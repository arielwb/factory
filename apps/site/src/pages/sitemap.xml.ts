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
    select: { slug: true, publishedAt: true }
  });
  const siteOrigin = process.env.SITE_ORIGIN || 'http://localhost:3000';

  const urls = posts.map((p) => {
    const loc = `${siteOrigin.replace(/\/$/, '')}/${p.slug}`;
    const lastmod = p.publishedAt ? p.publishedAt.toISOString() : new Date().toISOString();
    return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `  <url>\n    <loc>${xmlEscape(siteOrigin.replace(/\/$/, ''))}</loc>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>\n` +
    urls.join('\n') +
    `\n</urlset>`;

  res.setHeader('Content-Type', 'application/xml');
  res.write(xml);
  res.end();
}

