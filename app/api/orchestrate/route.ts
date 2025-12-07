// app/api/orchestrate/route.ts
// Main orchestration endpoint for C1-Thesys

import { C1ThesysOrchestrator } from '@/lib/orchestrator/main-orchestrator';

export const maxDuration = 300; // 5 minutes for video generation
export const runtime = 'nodejs';

const orchestrator = new C1ThesysOrchestrator();

/**
 * POST /api/orchestrate
 *
 * Main endpoint for orchestrating multi-provider AI tasks
 *
 * Request body:
 * - request: string - The user's request to process
 * - stream: boolean (optional) - Whether to stream the response
 * - model: string (optional) - Override the default model
 * - tools: boolean (optional) - Enable tool use for interactive chat
 *
 * Response:
 * - For streaming: Data stream with results
 * - For non-streaming: JSON with plan and results
 */
export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      request: string;
      stream?: boolean;
      model?: string;
      tools?: boolean;
      messages?: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>;
    };

    if (!body.request && !body.messages) {
      return Response.json(
        { error: 'Either "request" or "messages" is required' },
        { status: 400 }
      );
    }

    // Streaming mode for interactive chat
    if (body.stream) {
      const messages = body.messages ?? [
        { role: 'user' as const, content: body.request }
      ];

      const result = await orchestrator.streamResponse(messages, {
        model: body.model,
        tools: body.tools ?? true,
      });

      return result.toDataStreamResponse();
    }

    // Full orchestration with planning
    const { plan, results } = await orchestrator.planAndExecute(body.request);

    return Response.json({
      success: true,
      plan,
      results: Object.fromEntries(results),
    });
  } catch (error) {
    console.error('Orchestration error:', error);
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orchestrate
 *
 * Health check endpoint
 */
export async function GET() {
  return Response.json({
    status: 'operational',
    version: '1.0.0',
    providers: {
      openai: !!process.env.OPENAI_API_KEY,
      google: !!process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      kimi: !!process.env.KIMI_API_KEY,
      wavespeed: !!process.env.WAVESPEED_API_KEY,
      minimax: !!process.env.FAL_API_KEY || !!process.env.MINIMAX_API_KEY,
    },
  });
}
