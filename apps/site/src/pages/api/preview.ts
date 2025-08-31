import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { secret, slug } = req.query as { secret?: string; slug?: string };
  if (!secret || secret !== process.env.PREVIEW_SECRET) {
    return res.status(401).json({ ok: false, error: 'Invalid preview secret' });
  }
  res.setPreviewData({});
  const to = `/${String(slug || '').replace(/^\/+/, '')}` || '/';
  res.writeHead(307, { Location: to });
  res.end(null);
}

