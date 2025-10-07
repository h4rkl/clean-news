/* scripts/export-builder-authors.ts */
import fs from "node:fs/promises";
import path from "node:path";

/** ---------------------- Types ---------------------- */
type BuilderRef = {
  "@type": "@builder.io/core:Reference";
  model?: string;
  id: string;
};
type BuilderContent = {
  id: string;
  name?: string;
  modelId?: string;
  published?: string | null;
  createdDate?: number;
  lastUpdated?: number;
  locale?: string;
  data?: Record<string, any>;
  [k: string]: any;
};

/** ---------------------- Config ---------------------- */
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

// Likely article model names
const CANDIDATE_MODELS = [
  "news-article",
  "article",
  "news",
  "blog-article",
  "post",
  "posts",
];

// Where project-level settings may be referenced
const SETTINGS_FIELD_CANDIDATES = ["data.settings", "data.siteSettings"];

/** ---------------------- Utils ---------------------- */
function refObject(id: string) {
  return { "@type": "@builder.io/core:Reference", id };
}
function encodeQueryParam(obj: any) {
  return encodeURIComponent(JSON.stringify(obj));
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

/** ---------------------- HTTP ---------------------- */
async function httpGet<T>(
  url: string,
  retries = 4,
  backoffMs = 500
): Promise<T> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, {
      headers: { "User-Agent": "builder-authors-export/1.0" },
    });
    if (res.ok) return res.json() as Promise<T>;
    const retryable = res.status >= 500 || res.status === 429;
    if (attempt < retries && retryable) {
      const wait = backoffMs * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    const text = await res.text().catch(() => "");
    throw new Error(
      `Request failed (${res.status}): ${text || res.statusText} for ${url}`
    );
  }
  throw new Error("Unreachable");
}

/** ---------------------- Probe + Fetch posts ---------------------- */
async function probeModelAndQuery(): Promise<{
  model: string;
  queryParam: string | null;
}> {
  const queryVariants: Array<Record<string, any> | null> = [
    {
      $or: SETTINGS_FIELD_CANDIDATES.map((f) => ({
        [f]: refObject(SETTINGS_ID),
      })),
    },
    { $or: SETTINGS_FIELD_CANDIDATES.map((f) => ({ [f]: SETTINGS_ID })) },
    null,
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
        // keep probing
      }
    }
  }
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

/** ---------------------- Extract author references from posts ---------------------- */
type RefKey = string; // `${model}::${id}`
type AuthorRefMap = Map<
  RefKey,
  { model: string; id: string; usedByIds: Set<string> }
>;

function isRef(obj: any): obj is BuilderRef {
  return (
    obj &&
    typeof obj === "object" &&
    obj["@type"] === "@builder.io/core:Reference" &&
    typeof obj.id === "string"
  );
}

function collectAuthorRefsFromValue(
  value: any,
  out: AuthorRefMap,
  postId: string
) {
  if (!value) return;
  if (Array.isArray(value)) {
    for (const item of value) collectAuthorRefsFromValue(item, out, postId);
    return;
  }
  if (isRef(value)) {
    const model = value.model || "entity-blog-authors"; // default if missing
    const key = `${model}::${value.id}`;
    if (!out.has(key))
      out.set(key, { model, id: value.id, usedByIds: new Set<string>() });
    out.get(key)!.usedByIds.add(postId);
    return;
  }
  if (typeof value === "object") {
    // common shape: { author: { @type: Reference, model, id } }
    if (isRef(value.author)) {
      const r = value.author;
      const model = r.model || "entity-blog-authors";
      const key = `${model}::${r.id}`;
      if (!out.has(key))
        out.set(key, { model, id: r.id, usedByIds: new Set<string>() });
      out.get(key)!.usedByIds.add(postId);
      return;
    }
    // dive a little, but limit breadth to known keys
    for (const k of Object.keys(value)) {
      if (
        [
          "author",
          "authors",
          "writer",
          "writers",
          "contributor",
          "contributors",
          "by",
          "createdBy",
        ].includes(k)
      ) {
        collectAuthorRefsFromValue(value[k], out, postId);
      }
    }
  }
}

function collectAllAuthorRefs(posts: BuilderContent[]): {
  refs: AuthorRefMap;
  postToAuthorIds: Record<string, string[]>;
} {
  const refs: AuthorRefMap = new Map();
  const postToAuthorIds: Record<string, string[]> = {};
  for (const post of posts) {
    const d = post.data || {};
    const before = refs.size;
    collectAuthorRefsFromValue(d.author, refs, post.id);
    collectAuthorRefsFromValue(d.authors, refs, post.id);
    collectAuthorRefsFromValue(d.writer, refs, post.id);
    collectAuthorRefsFromValue(d.writers, refs, post.id);
    collectAuthorRefsFromValue(d.contributor, refs, post.id);
    collectAuthorRefsFromValue(d.contributors, refs, post.id);
    collectAuthorRefsFromValue(d.by, refs, post.id);
    collectAuthorRefsFromValue(d.createdBy, refs, post.id);

    // record mapping for this post
    const addedForThisPost: string[] = [];
    if (refs.size > before) {
      // pull keys that include this post.id
      for (const [key, rec] of refs) {
        if (rec.usedByIds.has(post.id)) {
          const [, id] = key.split("::");
          if (!addedForThisPost.includes(id)) addedForThisPost.push(id);
        }
      }
    }
    postToAuthorIds[post.id] = addedForThisPost;
  }
  return { refs, postToAuthorIds };
}

/** ---------------------- Fetch referenced author docs ---------------------- */
async function fetchRefsForModel(
  model: string,
  ids: string[]
): Promise<BuilderContent[]> {
  const out: BuilderContent[] = [];
  const batchSize = 100;
  for (let i = 0; i < ids.length; i += batchSize) {
    const slice = ids.slice(i, i + batchSize);
    const query = { id: { $in: slice } };
    const url =
      `${API_BASE}/${model}?` +
      [
        `apiKey=${API_KEY}`,
        `limit=${batchSize}`,
        `offset=0`,
        `cachebust=1`,
        PREVIEW ? `includeUnpublished=true` : `includeUnpublished=false`,
        PREVIEW ? `preview=true` : `preview=false`,
        `query=${encodeQueryParam(query)}`,
      ].join("&");
    const data = await httpGet<{ results: BuilderContent[] }>(url);
    if (Array.isArray(data?.results)) out.push(...data.results);
  }
  return out;
}

/** ---------------------- Normalize resolved author docs ---------------------- */
function nameOfAuthor(doc: BuilderContent): string {
  const d = doc.data || {};
  return d.name ||
    d.fullName ||
    d.displayName ||
    doc.name ||
    d.title ||
    (d.firstName && d.lastName)
    ? `${d.firstName} ${d.lastName}`
    : d.firstName || d.lastName || d.username || d.email || doc.id;
}
function slugOfAuthor(doc: BuilderContent): string {
  const d = doc.data || {};
  return d.slug || d.handle || d.username || slugify(nameOfAuthor(doc));
}

/** ---------------------- Write outputs ---------------------- */
async function writeOutputs(
  resolvedByModel: Map<string, BuilderContent[]>,
  refMap: AuthorRefMap,
  postToAuthorIds: Record<string, string[]>
) {
  const base = path.resolve(process.cwd(), "@builder", "authors-entity");
  await fs.mkdir(base, { recursive: true });

  // Flatten resolved set + attach usage
  const rows: Array<{
    id: string;
    model: string;
    name: string;
    slug: string;
    locale: string;
    usedByIds: string[];
    email?: string;
    bio?: string;
    avatar?: string;
  }> = [];
  for (const [model, docs] of resolvedByModel) {
    for (const doc of docs) {
      const key = `${model}::${doc.id}`;
      const usage = refMap.get(key)?.usedByIds ?? new Set<string>();
      const d = doc.data || {};
      rows.push({
        id: doc.id,
        model,
        name: nameOfAuthor(doc),
        slug: slugOfAuthor(doc),
        locale: (doc.locale || d.locale || "en").toString(),
        usedByIds: Array.from(usage),
        email: d.email,
        bio: d.bio || d.description || d.about,
        avatar: d.avatar || d.image || d.photo || d.picture,
      });
    }
  }

  // 1) All resolved authors
  await fs.writeFile(
    path.join(base, "resolved-authors.json"),
    JSON.stringify(rows, null, 2),
    "utf8"
  );

  // 2) Id → brief index
  const index: Record<
    string,
    { name: string; slug: string; model: string; email?: string }
  > = {};
  for (const r of rows)
    index[r.id] = {
      name: r.name,
      slug: r.slug,
      model: r.model,
      email: r.email,
    };
  await fs.writeFile(
    path.join(base, "resolved-author-index.json"),
    JSON.stringify(index, null, 2),
    "utf8"
  );

  // 3) Per-model convenience (esp. entity-blog-authors)
  const perModel: Record<string, typeof rows> = {};
  for (const r of rows) {
    (perModel[r.model] ||= []).push(r);
  }
  for (const [model, list] of Object.entries(perModel)) {
    await fs.writeFile(
      path.join(base, `${model}.json`),
      JSON.stringify(list, null, 2),
      "utf8"
    );
  }

  // 4) Post → author ids mapping as used
  await fs.writeFile(
    path.join(base, "post-to-authors.json"),
    JSON.stringify(postToAuthorIds, null, 2),
    "utf8"
  );
}

/** ---------------------- Main ---------------------- */
async function main() {
  console.log("Detecting article model...");
  const { model, queryParam } = await probeModelAndQuery();
  console.log(
    `Using model: ${model}${queryParam ? " with settings filter" : ""}`
  );

  console.log("Fetching posts...");
  const posts = await fetchAllContent(model, queryParam);
  console.log(
    `Fetched ${posts.length} post(s). Extracting author references...`
  );

  const { refs, postToAuthorIds } = collectAllAuthorRefs(posts);
  console.log(`Found ${refs.size} referenced author(s) across all posts.`);

  // Group ids by referenced model
  const byModel = new Map<string, Set<string>>();
  for (const { model: refModel, id } of refs.values()) {
    if (!byModel.has(refModel)) byModel.set(refModel, new Set<string>());
    byModel.get(refModel)!.add(id);
  }

  // Fetch referenced docs
  const resolvedByModel = new Map<string, BuilderContent[]>();
  for (const [refModel, idSet] of byModel) {
    const ids = Array.from(idSet);
    console.log(
      `Resolving ${ids.length} author(s) from model "${refModel}"...`
    );
    const docs = await fetchRefsForModel(refModel, ids);
    resolvedByModel.set(refModel, docs);
    // Note: if some ids not returned (deleted/unpublished), they'll be absent
  }

  console.log("Writing outputs to @builder/authors-entity/ ...");
  await writeOutputs(resolvedByModel, refs, postToAuthorIds);
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
