import fs from "node:fs/promises";
import path from "node:path";
import TurndownService from "turndown";

// Accept content dir as a CLI argument, or fallback to env var, or default to "content"
const CONTENT_DIR =
  process.argv[2] ||
  process.env.CONTENT_DIR ||
  path.resolve(process.cwd(), "content");

const POSTS_DIR = path.resolve(CONTENT_DIR, "posts");

const BLOCK_REGEX =
  /<BuilderBlock\s+name="Text"\s+options=\{\{([\s\S]*?)\}\}\s*>\s*<\/BuilderBlock>/gs;

const turndownService = new TurndownService();
let gfm: any = null;

async function initTurndown() {
  try {
    // @ts-ignore
    const g = await import("turndown-plugin-gfm");
    gfm = g.gfm || g.default?.gfm || null;
    if (gfm) {
      turndownService.use(gfm);
    }
  } catch {
    gfm = null;
  }
}

async function processFile(filePath: string): Promise<boolean> {
  const content = await fs.readFile(filePath, "utf8");
  let updated = content;

  updated = updated.replace(BLOCK_REGEX, (match, optionsStr) => {
    try {
      const opts = new Function(`return ({ ${optionsStr.trim()} })`)();
      const html = opts.text?.Default || "";
      if (!html) return match;

      const md = turndownService.turndown(html);
      return md;
    } catch (e) {
      console.error(`Error processing text block in ${filePath}: ${e}`);
      return match;
    }
  });

  if (updated !== content) {
    await fs.writeFile(filePath, updated, "utf8");
    return true;
  }
  return false;
}

async function main() {
  try {
    await initTurndown();

    const files = await fs.readdir(POSTS_DIR);
    const mdxFiles = files.filter((f) => f.endsWith(".mdx"));

    let converted = 0;
    for (const file of mdxFiles) {
      const filePath = path.join(POSTS_DIR, file);
      const changed = await processFile(filePath);
      if (changed) {
        converted++;
        console.log(`Converted text blocks in ${file}`);
      }
    }

    console.log(
      `Processed ${mdxFiles.length} MDX files, converted text blocks in ${converted} files`
    );
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
