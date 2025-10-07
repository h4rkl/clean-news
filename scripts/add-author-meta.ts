/* scripts/add-author-meta.ts */
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

type PostToAuthorsMap = Record<string, string[]>;

type BuilderIndexEntry = {
  id: string;
  file: string;
  name?: string;
  slug?: string;
  locale?: string;
  published?: string | null;
  date?: string | number | null;
};

/** ---------------------- Config ---------------------- */
const SOLANA_NEWS_PATH = "/Users/karambit/Sites/solana-news";
const TINA_NEWS_PATH = "/Users/karambit/Sites/tina-news";

const AUTHOR_INDEX_PATH = path.join(
  SOLANA_NEWS_PATH,
  "@builder/authors-entity/resolved-author-index.json"
);
const POST_TO_AUTHORS_PATH = path.join(
  SOLANA_NEWS_PATH,
  "@builder/authors-entity/post-to-authors.json"
);
const BUILDER_INDEX_PATH = path.join(SOLANA_NEWS_PATH, "@builder/index.json");
const POSTS_DIR = path.join(TINA_NEWS_PATH, "content/posts");
const AUTHORS_DIR = path.join(TINA_NEWS_PATH, "content/authors");

// Fallback author for posts without a matched author
const FALLBACK_AUTHOR_PATH = "content/authors/solana-foundation.md";
const FALLBACK_AUTHOR_SLUG = "solana-foundation";

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

async function loadPostToAuthors(): Promise<PostToAuthorsMap> {
  const content = await fs.readFile(POST_TO_AUTHORS_PATH, "utf8");
  return JSON.parse(content);
}

async function loadBuilderIndex(): Promise<BuilderIndexEntry[]> {
  const content = await fs.readFile(BUILDER_INDEX_PATH, "utf8");
  return JSON.parse(content);
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

  // Step 1: Load all required data
  console.log("📖 Loading data files...");
  const [authorIndex, postToAuthors, builderIndex] = await Promise.all([
    loadAuthorIndex(),
    loadPostToAuthors(),
    loadBuilderIndex(),
  ]);
  console.log(`  ✓ Loaded ${Object.keys(authorIndex).length} authors`);
  console.log(
    `  ✓ Loaded ${Object.keys(postToAuthors).length} post-author mappings`
  );
  console.log(`  ✓ Loaded ${builderIndex.length} builder posts\n`);

  // Step 2: Build a map of post ID -> slug from builder index
  console.log("🔗 Building post ID to slug mapping...");
  const postIdToSlug = new Map<string, string>();
  for (const entry of builderIndex) {
    if (entry.slug) {
      postIdToSlug.set(entry.id, entry.slug);
    }
  }
  console.log(`Mapped ${postIdToSlug.size} post IDs to slugs\n`);

  // Step 3: Build a map of slug -> author info
  console.log("🔗 Building slug to author mapping...");
  const slugToAuthor = new Map<
    string,
    { authorId: string; authorSlug: string }
  >();

  for (const [postId, authorIds] of Object.entries(postToAuthors)) {
    // Get the post slug
    const postSlug = postIdToSlug.get(postId);
    if (!postSlug) continue;

    // Get the first author (most posts have one author)
    if (authorIds.length === 0) continue;
    const authorId = authorIds[0];

    // Get author info
    const authorInfo = authorIndex[authorId];
    if (authorInfo) {
      slugToAuthor.set(postSlug, {
        authorId: authorId,
        authorSlug: authorInfo.slug,
      });
    }
  }
  console.log(`Mapped ${slugToAuthor.size} slugs to authors\n`);

  // Step 4: Ensure fallback author exists
  console.log("📝 Ensuring fallback author exists...");
  await ensureAuthorFileExists(FALLBACK_AUTHOR_SLUG);
  console.log();

  // Step 5: Get all MDX files
  console.log("📄 Scanning MDX posts...");
  const mdxFiles = await getMDXFiles();
  console.log(`Found ${mdxFiles.length} MDX files\n`);

  // Step 6: Update MDX files
  console.log("✏️  Updating MDX files with author metadata...\n");
  let updatedCount = 0;
  let skippedCount = 0;
  let fallbackCount = 0;

  for (const mdxFile of mdxFiles) {
    // Extract slug from filename (remove .mdx extension)
    const fileSlug = mdxFile.replace(/\.mdx$/, "");

    // Check if we have an author for this slug
    const authorInfo = slugToAuthor.get(fileSlug);

    if (authorInfo) {
      // Ensure author file exists
      await ensureAuthorFileExists(authorInfo.authorSlug);

      // Update the MDX file
      const authorPath = slugToAuthorPath(authorInfo.authorSlug);
      const updated = await updateMDXFile(mdxFile, authorPath);

      if (updated) {
        updatedCount++;
      } else {
        skippedCount++;
      }
    } else {
      // Use fallback author
      console.log(`  🔄 Using fallback author for: ${mdxFile}`);
      const updated = await updateMDXFile(mdxFile, FALLBACK_AUTHOR_PATH);

      if (updated) {
        fallbackCount++;
        updatedCount++;
      } else {
        skippedCount++;
      }
    }
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary:");
  console.log("=".repeat(60));
  console.log(
    `✅ Updated with matched authors:  ${updatedCount - fallbackCount} posts`
  );
  console.log(`🔄 Updated with fallback author:  ${fallbackCount} posts`);
  console.log(`⏭️  Skipped (already had authors):  ${skippedCount} posts`);
  console.log(`📝 Total updated:                  ${updatedCount} posts`);
  console.log("=".repeat(60));
  console.log(`\n✨ Done! All posts now have authors.`);
}

main().catch((err) => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
