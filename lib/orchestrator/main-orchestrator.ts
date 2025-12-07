// lib/orchestrator/main-orchestrator.ts
// Main orchestrator for C1-Thesys multi-provider AI system

import { generateObject, generateText, streamText, tool } from 'ai';
import { z } from 'zod';
import { registry, models } from '../providers/registry';
import { createWaveSpeedProvider } from '../providers/wavespeed-provider';
import { createMiniMaxProvider } from '../providers/minimax-provider';
import { executeWithProtection } from './error-handling';

// Task classification schema
const TaskPlanSchema = z.object({
  tasks: z.array(z.object({
    id: z.string(),
    type: z.enum(['text', 'image', 'video', 'analysis']),
    description: z.string(),
    provider: z.string(),
    model: z.string(),
    priority: z.number().min(1).max(10),
    dependsOn: z.array(z.string()).optional(),
    parameters: z.record(z.unknown()).optional(),
  })),
  executionStrategy: z.enum(['sequential', 'parallel', 'mixed']),
});

type TaskPlan = z.infer<typeof TaskPlanSchema>;
type Task = TaskPlan['tasks'][0];

// Initialize media providers (lazy initialization)
let wavespeedProvider: ReturnType<typeof createWaveSpeedProvider> | null = null;
let minimaxProvider: ReturnType<typeof createMiniMaxProvider> | null = null;

function getWaveSpeedProvider() {
  if (!wavespeedProvider && process.env.WAVESPEED_API_KEY) {
    wavespeedProvider = createWaveSpeedProvider({
      apiKey: process.env.WAVESPEED_API_KEY,
    });
  }
  return wavespeedProvider;
}

function getMiniMaxProvider() {
  if (!minimaxProvider && process.env.FAL_API_KEY) {
    minimaxProvider = createMiniMaxProvider({
      apiKey: process.env.FAL_API_KEY,
    });
  }
  return minimaxProvider;
}

// Tool definitions for the orchestrator
const orchestratorTools = {
  generateImage: tool({
    description: 'Generate an image using WaveSpeed or DALL-E',
    parameters: z.object({
      prompt: z.string(),
      provider: z.enum(['wavespeed', 'openai']).default('wavespeed'),
      model: z.string().default('flux-dev'),
      size: z.string().default('1024*1024'),
      quality: z.enum(['standard', 'hd']).default('standard'),
    }),
    execute: async ({ prompt, provider, model, size, quality }) => {
      if (provider === 'wavespeed') {
        const wavespeed = getWaveSpeedProvider();
        if (!wavespeed) {
          throw new Error('WaveSpeed API key not configured');
        }

        const result = await wavespeed.generateImage(model, {
          prompt,
          size,
        });
        return { success: true, urls: result.urls };
      } else {
        // Use OpenAI DALL-E 3
        if (!process.env.OPENAI_API_KEY) {
          throw new Error('OpenAI API key not configured');
        }

        const response = await fetch('https://api.openai.com/v1/images/generations', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'dall-e-3',
            prompt,
            size: size.replace('*', 'x') as '1024x1024' | '1024x1792' | '1792x1024',
            quality,
            n: 1,
          }),
        });

        if (!response.ok) {
          const error = await response.text();
          throw new Error(`OpenAI API error: ${error}`);
        }

        const data = await response.json() as { data: Array<{ url: string }> };
        return { success: true, urls: [data.data[0].url] };
      }
    },
  }),

  generateVideo: tool({
    description: 'Generate a video using MiniMax or WaveSpeed',
    parameters: z.object({
      prompt: z.string(),
      provider: z.enum(['minimax', 'wavespeed']).default('minimax'),
      model: z.string().default('video-01'),
      imageUrl: z.string().optional(),
      resolution: z.enum(['480p', '720p', '1080p']).default('720p'),
    }),
    execute: async ({ prompt, provider, model, imageUrl, resolution }) => {
      if (provider === 'minimax') {
        const minimax = getMiniMaxProvider();
        if (!minimax) {
          throw new Error('MiniMax API key not configured');
        }

        const result = await minimax.generateVideo({
          prompt,
          imageUrl,
        });
        return { success: true, url: result.url, duration: result.duration };
      } else {
        const wavespeed = getWaveSpeedProvider();
        if (!wavespeed) {
          throw new Error('WaveSpeed API key not configured');
        }

        const result = await wavespeed.generateVideo(model, {
          prompt,
          imageUrl,
          resolution,
        });
        return { success: true, url: result.url };
      }
    },
  }),

  analyzeContent: tool({
    description: 'Analyze text, images, or documents using text models',
    parameters: z.object({
      content: z.string(),
      analysisType: z.enum(['summarize', 'extract', 'classify', 'reason']),
      model: z.enum(['gpt-4o', 'gemini-2.0-flash-exp', 'kimi-k2']).default('gpt-4o'),
    }),
    execute: async ({ content, analysisType, model }) => {
      const modelMap: Record<string, string> = {
        'gpt-4o': 'openai:gpt-4o',
        'gemini-2.0-flash-exp': 'google:gemini-2.0-flash-exp',
        'kimi-k2': 'kimi:moonshot-v1-128k',
      };

      const systemPrompts: Record<string, string> = {
        summarize: 'Provide a concise summary of the content.',
        extract: 'Extract key information, entities, and facts.',
        classify: 'Classify the content type and intent.',
        reason: 'Analyze and reason about the content step by step.',
      };

      const { text } = await generateText({
        model: registry.languageModel(modelMap[model]),
        system: systemPrompts[analysisType],
        prompt: content,
      });

      return { success: true, result: text };
    },
  }),
};

/**
 * Main orchestrator class for C1-Thesys
 */
export class C1ThesysOrchestrator {
  private defaultTextModel = registry.languageModel('google:gemini-2.0-flash-exp');
  private planningModel = registry.languageModel('openai:gpt-4o');

  /**
   * Plan and execute a complex request with multiple tasks
   */
  async planAndExecute(userRequest: string): Promise<{
    plan: TaskPlan;
    results: Map<string, unknown>;
  }> {
    // Step 1: Generate execution plan
    const { object: plan } = await generateObject({
      model: this.planningModel,
      schema: TaskPlanSchema,
      system: `You are a task planner for an AI system with these capabilities:
        - Text generation: OpenAI GPT-4o/mini, Google Gemini 2.0, Kimi K2
        - Image generation: WaveSpeed (FLUX, Seedream), OpenAI DALL-E 3
        - Video generation: MiniMax Hailuo, WaveSpeed WAN 2.1

        Create an optimal execution plan for the user request.
        Consider task dependencies and choose providers based on:
        - Speed requirements: WaveSpeed for fast images, GPT-4o-mini for quick text
        - Quality requirements: DALL-E 3 HD for premium images, Gemini Pro for reasoning
        - Cost: GPT-4o-mini and Gemini Flash for budget-conscious tasks
        - Context length: Kimi K2 for very long documents (128K tokens)`,
      prompt: userRequest,
    });

    // Step 2: Execute tasks based on strategy
    const results = new Map<string, unknown>();

    if (plan.executionStrategy === 'parallel') {
      const taskPromises = plan.tasks.map(task => this.executeTask(task, results));
      const taskResults = await Promise.allSettled(taskPromises);

      plan.tasks.forEach((task, index) => {
        const result = taskResults[index];
        results.set(task.id, result.status === 'fulfilled' ? result.value : { error: result.reason });
      });
    } else {
      // Sequential or mixed execution
      for (const task of plan.tasks.sort((a, b) => a.priority - b.priority)) {
        // Check dependencies
        if (task.dependsOn?.some(depId => !results.has(depId))) {
          results.set(task.id, { error: 'Dependency not met' });
          continue;
        }

        try {
          const result = await this.executeTask(task, results);
          results.set(task.id, result);
        } catch (error) {
          results.set(task.id, { error: String(error) });
        }
      }
    }

    return { plan, results };
  }

  /**
   * Execute a single task
   */
  private async executeTask(
    task: Task,
    previousResults: Map<string, unknown>
  ): Promise<unknown> {
    switch (task.type) {
      case 'text':
        return this.executeTextTask(task);
      case 'image':
        return this.executeImageTask(task);
      case 'video':
        return this.executeVideoTask(task);
      case 'analysis':
        return this.executeAnalysisTask(task, previousResults);
      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }
  }

  /**
   * Execute a text generation task
   */
  private async executeTextTask(task: Task) {
    const modelId = `${task.provider}:${task.model}`;

    const result = await executeWithProtection(
      'text',
      async () => {
        const { text } = await generateText({
          model: registry.languageModel(modelId),
          prompt: task.description,
          ...(task.parameters as Record<string, unknown>),
        });
        return { text };
      }
    );

    return result.result;
  }

  /**
   * Execute an image generation task
   */
  private async executeImageTask(task: Task) {
    if (task.provider === 'wavespeed') {
      const wavespeed = getWaveSpeedProvider();
      if (!wavespeed) {
        throw new Error('WaveSpeed API key not configured');
      }

      return wavespeed.generateImage(task.model, {
        prompt: task.description,
        ...(task.parameters as Record<string, unknown>),
      });
    } else if (task.provider === 'openai') {
      // OpenAI DALL-E 3
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
      }

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt: task.description,
          size: '1024x1024',
          quality: 'hd',
          n: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      return response.json();
    }

    throw new Error(`Unknown image provider: ${task.provider}`);
  }

  /**
   * Execute a video generation task
   */
  private async executeVideoTask(task: Task) {
    if (task.provider === 'minimax') {
      const minimax = getMiniMaxProvider();
      if (!minimax) {
        throw new Error('MiniMax API key not configured');
      }

      return minimax.generateVideo({
        prompt: task.description,
        ...(task.parameters as { imageUrl?: string }),
      });
    } else if (task.provider === 'wavespeed') {
      const wavespeed = getWaveSpeedProvider();
      if (!wavespeed) {
        throw new Error('WaveSpeed API key not configured');
      }

      return wavespeed.generateVideo(task.model, {
        prompt: task.description,
        ...(task.parameters as { imageUrl?: string; resolution?: '480p' | '720p' | '1080p' }),
      });
    }

    throw new Error(`Unknown video provider: ${task.provider}`);
  }

  /**
   * Execute an analysis task
   */
  private async executeAnalysisTask(
    task: Task,
    previousResults: Map<string, unknown>
  ) {
    // Inject previous results into context
    const context = task.dependsOn
      ?.map(depId => JSON.stringify(previousResults.get(depId)))
      .join('\n');

    const { text } = await generateText({
      model: registry.languageModel(`${task.provider}:${task.model}`),
      prompt: `${task.description}\n\nContext:\n${context ?? 'None'}`,
    });

    return { analysis: text };
  }

  /**
   * Streaming interface for interactive chat
   */
  async streamResponse(
    messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
    options?: { model?: string; tools?: boolean }
  ) {
    const modelId = options?.model ?? 'google:gemini-2.0-flash-exp';

    return streamText({
      model: registry.languageModel(modelId),
      messages,
      tools: options?.tools ? orchestratorTools : undefined,
      maxSteps: 5,
    });
  }

  /**
   * Simple text generation
   */
  async generateText(prompt: string, options?: { model?: string }) {
    const modelId = options?.model ?? models.textFlash;

    const { text } = await generateText({
      model: registry.languageModel(modelId),
      prompt,
    });

    return text;
  }

  /**
   * Generate image using optimal provider
   */
  async generateImage(prompt: string, options?: {
    provider?: 'wavespeed' | 'openai';
    model?: string;
    size?: string;
    quality?: 'standard' | 'hd';
  }) {
    const provider = options?.provider ?? 'wavespeed';
    const model = options?.model ?? 'flux-dev';

    if (provider === 'wavespeed') {
      const wavespeed = getWaveSpeedProvider();
      if (!wavespeed) {
        throw new Error('WaveSpeed API key not configured');
      }

      return wavespeed.generateImage(model, {
        prompt,
        size: options?.size ?? '1024*1024',
      });
    } else {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error('OpenAI API key not configured');
      }

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt,
          size: (options?.size?.replace('*', 'x') ?? '1024x1024') as '1024x1024',
          quality: options?.quality ?? 'standard',
          n: 1,
        }),
      });

      const data = await response.json() as { data: Array<{ url: string }> };
      return { urls: [data.data[0].url], executionTime: 0 };
    }
  }

  /**
   * Generate video using optimal provider
   */
  async generateVideo(prompt: string, options?: {
    provider?: 'minimax' | 'wavespeed';
    model?: string;
    imageUrl?: string;
    resolution?: '480p' | '720p' | '1080p';
  }) {
    const provider = options?.provider ?? 'minimax';

    if (provider === 'minimax') {
      const minimax = getMiniMaxProvider();
      if (!minimax) {
        throw new Error('MiniMax API key not configured');
      }

      return minimax.generateVideo({
        prompt,
        imageUrl: options?.imageUrl,
      });
    } else {
      const wavespeed = getWaveSpeedProvider();
      if (!wavespeed) {
        throw new Error('WaveSpeed API key not configured');
      }

      return wavespeed.generateVideo(options?.model ?? 'wan-2.1-t2v-720p', {
        prompt,
        imageUrl: options?.imageUrl,
        resolution: options?.resolution ?? '720p',
      });
    }
  }
}

// Export a singleton instance
export const orchestrator = new C1ThesysOrchestrator();
