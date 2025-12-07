# C1-Thesys VisionReel: Multi-Provider AI Orchestration System

A production-ready Next.js application that orchestrates **six AI providers** for text, image, and video generation. Built on the Vercel AI SDK with custom providers for specialized media generation.

## 🚀 Features

- **Multi-Provider Text Generation**: OpenAI GPT-4o, Google Gemini 2.0, Kimi/Moonshot
- **Advanced Image Generation**: WaveSpeed (FLUX, Seedream), OpenAI DALL-E 3
- **Professional Video Generation**: MiniMax Hailuo, WaveSpeed WAN 2.x
- **Intelligent Task Routing**: Automatic provider selection based on requirements
- **Built-in Resilience**: Circuit breakers, rate limiting, and fallback handling
- **Streaming Support**: Real-time responses for interactive applications
- **Type-Safe**: Full TypeScript implementation with Zod validation

## 📋 Prerequisites

- Node.js 18+ and npm
- API keys for desired providers (see Configuration section)

## 🛠️ Installation

1. **Clone and install dependencies:**

```bash
npm install
```

2. **Configure environment variables:**

Copy `.env.example` to `.env.local` and add your API keys:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Required for text generation
OPENAI_API_KEY=sk-...
GOOGLE_GENERATIVE_AI_API_KEY=AIza...

# Optional: Additional text providers
KIMI_API_KEY=sk-...

# Required for image generation
WAVESPEED_API_KEY=ws_...

# Required for video generation
FAL_API_KEY=fal_...
# OR
MINIMAX_API_KEY=...

# Optional: Feature flags
RATE_LIMIT_ENABLED=true
FALLBACK_ENABLED=true
```

3. **Run the development server:**

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see your app.

## 🔑 API Key Setup

### OpenAI
Get your API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

### Google Gemini
Get your API key from [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)

### Kimi/Moonshot (Optional)
Get your API key from [platform.moonshot.cn](https://platform.moonshot.cn)

### WaveSpeed
Sign up at [wavespeed.ai](https://wavespeed.ai) and get your API key

### MiniMax via fal.ai
Get your fal.ai API key from [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys)

## 📡 API Endpoints

### 1. Main Orchestration (`/api/orchestrate`)

Intelligent task planning and execution across multiple providers.

**POST Request:**

```typescript
// Full orchestration with planning
const response = await fetch('/api/orchestrate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    request: 'Create a promotional video for a coffee shop with background music',
  }),
});

const { plan, results } = await response.json();
```

**Streaming Mode:**

```typescript
const response = await fetch('/api/orchestrate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    request: 'Explain quantum computing',
    stream: true,
    tools: true,
  }),
});

// Handle streaming response
const reader = response.body.getReader();
while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  // Process streaming data
}
```

**GET Request (Health Check):**

```bash
curl http://localhost:3000/api/orchestrate
```

Returns provider availability status.

### 2. Image Generation (`/api/generate/image`)

Direct image generation endpoint.

**Generate with WaveSpeed (Fast):**

```typescript
const response = await fetch('/api/generate/image', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'A serene mountain landscape at sunset',
    provider: 'wavespeed',
    model: 'flux-dev',
    size: '1024*1024',
  }),
});

const { urls, executionTime } = await response.json();
console.log('Generated image:', urls[0]);
```

**Generate with DALL-E 3 (High Quality):**

```typescript
const response = await fetch('/api/generate/image', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'A futuristic cityscape with flying cars',
    provider: 'openai',
    quality: 'hd',
  }),
});
```

**Available Models:**

```bash
curl http://localhost:3000/api/generate/image
```

### 3. Video Generation (`/api/generate/video`)

Direct video generation endpoint (may take 1-5 minutes).

**Text-to-Video with MiniMax:**

```typescript
const response = await fetch('/api/generate/video', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'A cat playing piano in a jazz club',
    provider: 'minimax',
    duration: 6,
  }),
});

const { url, duration, executionTime } = await response.json();
console.log('Video URL:', url);
```

**Image-to-Video:**

```typescript
const response = await fetch('/api/generate/video', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Camera zooms into the house',
    provider: 'wavespeed',
    imageUrl: 'https://example.com/image.jpg',
    resolution: '720p',
  }),
});
```

**Available Models:**

```bash
curl http://localhost:3000/api/generate/video
```

## 🧩 Usage Examples

### Programmatic Usage

```typescript
import { orchestrator } from '@/lib/orchestrator/main-orchestrator';

// Simple text generation
const text = await orchestrator.generateText(
  'Explain the benefits of Next.js',
  { model: 'google:gemini-2.0-flash-exp' }
);

// Image generation
const image = await orchestrator.generateImage(
  'A beautiful sunset over the ocean',
  {
    provider: 'wavespeed',
    model: 'flux-dev',
    size: '1024*1024',
  }
);

// Video generation
const video = await orchestrator.generateVideo(
  'A time-lapse of a flower blooming',
  {
    provider: 'minimax',
    duration: 6,
  }
);

// Complex orchestration
const { plan, results } = await orchestrator.planAndExecute(
  'Create a marketing campaign with images and videos for a new product'
);
```

### Streaming Chat Interface

```typescript
import { orchestrator } from '@/lib/orchestrator/main-orchestrator';

const messages = [
  { role: 'user', content: 'Generate an image of a futuristic car' },
];

const stream = await orchestrator.streamResponse(messages, {
  tools: true,
  model: 'google:gemini-2.0-flash-exp',
});

// Use with Vercel AI SDK's useChat hook
for await (const chunk of stream.textStream) {
  process.stdout.write(chunk);
}
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│          C1-Thesys Orchestrator                 │
│  ┌───────────────────────────────────────┐     │
│  │     Task Planning Engine (GPT-4o)     │     │
│  │  • Request Analysis                   │     │
│  │  • Provider Selection                 │     │
│  │  • Cost Optimization                  │     │
│  └───────────────────────────────────────┘     │
│                     │                           │
│        ┌────────────┴────────────┐             │
│        ▼                         ▼              │
│  Sequential Executor    Parallel Executor      │
└─────────────────────────────────────────────────┘
               │
   ┌───────────┼───────────┐
   ▼           ▼           ▼
┌──────┐  ┌────────┐  ┌────────┐
│ Text │  │ Image  │  │ Video  │
│      │  │        │  │        │
│OpenAI│  │WaveSpd │  │MiniMax │
│Gemini│  │DALL-E  │  │WaveSpd │
│ Kimi │  │        │  │        │
└──────┘  └────────┘  └────────┘
```

## 📊 Provider Comparison

### Text Generation

| Provider | Model | Context | Pricing (per 1M tokens) | Best For |
|----------|-------|---------|------------------------|----------|
| OpenAI | GPT-4o | 128K | $2.50 / $10.00 | Reasoning, coding |
| OpenAI | GPT-4o-mini | 128K | $0.15 / $0.60 | Fast, cost-effective |
| Google | Gemini 2.0 Flash | 1M | $0.30 / $2.50 | Long context, speed |
| Kimi | Moonshot K2 | 128K | $0.60 / $2.50 | Chinese, long docs |

### Image Generation

| Provider | Model | Avg Time | Cost | Best For |
|----------|-------|----------|------|----------|
| WaveSpeed | FLUX Dev | ~2s | $0.03 | Speed, quality |
| WaveSpeed | FLUX Ultra Fast | ~1s | $0.02 | Ultra-fast |
| OpenAI | DALL-E 3 | ~10s | $0.08 | High quality, safety |

### Video Generation

| Provider | Model | Duration | Resolution | Cost | Best For |
|----------|-------|----------|------------|------|----------|
| MiniMax | Hailuo-02 | 6-10s | 1080P | $0.33 | Quality, native |
| WaveSpeed | WAN 2.1 | 6s | 720p | $0.30 | Speed, cost |

## 🛡️ Error Handling

The system includes comprehensive error handling:

- **Circuit Breaker**: Automatically disables failing providers
- **Rate Limiting**: Prevents API quota exhaustion
- **Automatic Fallbacks**: Routes to alternative providers on failure
- **Exponential Backoff**: Smart retry logic for transient errors

```typescript
import { executeWithProtection } from '@/lib/orchestrator/error-handling';

// Automatic fallback and retry
const result = await executeWithProtection(
  'text',
  async (providerId) => {
    // Your API call
  },
  {
    onFallback: (error, nextProvider) => {
      console.log(`Falling back to ${nextProvider} due to:`, error);
    },
  }
);
```

## 🔧 Configuration

### Rate Limits

Customize rate limits in `lib/orchestrator/error-handling.ts`:

```typescript
const rateLimiter = new RateLimitedQueue();
rateLimiter.setLimit('openai', 1000); // 1000 requests per minute
```

### Circuit Breaker

Configure thresholds:

```typescript
const circuitBreaker = new CircuitBreaker();
// Opens after 5 failures, resets after 60 seconds
```

### Model Aliases

Customize model aliases in `lib/providers/registry.ts`:

```typescript
export const models = {
  textFast: 'openai:gpt-4o-mini',
  textSmart: 'google:gemini-2.0-flash-exp',
  imageDefault: 'wavespeed:flux-dev',
  videoDefault: 'minimax:video-01',
};
```

## 📝 Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OPENAI_API_KEY` | Yes | OpenAI API key for GPT models and DALL-E |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | Google API key for Gemini models |
| `KIMI_API_KEY` | No | Moonshot AI key for Kimi models |
| `WAVESPEED_API_KEY` | No | WaveSpeed key for image/video generation |
| `FAL_API_KEY` | No | fal.ai key for MiniMax video (recommended) |
| `MINIMAX_API_KEY` | No | Direct MiniMax API key (alternative) |
| `RATE_LIMIT_ENABLED` | No | Enable rate limiting (default: true) |
| `FALLBACK_ENABLED` | No | Enable fallbacks (default: true) |

## 🚀 Deployment

### Vercel (Recommended)

```bash
npm install -g vercel
vercel
```

Add environment variables in Vercel dashboard:
1. Go to your project settings
2. Navigate to Environment Variables
3. Add all required API keys

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

```bash
docker build -t c1-thesys .
docker run -p 3000:3000 --env-file .env.local c1-thesys
```

## 📚 Project Structure

```
.
├── app/
│   └── api/
│       ├── orchestrate/
│       │   └── route.ts          # Main orchestration endpoint
│       └── generate/
│           ├── image/
│           │   └── route.ts      # Image generation endpoint
│           └── video/
│               └── route.ts      # Video generation endpoint
├── lib/
│   ├── providers/
│   │   ├── registry.ts           # Provider registry
│   │   ├── wavespeed-provider.ts # WaveSpeed implementation
│   │   └── minimax-provider.ts   # MiniMax implementation
│   └── orchestrator/
│       ├── main-orchestrator.ts  # Main orchestrator class
│       └── error-handling.ts     # Error handling & resilience
├── package.json
├── tsconfig.json
├── next.config.js
└── README.md
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - feel free to use this in your projects!

## 🙏 Acknowledgments

Built with:
- [Vercel AI SDK](https://sdk.vercel.ai)
- [Next.js](https://nextjs.org)
- [OpenAI](https://openai.com)
- [Google Gemini](https://ai.google.dev)
- [WaveSpeed AI](https://wavespeed.ai)
- [MiniMax](https://www.minimaxi.com)

---

**Note**: This is a production-ready implementation of the C1-Thesys Technical Implementation Plan. For questions or issues, please open a GitHub issue.
