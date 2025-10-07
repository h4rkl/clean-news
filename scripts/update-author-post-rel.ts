/* scripts/rebuild-post-to-authors.ts */
import fs from "node:fs/promises";
import path from "node:path";

/** ---------------------- Types ---------------------- */
type BuilderPost = {
  id: string;
  data?: {
    author?: {
      "@type": "@builder.io/core:Reference";
      id: string;
      model?: string;
    };
    [key: string]: any;
  };
  [key: string]: any;
};

type PostToAuthorsMap = Record<string, string[]>;

/** ---------------------- Config ---------------------- */
const BUILDER_DIR = path.resolve(process.cwd(), "@builder");
const OUTPUT_PATH = path.resolve(
  process.cwd(),
  "@builder/authors-entity/post-to-authors.json"
);

/** ---------------------- Utils ---------------------- */
async function getAllBuilderFiles(): Promise<string[]> {
  const files = await fs.readdir(BUILDER_DIR);
  return files.filter((f) => f.endsWith(".json") && f.startsWith("en__"));
}

async function loadBuilderPost(filename: string): Promise<BuilderPost | null> {
  try {
    const filePath = path.join(BUILDER_DIR, filename);
    const content = await fs.readFile(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.warn(`  ⚠️  Could not load builder post: ${filename}`);
    return null;
  }
}

/** ---------------------- Main Logic ---------------------- */
async function rebuildPostToAuthors() {
  console.log("🚀 Rebuilding post-to-authors.json mapping...\n");

  // Step 1: Get all builder files
  console.log("📂 Scanning builder files...");
  const builderFiles = await getAllBuilderFiles();
  console.log(`Found ${builderFiles.length} builder files\n`);

  // Step 2: Build the mapping
  console.log("🔗 Building post-to-authors mapping...\n");
  const postToAuthors: PostToAuthorsMap = {};
  let processedCount = 0;
  let withAuthorsCount = 0;
  let withoutAuthorsCount = 0;

  for (const filename of builderFiles) {
    const post = await loadBuilderPost(filename);
    if (!post) continue;

    processedCount++;

    // Initialize the post entry
    const authorIds: string[] = [];

    // Check if the post has an author reference
    if (post.data?.author) {
      const authorRef = post.data.author;

      // Validate it's a proper reference
      if (authorRef["@type"] === "@builder.io/core:Reference" && authorRef.id) {
        authorIds.push(authorRef.id);
        withAuthorsCount++;
        console.log(
          `  ✅ ${post.id.substring(0, 40)}... → ${authorRef.id.substring(
            0,
            40
          )}...`
        );
      }
    } else {
      withoutAuthorsCount++;
      console.log(`  ⏭️  ${post.id.substring(0, 40)}... (no author)`);
    }

    // Add to mapping (even if empty array for posts without authors)
    postToAuthors[post.id] = authorIds;
  }

  // Step 3: Write the updated mapping
  console.log("\n💾 Writing updated post-to-authors.json...");
  await fs.writeFile(
    OUTPUT_PATH,
    JSON.stringify(postToAuthors, null, 2),
    "utf8"
  );

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary:");
  console.log("=".repeat(60));
  console.log(`📄 Total posts processed:    ${processedCount}`);
  console.log(`✅ Posts with authors:        ${withAuthorsCount}`);
  console.log(`⏭️  Posts without authors:     ${withoutAuthorsCount}`);
  console.log("=".repeat(60));
  console.log(`\n✨ Done! Updated ${OUTPUT_PATH}`);
}

async function main() {
  try {
    await rebuildPostToAuthors();
  } catch (error) {
    console.error("❌ Fatal error:", error);
    process.exit(1);
  }
}

main();
