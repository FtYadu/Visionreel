// lib/providers/wavespeed-provider.ts
// Custom provider for WaveSpeed AI image and video generation

interface WaveSpeedProviderSettings {
  apiKey: string;
  baseURL?: string;
  pollInterval?: number;
  timeout?: number;
}

interface ImageGenerationOptions {
  prompt: string;
  size?: string;
  numInferenceSteps?: number;
  guidanceScale?: number;
  numImages?: number;
  seed?: number;
  loras?: Array<{ path: string; scale: number }>;
  outputFormat?: 'jpeg' | 'png';
  enableSafetyChecker?: boolean;
}

interface VideoGenerationOptions {
  prompt: string;
  imageUrl?: string; // For image-to-video
  resolution?: '480p' | '720p' | '1080p';
  duration?: number;
  seed?: number;
}

interface PredictionResponse {
  id: string;
  status: 'starting' | 'processing' | 'completed' | 'failed';
  outputs?: string[];
  output?: string;
  error?: string;
  execution_time?: number;
}

export function createWaveSpeedProvider(settings: WaveSpeedProviderSettings) {
  const baseURL = settings.baseURL ?? 'https://api.wavespeed.ai/api/v2';
  const pollInterval = settings.pollInterval ?? 2000;
  const timeout = settings.timeout ?? 300000; // 5 minutes

  async function createPrediction(
    endpoint: string,
    input: Record<string, unknown>
  ): Promise<PredictionResponse> {
    const response = await fetch(`${baseURL}/predictions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: endpoint,
        input,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`WaveSpeed API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async function getPrediction(id: string): Promise<PredictionResponse> {
    const response = await fetch(`${baseURL}/predictions/${id}`, {
      headers: {
        'Authorization': `Bearer ${settings.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get prediction: ${response.status}`);
    }

    return response.json();
  }

  async function pollUntilComplete(predictionId: string): Promise<PredictionResponse> {
    const startTime = Date.now();

    while (true) {
      const prediction = await getPrediction(predictionId);

      if (prediction.status === 'completed') {
        return prediction;
      }

      if (prediction.status === 'failed') {
        throw new Error(prediction.error ?? 'Generation failed');
      }

      if (Date.now() - startTime > timeout) {
        throw new Error('Generation timeout');
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  return {
    async generateImage(
      modelId: string,
      options: ImageGenerationOptions
    ): Promise<{ urls: string[]; executionTime: number }> {
      const input: Record<string, unknown> = {
        prompt: options.prompt,
        width: options.size?.split('*')[0] ?? '1024',
        height: options.size?.split('*')[1] ?? '1024',
        num_inference_steps: options.numInferenceSteps ?? 28,
        guidance_scale: options.guidanceScale ?? 5.0,
        num_outputs: options.numImages ?? 1,
        seed: options.seed ?? -1,
        output_format: options.outputFormat ?? 'jpeg',
        enable_safety_checker: options.enableSafetyChecker ?? true,
      };

      if (options.loras && options.loras.length > 0) {
        input.loras = options.loras;
      }

      const prediction = await createPrediction(`wavespeed-ai/${modelId}`, input);
      const result = await pollUntilComplete(prediction.id);

      return {
        urls: result.outputs ?? (result.output ? [result.output] : []),
        executionTime: result.execution_time ?? 0,
      };
    },

    async generateVideo(
      modelId: string,
      options: VideoGenerationOptions
    ): Promise<{ url: string; executionTime: number }> {
      const input: Record<string, unknown> = {
        prompt: options.prompt,
        seed: options.seed ?? -1,
      };

      // Image-to-video mode
      if (options.imageUrl) {
        input.image_url = options.imageUrl;
      }

      // Resolution-specific endpoints
      const endpoint = options.imageUrl
        ? `wan-2.1-i2v-${options.resolution ?? '720p'}`
        : modelId;

      const prediction = await createPrediction(`wavespeed-ai/${endpoint}`, input);
      const result = await pollUntilComplete(prediction.id);

      const outputUrl = result.outputs?.[0] ?? result.output;
      if (!outputUrl) {
        throw new Error('No video output generated');
      }

      return {
        url: outputUrl,
        executionTime: result.execution_time ?? 0,
      };
    },

    // Manual polling for custom control
    async createAndPoll(
      endpoint: string,
      input: Record<string, unknown>,
      onProgress?: (status: string) => void
    ): Promise<{ outputs: string[]; executionTime: number }> {
      const prediction = await createPrediction(endpoint, input);

      const startTime = Date.now();
      let current = prediction;

      while (current.status !== 'completed' && current.status !== 'failed') {
        if (Date.now() - startTime > timeout) {
          throw new Error('Generation timeout');
        }

        await new Promise(resolve => setTimeout(resolve, pollInterval));
        current = await getPrediction(prediction.id);
        onProgress?.(current.status);
      }

      if (current.status === 'failed') {
        throw new Error(current.error ?? 'Generation failed');
      }

      return {
        outputs: current.outputs ?? (current.output ? [current.output] : []),
        executionTime: current.execution_time ?? 0,
      };
    },
  };
}

export type WaveSpeedProvider = ReturnType<typeof createWaveSpeedProvider>;
