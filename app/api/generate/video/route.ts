// app/api/generate/video/route.ts
// Dedicated video generation endpoint

import { orchestrator } from '@/lib/orchestrator/main-orchestrator';

export const maxDuration = 300; // 5 minutes for video generation
export const runtime = 'nodejs';

/**
 * POST /api/generate/video
 *
 * Generate videos using MiniMax or WaveSpeed
 *
 * Request body:
 * - prompt: string - Description of the video to generate
 * - provider: 'minimax' | 'wavespeed' (optional, default: minimax)
 * - model: string (optional, default: video-01 for minimax, wan-2.1-t2v-720p for wavespeed)
 * - imageUrl: string (optional) - First frame image URL for image-to-video
 * - resolution: '480p' | '720p' | '1080p' (optional, default: 720p, only for wavespeed)
 * - duration: 6 | 10 (optional, default: 6, only for minimax)
 *
 * Response:
 * - success: boolean
 * - url: string - Generated video URL
 * - duration: number - Video duration in seconds
 * - executionTime: number - Time taken in seconds
 * - provider: string - Provider used
 */
export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      prompt: string;
      provider?: 'minimax' | 'wavespeed';
      model?: string;
      imageUrl?: string;
      resolution?: '480p' | '720p' | '1080p';
      duration?: 6 | 10;
    };

    if (!body.prompt) {
      return Response.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const provider = body.provider ?? 'minimax';
    const startTime = Date.now();

    const result = await orchestrator.generateVideo(body.prompt, {
      provider,
      model: body.model,
      imageUrl: body.imageUrl,
      resolution: body.resolution,
    });

    const executionTime = (Date.now() - startTime) / 1000;

    return Response.json({
      success: true,
      url: result.url,
      duration: result.duration,
      executionTime,
      provider,
    });
  } catch (error) {
    console.error('Video generation error:', error);
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
 * GET /api/generate/video
 *
 * Get available video generation models and providers
 */
export async function GET() {
  return Response.json({
    providers: {
      minimax: {
        available: !!process.env.FAL_API_KEY || !!process.env.MINIMAX_API_KEY,
        models: ['video-01', 'hailuo-02'],
        supportedDurations: [6, 10],
        supportedResolutions: ['768P', '1080P'],
        features: ['text-to-video', 'image-to-video', 'prompt-optimizer'],
        avgGenerationTime: '60-120s',
      },
      wavespeed: {
        available: !!process.env.WAVESPEED_API_KEY,
        models: [
          'wan-2.1-t2v-480p',
          'wan-2.1-t2v-720p',
          'wan-2.5-t2v-720p',
          'wan-2.1-i2v-480p',
          'wan-2.1-i2v-720p',
        ],
        supportedResolutions: ['480p', '720p'],
        features: ['text-to-video', 'image-to-video', 'camera-control'],
        avgGenerationTime: '30-60s',
      },
    },
  });
}
