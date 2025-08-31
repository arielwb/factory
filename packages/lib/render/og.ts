import sharp from "sharp";

export async function renderOgCardImage(input: { title: string; summary: string; slug: string }): Promise<Buffer> {
  const title = escapeHtml(truncate(input.title, 100));
  const summary = escapeHtml(truncate(input.summary, 180));
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="100%" stop-color="#1e293b" />
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <g transform="translate(80, 80)">
    <text x="0" y="0" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="72" font-weight="700" fill="#e2e8f0">
      <tspan x="0" dy="72">${title}</tspan>
    </text>
    <foreignObject x="0" y="120" width="1040" height="380">
      <div xmlns="http://www.w3.org/1999/xhtml" style="color:#cbd5e1;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,sans-serif;font-size:36px;line-height:1.3;white-space:pre-wrap">${summary}</div>
    </foreignObject>
    <text x="0" y="520" font-family="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif" font-size="28" fill="#94a3b8">factory</text>
  </g>
</svg>`;

  const png = await sharp(Buffer.from(svg))
    .png({ quality: 90 })
    .toBuffer();
  return png;
}

function truncate(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

