import { readFileSync } from "node:fs";
import path from "node:path";
import type { Locale } from "@/lib/i18n";

export type KnowledgeDocument = {
  id: string;
  file: string;
  status: "approved" | "pending";
  category: string;
  title: Record<Locale, string>;
  publicPath: Record<Locale, string> | null;
  sources: string[];
  verifiedAt: string;
  topics: string[];
};

export type KnowledgePassage = {
  id: string;
  docId: string;
  topics: string;
  fr: string;
  en: string;
};

type IndexedPassage = KnowledgePassage & { terms: Map<string, number>; length: number };

export type KnowledgeBase = {
  documents: Map<string, KnowledgeDocument>;
  passages: IndexedPassage[];
  documentFrequency: Map<string, number>;
  averageLength: number;
};

export type FaqContext =
  | { kind: "model"; locale: Locale; passages: KnowledgePassage[] }
  | { kind: "out_of_scope" | "insufficient_sources"; locale: Locale };

const KNOWLEDGE_DIR = path.join(process.cwd(), "docs", "faq-knowledge");
const MAX_PASSAGES = 4;
const MIN_TOP_SCORE = 1;
const RELATIVE_CUTOFF = 0.35;
const COMMON_TERM_SHARE = 0.3;

const STOPWORDS = new Set(
  (
    "le la les l un une des du de d et ou a au aux en dans sur pour par avec sans ce ces cet cette ca " +
    "est sont etre il ils elle elles on je j tu te vous nous me m se s y que qu qui quoi quel quelle quels quelles " +
    "ne pas plus mon ma mes ton ta tes votre vos notre nos leur leurs t ai as peux peut puis faut devoir doit " +
    "the an is are was be do does did to of in on at for with and or it its this that these those i you your we our " +
    "my me can could would should will get what which who how there any"
  ).split(" ")
);
const FRENCH_MARKERS = new Set(
  "le la les est que quoi comment combien des une un pour avec il ce ca faut peut sur sans mon ma vous quel quelle quels quelles".split(" ")
);
const ENGLISH_MARKERS = new Set(
  "the is are do does how what can much need my you your with for of it an which who will".split(" ")
);
const DOMAIN_TERMS = [
  "vistaire", "menu", "carte", "qr", "restaura", "plat", "3d", "ar", "tarif", "prix", "abonnement",
  "support", "dish", "price", "pricing", "subscription", "display", "applic", "app", "client", "guest",
  "allerg", "photo", "pilotage", "dashboard"
];

export function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function words(value: string): string[] {
  return normalizeText(value).split(/[^a-z0-9]+/).filter(Boolean);
}

export function tokenize(value: string): string[] {
  return words(value)
    .filter((word) => word.length > 1 && !STOPWORDS.has(word))
    .map((word) => (word.length > 4 && /[sx]$/.test(word) ? word.slice(0, -1) : word));
}

export function parsePassages(markdown: string, docId: string): KnowledgePassage[] {
  const passages: KnowledgePassage[] = [];
  let current: Partial<KnowledgePassage> | null = null;
  for (const line of markdown.split(/\r?\n/)) {
    const heading = line.match(/^##\s+([a-z0-9-]+)\s*$/);
    if (heading) {
      current = { id: heading[1], docId };
      passages.push(current as KnowledgePassage);
      continue;
    }
    const field = line.match(/^(topics|fr|en):\s*(.+)$/);
    if (current && field) current[field[1] as "topics" | "fr" | "en"] = field[2].trim();
  }
  for (const passage of passages) {
    if (!passage.topics || !passage.fr || !passage.en) {
      throw new Error(`FAQ knowledge passage ${passage.id} is missing topics, fr or en.`);
    }
  }
  return passages;
}

export function readKnowledgeManifest(dir = KNOWLEDGE_DIR): { version: number; documents: KnowledgeDocument[] } {
  return JSON.parse(readFileSync(path.join(dir, "manifest.json"), "utf8"));
}

let cachedKnowledgeBase: KnowledgeBase | null = null;

export function loadKnowledgeBase(): KnowledgeBase {
  if (cachedKnowledgeBase) return cachedKnowledgeBase;

  const documents = new Map<string, KnowledgeDocument>();
  const passages: IndexedPassage[] = [];
  for (const doc of readKnowledgeManifest().documents) {
    if (doc.status !== "approved" || !/^[\w-]+\.md$/.test(doc.file)) continue;
    documents.set(doc.id, doc);
    const markdown = readFileSync(path.join(KNOWLEDGE_DIR, doc.file), "utf8");
    for (const passage of parsePassages(markdown, doc.id)) {
      const tokens = [
        ...tokenize(passage.topics),
        ...tokenize(passage.topics),
        ...tokenize(passage.fr),
        ...tokenize(passage.en),
        ...tokenize(`${doc.title.fr} ${doc.title.en}`)
      ];
      const terms = new Map<string, number>();
      for (const token of tokens) terms.set(token, (terms.get(token) ?? 0) + 1);
      passages.push({ ...passage, terms, length: tokens.length });
    }
  }

  const documentFrequency = new Map<string, number>();
  for (const passage of passages) {
    for (const term of passage.terms.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }
  const averageLength = passages.reduce((sum, passage) => sum + passage.length, 0) / passages.length;

  cachedKnowledgeBase = { documents, passages, documentFrequency, averageLength };
  return cachedKnowledgeBase;
}

export function detectQuestionLocale(question: string, fallback: Locale): Locale {
  let fr = /[àâçéèêëîïôûùüÿœ]/i.test(question) ? 2 : 0;
  let en = 0;
  for (const word of words(question)) {
    if (FRENCH_MARKERS.has(word)) fr += 1;
    if (ENGLISH_MARKERS.has(word)) en += 1;
  }
  if (fr === en) return fallback;
  return fr > en ? "fr" : "en";
}

// Exact term, or a shared prefix of 4+ characters ("coute" ~ "cout", "appli" ~ "application").
function matchingTerms(token: string, kb: KnowledgeBase): Array<[string, number]> {
  const matches: Array<[string, number]> = [];
  for (const term of kb.documentFrequency.keys()) {
    if (term === token) matches.push([term, 1]);
    else if (Math.min(term.length, token.length) >= 4 && (term.startsWith(token) || token.startsWith(term))) {
      matches.push([term, 0.7]);
    }
  }
  return matches;
}

function isDomainToken(token: string): boolean {
  return DOMAIN_TERMS.some((term) => (term.length <= 3 ? token === term : token.startsWith(term)));
}

// ponytail: in-memory BM25 over ~50 passages; move to embeddings only if reformulations measurably fail.
export function selectFaqContext(question: string, kb: KnowledgeBase, pageLocale: Locale = "fr"): FaqContext {
  const locale = detectQuestionLocale(question, pageLocale);
  const tokens = [...new Set(tokenize(question))];
  const total = kb.passages.length;
  const scores = new Map<IndexedPassage, number>();
  let matchedTokens = 0;
  let informativeMatch = false;

  for (const token of tokens) {
    const matches = matchingTerms(token, kb);
    if (matches.length) matchedTokens += 1;
    for (const [term, weight] of matches) {
      const df = kb.documentFrequency.get(term) ?? 0;
      if (df / total <= COMMON_TERM_SHARE) informativeMatch = true;
      const idf = Math.log(1 + (total - df + 0.5) / (df + 0.5));
      for (const passage of kb.passages) {
        const tf = passage.terms.get(term);
        if (!tf) continue;
        const norm = (tf * 2.2) / (tf + 1.2 * (0.25 + 0.75 * (passage.length / kb.averageLength)));
        scores.set(passage, (scores.get(passage) ?? 0) + idf * norm * weight);
      }
    }
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const top = ranked[0]?.[1] ?? 0;
  const fullyMatched = tokens.length > 0 && matchedTokens === tokens.length;
  if (!(informativeMatch || fullyMatched) || (top < MIN_TOP_SCORE && !fullyMatched)) {
    return { kind: tokens.some(isDomainToken) ? "insufficient_sources" : "out_of_scope", locale };
  }

  const passages = ranked
    .filter(([, score]) => score >= top * RELATIVE_CUTOFF)
    .slice(0, MAX_PASSAGES)
    .map(([passage]) => ({
      id: passage.id,
      docId: passage.docId,
      topics: passage.topics,
      fr: passage.fr,
      en: passage.en
    }));
  return { kind: "model", locale, passages };
}
