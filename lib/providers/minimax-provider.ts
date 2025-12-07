// lib/providers/minimax-provider.ts
// Custom provider for MiniMax video and image generation via fal.ai

import { fal } from '@fal-ai/client';

interface MiniMaxProviderSettings {
  apiKey: string; // fal.ai API key
  resourceMode?: 'url' | 'base64';
}

interface VideoGenerationOptions {
  prompt: string;
  imageUrl?: string; // First frame for I2V
  promptOptimizer?: boolean;
  duration?: 6 | 10;
  resolution?: '768P' | '1080P';
}

interface ImageGenerationOptions {
  prompt: string;
  aspectRatio?: '1:1' | '16:9' | '4:3' | '9:16';
  numImages?: number;
  promptOptimizer?: boolean;
}

interface VideoResult {
  url: string;
  duration: number;
}

interface ImageResult {
  urls: string[];
}

export function createMiniMaxProvider(settings: MiniMaxProviderSettings) {
  // Configure fal.ai client
  fal.config({ credentials: settings.apiKey });

  return {
    async generateVideo(
      options: VideoGenerationOptions,
      onProgress?: (logs: string[]) => void
    ): Promise<VideoResult> {
      const modelEndpoint = options.imageUrl
        ? 'fal-ai/minimax/video-01/image-to-video'
        : 'fal-ai/minimax/video-01';

      const input: Record<string, unknown> = {
        prompt: options.prompt,
        prompt_optimizer: options.promptOptimizer ?? true,
      };

      if (options.imageUrl) {
        input.image_url = options.imageUrl;
      }

      try {
        const result = await fal.subscribe(modelEndpoint, {
          input,
          logs: true,
          onQueueUpdate: (update) => {
            if (update.status === 'IN_PROGRESS' && onProgress) {
              const logMessages = (update.logs || []).map((log: { message: string }) => log.message);
              onProgress(logMessages);
            }
          },
        }) as { data: { video: { url: string; duration?: number } } };

        return {
          url: result.data.video.url,
          duration: result.data.video.duration ?? 6,
        };
      } catch (error) {
        throw new Error(`MiniMax video generation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    },

    async generateImage(
      options: ImageGenerationOptions
    ): Promise<ImageResult> {
      const input = {
        prompt: options.prompt,
        aspect_ratio: options.aspectRatio ?? '16:9',
        num_images: options.numImages ?? 1,
        prompt_optimizer: options.promptOptimizer ?? true,
      };

      try {
        const result = await fal.subscribe('fal-ai/minimax/image-01', {
          input,
        }) as { data: { images: Array<{ url: string }> } };

        return {
          urls: result.data.images.map((img) => img.url),
        };
      } catch (error) {
        throw new Error(`MiniMax image generation failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    },

    // Direct REST API alternative (no fal.ai dependency)
    async generateVideoREST(
      options: VideoGenerationOptions
    ): Promise<{ taskId: string }> {
      if (!process.env.MINIMAX_API_KEY) {
        throw new Error('MINIMAX_API_KEY environment variable is required');
      }

      const response = await fetch(
        'https://api.minimax.chat/v1/video_generation',
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'video-01',
            prompt: options.prompt,
            first_frame_image: options.imageUrl,
            prompt_optimizer: options.promptOptimizer ?? true,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`MiniMax API error: ${response.status} - ${error}`);
      }

      const data = await response.json() as { task_id: string };
      return { taskId: data.task_id };
    },

    async pollVideoStatus(taskId: string): Promise<{
      status: string;
      fileId?: string;
      url?: string;
    }> {
      if (!process.env.MINIMAX_API_KEY) {
        throw new Error('MINIMAX_API_KEY environment variable is required');
      }

      const response = await fetch(
        `https://api.minimax.chat/v1/query/video_generation?task_id=${taskId}`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to poll video status: ${response.status}`);
      }

      const data = await response.json() as {
        status: string;
        file_id?: string;
      };

      if (data.status === 'Success' && data.file_id) {
        // Fetch actual URL
        const fileResponse = await fetch(
          `https://api.minimax.chat/v1/files/retrieve?file_id=${data.file_id}`,
          {
            headers: {
              'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
            },
          }
        );

        if (!fileResponse.ok) {
          throw new Error(`Failed to retrieve file: ${fileResponse.status}`);
        }

        const fileData = await fileResponse.json() as {
          file: { download_url: string };
        };

        return {
          status: 'completed',
          url: fileData.file.download_url,
          fileId: data.file_id,
        };
      }

      return { status: data.status, fileId: data.file_id };
    },

    // Helper to generate video and wait for completion (REST API)
    async generateVideoRESTComplete(
      options: VideoGenerationOptions,
      maxWaitTime: number = 300000 // 5 minutes
    ): Promise<string> {
      const { taskId } = await this.generateVideoREST(options);

      const startTime = Date.now();
      while (Date.now() - startTime < maxWaitTime) {
        const status = await this.pollVideoStatus(taskId);

        if (status.status === 'completed' && status.url) {
          return status.url;
        }

        if (status.status === 'failed') {
          throw new Error('Video generation failed');
        }

        // Wait 3 seconds before next poll
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

      throw new Error('Video generation timeout');
    },
  };
}

export type MiniMaxProvider = ReturnType<typeof createMiniMaxProvider>;
