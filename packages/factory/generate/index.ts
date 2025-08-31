import type { NichePlugin } from "@factory/core/plugins";
import type { DB, LLM, Renderer } from "@factory/core/ports";

function buildContentHtml(draft: { sections: { meaning: string; origin: string; usage: string[] } }) {
  return `
    <h2>Meaning</h2><p>${draft.sections.meaning}</p>
    <h2>Origin</h2><p>${draft.sections.origin}</p>
    <h2>Usage</h2><ul>${draft.sections.usage.map((u) => `<li>${u}</li>`).join("")}</ul>
  `;
}

export async function generateOne(opts: {
  plugin: NichePlugin;
  db: DB;
  llm: LLM;
  renderer: Renderer;
}): Promise<{ slug: string } | null> {
  const { plugin, db, llm, renderer } = opts;
  const [item] = await db.queueTopNForDraft(plugin.name, 1);
  if (!item) return null;

  const prompt = plugin.buildPrompt({ item });
  const seoDraft = (llm.draftExplainerFromPrompt
    ? await llm.draftExplainerFromPrompt(prompt)
    : await (async () => {
        try {
          const u = JSON.parse(prompt.user);
          return await llm.draftExplainer({ term: u.term ?? item.term, snippets: u.snippets ?? [item.text], language: u.language ?? "en" });
        } catch {
          return await llm.draftExplainer({ term: item.term, snippets: [item.text], language: "en" });
        }
      })());

  // Meme mode using same JSON schema but memey tone
  const memeSystem = "You write meme-style definitions in the SAME JSON schema (title, summary, sections) but with casual internet slang, emojis, and PG-13 humor. No slurs or NSFW.";
  const memeDraft = (llm.draftExplainerFromPrompt
    ? await llm.draftExplainerFromPrompt({ system: memeSystem, user: prompt.user })
    : seoDraft);

  // Generate slug with collision avoidance
  let slug = plugin.slugFor?.(item) || `what-does-${plugin.name}-item-mean`;
  try {
    const existing = await db.getPostBySlug(slug);
    if (existing) {
      let i = 2;
      while (await db.getPostBySlug(`${slug}-v${i}`)) i++;
      slug = `${slug}-v${i}`;
    }
  } catch {}

  const { key } = await renderer.renderOgCard({ title: seoDraft.title, summary: seoDraft.summary, slug });
  const contentHtml = buildContentHtml(seoDraft as any);
  const memeHtml = buildMemeHtml(memeDraft as any);
  const memeText = buildMemeText(memeDraft as any);
  const post = await db.createDraftPost({
    niche: plugin.name,
    slug,
    title: seoDraft.title,
    summary: seoDraft.summary,
    contentHtml,
    ogImageKey: key
  });
  try {
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    await prisma.post.update({ where: { id: post.id }, data: { memeText, memeHtml } });
  } catch {}
  return { slug: post.slug };
}

function buildMemeText(draft: { title: string; summary: string; sections: { usage: string[] } }) {
  const oneLiner = draft.summary || draft.title;
  const example = draft.sections?.usage?.[0] || '';
  const caption = `${oneLiner}${example ? ' — ' + example : ''}`.slice(0, 260);
  return caption;
}

function buildMemeHtml(draft: { title: string; summary: string; sections: { usage: string[] } }) {
  const oneLiner = draft.summary || draft.title;
  const usage = draft.sections?.usage || [];
  return `
    <h2>Memey</h2>
    <p>${oneLiner}</p>
    ${usage.length ? `<h3>Examples</h3><ul>${usage.slice(0,2).map(u=>`<li>${u}</li>`).join('')}</ul>` : ''}
  `;
}
