export type Tweet = {
  id: string;
  text: string;
  lang?: string;
  created_at?: string;
  public_metrics?: {
    like_count?: number;
    retweet_count?: number;
    reply_count?: number;
    quote_count?: number;
  };
};

export type SearchRecentInput = {
  query: string;
  maxResults?: number; // 10..100
  bearer?: string;
  tweetFields?: string[];
  nextToken?: string;
};

function sleep(ms: number) { return new Promise(res => setTimeout(res, ms)); }
function jitter(ms: number) { return Math.max(0, Math.round(ms * (0.9 + Math.random() * 0.2))); }

function msUntilReset(headers: Headers): number | null {
  const reset = headers.get('x-rate-limit-reset');
  if (!reset) return null;
  const resetEpoch = parseInt(reset, 10);
  if (Number.isNaN(resetEpoch)) return null;
  const nowSec = Math.floor(Date.now() / 1000);
  const deltaSec = resetEpoch - nowSec;
  return Math.max(0, deltaSec * 1000);
}

async function fetchWithRateLimit(url: URL, bearer: string, attempts = 3): Promise<Response> {
  let attempt = 0;
  while (true) {
    attempt++;
    const res = await fetch(url.toString(), { headers: { Authorization: `Bearer ${bearer}` } } as any);
    const remaining = res.headers.get('x-rate-limit-remaining');
    const resetMs = msUntilReset(res.headers);
    if (res.status === 429 || (remaining !== null && parseInt(remaining, 10) <= 1)) {
      const waitMs = jitter((resetMs ?? 60_000));
      if (attempt <= attempts) await sleep(waitMs);
      else return res; // give up and let caller handle
      continue;
    }
    if (!res.ok && attempt < attempts) {
      // simple backoff for transient errors
      await sleep(jitter(500 * Math.pow(2, attempt - 1)));
      continue;
    }
    return res;
  }
}

export async function searchRecentTweetsPage(input: SearchRecentInput): Promise<{ data: Tweet[]; meta?: { next_token?: string } }> {
  const bearer = input.bearer || process.env.TWITTER_BEARER || process.env.TWITTER_BEARER_TOKEN;
  if (!bearer) throw new Error("Missing TWITTER_BEARER env or bearer param");
  const max = Math.max(10, Math.min(100, input.maxResults ?? 10));
  const fields = input.tweetFields?.length ? input.tweetFields : ["lang", "created_at", "public_metrics"];
  const url = new URL("https://api.twitter.com/2/tweets/search/recent");
  url.searchParams.set("query", input.query);
  url.searchParams.set("max_results", String(max));
  url.searchParams.set("tweet.fields", fields.join(","));
  if (input.nextToken) url.searchParams.set("next_token", input.nextToken);
  const res = await fetchWithRateLimit(url, bearer);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twitter API error ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  return { data: (data.data || []) as Tweet[], meta: data.meta };
}

export async function searchRecentTweets(input: Omit<SearchRecentInput, 'nextToken'>): Promise<Tweet[]> {
  const page = await searchRecentTweetsPage(input);
  return page.data;
}

// Domain-specific query construction should live in plugins. This client stays generic.
