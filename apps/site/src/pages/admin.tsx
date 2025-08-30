import { GetServerSideProps } from "next";
import Link from "next/link";
import { PrismaClient } from "@prisma/client";

type Draft = { id: string; slug: string; title: string };

export default function Admin({ drafts }: { drafts: Draft[] }) {
  const publish = async (id: string) => {
    await fetch(`/api/publish?id=${encodeURIComponent(id)}`, { method: "POST" });
    // naive refresh
    if (typeof window !== "undefined") window.location.reload();
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
              <button onClick={() => publish(d.id)}>Publish</button>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async () => {
  const prisma = new PrismaClient();
  const drafts = await prisma.post.findMany({
    where: { status: "draft" },
    select: { id: true, slug: true, title: true }
  });
  return { props: { drafts } } as any;
};

