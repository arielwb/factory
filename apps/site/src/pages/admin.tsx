import { GetServerSideProps } from "next";
import Link from "next/link";
import { useState } from "react";
import { PrismaClient } from "@prisma/client";

type Draft = { id: string; slug: string; title: string };

export default function Admin({ drafts, allowPreview, previewSecret }: { drafts: Draft[]; allowPreview: boolean; previewSecret: string | null }) {
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
          <button disabled={busy} onClick={() => enqueue('ingest', { plugin: 'emoji', live: true, limit: 15, nocache: true })}>Run Discovery (live)</button>
          <button disabled={busy} onClick={() => enqueue('generate', { plugin: 'emoji', count: 1 })}>Generate 1</button>
          <button disabled={busy} onClick={() => enqueue('publishTop', { limit: 1 })}>Publish Top 1</button>
          <button disabled={busy} onClick={() => enqueue('distributeRecent', { since: 1440 })}>Distribute Recent</button>
        </div>
        <p style={{marginTop:8,fontSize:12,color:'#555'}}>Note: keep the worker tasks watcher running to process these. <code>pnpm run tasks:watch</code></p>
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
  return { props: { drafts, allowPreview, previewSecret } } as any;
};
