import { Header } from "@/components/dashboard/Header";
import { getEnvHealth, getNiches, isDbConfigured } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

interface KeyMeta {
  key: string;
  label: string;
  phase: 1 | 2 | 3;
  critical: boolean;
  url: string;
}

const API_KEYS: KeyMeta[] = [
  { key: "ANTHROPIC_API_KEY", label: "Anthropic (Claude API)", phase: 1, critical: true, url: "console.anthropic.com" },
  { key: "NEXT_PUBLIC_SUPABASE_URL", label: "Supabase URL", phase: 1, critical: true, url: "supabase.com" },
  { key: "NEXT_PUBLIC_SUPABASE_ANON_KEY", label: "Supabase Anon Key", phase: 1, critical: true, url: "supabase.com" },
  { key: "SUPABASE_SERVICE_ROLE_KEY", label: "Supabase Service Role", phase: 1, critical: true, url: "supabase.com" },
  { key: "NEXT_PUBLIC_APP_URL", label: "App URL (QStash target)", phase: 1, critical: false, url: "localhost / vercel.app" },
  { key: "YOUTUBE_API_KEY", label: "YouTube Data API (trends)", phase: 1, critical: false, url: "console.cloud.google.com" },
  { key: "QSTASH_TOKEN", label: "QStash Token (cron + queue)", phase: 2, critical: false, url: "upstash.com" },
  { key: "QSTASH_CURRENT_SIGNING_KEY", label: "QStash Current Signing Key", phase: 2, critical: false, url: "upstash.com" },
  { key: "QSTASH_NEXT_SIGNING_KEY", label: "QStash Next Signing Key", phase: 2, critical: false, url: "upstash.com" },
  { key: "CRON_ADMIN_SECRET", label: "Cron Admin Secret", phase: 2, critical: false, url: "openssl rand -base64 32" },
  { key: "GOOGLE_CLIENT_ID", label: "Google OAuth Client ID", phase: 2, critical: false, url: "console.cloud.google.com" },
  { key: "GOOGLE_CLIENT_SECRET", label: "Google OAuth Client Secret", phase: 2, critical: false, url: "console.cloud.google.com" },
  { key: "ELEVENLABS_API_KEY", label: "ElevenLabs (Voice)", phase: 2, critical: false, url: "elevenlabs.io" },
  { key: "ELEVENLABS_VOICE_ID", label: "ElevenLabs Voice ID (render)", phase: 2, critical: false, url: "elevenlabs.io → Voices" },
  { key: "CONTENT_OUTPUT_DIR", label: "Video output dir (default ~/ContentOS/output)", phase: 2, critical: false, url: "absolute path / drive" },
  { key: "PEXELS_API_KEY", label: "Pexels (Free Stock)", phase: 2, critical: false, url: "pexels.com/api" },
  { key: "SERPAPI_API_KEY", label: "SerpAPI (optional trends)", phase: 2, critical: false, url: "serpapi.com" },
  { key: "MUAPI_API_KEY", label: "Muapi.ai (Video Gen)", phase: 3, critical: false, url: "muapi.ai — add when funded" },
  { key: "CREATOMATE_API_KEY", label: "Creatomate (Assembly)", phase: 3, critical: false, url: "creatomate.com — add when funded" },
];

export default async function SettingsPage() {
  const health = new Map(getEnvHealth(API_KEYS.map((k) => k.key)).map((h) => [h.key, h.set]));
  const niches = await getNiches();
  const dbOk = isDbConfigured();

  return (
    <div>
      <Header title="Settings" subtitle="API keys, integrations, and platform configuration" />
      <div className="p-6 space-y-6">

        <div className={`rounded-xl border px-4 py-3 text-xs ${dbOk ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" : "border-red-500/20 bg-red-500/5 text-red-400"}`}>
          {dbOk
            ? "Supabase connection configured — dashboard reads live data."
            : "Supabase env vars missing — copy .env.example to .env.local and fill them in. Pages fall back to empty states."}
        </div>

        <section>
          <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">API Key Status</h2>
          <p className="text-[10px] text-zinc-600 mb-3">
            Status reflects whether the variable is set in the server environment — values are never displayed.
          </p>
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Variable</th>
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Service</th>
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Phase</th>
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Where to get</th>
                </tr>
              </thead>
              <tbody>
                {API_KEYS.map((k) => {
                  const isSet = health.get(k.key) ?? false;
                  return (
                    <tr key={k.key} className="border-b border-zinc-800/50 last:border-0">
                      <td className="px-4 py-2.5">
                        <code className="text-xs text-zinc-400 bg-zinc-800/50 px-1.5 py-0.5 rounded">{k.key}</code>
                        {k.critical && <span className="ml-2 text-[9px] text-orange-400 uppercase">required</span>}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-zinc-400">{k.label}</td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          isSet ? "bg-emerald-500/10 text-emerald-400" : k.critical ? "bg-red-500/10 text-red-400" : "bg-zinc-800 text-zinc-500"
                        }`}>
                          {isSet ? "set" : "missing"}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${k.phase === 1 ? "bg-orange-500/10 text-orange-400" : k.phase === 2 ? "bg-sky-500/10 text-sky-400" : "bg-zinc-800 text-zinc-500"}`}>
                          Phase {k.phase}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-zinc-600 font-mono">{k.url}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Niche Registry</h2>
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Niche</th>
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Slug</th>
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">CPM Range</th>
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Copyright Risk</th>
                  <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">Active</th>
                </tr>
              </thead>
              <tbody>
                {niches.map((n) => (
                  <tr key={n.id} className="border-b border-zinc-800/50 last:border-0">
                    <td className="px-4 py-2.5 text-xs text-zinc-300 font-medium">{n.name}</td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500 font-mono">{n.slug}</td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500 font-mono">${Number(n.cpm_min)}–{Number(n.cpm_max)}</td>
                    <td className="px-4 py-2.5 text-xs text-zinc-500">{n.risk_level.replace("_", " ")}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${n.active ? "bg-emerald-500/10 text-emerald-400" : "bg-zinc-800 text-zinc-500"}`}>
                        {n.active ? "yes" : "no"}
                      </span>
                    </td>
                  </tr>
                ))}
                {niches.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-xs text-zinc-600">
                      No niches — apply supabase/migrations/001_initial.sql
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-xs text-zinc-500 uppercase tracking-wider mb-3">Hard Rules (Never Violate)</h2>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-4 space-y-2">
            {[
              "Never use actual movie clips or sports footage — ContentID strikes kill channels",
              "Always add AI disclosure labels where platforms require them",
              "Never post two videos within 18 hours on the same channel",
              "Post via official APIs only: YouTube Data API v3, TikTok Content Posting API",
              "Only add paid services when revenue exists to fund them",
            ].map((rule, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-zinc-400">
                <span className="text-orange-400 mt-px">•</span>
                {rule}
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}
