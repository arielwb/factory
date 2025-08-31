import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const origin = (process.env.SITE_ORIGIN || 'http://localhost:3000').replace(/\/$/, '');
  const robots = `User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: ${origin}/sitemap.xml\n`;
  res.setHeader('Content-Type', 'text/plain');
  res.send(robots);
}

