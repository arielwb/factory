import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';

function xmlEscape(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  const prisma = new PrismaClient();
  const posts = await prisma.post.findMany({
    where: { status: 'published' },
    orderBy: { publishedAt: 'desc' },
    take: 50,
    select: { slug: true, title: true, summary: true, publishedAt: true, ogImageKey: true }
  });
  const siteOrigin = (process.env.SITE_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');

  const items = posts.map((p) => {
    const link = `${siteOrigin}/${p.slug}`;
    const pubDate = p.publishedAt ? new Date(p.publishedAt).toUTCString() : new Date().toUTCString();
    const description = xmlEscape(p.summary || '');
    return `  <item>\n    <title>${xmlEscape(p.title)}</title>\n    <link>${xmlEscape(link)}</link>\n    <guid>${xmlEscape(link)}</guid>\n    <pubDate>${pubDate}</pubDate>\n    <description>${description}</description>\n  </item>`;
  });

  const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0">\n<channel>\n  <title>Latest Explainers</title>\n  <link>${xmlEscape(siteOrigin)}</link>\n  <description>Fresh explainers with simple meanings and examples.</description>\n${items.join('\n')}\n</channel>\n</rss>`;

  res.setHeader('Content-Type', 'application/rss+xml');
  res.send(rss);
}

