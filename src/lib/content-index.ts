import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { unstable_cache, revalidateTag } from "next/cache";
import type { ContentMetadata } from "@/lib/parse-mdx";

export const NEWS_CONTENT_ROOT = path.join(process.cwd(), "content", "news");
export const NEWS_INDEX_TAG = "news-index";

export type ArticleStatus = "draft" | "published" | "archived";

export type ArticleIndexItem = Omit<ContentMetadata, "slug" | "date"> & {
  // Use string for frontmatter date for portability; keep as-is from file.
  date: string;
  slug: string;
  locale: string;
  path: string;
  status?: ArticleStatus;
};

/**
 * Recursively scans /content/news/<locale> for .mdx files
 * and builds a typed index array using frontmatter + derived fields.
 */
async function scanNewsDirectory(): Promise<ArticleIndexItem[]> {
  // locales are the immediate directories within NEWS_CONTENT_ROOT
  let locales: string[] = [];
  try {
    const entries = await fs.readdir(NEWS_CONTENT_ROOT, {
      withFileTypes: true,
    });
    locales = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }

  const items: ArticleIndexItem[] = [];

  for (const locale of locales) {
    const localeDir = path.join(NEWS_CONTENT_ROOT, locale);
    const files = await fs.readdir(localeDir, { withFileTypes: true });

    for (const file of files) {
      if (!file.isFile()) continue;
      if (!file.name.toLowerCase().endsWith(".mdx")) continue;

      const slugFromFilename = file.name.replace(/\.mdx$/i, "");
      const filePath = path.join(localeDir, file.name);
      const raw = await fs.readFile(filePath, "utf8");
      const { data } = matter(raw);

      // frontmatter is user-provided; normalize to our typed shape with safe fallbacks
      const fm = (data || {}) as Partial<ContentMetadata> & {
        status?: ArticleStatus;
      };

      const item: ArticleIndexItem = {
        title: String(fm.title ?? slugFromFilename),
        description: String(fm.description ?? ""),
        // Prefer frontmatter slug; fall back to filename-derived slug
        slug: fm.slug ? String(fm.slug) : slugFromFilename,
        date: String(fm.date ?? ""),
        audiences: Array.isArray(fm.audiences)
          ? (fm.audiences as string[])
          : [],
        topics: Array.isArray(fm.topics) ? (fm.topics as string[]) : [],
        heroImage: fm.heroImage ? String(fm.heroImage) : undefined,
        simdNumber:
          typeof (fm as any).simdNumber === "number"
            ? (fm as any).simdNumber
            : undefined,
        status:
          fm.status && ["draft", "published", "archived"].includes(fm.status)
            ? fm.status
            : undefined,
        locale,
        path: filePath,
      };

      items.push(item);
    }
  }

  // Sort newest first where dates are comparable; otherwise leave relative order
  items.sort((a, b) => {
    const da = Date.parse(a.date || "");
    const db = Date.parse(b.date || "");
    if (Number.isNaN(da) && Number.isNaN(db)) return 0;
    if (Number.isNaN(da)) return 1;
    if (Number.isNaN(db)) return -1;
    return db - da;
  });

  return items;
}

// Cached accessor with ISR tag support
const getNewsIndexCached = unstable_cache(
  async () => {
    return scanNewsDirectory();
  },
  ["getNewsIndex"],
  {
    tags: [NEWS_INDEX_TAG],
  }
);

export async function getNewsIndex(): Promise<ArticleIndexItem[]> {
  if (process.env.NODE_ENV !== "production") {
    return scanNewsDirectory();
  }
  return getNewsIndexCached();
}

export function revalidateNewsIndex() {
  revalidateTag(NEWS_INDEX_TAG);
}

// Filters
export function filterByAudience(
  items: ArticleIndexItem[],
  audience: string
): ArticleIndexItem[] {
  return items.filter((it) => it.audiences?.includes(audience));
}

export type TopicMatchMode = "any" | "all";
export function filterByTopics(
  items: ArticleIndexItem[],
  topics: string[],
  mode: TopicMatchMode = "any"
): ArticleIndexItem[] {
  if (!topics.length) return items;
  return items.filter((it) => {
    const set = new Set(it.topics || []);
    if (mode === "all") {
      return topics.every((t) => set.has(t));
    }
    return topics.some((t) => set.has(t));
  });
}

export function filterByStatus(
  items: ArticleIndexItem[],
  status: ArticleStatus
): ArticleIndexItem[] {
  return items.filter((it) => it.status === status);
}

// Convenience combined filter
export function filterArticles(opts: {
  items: ArticleIndexItem[];
  audience?: string;
  section?: string;
  topics?: string[];
  topicMode?: TopicMatchMode;
  status?: ArticleStatus;
}): ArticleIndexItem[] {
  const {
    items,
    audience,
    section,
    topics = [],
    topicMode = "any",
    status,
  } = opts;
  let out = items;
  if (audience) out = filterByAudience(out, audience);
  if (section) out = filterBySection(out, section);
  if (topics.length) out = filterByTopics(out, topics, topicMode);
  if (status) out = filterByStatus(out, status);
  return out;
}
