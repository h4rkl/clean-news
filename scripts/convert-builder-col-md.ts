import fs from "node:fs/promises";
import path from "node:path";
import TurndownService from "turndown";

const REPO_ROOT = process.cwd();
const CONTENT_DIR = path.resolve(REPO_ROOT, "content/news/en");

const BLOCK_REGEX =
  /<BuilderBlock\s+name="Columns"\s+options=\{\{([\s\S]*?)\}\}\s*>\s*([\s\S]*?)<\/BuilderBlock>/gs;

// Initialize Turndown for HTML to Markdown conversion
const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

// Function to convert HTML to Markdown (reusable method)
function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}

function parseOptions(optionsStr: string): any | null {
  try {
    // Wrap and evaluate as JS object literal
    const func = new Function(`return ({${optionsStr}})`);
    return func();
  } catch (e) {
    console.error("Failed to parse options:", e, "\nOriginal:", optionsStr);
    return null;
  }
}

function convertBlock(block: any): string {
  const component = block.component;
  if (!component) return "";

  switch (component.name) {
    case "Copy":
      let rawHtml =
        block.component.options?.rawHtml?.Default ||
        block.component.options?.rawHtml ||
        "";
      // Unescape common HTML entities
      rawHtml = rawHtml
        .replace(/\\u003c/g, "<")
        .replace(/\\u003e/g, ">")
        .replace(/\\"/g, '"')
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
      return htmlToMarkdown(rawHtml) + "\n\n";
    case "Image":
      const src = component.options?.image || "";
      const alt = component.options?.alt?.Default || "";
      return `![${alt}](${src})\n\n`;
    case "Youtube":
      const url = component.options?.url || "";
      return `[Watch Video](${url})\n\n`; // Simple link for YouTube
    default:
      // For unknown, try to convert any rawHtml if present
      const unknownHtml = component.options?.rawHtml?.Default || "";
      if (unknownHtml) return htmlToMarkdown(unknownHtml) + "\n\n";
      return "";
  }
}

async function processFile(filePath: string): Promise<boolean> {
  const content = await fs.readFile(filePath, "utf8");
  let updated = content;

  const matches = [...content.matchAll(BLOCK_REGEX)];
  for (const match of matches) {
    const optionsStr = match[1];
    const innerContent = match[2]; // Capture inner content if any

    const opts = parseOptions(optionsStr);
    if (!opts || !opts.columns) continue;

    let md = "";
    for (const column of opts.columns) {
      if (column.blocks) {
        for (const block of column.blocks) {
          md += convertBlock(block);
        }
      }
    }

    // If there's inner content, append it (converted if HTML)
    if (innerContent.trim()) {
      md += htmlToMarkdown(innerContent) + "\n\n";
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
        console.log(`Converted columns in ${file}`);
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
