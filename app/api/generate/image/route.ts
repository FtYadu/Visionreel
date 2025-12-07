// app/api/generate/image/route.ts
// Dedicated image generation endpoint

import { orchestrator } from '@/lib/orchestrator/main-orchestrator';

export const maxDuration = 60; // 1 minute timeout
export const runtime = 'nodejs';

/**
 * POST /api/generate/image
 *
 * Generate images using WaveSpeed or OpenAI DALL-E
 *
 * Request body:
 * - prompt: string - Description of the image to generate
 * - provider: 'wavespeed' | 'openai' (optional, default: wavespeed)
 * - model: string (optional, default: flux-dev for wavespeed, dall-e-3 for openai)
 * - size: string (optional, default: 1024*1024)
 * - quality: 'standard' | 'hd' (optional, default: standard, only for openai)
 * - numImages: number (optional, default: 1, only for wavespeed)
 *
 * Response:
 * - success: boolean
 * - urls: string[] - Array of generated image URLs
 * - executionTime: number - Time taken in seconds
 * - provider: string - Provider used
 */
export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      prompt: string;
      provider?: 'wavespeed' | 'openai';
      model?: string;
      size?: string;
      quality?: 'standard' | 'hd';
      numImages?: number;
    };

    if (!body.prompt) {
      return Response.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const provider = body.provider ?? 'wavespeed';
    const startTime = Date.now();

    const result = await orchestrator.generateImage(body.prompt, {
      provider,
      model: body.model,
      size: body.size,
      quality: body.quality,
    });

    const executionTime = (Date.now() - startTime) / 1000;

    return Response.json({
      success: true,
      urls: result.urls,
      executionTime,
      provider,
    });
  } catch (error) {
    console.error('Image generation error:', error);
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
 * GET /api/generate/image
 *
 * Get available image generation models and providers
 */
export async function GET() {
  return Response.json({
    providers: {
      wavespeed: {
        available: !!process.env.WAVESPEED_API_KEY,
        models: [
          'flux-dev',
          'flux-dev-ultra-fast',
          'flux-schnell',
          'seedream-v4',
          'flux-kontext-pro',
        ],
        defaultSize: '1024*1024',
        avgGenerationTime: '2s',
      },
      openai: {
        available: !!process.env.OPENAI_API_KEY,
        models: ['dall-e-3'],
        supportedSizes: ['1024x1024', '1024x1792', '1792x1024'],
        qualities: ['standard', 'hd'],
        avgGenerationTime: '10s',
      },
    },
  });
}
