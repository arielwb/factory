import Head from 'next/head';
import Link from 'next/link';
import { GetServerSideProps } from 'next';
import { PrismaClient } from '@prisma/client';

type PostLite = { slug: string; title: string; summary: string | null; publishedAt: string | null };

export default function Home({ posts, siteOrigin }: { posts: PostLite[]; siteOrigin: string }) {
  const title = 'Latest Explainers';
  const description = 'Fresh explainers with simple meanings and examples.';
  const url = siteOrigin;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={url} />
        <meta name="twitter:card" content="summary" />
        <link rel="alternate" type="application/rss+xml" title="Latest Explainers" href="/rss.xml" />
      </Head>
      <main style={{maxWidth:760, margin:'40px auto', padding:'0 16px'}}>
        <h1>Latest Explainers</h1>
        {posts.length === 0 ? (
          <p>No posts yet. Check back soon.</p>
        ) : (
          <ul>
            {posts.map((p) => (
              <li key={p.slug} style={{marginBottom:12}}>
                <Link href={`/${p.slug}`}>{p.title}</Link>
                {p.summary && <p style={{margin:'4px 0 0', color:'#555'}}>{p.summary}</p>}
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const prisma = new PrismaClient();
  const rows = await prisma.post.findMany({
    where: { status: 'published' },
    orderBy: { publishedAt: 'desc' },
    take: 50,
    select: { slug: true, title: true, summary: true, publishedAt: true }
  });
  const host = String(ctx.req?.headers['host'] || 'localhost:3000');
  const proto = String((ctx.req?.headers['x-forwarded-proto'] as string) || 'http');
  const siteOrigin = process.env.SITE_ORIGIN || `${proto}://${host}`;
  const posts: PostLite[] = rows.map((r) => ({
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    publishedAt: r.publishedAt ? r.publishedAt.toISOString() : null
  }));
  return { props: { posts, siteOrigin } } as any;
};
