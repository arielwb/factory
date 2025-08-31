import { GetServerSideProps } from "next";
import Link from "next/link";
import { useState } from "react";
import { PrismaClient } from "@prisma/client";

type Draft = { id: string; slug: string; title: string };
type ProviderHealth = Record<string, { ok?: boolean; count?: number; ms?: number; at?: string }>;
type IngestSummary = { providers: string[]; reservoirRows: number; topEmojis: { emoji: string; freq: number; score: number }[]; topAcronyms: { term: string; count: number }[] };

export default function Admin({ drafts, allowPreview, previewSecret, summary, health }: { drafts: Draft[]; allowPreview: boolean; previewSecret: string | null; summary: IngestSummary | null; health: ProviderHealth }) {
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const publish = async (id: string) => {
    try {
      setPublishingId(id);
      await fetch(`/api/publish?id=${encodeURIComponent(id)}`, { method: "POST" });
      // naive refresh
      if (typeof window !== "undefined") window.location.reload();
    } finally {
      setPublishingId(null);
    }
  };
  const enqueue = async (type: string, payload: any = {}) => {
    try {
      setBusy(true);
      await fetch(`/api/tasks/enqueue`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, payload }) });
      alert(`Enqueued: ${type}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main style={{ maxWidth: 760, margin: "40px auto", padding: "0 16px" }}>
      <h1>Admin</h1>
      <section style={{border:'1px solid #eee',padding:12,margin:'12px 0'}}>
        <h2>Shortcuts</h2>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <button disabled={busy} onClick={() => enqueue('ingest', { plugin: 'emoji', live: true, limit: 15, nocache: true })}>Run Emoji Discovery</button>
          <button disabled={busy} onClick={() => enqueue('generate', { plugin: 'emoji', count: 1 })}>Generate 1 (Emoji)</button>
          <button disabled={busy} onClick={() => enqueue('publishTop', { limit: 1 })}>Publish Top 1</button>
          <button disabled={busy} onClick={() => enqueue('distributeRecent', { since: 1440 })}>Distribute Recent</button>
          <button disabled={busy} onClick={() => enqueue('ingest', { plugin: 'acronyms', live: true, limit: 15, nocache: true })}>Run Acronyms Discovery</button>
          <button disabled={busy} onClick={() => enqueue('generate', { plugin: 'acronyms', count: 1 })}>Generate 1 (Acronyms)</button>
        </div>
        <p style={{marginTop:8,fontSize:12,color:'#555'}}>Note: keep the worker tasks watcher running to process these. <code>pnpm run tasks:watch</code></p>
      </section>
      <section style={{border:'1px solid #eee',padding:12,margin:'12px 0'}}>
        <h2>Ingest Console</h2>
        {!summary ? (
          <p>Summary unavailable.</p>
        ) : (
          <div>
            <p><strong>Providers:</strong> {summary.providers.join(', ') || '(none)'}</p>
            <p><strong>Reservoir rows:</strong> {summary.reservoirRows}</p>
            <div style={{display:'flex',gap:24,flexWrap:'wrap'}}>
              <div>
                <h3>Top Emojis</h3>
                <ul>
                  {summary.topEmojis.map((e) => (
                    <li key={e.emoji}>
                      <span style={{fontSize:18,marginRight:8}}>{e.emoji}</span>
                      freq {e.freq} • score {e.score}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3>Top Acronyms</h3>
                <ul>
                  {summary.topAcronyms.map((a) => (
                    <li key={a.term}><code>{a.term}</code> freq {a.count}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
        <div style={{marginTop:12}}>
          <h3>Provider Health</h3>
          {Object.keys(health || {}).length === 0 ? (
            <p>(no health data yet)</p>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr><th style={{textAlign:'left'}}>Provider</th><th>Status</th><th>Count</th><th>ms</th><th>When</th></tr>
              </thead>
              <tbody>
                {Object.entries(health).map(([name, h]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td>{String(h.ok)}</td>
                    <td>{h.count ?? '-'}</td>
                    <td>{h.ms ?? '-'}</td>
                    <td>{h.at ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
      <h2>Drafts</h2>
      {drafts.length === 0 ? (
        <p>No drafts.</p>
      ) : (
        <ul>
          {drafts.map((d) => (
            <li key={d.id} style={{ marginBottom: 12 }}>
              <Link href={`/${d.slug}`} style={{ marginRight: 12 }}>{d.title || d.slug}</Link>
              {allowPreview && previewSecret && (
                <a
                  href={`/api/preview?secret=${encodeURIComponent(previewSecret)}&slug=${encodeURIComponent(d.slug)}`}
                  style={{ marginRight: 12 }}
                >Preview</a>
              )}
              <button
                onClick={() => publish(d.id)}
                disabled={publishingId === d.id}
                aria-busy={publishingId === d.id}
              >
                {publishingId === d.id ? "Publishing..." : "Publish"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  const prisma = new PrismaClient();
  const drafts = await prisma.post.findMany({ where: { status: "draft" }, select: { id: true, slug: true, title: true } });
  const allowPreview = Boolean(process.env.NEXT_PUBLIC_PREVIEW_SECRET);
  const previewSecret = process.env.NEXT_PUBLIC_PREVIEW_SECRET || null;
  let summary: IngestSummary | null = null;
  let health: ProviderHealth = {};
  try {
    const { buildReservoir } = await import('@factory/plugins/emoji/lib/reservoir');
    const { topEmojisFromReservoir } = await import('@factory/plugins/emoji/lib/discover');
    const rows = await buildReservoir(200);
    const topEmojis = (await topEmojisFromReservoir(rows)).slice(0,10).map(e=>({emoji:e.emoji,freq:e.freq,score:Number(e.score.toFixed(2))}));
    const counts = new Map<string, number>();
    const re = /\b[A-Z]{2,5}\b/g; const stop = new Set(['USA','HTTP','CPU','GPU','API','WWW','COVID','NASA','FBI','CIA','UK','EU','NBA','FIFA','UFC','SSN','DOB','ETA','DIY']);
    for (const r of rows) { let m: RegExpExecArray | null; while ((m=re.exec(r.text||''))) { const t=m[0]; if (!stop.has(t)) counts.set(t,(counts.get(t)||0)+1);} }
    const topAcronyms = [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0,10).map(([term,count])=>({term,count}));
    const providers = (process.env.DISCOVER_PROVIDERS || '').split(',').map(s=>s.trim()).filter(Boolean);
    summary = { providers, reservoirRows: rows.length, topEmojis, topAcronyms };
  } catch {}
  try {
    const { promises: fs } = await import('fs');
    const { resolve } = await import('path');
    const file = resolve(process.cwd(), '..', '..', 'data', 'fixtures', 'reservoir-health.json');
    const raw = await fs.readFile(file, 'utf8');
    health = JSON.parse(raw);
  } catch {}
  return { props: { drafts, allowPreview, previewSecret, summary, health } } as any;
};
