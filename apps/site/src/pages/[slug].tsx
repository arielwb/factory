import { GetServerSideProps } from "next";
import { PrismaClient } from "@prisma/client";

export default function Post({ post }: any) {
  if (!post) return <p>Not found</p>;
  return (
    <main style={{ maxWidth: 760, margin: "40px auto", padding: "0 16px" }}>
      {post.__preview && (
        <div style={{background:'#fffbdd',border:'1px solid #f6e05e',padding:8,marginBottom:12,fontSize:14}}>Preview mode: this post may be a draft</div>
      )}
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

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const prisma = new PrismaClient();
  const isPreview = !!ctx.preview;
  const slug = String(ctx.params!.slug);
  const post = isPreview
    ? await prisma.post.findFirst({ where: { slug } })
    : await prisma.post.findFirst({ where: { slug, status: "published" } });
  if (!post) return { notFound: true } as any;
  const safePost: any = {
    ...post,
    createdAt: post.createdAt ? (post.createdAt as Date).toISOString() : null,
    publishedAt: post.publishedAt ? (post.publishedAt as Date).toISOString() : null
  };
  if (isPreview) safePost.__preview = true;
  return { props: { post: safePost } } as any;
};
