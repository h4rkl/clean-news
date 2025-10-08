/* scripts/add-tags-to-posts.ts */
import fs from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";

/** ---------------------- Types ---------------------- */
type ResolvedTag = {
  id: string;
  model: string;
  name: string;
  slug: string;
  locale: string;
  usedByIds: string[];
};

type BuilderIndexEntry = {
  id: string;
  file: string;
  name?: string;
  slug: string;
  locale?: string;
  published?: string;
  date?: string | number | null;
};

/** ---------------------- Config ---------------------- */
const SOLANA_NEWS_PATH = "/Users/karambit/Sites/solana-news";
const TINA_NEWS_PATH = "/Users/karambit/Sites/tina-news";

const RESOLVED_TAGS_PATH = path.join(
  SOLANA_NEWS_PATH,
  "@builder/tags-entity/resolved-tags.json"
);
const BUILDER_INDEX_PATH = path.join(SOLANA_NEWS_PATH, "@builder/index.json");
const POSTS_DIR = path.join(TINA_NEWS_PATH, "content/posts");
const TAGS_DIR = path.join(TINA_NEWS_PATH, "content/tags");

/** ---------------------- Utils ---------------------- */
async function loadJSON<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf-8");
  return JSON.parse(content);
}

/** ---------------------- Main Logic ---------------------- */
async function addTagsToPosts() {
  console.log("🏷️  Starting tag creation and post update process...\n");

  // 1. Load resolved tags and builder index
  console.log("📖 Loading resolved-tags.json...");
  const resolvedTags = await loadJSON<ResolvedTag[]>(RESOLVED_TAGS_PATH);

  console.log("📖 Loading @builder/index.json...");
  const builderIndex = await loadJSON<BuilderIndexEntry[]>(BUILDER_INDEX_PATH);

  // Create a map of post ID to post data for faster lookup
  const postIdToSlug = new Map<string, string>();
  builderIndex.forEach((post) => {
    postIdToSlug.set(post.id, post.slug);
  });

  console.log(`\n✅ Loaded ${resolvedTags.length} tags`);
  console.log(`✅ Loaded ${builderIndex.length} posts\n`);

  // Ensure tags directory exists
  await fs.mkdir(TAGS_DIR, { recursive: true });

  let tagsCreated = 0;
  let tagsSkipped = 0;
  let postsUpdated = 0;
  let postsSkipped = 0;
  let errorCount = 0;

  // 2. Process each tag - create tag files first
  console.log("📝 Creating tag files...\n");
  for (const tag of resolvedTags) {
    const tagFilePath = path.join(TAGS_DIR, `${tag.slug}.mdx`);

    try {
      // Check if tag file already exists
      try {
        await fs.access(tagFilePath);
        console.log(`   ⏭️  Tag file already exists: ${tag.slug}.mdx`);
        tagsSkipped++;
      } catch {
        // Create the tag file with simple frontmatter
        const tagContent = `---\nname: ${tag.name}\n---\n`;
        await fs.writeFile(tagFilePath, tagContent, "utf-8");
        console.log(`   ✅ Created tag file: ${tag.slug}.mdx (${tag.name})`);
        tagsCreated++;
      }
    } catch (error) {
      console.error(`   ❌ Error creating tag file ${tag.slug}.mdx:`, error);
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(50));
  console.log(`📊 Tag Creation Summary:`);
  console.log(`   ✅ Created: ${tagsCreated} tags`);
  console.log(`   ⏭️  Skipped: ${tagsSkipped} tags (already exist)`);
  console.log(`   ❌ Errors: ${errorCount} tags`);
  console.log("=".repeat(50) + "\n");

  // 3. Now update posts with tags
  console.log("📝 Updating posts with tags...\n");
  for (const tag of resolvedTags) {
    console.log(`\n🏷️  Processing tag: "${tag.name}" (${tag.slug})`);
    console.log(`   Posts using this tag: ${tag.usedByIds.length}`);

    // Process each post that uses this tag
    for (const postId of tag.usedByIds) {
      const slug = postIdToSlug.get(postId);

      if (!slug) {
        console.log(`   ⚠️  Post ID ${postId} not found in index`);
        postsSkipped++;
        continue;
      }

      const postPath = path.join(POSTS_DIR, `${slug}.mdx`);

      try {
        // Check if file exists
        try {
          await fs.access(postPath);
        } catch {
          console.log(`   ⚠️  Post file not found: ${slug}.mdx`);
          postsSkipped++;
          continue;
        }

        // Read and parse the MDX file
        const fileContent = await fs.readFile(postPath, "utf-8");
        const parsed = matter(fileContent);

        // Get current tags array or initialize it
        const currentTags = Array.isArray(parsed.data.tags)
          ? parsed.data.tags
          : [];

        // Build the tag reference path
        const tagReference = `content/tags/${tag.slug}.mdx`;

        // Check if tag is already in tags
        const tagExists = currentTags.some((t: any) => t.tag === tagReference);

        if (tagExists) {
          console.log(`   ⏭️  Tag "${tag.slug}" already exists in ${slug}`);
          postsSkipped++;
          continue;
        }

        // Add the tag to tags array in the correct format
        const updatedTags = [...currentTags, { tag: tagReference }];
        parsed.data.tags = updatedTags;

        // Convert back to string with frontmatter
        const updatedContent = matter.stringify(parsed.content, parsed.data);

        // Write the updated content back to the file
        await fs.writeFile(postPath, updatedContent, "utf-8");

        console.log(`   ✅ Added "${tag.slug}" to ${slug}`);
        postsUpdated++;
      } catch (error) {
        console.error(`   ❌ Error processing ${slug}:`, error);
        errorCount++;
      }
    }
  }

  // Final Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 Posts Update Summary:");
  console.log(`   ✅ Updated: ${postsUpdated} posts`);
  console.log(`   ⏭️  Skipped: ${postsSkipped} posts`);
  console.log(`   ❌ Errors: ${errorCount} posts`);
  console.log("=".repeat(50) + "\n");

  console.log("🎉 Process complete!");
}

/** ---------------------- Run ---------------------- */
addTagsToPosts().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
