import { Header } from "@/components/dashboard/Header";

const apiKeys = [
  { key: "ANTHROPIC_API_KEY", label: "Anthropic (Claude API)", phase: 1, critical: true, url: "console.anthropic.com" },
  { key: "NEXT_PUBLIC_SUPABASE_URL", label: "Supabase URL", phase: 1, critical: true, url: "supabase.com" },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", label: "Supabase Anon Key", phase: 1, critical: true, url: "supabase.com" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Supabase Service Role", phase: 1, critical: true, url: "supabase.com" },
  { key: "NEXTAUTH_SECRET", label: "NextAuth Secret", phase: 1, critical: true, url: "Generate: openssl rand -base64 32" },
  { key: "GOOGLE_CLIENT_ID", label: "Google OAuth Client ID", phase: 2, critical: false, url: "console.cloud.google.com" },
  { key: "GOOGLE_CLIENT_SECRET", label: "Google OAuth Client Secret", phase: 2, critical: false, url: "console.cloud.google.com" },
  { key: "YOUTUBE_API_KEY", label: "YouTube Data API Key", phase: 2, critical: false, url: "console.cloud.google.com" },
  { key: "ELEVENLABS_API_KEY", label: "ElevenLabs (Voice)", phase: 2, critical: false, url: "elevenlabs.io" },
  { key: "UPSTASH_REDIS_REST_URL", label: "Upstash Redis URL", phase: 2, critical: false, url: "upstash.com" },
  { key: "UPSTASH_REDIS_REST_TOKEN", label: "Upstash Redis Token", phase: 2, critical: false, url: "upstash.com" },
  { key: "PEXELS_API_KEY", label: "Pexels (Free Stock)", phase: 1, critical: false, url: "pexels.com/api" },
  { key: "REDDIT_CLIENT_ID", label: "Reddit API (Trends)", phase: 2, critical: false, url: "reddit.com/prefs/apps" },
  { key: "MUAPI_API_KEY", label: "Muapi.ai (Video Gen)", phase: 3, critical: false, url: "muapi.ai — add when funded" },
];

export default function SettingsPage() {
  return (
    <div>
      <Header title="Settings" subtitle="API keys, integrations, and platform configuration" />
      <div className="p-6 space-y-6">

        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 px-4 py-3 text-xs text-orange-400">
          Copy <code className="bg-orange-500/10 px-1 rounded">.env.example</code> to{" "}
          <code className="bg-orange-500/10 px-1 rounded">.env.local</code> and fill in your keys.
          The file is git-ignored. Never commit API keys.
        </div>

        <section>
          <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Required API Keys</h2>
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Variable</th>
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Service</th>
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Phase</th>
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Where to get</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((k) => (
                  <tr key={k.key} className="border-b border-zinc-800/50 last:border-0">
                    <td className="px-4 py-2.5">
                      <code className="text-xs text-zinc-400 bg-zinc-800/50 px-1.5 py-0.5 rounded">{k.key}</code>
                      {k.critical && <span className="ml-2 text-[9px] text-orange-400 uppercase">required</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-400">{k.label}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${k.phase <= 1 ? "bg-orange-500/10 text-orange-400" : k.phase === 2 ? "bg-sky-500/10 text-sky-400" : "bg-zinc-800 text-zinc-500"}`}>
                        Phase {k.phase}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-zinc-600 font-mono">{k.url}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </div>
    </div>
  );
}
