/* scripts/export-builder.ts */
import fs from "node:fs/promises";
import path from "node:path";

type BuilderContent = {
  id: string;
  name?: string;
  modelId?: string;
  published?: string | null;
  createdDate?: number;
  lastUpdated?: number;
  query?: unknown;
  data?: Record<string, any>;
  variations?: any[];
  testRatio?: number;
  createdBy?: string;
  meta?: Record<string, any>;
  locale?: string;
  [k: string]: any;
};

const API_KEY = process.env.NEXT_PUBLIC_BUILDER_API_KEY || "";
const SETTINGS_ID = process.env.NEXT_PUBLIC_BUILDER_NEWS_SETTINGS_ID || "";
const BUILDER_ENV = (
  process.env.NEXT_PUBLIC_BUILDER_ENV || "production"
).toLowerCase();

if (!API_KEY) {
  console.error("Missing env NEXT_PUBLIC_BUILDER_API_KEY");
  process.exit(1);
}
if (!SETTINGS_ID) {
  console.error("Missing env NEXT_PUBLIC_BUILDER_NEWS_SETTINGS_ID");
  process.exit(1);
}

const PREVIEW = BUILDER_ENV !== "production";
const API_BASE = "https://cdn.builder.io/api/v3/content";

// Try common model names for articles
const CANDIDATE_MODELS = [
  "news-article",
  "article",
  "news",
  "blog-article",
  "post",
  "posts",
];

function refObject(id: string) {
  return { "@type": "@builder.io/core:Reference", id };
}

// Two possible field names where settings reference may live
const SETTINGS_FIELD_CANDIDATES = ["data.settings", "data.siteSettings"];

function encodeQueryParam(obj: any) {
  return encodeURIComponent(JSON.stringify(obj));
}

async function httpGet<T>(
  url: string,
  retries = 4,
  backoffMs = 500
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: { "User-Agent": "solana-news-export/1.0" },
    });
    if (res.ok) {
      return res.json() as Promise<T>;
    }
    const status = res.status;
    const retryable = status >= 500 || status === 429;
    if (attempt < retries && retryable) {
      const wait = backoffMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const text = await res.text().catch(() => "");
    throw new Error(
      `Request failed (${status}): ${text || res.statusText} for ${url}`
    );
  }
  throw new Error("Unreachable");
}

async function probeModelAndQuery(): Promise<{
  model: string;
  queryParam: string | null;
}> {
  // Prefer to probe with a settings reference first
  const queryVariants: Array<Record<string, any> | null> = [
    {
      $or: SETTINGS_FIELD_CANDIDATES.map((field) => ({
        [field]: refObject(SETTINGS_ID),
      })),
    },
    // Some projects store just the id in a field
    {
      $or: SETTINGS_FIELD_CANDIDATES.map((field) => ({ [field]: SETTINGS_ID })),
    },
    null, // fallback: no filter
  ];

  for (const model of CANDIDATE_MODELS) {
    for (const q of queryVariants) {
      const url =
        `${API_BASE}/${model}?` +
        [
          `apiKey=${API_KEY}`,
          `limit=1`,
          `offset=0`,
          `cachebust=1`,
          PREVIEW ? `includeUnpublished=true` : `includeUnpublished=false`,
          PREVIEW ? `preview=true` : `preview=false`,
          q ? `query=${encodeQueryParam(q)}` : null,
        ]
          .filter(Boolean)
          .join("&");

      try {
        const data = await httpGet<{ results: BuilderContent[] }>(url);
        if (Array.isArray(data?.results) && data.results.length > 0) {
          return {
            model,
            queryParam: q ? `query=${encodeQueryParam(q)}` : null,
          };
        }
      } catch {
        // Ignore probe errors and continue
      }
    }
  }

  // Final fallback: use first candidate without query; it may still return content
  return { model: CANDIDATE_MODELS[0], queryParam: null };
}

async function fetchAllContent(
  model: string,
  queryParam: string | null
): Promise<BuilderContent[]> {
  const pageSize = 100;
  let offset = 0;
  const all: BuilderContent[] = [];

  while (true) {
    const url =
      `${API_BASE}/${model}?` +
      [
        `apiKey=${API_KEY}`,
        `limit=${pageSize}`,
        `offset=${offset}`,
        `cachebust=1`,
        PREVIEW ? `includeUnpublished=true` : `includeUnpublished=false`,
        PREVIEW ? `preview=true` : `preview=false`,
        queryParam,
      ]
        .filter(Boolean)
        .join("&");

    const data = await httpGet<{ results: BuilderContent[] }>(url);
    const items = Array.isArray(data?.results) ? data.results : [];
    all.push(...items);
    if (items.length < pageSize) break;
    offset += pageSize;
  }

  return all;
}

function slugify(input: string) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

async function writeOutput(contents: BuilderContent[]) {
  const outDir = path.resolve(process.cwd(), "@builder");
  await fs.mkdir(outDir, { recursive: true });

  const index: Array<{
    id: string;
    file: string;
    name?: string;
    slug?: string;
    locale?: string;
    published?: string | null;
    date?: string | number | null;
  }> = [];

  for (const item of contents) {
    const locale = item.locale || item?.data?.locale || "en";
    const slug =
      item?.data?.slug ||
      (item?.data?.title ? slugify(item.data.title) : "") ||
      item.id;
    const filename = `${locale}__${slug || item.id}.json`;
    const filePath = path.join(outDir, filename);
    await fs.writeFile(filePath, JSON.stringify(item, null, 2), "utf8");

    index.push({
      id: item.id,
      file: filename,
      name: item.name,
      slug: item?.data?.slug || slug,
      locale,
      published: item.published ?? null,
      date: (item as any)?.data?.date ?? null,
    });
  }

  // Aggregate file
  await fs.writeFile(
    path.join(outDir, "news.json"),
    JSON.stringify(contents, null, 2),
    "utf8"
  );
  // Simple index for quick lookups
  await fs.writeFile(
    path.join(outDir, "index.json"),
    JSON.stringify(index, null, 2),
    "utf8"
  );
}

async function main() {
  console.log("Detecting Builder model and query...");
  const { model, queryParam } = await probeModelAndQuery();
  console.log(
    `Using model: ${model}${queryParam ? " with settings filter" : ""}`
  );

  console.log("Fetching content from Builder...");
  const all = await fetchAllContent(model, queryParam);

  console.log(`Fetched ${all.length} item(s). Writing files to @builder/ ...`);
  await writeOutput(all);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
