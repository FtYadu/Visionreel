// app/page.tsx
// Main landing page for C1-Thesys VisionReel

export default function Home() {
  return (
    <main className="min-h-screen p-8 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-16">
          <h1 className="text-5xl font-bold text-white mb-4">
            C1-Thesys VisionReel
          </h1>
          <p className="text-xl text-purple-300">
            Multi-Provider AI Orchestration System
          </p>
          <p className="text-lg text-slate-400 mt-2">
            6 Providers • Text • Image • Video Generation
          </p>
        </header>

        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-purple-500/30">
            <h2 className="text-2xl font-bold text-white mb-3">Text Generation</h2>
            <ul className="text-slate-300 space-y-2">
              <li>• OpenAI GPT-4o</li>
              <li>• Google Gemini 2.0</li>
              <li>• Kimi/Moonshot</li>
            </ul>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-purple-500/30">
            <h2 className="text-2xl font-bold text-white mb-3">Image Generation</h2>
            <ul className="text-slate-300 space-y-2">
              <li>• WaveSpeed FLUX</li>
              <li>• OpenAI DALL-E 3</li>
              <li>• &lt;2s generation</li>
            </ul>
          </div>

          <div className="bg-white/10 backdrop-blur-lg rounded-lg p-6 border border-purple-500/30">
            <h2 className="text-2xl font-bold text-white mb-3">Video Generation</h2>
            <ul className="text-slate-300 space-y-2">
              <li>• MiniMax Hailuo</li>
              <li>• WaveSpeed WAN 2.x</li>
              <li>• Up to 1080p</li>
            </ul>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-lg rounded-lg p-8 border border-purple-500/30 mb-12">
          <h2 className="text-3xl font-bold text-white mb-6">API Endpoints</h2>

          <div className="space-y-4">
            <div className="bg-slate-800/50 rounded-lg p-4">
              <h3 className="text-xl font-semibold text-purple-300 mb-2">
                POST /api/orchestrate
              </h3>
              <p className="text-slate-300 mb-3">
                Intelligent multi-provider task orchestration with automatic planning
              </p>
              <code className="block bg-slate-900 p-3 rounded text-sm text-green-400 overflow-x-auto">
{`fetch('/api/orchestrate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    request: 'Create a marketing campaign for my product'
  })
})`}
              </code>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4">
              <h3 className="text-xl font-semibold text-purple-300 mb-2">
                POST /api/generate/image
              </h3>
              <p className="text-slate-300 mb-3">
                Direct image generation with WaveSpeed or DALL-E
              </p>
              <code className="block bg-slate-900 p-3 rounded text-sm text-green-400 overflow-x-auto">
{`fetch('/api/generate/image', {
  method: 'POST',
  body: JSON.stringify({
    prompt: 'A serene mountain landscape',
    provider: 'wavespeed'
  })
})`}
              </code>
            </div>

            <div className="bg-slate-800/50 rounded-lg p-4">
              <h3 className="text-xl font-semibold text-purple-300 mb-2">
                POST /api/generate/video
              </h3>
              <p className="text-slate-300 mb-3">
                Professional video generation with MiniMax or WaveSpeed
              </p>
              <code className="block bg-slate-900 p-3 rounded text-sm text-green-400 overflow-x-auto">
{`fetch('/api/generate/video', {
  method: 'POST',
  body: JSON.stringify({
    prompt: 'A cat playing piano',
    provider: 'minimax'
  })
})`}
              </code>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg p-8 border border-purple-500/50">
          <h2 className="text-3xl font-bold text-white mb-4">Features</h2>
          <div className="grid md:grid-cols-2 gap-4 text-slate-300">
            <div>
              <h3 className="font-semibold text-purple-300 mb-2">Intelligent Routing</h3>
              <p>Automatic provider selection based on task requirements</p>
            </div>
            <div>
              <h3 className="font-semibold text-purple-300 mb-2">Built-in Resilience</h3>
              <p>Circuit breakers, rate limiting, and automatic fallbacks</p>
            </div>
            <div>
              <h3 className="font-semibold text-purple-300 mb-2">Streaming Support</h3>
              <p>Real-time responses for interactive applications</p>
            </div>
            <div>
              <h3 className="font-semibold text-purple-300 mb-2">Type-Safe</h3>
              <p>Full TypeScript implementation with Zod validation</p>
            </div>
          </div>
        </div>

        <footer className="text-center mt-12 text-slate-400">
          <p>Built with Vercel AI SDK • Next.js • TypeScript</p>
          <p className="mt-2">
            <a
              href="https://github.com/yourusername/visionreel"
              className="text-purple-400 hover:text-purple-300"
            >
              View Documentation
            </a>
          </p>
        </footer>
      </div>
    </main>
  );
}
