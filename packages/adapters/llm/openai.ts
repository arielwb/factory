import OpenAI from "openai";
import type { LLM } from "@factory/core/ports";
import { DraftExplainer } from "@factory/core/ports";

function extractJson(text: string): string {
  const triple = /```(?:json)?\n([\s\S]*?)```/i.exec(text);
  if (triple) return triple[1].trim();
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return text.trim();
}

const DraftExplainerSchema = {
  name: "DraftExplainer",
  // Keep strict mode off to allow optional fields like variants/notes
  // The validator below still enforces our zod schema.
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      title: { type: "string" },
      summary: { type: "string" },
      sections: {
        type: "object",
        additionalProperties: false,
        properties: {
          meaning: { type: "string" },
          origin: { type: "string" },
          usage: { type: "array", items: { type: "string" }, maxItems: 3 },
          variants: { type: "array", items: { type: "string" } },
          notes: { type: "string" }
        },
        required: ["meaning", "origin", "usage"]
      }
    },
    required: ["title", "summary", "sections"]
  }
} as const;

async function completeWithSchema(client: OpenAI, model: string, system: string, user: string) {
  return client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_schema", json_schema: DraftExplainerSchema } as any,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user }
    ]
  });
}

function normalizeAndValidate(raw: any) {
  if (!raw.sections) {
    // Attempt repair if the model omitted sections
    raw.sections = {
      meaning: String(raw.meaning ?? ""),
      origin: String(raw.origin ?? ""),
      usage: Array.isArray(raw.usage) ? raw.usage.map((x: any) => String(x)).slice(0, 3) : []
    };
  }
  const s = raw.sections;
  if (s) {
    if (s.usage && !Array.isArray(s.usage)) s.usage = [String(s.usage)];
    if (!s.usage) s.usage = [];
    s.usage = s.usage.map((x: any) => String(x)).slice(0, 3);
    if (s.variants == null) delete s.variants;
    if (s.notes == null) delete s.notes;
    if (typeof s.meaning !== "string") s.meaning = String(s.meaning ?? "");
    if (typeof s.origin !== "string") s.origin = String(s.origin ?? "");
  }
  if (typeof raw.title !== "string") raw.title = String(raw.title ?? "");
  if (typeof raw.summary !== "string") raw.summary = String(raw.summary ?? "");
  const validated = DraftExplainer.safeParse(raw);
  if (!validated.success) {
    throw new Error(`OpenAI JSON failed schema: ${validated.error.message}`);
  }
  return validated.data;
}

export const llm: LLM = {
  async draftExplainer({ term, snippets, language }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const client = new OpenAI({ apiKey });

    const system = "You return only strict JSON matching the provided JSON schema.";
    const user = [
      `Task: Generate a compact explainer for the term "${term}" in ${language}.`,
      `Snippets:`,
      ...snippets.map((s, i) => `- [${i + 1}] ${s}`),
    ].join("\n");

    try {
      console.log(`[llm:openai] requesting model=${model} term=${term}`);
      const res = await completeWithSchema(client, model, system, user);
      const text = res.choices?.[0]?.message?.content || "{}";
      const jsonStr = extractJson(text);
      let parsed: any = {};
      try { parsed = JSON.parse(jsonStr); } catch (e) { /* fallthrough to repair */ }
      return normalizeAndValidate(parsed);
    } catch (err: any) {
      const status = err?.status;
      const code = err?.code || err?.error?.code;
      const requestID = err?.requestID;
      const message = err?.message || String(err);
      console.error(`[llm:openai] error`, { status, code, requestID, message });
      if (/Invalid schema for response_format/i.test(message || "")) {
        // Fallback to plain JSON instruction if the schema isn’t accepted by this model/account
        const res = await client.chat.completions.create({
          model,
          temperature: 0.2,
          messages: [
            { role: "system", content: system + " Return strict JSON only matching {title, summary, sections{meaning, origin, usage[]?, variants[]?, notes?}}" },
            { role: "user", content: user }
          ]
        });
        const text = res.choices?.[0]?.message?.content || "{}";
        const jsonStr = extractJson(text);
        let parsed: any = {};
        try { parsed = JSON.parse(jsonStr); } catch (e) { /* fallthrough */ }
        return normalizeAndValidate(parsed);
      }
      if (status === 429 || code === "insufficient_quota" || /quota/i.test(message)) {
        throw new Error(`LLM_QUOTA: OpenAI quota/rate limit (status=${status}, code=${code}, requestID=${requestID})`);
      }
      throw err;
    }
  },

  async draftExplainerFromPrompt({ system, user }) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");
    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const client = new OpenAI({ apiKey });
    try {
      console.log(`[llm:openai] requesting(model=${model}) via prompt`);
      const res = await completeWithSchema(client, model, system, user);
      const text = res.choices?.[0]?.message?.content || "{}";
      const jsonStr = extractJson(text);
      let parsed: any = {};
      try { parsed = JSON.parse(jsonStr); } catch (e) { /* fallthrough to repair */ }
      return normalizeAndValidate(parsed);
    } catch (err: any) {
      const status = err?.status;
      const code = err?.code || err?.error?.code;
      const requestID = err?.requestID;
      const message = err?.message || String(err);
      console.error(`[llm:openai] error`, { status, code, requestID, message });
      if (/Invalid schema for response_format/i.test(message || "")) {
        // Fallback without response_format
        const res = await client.chat.completions.create({
          model,
          temperature: 0.2,
          messages: [
            { role: "system", content: system + " Return strict JSON only matching {title, summary, sections{meaning, origin, usage[]?, variants[]?, notes?}}" },
            { role: "user", content: user }
          ]
        });
        const text = res.choices?.[0]?.message?.content || "{}";
        const jsonStr = extractJson(text);
        let parsed: any = {};
        try { parsed = JSON.parse(jsonStr); } catch (e) { /* fallthrough */ }
        return normalizeAndValidate(parsed);
      }
      if (status === 429 || code === "insufficient_quota" || /quota/i.test(message)) {
        throw new Error(`LLM_QUOTA: OpenAI quota/rate limit (status=${status}, code=${code}, requestID=${requestID})`);
      }
      throw err;
    }
  }
};
