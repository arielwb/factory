2) Local Runbook
Install & bootstrap (one time)
pnpm i -g pnpm
pnpm init -y

# add workspaces in package.json or pnpm-workspace.yaml

pnpm add -w typescript ts-node @types/node zod prisma @prisma/client date-fns nanoid
pnpm add -w next react react-dom
pnpm add -w puppeteer sharp twitter-api-v2 fluent-ffmpeg
pnpm add -w eslint prettier


Create .env.local:

ENV=local
DB_DRIVER=sqlite
DATABASE_URL=file:./data/dev.db
STORAGE_DRIVER=fs
QUEUE_DRIVER=memory
LLM_DRIVER=mock
POSTER_DRIVER=mock
ANALYTICS_DRIVER=console


Prisma:

pnpm prisma init --datasource-provider sqlite

# paste schema.prisma from SPEC

pnpm prisma migrate dev -n init


Scaffold Next.js:

pnpm dlx create-next-app apps/site --ts --eslint --use-npm=false --src-dir


Add worker CLI entry apps/worker/index.ts:

import { container } from "@factory/infra/container";
import { slugify } from "@sindresorhus/slugify";

(async () => {
  const { db, llm, renderer } = container();
  // 1) ingest mock
  const items = [
    { id:"mock:goose", niche:"emoji", term:"🪿", lang:"en", text:"goose emoji", sourceUrl:"https://example.com", likes:120, shares:20, comments:5, firstSeenAt:new Date() }
  ];
  await db.upsertSourceItems(items as any);

  // 2) select top
  const [item] = await db.queueTopNForDraft("emoji", 1);

  // 3) generate draft
  const draft = await llm.draftExplainer({ term: item.term, snippets: [item.text], language: "en" });
  const rawSlug = `what-does-goose-emoji-mean`; // simple slug for MVP
  const { key } = await renderer.renderOgCard({ title: draft.title, summary: draft.summary, slug: rawSlug });

  // 4) create draft post
  const contentHtml = `
    <h2>Meaning</h2><p>${draft.sections.meaning}</p>
    <h2>Origin</h2><p>${draft.sections.origin}</p>
    <h2>Usage</h2><ul>${draft.sections.usage.map(u=>`<li>${u}</li>`).join("")}</ul>
  `;
  const post = await db.createDraftPost({
    niche: "emoji", slug: rawSlug, title: draft.title, summary: draft.summary, contentHtml, ogImageKey: key
  });

  console.log("DRAFT_CREATED", post.slug);
})();


Add site page /apps/site/src/pages/[slug].tsx:

import { GetServerSideProps } from "next";
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
export default function Post({ post }: any) {
  if (!post) return <p>Not found</p>;
  return (
    <main style={{maxWidth:760,margin:"40px auto",padding:"0 16px"}}>
      {post.ogImageKey && <img src={post.ogImageKey.startsWith("http") ? post.ogImageKey : `/api/og?key=${encodeURIComponent(post.ogImageKey)}`} width={600} alt="og" />}
      <h1>{post.title}</h1>
      <p>{post.summary}</p>
      <div dangerouslySetInnerHTML={{ __html: post.contentHtml }} />
    </main>
  );
}
export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const prisma = new PrismaClient();
  const post = await prisma.post.findUnique({ where: { slug: String(params!.slug) } });
  return { props: { post } };
};


Add local OG serving route /apps/site/src/pages/api/og.ts:

import type { NextApiRequest, NextApiResponse } from "next";
import { createReadStream } from "fs";
import { resolve } from "path";
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const key = String(req.query.key || "");
  const file = resolve(process.cwd(), "data/media", key);
  createReadStream(file).pipe(res);
}

Run (local, no cloud)
# 1) build prisma client
pnpm prisma generate

# 2) run the worker once (creates a draft post and og image)
pnpm ts-node apps/worker/index.ts

# Expected console:
# DRAFT_CREATED what-does-goose-emoji-mean

# 3) start the site
pnpm --filter apps/site dev
# open http://localhost:3000/what-does-goose-emoji-mean
# You should see title, summary, OG image and sections.

Minimal admin (approve/publish)

Add /apps/site/src/pages/admin.tsx with a button that hits /api/publish?id=...:

API /api/publish.ts calls Prisma update to set status="published", publishedAt=new Date().

Success check: After clicking Publish, reload the post and confirm status updated in DB (optional).

Flip to real LLM (still local)

Set:

LLM_DRIVER=openai
OPENAI_API_KEY=sk-...


Replace the mock generation call with openai adapter (same port). Re-run worker. Content should be richer.

Smoke test cloud adapters (local only)

Set STORAGE_DRIVER=s3 and fill S3/B2 envs → run worker → OG image should upload and the page should load it via public URL.

Optionally set DB_DRIVER=postgres to point to Neon staging → run worker → data lands in Neon while you still serve site locally.

Add cron later (when going prod)

Not needed locally. When ready, add Vercel Cron calling /api/tasks/run that triggers the same pipeline you just ran manually.

Acceptance tests (AI can self-verify)

Draft creation

Input: run worker once with mock ingest

Assert: DB has ≥1 Post with status="draft", slug="what-does-goose-emoji-mean"

OG render

Input: same run

Assert: file exists at data/media/og/what-does-goose-emoji-mean.png OR S3 key if s3 driver

Page render

Input: navigate to http://localhost:3000/what-does-goose-emoji-mean

Assert: page contains <h1>, <img> (OG), and the three sections

Switch adapters

Input: change STORAGE_DRIVER=fs -> s3 + valid creds; re-run worker

Assert: post loads OG from a public URL

Switch LLM

Input: LLM_DRIVER=mock -> openai + key

Assert: new draft has different, non-fixture text; JSON shape unchanged

No throwaway code

Assert: Only env changes were needed to switch drivers; no code edits

What’s purposely not included until prod

Cron schedules

Redis/BullMQ queue

Real social posting (mock only)

CI/CD pipelines

Those are flip-in adapters later, not new code paths.