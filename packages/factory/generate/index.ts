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
  const draft = (llm.draftExplainerFromPrompt
    ? await llm.draftExplainerFromPrompt(prompt)
    : await (async () => {
        try {
          const u = JSON.parse(prompt.user);
          return await llm.draftExplainer({ term: u.term ?? item.term, snippets: u.snippets ?? [item.text], language: u.language ?? "en" });
        } catch {
          return await llm.draftExplainer({ term: item.term, snippets: [item.text], language: "en" });
        }
      })());

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

  const { key } = await renderer.renderOgCard({ title: draft.title, summary: draft.summary, slug });
  const contentHtml = buildContentHtml(draft as any);
  const post = await db.createDraftPost({
    niche: plugin.name,
    slug,
    title: draft.title,
    summary: draft.summary,
    contentHtml,
    ogImageKey: key
  });
  return { slug: post.slug };
}

