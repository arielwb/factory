import { container } from "@factory/infra/container";

(async () => {
  const { db, llm, renderer } = container();
  // 1) ingest mock
  const items = [
    { id: "mock:goose", niche: "emoji", term: "🪿", lang: "en", text: "goose emoji", sourceUrl: "https://example.com", likes: 120, shares: 20, comments: 5, firstSeenAt: new Date() }
  ];
  await db.upsertSourceItems(items as any);

  // 2) select top
  const [item] = await db.queueTopNForDraft("emoji", 1);
  if (!item) {
    console.log("NO_ITEMS");
    return;
  }

  // 3) generate draft
  const draft = await llm.draftExplainer({ term: item.term, snippets: [item.text], language: "en" });
  const rawSlug = `what-does-goose-emoji-mean`; // simple slug for MVP
  const { key } = await renderer.renderOgCard({ title: draft.title, summary: draft.summary, slug: rawSlug });

  // 4) create draft post
  const contentHtml = `
    <h2>Meaning</h2><p>${draft.sections.meaning}</p>
    <h2>Origin</h2><p>${draft.sections.origin}</p>
    <h2>Usage</h2><ul>${draft.sections.usage.map(u => `<li>${u}</li>`).join("")}</ul>
  `;
  const post = await db.createDraftPost({
    niche: "emoji", slug: rawSlug, title: draft.title, summary: draft.summary, contentHtml, ogImageKey: key
  });

  console.log("DRAFT_CREATED", post.slug);
})();

