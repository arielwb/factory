export function slugFromEmoji(term: string): string {
  const map: Record<string, string> = {
    '🪿': 'goose-emoji',
    '🥲': 'smiling-crying-emoji',
    '🫨': 'shaking-face-emoji',
    '😂': 'face-with-tears-of-joy',
    '❤️': 'red-heart-emoji',
    '🤣': 'rolling-on-the-floor-laughing',
    '😍': 'smiling-face-with-heart-eyes',
    '😭': 'loudly-crying-face',
    '✨': 'sparkles-emoji',
    '💕': 'two-hearts-emoji',
    '🙏': 'folded-hands-emoji'
  };
  if (map[term]) return `what-does-${map[term]}-mean`;
  // Fallback: codepoint-based slug
  const hex = Array.from(term)
    .map((ch) => (ch.codePointAt(0) || 0).toString(16))
    .join('-');
  return `what-does-emoji-u${hex}-mean`;
}

