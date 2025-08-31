import Head from "next/head";
import { GetServerSideProps } from "next";
import { PrismaClient } from "@prisma/client";

export default function Post({ post }: any) {
  if (!post) return <p>Not found</p>;
  return (
    <>
      <Head>
        <title>{post.title}</title>
        <meta name="description" content={post.summary || ""} />
        {post.canonical && <link rel="canonical" href={post.canonical} />}
        <meta property="og:type" content="article" />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.summary || ""} />
        {post.ogAbsolute && <meta property="og:image" content={post.ogAbsolute} />}
        {post.canonical && <meta property="og:url" content={post.canonical} />}
        <meta name="twitter:card" content="summary_large_image" />
        {post.ld && (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(post.ld) }} />
        )}
      </Head>
      <main style={{ maxWidth: 760, margin: "40px auto", padding: "0 16px" }}>
      {post.__preview && (
        <div style={{background:'#fffbdd',border:'1px solid #f6e05e',padding:8,marginBottom:12,fontSize:14}}>Preview mode: this post may be a draft</div>
      )}
      {post.ogImageKey && (
        <img
          src={post.ogAbsolute || (post.ogImageKey.startsWith("http") ? post.ogImageKey : `/api/og?key=${encodeURIComponent(post.ogImageKey)}`)}
          width={600}
          alt="og"
        />
      )}
      <h1>{post.title}</h1>
      <p>{post.summary}</p>
      <div dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
      </main>
    </>
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
  const host = String(ctx.req?.headers['host'] || 'localhost:3000');
  const proto = String((ctx.req?.headers['x-forwarded-proto'] as string) || 'http');
  const siteOrigin = process.env.SITE_ORIGIN || `${proto}://${host}`;
  const canonical = `${siteOrigin.replace(/\/$/, '')}/${slug}`;
  const ogAbsolute = post.ogImageKey
    ? (post.ogImageKey.startsWith('http') ? post.ogImageKey : `${siteOrigin.replace(/\/$/, '')}/api/og?key=${encodeURIComponent(post.ogImageKey)}`)
    : null;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.summary || '',
    url: canonical,
    image: ogAbsolute || undefined,
    datePublished: post.publishedAt || post.createdAt,
    dateModified: post.publishedAt || post.createdAt,
    author: { '@type': 'Organization', name: 'Factory' },
    publisher: { '@type': 'Organization', name: 'Factory' }
  };
  const safePost: any = {
    ...post,
    createdAt: post.createdAt ? (post.createdAt as Date).toISOString() : null,
    publishedAt: post.publishedAt ? (post.publishedAt as Date).toISOString() : null,
    canonical,
    ogAbsolute,
    ld
  };
  if (isPreview) safePost.__preview = true;
  return { props: { post: safePost } } as any;
};
