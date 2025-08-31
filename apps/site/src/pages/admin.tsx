import { GetServerSideProps } from "next";
import Link from "next/link";
import { useState } from "react";
import { PrismaClient } from "@prisma/client";

type Draft = { id: string; slug: string; title: string };

export default function Admin({ drafts, allowPreview, previewSecret }: { drafts: Draft[]; allowPreview: boolean; previewSecret: string | null }) {
  const [publishingId, setPublishingId] = useState<string | null>(null);
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

  return (
    <main style={{ maxWidth: 760, margin: "40px auto", padding: "0 16px" }}>
      <h1>Admin</h1>
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
