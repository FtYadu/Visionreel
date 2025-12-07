// lib/providers/registry.ts
// Unified provider registry integrating all AI providers

import { experimental_createProviderRegistry as createProviderRegistry } from 'ai';
import { openai } from '@ai-sdk/openai';
import { google } from '@ai-sdk/google';
import { createOpenAI as createOpenAICompatible } from '@ai-sdk/openai';

// Kimi uses OpenAI-compatible API
const kimi = createOpenAICompatible({
  name: 'kimi',
  apiKey: process.env.KIMI_API_KEY ?? '',
  baseURL: 'https://api.moonshot.cn/v1',
});

// Create the provider registry with all text/chat providers
export const registry = createProviderRegistry({
  // Native Vercel AI SDK providers
  openai,
  google,

  // OpenAI-compatible provider
  kimi,
});

// Model aliases for convenience
export const models = {
  // Text models
  textFast: 'openai:gpt-4o-mini',
  textSmart: 'google:gemini-2.0-flash-exp',
  textFlash: 'google:gemini-2.0-flash-exp',
  textLongContext: 'kimi:moonshot-v1-128k',

  // Image model identifiers (handled by custom providers)
  imageDefault: 'wavespeed:flux-dev',
  imageFast: 'wavespeed:flux-dev-ultra-fast',
  imageHD: 'openai:dall-e-3',

  // Video model identifiers (handled by custom providers)
  videoDefault: 'minimax:video-01',
  videoFast: 'wavespeed:wan-2.1-t2v-480p',
  videoHD: 'wavespeed:wan-2.1-t2v-720p',
};

// Helper function to get a language model
export function getLanguageModel(modelId: string) {
  return registry.languageModel(modelId);
}

// Model information for routing decisions
export const modelInfo = {
  text: {
    'openai:gpt-4o': {
      contextWindow: 128000,
      pricing: { input: 2.50, output: 10.00 },
      strengths: ['reasoning', 'coding', 'multimodal'],
    },
    'openai:gpt-4o-mini': {
      contextWindow: 128000,
      pricing: { input: 0.15, output: 0.60 },
      strengths: ['speed', 'cost-effective', 'simple-tasks'],
    },
    'google:gemini-2.0-flash-exp': {
      contextWindow: 1000000,
      pricing: { input: 0.30, output: 2.50 },
      strengths: ['long-context', 'speed', 'multimodal'],
    },
    'google:gemini-2.0-flash-thinking-exp': {
      contextWindow: 32000,
      pricing: { input: 0.30, output: 2.50 },
      strengths: ['reasoning', 'thinking-budget', 'complex-problems'],
    },
    'kimi:moonshot-v1-128k': {
      contextWindow: 128000,
      pricing: { input: 0.60, output: 2.50 },
      strengths: ['long-context', 'chinese', 'cost-effective'],
    },
  },
  image: {
    'wavespeed:flux-dev': {
      avgTime: 2,
      pricing: 0.03,
      strengths: ['speed', 'quality', 'versatile'],
    },
    'wavespeed:flux-dev-ultra-fast': {
      avgTime: 1,
      pricing: 0.02,
      strengths: ['ultra-fast', 'good-quality'],
    },
    'openai:dall-e-3': {
      avgTime: 10,
      pricing: 0.08,
      strengths: ['high-quality', 'prompt-following', 'safety'],
    },
  },
  video: {
    'minimax:video-01': {
      duration: [6, 10],
      resolution: ['768P', '1080P'],
      pricing: 0.33,
      strengths: ['quality', 'native-video', 'prompt-optimizer'],
    },
    'wavespeed:wan-2.1-t2v-720p': {
      duration: [6],
      resolution: ['720p'],
      pricing: 0.30,
      strengths: ['speed', 'cost-effective'],
    },
  },
};
