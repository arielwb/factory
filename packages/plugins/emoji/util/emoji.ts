// Extract emoji codepoints, including extended pictographic and ZWJ sequences (basic support)
// Note: This is a simplified regex and may miss some complex sequences; acceptable for MVP.
const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;

export function extractEmojis(text: string): string[] {
  return (text.match(EMOJI_REGEX) || []).filter(Boolean);
}

export const COMMON_STOPLIST = new Set(["❤️", "❤", "😂", "🤣", "😍", "😭", "✨", "💕", "🔥", "🙏"]);

