import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import TurndownService from "turndown";
import slugify from "slugify";
import { format } from "date-fns";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "content/news/en");
const ASSET_DIR = path.join(ROOT, "public/news-assets");

const BUILDER_MODEL = process.env.BUILDER_NEWS_MODEL || "post";
const BUILDER_PUBLIC_KEY = process.env.BUILDER_PUBLIC_KEY || "";

const turndown = new TurndownService({ headingStyle: "atx" });

type BuilderEntry = {
  id: string;
  name?: string;
  slug?: string;
  data?: Record<string, any>;
  published?: string; // ISO
  firstPublished?: string; // ISO
  createdDate?: string; // ISO
  locale?: string; // "en", "fr", etc.
};

const ensureDirs = async () => {
  await fs.mkdir(OUT_DIR, { recursive: true });
  await fs.mkdir(ASSET_DIR, { recursive: true });
};

const builderUrl = (params: Record<string, string | number | boolean>) => {
  const u = new URL(`https://cdn.builder.io/api/v3/content/${BUILDER_MODEL}`);
  const key = BUILDER_PUBLIC_KEY;
  u.searchParams.set("apiKey", key);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  return u.toString();
};

async function fetchBuilderNews(): Promise<BuilderEntry[]> {
  const url = builderUrl({
    limit: 200,
    fields: "id,name,slug,data,published,firstPublished,createdDate,locale",
  });
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Builder fetch failed: ${res.status}`);
  const json = await res.json();
  const results: BuilderEntry[] = json?.results || [];
  return results.filter((r) =>
    (r.locale || "en").toLowerCase().startsWith("en")
  );
}

function toYYYYMMDD(iso?: string) {
  if (!iso) return "";
  try {
    return format(new Date(iso), "yyyy-MM-dd");
  } catch {
    return "";
  }
}

// Safely unwrap Builder LocalizedValue and other shapes to a string
function asString(val: any): string {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  if (Array.isArray(val)) return val.map(asString).filter(Boolean).join(", ");
  if (typeof val === "object") {
    if (val["@type"] === "@builder.io/core:LocalizedValue") {
      const primary = (val as any).Default ?? (val as any).en;
      if (primary != null) return asString(primary);
      const firstStr = Object.values(val as any).find(
        (v) => typeof v === "string"
      );
      if (firstStr != null) return asString(firstStr);
      return "";
    }
    if (typeof (val as any).value !== "undefined")
      return asString((val as any).value);
    if (typeof (val as any).text !== "undefined")
      return asString((val as any).text);
    if (typeof (val as any).html !== "undefined")
      return asString((val as any).html);
    if (typeof (val as any).markdown !== "undefined")
      return asString((val as any).markdown);
    if (typeof (val as any).longText !== "undefined")
      return asString((val as any).longText);
  }
  return "";
}

// Recursively collect text/html from arbitrary Builder blocks/content
function collectTextualContent(input: any): {
  htmlParts: string[];
  mdParts: string[];
} {
  const htmlParts: string[] = [];
  const mdParts: string[] = [];

  const visit = (val: any, key?: string) => {
    if (val == null) return;
    if (typeof val === "string") {
      // Heuristic: treat strings with tags as HTML, others as markdown text
      if (/<[a-z][\s\S]*>/i.test(val)) htmlParts.push(val);
      else mdParts.push(val);
      return;
    }
    if (typeof val === "number" || typeof val === "boolean") {
      mdParts.push(String(val));
      return;
    }
    if (Array.isArray(val)) {
      val.forEach((v) => visit(v));
      return;
    }
    if (typeof val === "object") {
      // Localized value or simple wrappers
      const unwrapped = asString(val);
      if (unwrapped) {
        visit(unwrapped);
        return;
      }
      for (const [k, v] of Object.entries(val)) {
        const lower = k.toLowerCase();
        // Skip common non-body fields
        if (lower === "title" || lower === "description" || lower === "slug")
          continue;

        if (lower.includes("html")) {
          const s = asString(v);
          if (s) htmlParts.push(s);
          continue;
        }
        if (lower.includes("markdown") || lower === "md") {
          const s = asString(v);
          if (s) mdParts.push(s);
          continue;
        }
        if (lower.includes("text") || lower.includes("longtext")) {
          const s = asString(v);
          if (s) mdParts.push(s);
          continue;
        }
        // Common Builder shapes
        if (
          lower === "options" ||
          lower === "component" ||
          lower === "children" ||
          lower === "blocks" ||
          lower === "content" ||
          lower === "body"
        ) {
          visit(v, k);
          continue;
        }
        // Generic fallback recursion
        visit(v, k);
      }
    }
  };

  visit(input);
  return {
    htmlParts: htmlParts.filter(Boolean),
    mdParts: mdParts.filter(Boolean),
  };
}

function deriveSlug(entry: BuilderEntry) {
  const raw =
    asString(entry?.data?.slug) ||
    asString(entry.slug) ||
    asString(entry.name) ||
    "untitled";
  return slugify(String(raw), { lower: true, strict: true });
}

function extractHtmlOrText(entry: BuilderEntry): {
  html?: string;
  markdown?: string;
} {
  const d = entry.data || {};

  // Obvious direct fields
  const htmlDirect =
    asString(d.bodyHtml) || asString(d.html) || asString(d.richTextHtml);

  const mdDirect = asString(d.markdown) || asString(d.longText);

  // Heuristic collection from nested content/blocks/children/etc.
  const fromNested = collectTextualContent({
    blocks: d.blocks,
    content: d.content,
    body: d.body,
    article: d.article,
    postContent: d.postContent,
    richText: (d as any).richText,
  });

  const htmlCollected = fromNested.htmlParts.join("\n\n");
  const mdCollected = fromNested.mdParts.join("\n\n");

  const html =
    (htmlDirect && htmlDirect.trim()) ||
    (htmlCollected && htmlCollected.trim()) ||
    undefined;

  const markdown =
    (mdDirect && mdDirect.trim()) ||
    (mdCollected && mdCollected.trim()) ||
    undefined;

  return { html, markdown };
}

function htmlToMarkdown(html: string) {
  return turndown.turndown(html);
}

function detectSimdNumber(str: string): number | undefined {
  const m = str.match(/\bSIMD[-\s#:]?(\d{1,4})\b/i);
  return m ? Number(m[1]) : undefined;
}

async function downloadAsset(url: string): Promise<string | undefined> {
  try {
    const u = new URL(url);
    const base = path.basename(u.pathname).split("?")[0];
    const safe = base || `asset-${Date.now()}`;
    const dest = path.join(ASSET_DIR, safe);
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(dest, buf);
    return `/news-assets/${safe}`;
  } catch {
    return undefined;
  }
}

type Frontmatter = {
  title: string;
  description: string;
  slug: string;
  status?: "draft" | "published" | "archived";
  date: string;
  audiences: string[];
  topics: string[];
  heroImage?: string;
  simdNumber?: number;
};

function composeFrontmatter(
  entry: BuilderEntry,
  body: string,
  heroPath?: string
): Frontmatter {
  const d = entry.data || {};
  const title = asString(d.title) || asString(entry.name) || "Untitled";
  const description = asString(d.description) || "";
  const slug = deriveSlug(entry);
  const date = toYYYYMMDD(
    entry.firstPublished || entry.published || entry.createdDate
  );
  const status: "draft" | "published" | "archived" = entry.published
    ? "published"
    : "published";

  const audiences: string[] = Array.isArray(d.audiences)
    ? d.audiences.map(asString).filter(Boolean)
    : [];

  const topics: string[] = Array.isArray(d.topics)
    ? d.topics.map(asString).filter(Boolean)
    : [];

  const simdNumber =
    d.simdNumber || detectSimdNumber(title + " " + description + " " + body);
  const heroImage = heroPath;

  return {
    title,
    description,
    slug,
    status,
    date,
    audiences,
    topics,
    heroImage,
    simdNumber,
  };
}

function sanitizeFrontmatter(fm: Frontmatter): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(fm)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

async function writeMdx(fm: Frontmatter, body: string) {
  const file = path.join(OUT_DIR, `${fm.slug}.mdx`);
  const cleanFm = sanitizeFrontmatter(fm);
  const src = matter.stringify(
    String(body ?? "").trim() + "\n",
    cleanFm as any
  );
  await fs.writeFile(file, src, "utf8");
  return file;
}

async function run() {
  if (!BUILDER_PUBLIC_KEY) {
    throw new Error("Set BUILDER_PUBLIC_KEY");
  }
  await ensureDirs();
  const entries = await fetchBuilderNews();

  for (const e of entries) {
    const { html, markdown } = extractHtmlOrText(e);

    // Prefer raw HTML to preserve markup; fall back to markdown
    const rawBody = html && html.trim() ? html : markdown || "";

    const heroUrlRaw = e.data?.heroImage || e.data?.image || "";
    const heroUrl = asString(heroUrlRaw);
    const heroPath = heroUrl ? await downloadAsset(heroUrl) : undefined;

    const fm = composeFrontmatter(e, rawBody, heroPath);

    // Ensure body is never empty
    const body = rawBody || fm.description || fm.title;

    const outfile = await writeMdx(fm, body);
    console.log(`Wrote ${outfile}`);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
