import fs from "node:fs/promises";
import path from "node:path";

const REPO_ROOT = process.cwd();
const CONTENT_DIR = path.resolve(REPO_ROOT, "content/news/en");

const BLOCK_REGEX =
  /<BuilderBlock\s+name="Heading"\s+options=\{\{([\s\S]*?)\}\}\s*>\s*<\/BuilderBlock>/gs;

function extractOptions(optionsStr: string): Record<string, string> | null {
  // Clean up the string: remove newlines and extra spaces
  const cleaned = optionsStr.replace(/\s+/g, " ").trim();

  // Simple regex-based parsing for key-value pairs
  const pairs = cleaned.matchAll(/"([^"]+)":\s*"([^"]*)"/g);
  const opts: Record<string, string> = {};
  for (const pair of pairs) {
    const [, key, value] = pair;
    opts[key] = value;
  }

  if (Object.keys(opts).length === 0) return null;
  return opts;
}

async function processFile(filePath: string): Promise<boolean> {
  const content = await fs.readFile(filePath, "utf8");
  let updated = content;

  const matches = [...content.matchAll(BLOCK_REGEX)];
  for (const match of matches) {
    const optionsStr = match[1];
    const opts = extractOptions(optionsStr);
    if (!opts) continue;

    const eyebrow = opts.eyebrow || "";
    const headline = opts.headline || "";
    const body = opts.body || "";
    const variant = opts.variant || "";

    if (!headline || variant !== "standard") continue;

    let md = "";
    if (eyebrow) {
      md += `**${eyebrow}**\n\n`;
    }
    md += `## ${headline}\n\n`;
    if (body) {
      md += `${body}\n\n`;
    }

    updated = updated.replace(match[0], `\n${md.trim()}\n`);
  }

  if (updated !== content) {
    await fs.writeFile(filePath, updated, "utf8");
    return true;
  }
  return false;
}

async function main() {
  try {
    const files = await fs.readdir(CONTENT_DIR);
    const mdxFiles = files.filter((f) => f.endsWith(".mdx"));

    let converted = 0;
    for (const file of mdxFiles) {
      const filePath = path.join(CONTENT_DIR, file);
      const changed = await processFile(filePath);
      if (changed) {
        converted++;
        console.log(`Converted headings in ${file}`);
      }
    }

    console.log(
      `Processed ${mdxFiles.length} MDX files, converted ${converted}`
    );
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
