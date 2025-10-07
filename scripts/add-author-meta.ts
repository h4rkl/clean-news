/* scripts/add-authors-to-posts.ts */
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

/** ---------------------- Types ---------------------- */
type AuthorIndex = Record<
  string,
  {
    name: string;
    slug: string;
    model: string;
    email?: string;
  }
>;

type BuilderIndex = Array<{
  id: string;
  file: string;
  name?: string;
  slug?: string;
  locale?: string;
  published?: string | null;
  date?: string | number | null;
}>;

type BuilderPost = {
  id: string;
  data?: {
    author?: {
      "@type": "@builder.io/core:Reference";
      id: string;
      model?: string;
    };
    slug?: string;
    [key: string]: any;
  };
  [key: string]: any;
};

/** ---------------------- Config ---------------------- */
const SOLANA_NEWS_PATH = "/Users/karambit/Sites/solana-news";
const TINA_NEWS_PATH = "/Users/karambit/Sites/tina-news";

const AUTHOR_INDEX_PATH = path.join(
  SOLANA_NEWS_PATH,
  "@builder/authors-entity/resolved-author-index.json"
);
const BUILDER_DIR = path.join(SOLANA_NEWS_PATH, "@builder");
const POSTS_DIR = path.join(TINA_NEWS_PATH, "content/posts");
const AUTHORS_DIR = path.join(TINA_NEWS_PATH, "content/authors");

/** ---------------------- Utils ---------------------- */
function cleanSlug(slug: string): string {
  // Remove leading slashes and clean up the slug
  return slug.replace(/^\/+/, "").trim();
}

function slugToAuthorPath(slug: string): string {
  const cleanedSlug = cleanSlug(slug);
  return `content/authors/${cleanedSlug}.md`;
}

/** ---------------------- Main Logic ---------------------- */
async function loadAuthorIndex(): Promise<AuthorIndex> {
  const content = await fs.readFile(AUTHOR_INDEX_PATH, "utf8");
  return JSON.parse(content);
}

async function loadBuilderPost(filename: string): Promise<BuilderPost | null> {
  try {
    const filePath = path.join(BUILDER_DIR, filename);
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.warn(`Could not load builder post: ${filename}`);
    return null;
  }
}

async function getAllBuilderFiles(): Promise<string[]> {
  const files = await fs.readdir(BUILDER_DIR);
  return files.filter((f) => f.endsWith(".json") && f.startsWith("en__"));
}

async function getMDXFiles(): Promise<string[]> {
  const files = await fs.readdir(POSTS_DIR);
  return files.filter((f) => f.endsWith(".mdx"));
}

async function updateMDXFile(
  filename: string,
  authorPath: string
): Promise<boolean> {
  try {
    const filePath = path.join(POSTS_DIR, filename);
    const content = await fs.readFile(filePath, "utf8");
    const parsed = matter(content);

    // Check if author already exists
    if (parsed.data.author) {
      console.log(`  ⏭️  Skipped ${filename} (author already exists)`);
      return false;
    }

    // Add author to frontmatter
    parsed.data.author = authorPath;

    // Stringify the updated frontmatter and content
    const updated = matter.stringify(parsed.content, parsed.data);

    // Write back to file
    await fs.writeFile(filePath, updated, "utf8");
    console.log(`  ✅ Updated ${filename} with author: ${authorPath}`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error updating ${filename}:`, error);
    return false;
  }
}

async function ensureAuthorFileExists(slug: string): Promise<boolean> {
  const cleanedSlug = cleanSlug(slug);
  const authorPath = path.join(AUTHORS_DIR, `${cleanedSlug}.md`);

  try {
    await fs.access(authorPath);
    return true;
  } catch {
    // Author file doesn't exist, create it
    const authorName = cleanedSlug
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");

    const authorContent = `---
name: ${authorName}
avatar: /uploads/authors/default-avatar.png
---
`;

    try {
      await fs.writeFile(authorPath, authorContent, "utf8");
      console.log(`  📝 Created author file: ${cleanedSlug}.md`);
      return true;
    } catch (error) {
      console.error(`  ❌ Could not create author file: ${cleanedSlug}.md`);
      return false;
    }
  }
}

async function main() {
  console.log("🚀 Starting author mapping process...\n");

  // Step 1: Load author index
  console.log("📖 Loading author index...");
  const authorIndex = await loadAuthorIndex();
  console.log(`Found ${Object.keys(authorIndex).length} authors\n`);

  // Step 2: Get all builder files
  console.log("📂 Scanning builder files...");
  const builderFiles = await getAllBuilderFiles();
  console.log(`Found ${builderFiles.length} builder files\n`);

  // Step 3: Build a map of slug -> author
  console.log("🔗 Building slug to author mapping...");
  const slugToAuthor = new Map<string, { id: string; slug: string }>();

  for (const filename of builderFiles) {
    const post = await loadBuilderPost(filename);
    if (!post?.data) continue;

    const postSlug = post.data.slug;
    const authorRef = post.data.author;

    if (postSlug && authorRef?.id) {
      const authorInfo = authorIndex[authorRef.id];
      if (authorInfo) {
        slugToAuthor.set(postSlug, {
          id: authorRef.id,
          slug: authorInfo.slug,
        });
      }
    }
  }

  console.log(`Mapped ${slugToAuthor.size} posts to authors\n`);

  // Step 4: Get all MDX files
  console.log("📄 Scanning MDX posts...");
  const mdxFiles = await getMDXFiles();
  console.log(`Found ${mdxFiles.length} MDX files\n`);

  // Step 5: Update MDX files
  console.log("✏️  Updating MDX files with author metadata...\n");
  let updatedCount = 0;
  let skippedCount = 0;
  let notFoundCount = 0;

  for (const mdxFile of mdxFiles) {
    // Extract slug from filename (remove .mdx extension)
    const fileSlug = mdxFile.replace(/\.mdx$/, "");

    // Check if we have an author for this slug
    const authorInfo = slugToAuthor.get(fileSlug);

    if (authorInfo) {
      // Ensure author file exists
      await ensureAuthorFileExists(authorInfo.slug);

      // Update the MDX file
      const authorPath = slugToAuthorPath(authorInfo.slug);
      const updated = await updateMDXFile(mdxFile, authorPath);

      if (updated) {
        updatedCount++;
      } else {
        skippedCount++;
      }
    } else {
      notFoundCount++;
      console.log(`  ⚠️  No author found for: ${mdxFile}`);
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary:");
  console.log("=".repeat(60));
  console.log(`✅ Updated:  ${updatedCount} posts`);
  console.log(`⏭️  Skipped:  ${skippedCount} posts (already had authors)`);
  console.log(`⚠️  Not found: ${notFoundCount} posts (no matching author)`);
  console.log("=".repeat(60));
  console.log("\n✨ Done!");
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
