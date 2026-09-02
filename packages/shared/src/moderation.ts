/**
 * Deterministic first-line filter for player-authored names and answers.
 *
 * This deliberately targets a small set of unambiguous Danish/English abuse
 * terms and common character substitutions. It is not a context classifier;
 * reporting, local hiding, and host removal cover harmful content that a
 * conservative automatic filter should not guess at.
 */
const BLOCKED_WORDS = new Set([
  "bitch",
  "cunt",
  "faggot",
  "fuck",
  "kike",
  "luder",
  "nigga",
  "nigger",
  "pedo",
  "retard",
  "whore",
]);

const BLOCKED_COMPACT_PHRASES = [
  "faggot",
  "fuck",
  "heilhitler",
  "killyourself",
  "nigga",
  "nigger",
  "dræbdigselv",
  "sladigselv",
];

function normalizedWords(value: string): string[] {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[@4]/g, "a")
    .replace(/3/g, "e")
    .replace(/[1!|]/g, "i")
    .replace(/0/g, "o")
    .replace(/[$5]/g, "s")
    .replace(/7/g, "t")
    .split(/[^a-zæøå]+/u)
    .filter(Boolean);
}

export function containsObjectionableContent(value: string): boolean {
  const words = normalizedWords(value);
  if (words.some((word) => BLOCKED_WORDS.has(word))) return true;
  const compact = words.join("");
  return BLOCKED_COMPACT_PHRASES.some((phrase) => compact.includes(phrase));
}
