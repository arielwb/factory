Perfect — here’s a **task-formatted plan** for implementing **two-mode content generation** (formal SEO + slang/meme). This includes prompt tuning, rendering, and delivery strategy.

---

# Epic: Dual-Tone Content Generation (SEO + Meme Mode)

## 🎯 Goal

Ensure every post has:

1. A **formal SEO-friendly version** (Google-safe, neutral tone).
2. A **memey/slang version** (funny, casual, shareable, can include mild profanity).

Both are generated from the same query (e.g., *“What does SMH mean?”*).

---

## ✅ Tasks

### Task 1 — Define Tone Modes

* **SEO Mode**:

  * Tone: neutral, dictionary-style.
  * Requirements: PG, no profanity.
  * Format: Question as H1, 1–2 sentence answer, then usage examples.
* **Meme Mode**:

  * Tone: sarcastic friend / internet shitposter.
  * Requirements: informal slang, emoji, memes, optionally PG-13 profanity.
  * Format: Short punchy definition, then 1–2 chat-style examples.

**Acceptance Criteria:**

* SEO mode passes Google SafeSearch checks.
* Meme mode feels screenshot-able, with emojis + casual vibe.

---

### Task 2 — LLM Prompt Tuning

* Create **prompt templates** per mode.

**SEO prompt**:

```
Explain the meaning of {TERM}. 
Tone: neutral, educational, concise. 
Output must be safe for all ages. 
Structure: 
- Definition (1–2 sentences) 
- Origin/usage 
- Example sentence
```

**Meme prompt**:

```
Explain the meaning of {TERM}. 
Tone: internet meme, casual, slangy, sarcastic. 
Allow light profanity (PG-13) but no hate/slurs. 
Sprinkle emojis. 
Structure: 
- Punchy definition (1 line, funny) 
- Example (chat-style, meme-ish) 
- Optional alt-joke 
```

**Acceptance Criteria:**

* Both prompts produce distinct outputs from the same query.
* Meme prompt reliably inserts emojis + slang.

---

### Task 3 — Rendering Pipeline

* `renderer/formalRenderer.ts`

  * Generates SEO-safe HTML (H1, p, FAQ schema).
* `renderer/memeRenderer.ts`

  * Generates short meme caption + OG card text.
* Store both in DB under the same `content_id`.

**Acceptance Criteria:**

* SEO renderer outputs valid schema.org markup.
* Meme renderer outputs text <280 chars (tweetable).

---

### Task 4 — Delivery Strategy

* On the **site**:

  * Serve SEO mode content as the main article.
  * Add a toggle/button “See memey version 😂” → loads memeRenderer output.
* On **social previews**:

  * Use memeRenderer text + OG card template (big emoji, bold font).
* Optional: auto-post memeRenderer content to socials.

**Acceptance Criteria:**

* SEO mode is canonical for crawlers (meta tags).
* Meme mode is available but doesn’t pollute SEO.

---

### Task 5 — A/B Testing Meme Tone

* Implement 2–3 variations of meme prompts (sarcastic, wholesome, edgy).
* Run A/B by randomizing memeRenderer style per post.
* Track CTR/shares via Plausible/Posthog.

**Acceptance Criteria:**

* Track which meme tone produces higher click/share rate.
* Kill low performers, keep best-performing meme tone.

---

### Task 6 — Guardrails & Fine-Tuning

* Add profanity filter (e.g., no F-bombs if Adsense is enabled).
* Adjust meme prompt if it skews too formal (add “speak like TikTok” style).
* Optionally fine-tune with **few-shot examples** (feed 20 sample “good” meme answers).

**Acceptance Criteria:**

* Meme answers never cross red-line (slurs/NSFW).
* Consistent slang style emerges after 20+ generations.

---

## 🚀 Example Output

**Query:** *What does SMH mean?*

**SEO mode**:

> SMH means “shaking my head.” It’s used online to show disapproval or disappointment.
> Example: *“You’re still awake at 3am? SMH.”*

**Meme mode**:

> SMH = “shaking my head” 🤦. Basically a polite way of saying *“bruh, you dumb af.”*
> Example:
> Friend: *I dropped my phone in the toilet again.*
> Me: *SMH bro 😂*

---

👉 This way you get **the SEO traffic** *and* **the shareable memes** without sacrificing one for the other.

Do you want me to also draft a **content schema** (DB fields + API output) so each post naturally stores both versions (`formal`, `meme`) under the same entry?
