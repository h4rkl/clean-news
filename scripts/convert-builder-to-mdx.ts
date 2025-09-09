/* scripts/convert-builder-to-mdx.ts */
import fs from "node:fs/promises";
import path from "node:path";
import { dump as toYAML } from "js-yaml";

type LocalizedValue<T = string> = {
  "@type": "@builder.io/core:LocalizedValue";
  Default?: T;
  [locale: string]: T | any;
};

type BuilderRef = {
  "@type": "@builder.io/core:Reference";
  id: string;
  model?: string;
};

type BuilderElement = {
  "@type": "@builder.io/sdk:Element";
  "@version"?: number;
  id?: string;
  component?: {
    name: string;
    options?: Record<string, any>;
    isRSC?: any;
  };
  children?: BuilderElement[];
  meta?: Record<string, any>;
  responsiveStyles?: Record<string, any>;
};

type BuilderDoc = {
  id: string;
  name?: string;
  published?: string | null;
  createdDate?: number;
  lastUpdated?: number;
  modelId?: string;
  locale?: string;
  data: {
    title?: string | LocalizedValue<string>;
    intro?: string;
    slug?: string;
    image?: string;
    datePublished?: number;
    publishedDate?: string;
    seo?: {
      internalName?: string;
      seoTitle?: string;
      seoDescription?: string;
      seoImage?: string;
      noIndex?: boolean;
      noFollow?: boolean;
    };
    openGraph?: Record<string, any>;
    twitterMeta?: Record<string, any>;
    tags?: Array<{ tag: BuilderRef }>;
    blocks?: BuilderElement[];
    [k: string]: any;
  };
  meta?: {
    componentsUsed?: Record<string, number>;
    [k: string]: any;
  };
  [k: string]: any;
};

type IndexItem = {
  id: string;
  file: string;
  name?: string;
  slug?: string;
  locale?: string;
  published?: string | null;
  date?: string | number | null;
};

const REPO_ROOT = process.cwd();
const BUILDER_DIR = path.resolve(REPO_ROOT, "@builder");
const OUTPUT_ROOT = path.resolve(REPO_ROOT, "content/news");
const PUBLIC_ROOT = path.resolve(REPO_ROOT, "public");

// Components that are layout-only; unwrap their children without wrapping
const WRAPPER_COMPONENTS = new Set<string>(["Section Molecule"]);

type TurndownLike = {
  new (opts?: any): {
    use: (...plugins: any[]) => any;
    addRule: (name: string, rule: any) => any;
    keep: (filter: any) => any;
    turndown: (html: string) => string;
  };
};

async function loadTurndown(): Promise<{
  TurndownService: TurndownLike | null;
  gfm: any | null;
}> {
  try {
    // @ts-ignore
    const mod = await import("turndown");
    // @ts-ignore
    let gfm: any = null;
    try {
      // @ts-ignore
      const g = await import("turndown-plugin-gfm");
      gfm = g.gfm || g.default?.gfm || null;
    } catch {
      gfm = null;
    }
    const TurndownService = (mod as any).default || (mod as any);
    return { TurndownService, gfm };
  } catch {
    return { TurndownService: null, gfm: null };
  }
}

function ensureDir(p: string) {
  return fs.mkdir(p, { recursive: true });
}

function readJSON<T = any>(file: string): Promise<T> {
  return fs.readFile(file, "utf8").then((s) => JSON.parse(s));
}

function safeSlug(s: string) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatDate(d?: number | string | null): string | undefined {
  if (!d) return undefined;
  let date: Date;
  if (typeof d === "number") date = new Date(d);
  else {
    const parsed = Date.parse(d);
    if (Number.isNaN(parsed)) return undefined;
    date = new Date(parsed);
  }
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const day = `${date.getUTCDate()}`.padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function unwrapLocalized<T = string>(
  v: T | LocalizedValue<T> | undefined,
  locale: string
): T | undefined {
  if (v == null) return undefined;
  const isLoc =
    typeof v === "object" &&
    (v as any)["@type"] === "@builder.io/core:LocalizedValue";
  if (!isLoc) return v as T;
  const lv = v as LocalizedValue<T>;
  // Try exact locale, then normalized code, then Default
  const norm = locale.toLowerCase().split("-")[0];
  if (lv[locale]) return lv[locale] as T;
  if (lv[norm]) return lv[norm] as T;
  if (lv.Default) return lv.Default as T;
  const keys = Object.keys(lv).filter((k) => k !== "@type");
  return keys.length ? (lv[keys[0]] as T) : undefined;
}

function isHtmlComplex(html: string): boolean {
  // Heuristic: if content includes tables, iframes, inline styles, scripts, or custom tags, keep as raw HTML
  return (
    /<(table|thead|tbody|tr|td|th|iframe|video|audio|script|style|svg)\b/i.test(
      html
    ) ||
    /\sstyle\s*=/i.test(html) ||
    /data-[\w-]+=/i.test(html) ||
    /<code\b/i.test(html) ||
    /<pre\b/i.test(html)
  );
}

function mdxJsxProps(obj: any): string {
  // Render object as inline MDX expression props: options={{...}}
  // Keep it compact while JSON-stringifying safely
  const json = JSON.stringify(obj ?? {}, null, 2).replace(/</g, "\\u003c"); // prevent accidental HTML closing
  return `{${json}}`;
}

function extFromContentType(ct?: string): string {
  const base = (ct || "").split(";")[0].trim().toLowerCase();
  switch (base) {
    case "image/jpeg":
    case "image/jpg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/svg+xml":
      return ".svg";
    case "image/avif":
      return ".avif";
    default:
      return "";
  }
}

function guessExtFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const ext = path.extname(u.pathname).toLowerCase();
    return ext;
  } catch {
    return "";
  }
}

function escapeMdText(s: string): string {
  return String(s ?? "").replace(/[\\`*_{}\[\]\(\)#\+\-.!]/g, "\\$&");
}

async function saveImageToPublic(
  url: string,
  slug: string,
  baseName: string
): Promise<string> {
  const dir = path.join(PUBLIC_ROOT, slug);
  await ensureDir(dir);

  const fetchFn = (globalThis as any).fetch as (
    input: any,
    init?: any
  ) => Promise<any>;
  if (!fetchFn) {
    throw new Error("fetch is not available in this Node runtime");
  }

  const res = await fetchFn(url);
  if (!res?.ok) {
    throw new Error(
      `Failed to download image: ${res?.status || ""} ${
        res?.statusText || ""
      }`.trim()
    );
  }
  const ct =
    (res.headers?.get?.("content-type") as string | undefined) || undefined;

  let ext = guessExtFromUrl(url) || extFromContentType(ct) || "";
  const arrBuf = await res.arrayBuffer();
  const buf = Buffer.from(arrBuf);

  const fileName = `${baseName}${ext}`;
  const destAbs = path.join(dir, fileName);
  await fs.writeFile(destAbs, buf);

  // Return the public URL path
  return `/${slug}/${fileName}`;
}

async function convertHtmlToMd(
  html: string,
  turndownCache?: { svc?: any; hasGfm?: boolean }
) {
  if (!html.trim()) return "";
  // Keep complex HTML as-is to preserve CSS/semantics
  if (isHtmlComplex(html)) return html;
  if (!turndownCache?.svc) {
    return html; // MDX can render raw HTML; better to keep than to lose fidelity
  }
  const svc = turndownCache.svc;
  try {
    return svc.turndown(html);
  } catch {
    return html;
  }
}

function collectBlocks(el?: BuilderElement): BuilderElement[] {
  if (!el) return [];
  const out: BuilderElement[] = [el];
  (el.children || []).forEach((c) => out.push(...collectBlocks(c)));
  return out;
}

function flattenContentBlocks(blocks: BuilderElement[] = []): BuilderElement[] {
  // Keep DFS order
  const out: BuilderElement[] = [];
  for (const b of blocks) {
    out.push(b);
    if (b.children?.length) {
      out.push(...flattenContentBlocks(b.children));
    }
  }
  return out;
}

function getLocaleFromFilename(file: string): string {
  const base = path.basename(file);
  const m = /^([a-z]{2})(?:[_-])/.exec(base);
  return m?.[1] || "en";
}

function buildFrontmatter(doc: BuilderDoc, locale: string) {
  const titleRaw = doc.data.title;
  const title =
    unwrapLocalized(titleRaw as any, locale) ||
    (typeof titleRaw === "string" ? titleRaw : undefined) ||
    doc.name ||
    "";
  const seoTitle = doc.data.seo?.seoTitle || title || "";
  const seoDescription = doc.data.seo?.seoDescription || doc.data.intro || "";
  const date = formatDate(
    doc.data.datePublished ?? doc.data.publishedDate ?? null
  );
  const heroImage = doc.data.seo?.seoImage || doc.data.image || undefined;
  const slug = doc.data.slug || safeSlug(title) || doc.id;

  const fm: Record<string, any> = {
    title,
    description: seoDescription || "",
    slug,
    date,
    audiences: [],
    topics: [], // requires deref of references to populate names
    heroImage,
    status: doc.published ?? undefined,
    locale: doc.locale || locale,
    seo: {
      title: seoTitle || "",
      description: seoDescription || "",
      image: heroImage || undefined,
      noIndex: doc.data.seo?.noIndex ?? false,
      noFollow: doc.data.seo?.noFollow ?? false,
      openGraph: doc.data.openGraph ?? undefined,
      twitter: doc.data.twitterMeta ?? undefined,
    },
  };

  // Clean up undefined keys
  Object.keys(fm).forEach((k) => (fm[k] === undefined ? delete fm[k] : null));
  Object.keys(fm.seo).forEach((k) =>
    fm.seo[k] === undefined ? delete fm.seo[k] : null
  );

  return fm;
}

function mdxFrontmatter(frontmatter: Record<string, any>) {
  // YAML dump that’s MD frontmatter-friendly
  const yaml = toYAML(frontmatter, { noRefs: true, skipInvalid: true });
  return `---\n${yaml}---`;
}

function extractTextHtml(el: BuilderElement, locale: string): string | null {
  const name = el.component?.name || "";
  const opts = el.component?.options || {};
  if (name === "Copy") {
    const raw = unwrapLocalized<string>(opts.rawHtml as any, locale);
    if (typeof raw === "string") return raw;
  }
  if (name === "Text") {
    const raw = opts.text as string | undefined;
    if (typeof raw === "string") return raw;
  }
  return null;
}

function isWrapper(el: BuilderElement): boolean {
  const name = el.component?.name || "";
  return WRAPPER_COMPONENTS.has(name);
}

function componentWrapperStart(el: BuilderElement): string {
  const name = el.component?.name || "Unknown";
  const opts = el.component?.options || {};
  return `<BuilderBlock name="${name}" options=${mdxJsxProps(opts)}>`;
}

function componentWrapperEnd(): string {
  return `</BuilderBlock>`;
}

async function convertOne(
  doc: BuilderDoc,
  fileHint: string,
  turndownCache: { svc?: any; hasGfm?: boolean }
) {
  const localeFromFile = getLocaleFromFilename(fileHint);
  const locale = doc.locale || localeFromFile || "en";

  const fm = buildFrontmatter(doc, locale);
  const fmStr = mdxFrontmatter(fm);

  const blocks = flattenContentBlocks(doc.data.blocks || []);
  const outParts: string[] = [];
  let imageIdx = 0;

  for (const b of blocks) {
    const asHtml = extractTextHtml(b, locale);
    if (asHtml != null) {
      const md = await convertHtmlToMd(asHtml, turndownCache);
      outParts.push(md.trim());
      continue;
    }

    // Handle Image components: download to public/<slug>/ and emit standard Markdown
    if (b.component?.name === "Image") {
      const opts = b.component?.options || {};
      const url =
        (typeof opts.image === "string" && opts.image) ||
        (typeof opts.src === "string" && opts.src) ||
        (opts.image?.src as string | undefined) ||
        "";
      const alt =
        (opts.altText as string | undefined) ||
        (opts.alt as string | undefined) ||
        (opts.imageAlt as string | undefined) ||
        "";

      if (url) {
        let publicPath = url;
        try {
          imageIdx += 1;
          publicPath = await saveImageToPublic(
            url,
            fm.slug,
            `image-${imageIdx}`
          );
        } catch {
          // Fallback to remote URL if download fails
        }
        outParts.push(`![${escapeMdText(alt)}](${publicPath})`);
      }
      continue;
    }

    if (isWrapper(b)) {
      // Unwrap layout-only components; children already traversed
      continue;
    }

    if (b.component?.name) {
      // Annotate custom components with JSX wrappers
      outParts.push(componentWrapperStart(b));
      // Children’s content was already collected in DFS; no need to duplicate
      outParts.push(componentWrapperEnd());
      continue;
    }
  }

  // Deduplicate adjacent wrapper pairs or empties
  const body = outParts
    .filter(Boolean)
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const mdx = `${fmStr}\n\n${body}\n`;
  const outDir = path.join(OUTPUT_ROOT, fm.locale || "en");
  await ensureDir(outDir);
  const file = path.join(outDir, `${fm.slug}.mdx`);
  await fs.writeFile(file, mdx, "utf8");
  return file;
}

async function main() {
  const indexPath = path.join(BUILDER_DIR, "index.json");
  const exists = await fs
    .stat(indexPath)
    .then(() => true)
    .catch(() => false);
  if (!exists) {
    console.error(`Missing @builder/index.json at ${indexPath}`);
    process.exit(1);
  }

  const { TurndownService, gfm } = await loadTurndown();
  const turndownCache: { svc?: any; hasGfm?: boolean } = {};
  if (TurndownService) {
    const svc = new (TurndownService as any)({
      codeBlockStyle: "fenced",
      headingStyle: "atx",
      bulletListMarker: "-",
      emDelimiter: "_",
      hr: "---",
      linkStyle: "inlined",
    });
    if (gfm) {
      try {
        svc.use(gfm);
        turndownCache.hasGfm = true;
      } catch {
        turndownCache.hasGfm = false;
      }
    }
    // Keep tags we know are tricky to convert cleanly
    svc.keep([
      "iframe",
      "video",
      "audio",
      "table",
      "thead",
      "tbody",
      "tr",
      "td",
      "th",
      "pre",
      "code",
      "style",
      "script",
      "svg",
    ]);
    // Preserve <a target rel> attributes by not forcing conversion into reference-style
    turndownCache.svc = svc;
  } else {
    console.warn(
      "turndown not found; keeping HTML segments as raw HTML in MDX. Run: pnpm add -D turndown turndown-plugin-gfm"
    );
  }

  const index: IndexItem[] = await readJSON(indexPath);
  const componentsSeen = new Map<string, number>();
  const outputs: string[] = [];

  for (const item of index) {
    const filePath = path.join(BUILDER_DIR, item.file);
    try {
      const doc: BuilderDoc = await readJSON(filePath);

      // Track components used
      const used = doc.meta?.componentsUsed || {};
      for (const [k, v] of Object.entries(used)) {
        componentsSeen.set(k, (componentsSeen.get(k) || 0) + Number(v || 1));
      }

      const outFile = await convertOne(doc, item.file, turndownCache);
      outputs.push(outFile);
      console.log(`Wrote ${outFile}`);
    } catch (e: any) {
      console.error(`Failed to convert ${filePath}: ${e?.message || e}`);
    }
  }

  // Save component inventory for future mapping
  const inv = Object.fromEntries(
    [...componentsSeen.entries()].sort((a, b) => b[1] - a[1])
  );
  const invPath = path.join(REPO_ROOT, "scripts", ".builder-components.json");
  await ensureDir(path.dirname(invPath));
  await fs.writeFile(invPath, JSON.stringify(inv, null, 2), "utf8");
  console.log(`Component inventory saved to ${invPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
