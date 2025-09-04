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

function deriveSlug(entry: BuilderEntry) {
  const raw = entry?.data?.slug || entry.slug || entry.name || "untitled";
  return slugify(String(raw), { lower: true, strict: true });
}

function extractHtmlOrText(entry: BuilderEntry): {
  html?: string;
  markdown?: string;
} {
  const d = entry.data || {};
  if (typeof d.bodyHtml === "string") return { html: d.bodyHtml };
  if (typeof d.html === "string") return { html: d.html };
  if (typeof d.richTextHtml === "string") return { html: d.richTextHtml };
  if (typeof d.markdown === "string") return { markdown: d.markdown };
  if (typeof d.longText === "string") return { markdown: d.longText };
  if (Array.isArray(d.blocks)) {
    try {
      const text = d.blocks
        .map((b: any) => b?.options?.text || "")
        .filter(Boolean)
        .join("\n\n");
      if (text) return { markdown: text };
    } catch {}
  }
  return { markdown: "" };
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
  mdBody: string,
  heroPath?: string
): Frontmatter {
  const d = entry.data || {};
  const title = d.title || entry.name || "Untitled";
  const description = d.description || "";
  const slug = deriveSlug(entry);
  const date = toYYYYMMDD(
    entry.firstPublished || entry.published || entry.createdDate
  );
  // Public CDN returns only published entries; default to "published"
  const status: "draft" | "published" | "archived" = entry.published
    ? "published"
    : "published";
  const audiences: string[] = Array.isArray(d.audiences)
    ? d.audiences.filter(Boolean).map(String)
    : [];
  const topics: string[] = Array.isArray(d.topics)
    ? d.topics.filter(Boolean).map(String)
    : [];
  const simdNumber =
    d.simdNumber || detectSimdNumber(title + " " + description + " " + mdBody);
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

async function writeMdx(fm: Frontmatter, bodyMd: string) {
  const file = path.join(OUT_DIR, `${fm.slug}.mdx`);
  const cleanFm = sanitizeFrontmatter(fm);
  const src = matter.stringify(
    String(bodyMd ?? "").trim() + "\n",
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
    const bodyMd = html
      ? htmlToMarkdown(html)
      : typeof markdown === "string"
      ? markdown
      : "";

    const heroUrl = e.data?.heroImage || e.data?.image || "";
    const heroPath = heroUrl ? await downloadAsset(heroUrl) : undefined;

    const fm = composeFrontmatter(e, bodyMd, heroPath);

    const outfile = await writeMdx(fm, bodyMd || fm.description || fm.title);
    console.log(`Wrote ${outfile}`);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
