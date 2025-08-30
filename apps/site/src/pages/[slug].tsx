import { GetServerSideProps } from "next";
import { PrismaClient } from "@prisma/client";

export default function Post({ post }: any) {
  if (!post) return <p>Not found</p>;
  return (
    <main style={{ maxWidth: 760, margin: "40px auto", padding: "0 16px" }}>
      {post.ogImageKey && (
        <img
          src={post.ogImageKey.startsWith("http") ? post.ogImageKey : `/api/og?key=${encodeURIComponent(post.ogImageKey)}`}
          width={600}
          alt="og"
        />
      )}
      <h1>{post.title}</h1>
      <p>{post.summary}</p>
      <div dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
    </main>
  );
}

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const prisma = new PrismaClient();
  const post = await prisma.post.findUnique({ where: { slug: String(params!.slug) } });
  if (!post) return { props: { post: null } } as any;
  const safePost = {
    ...post,
    createdAt: post.createdAt ? (post.createdAt as Date).toISOString() : null,
    publishedAt: post.publishedAt ? (post.publishedAt as Date).toISOString() : null
  };
  return { props: { post: safePost } } as any;
};
