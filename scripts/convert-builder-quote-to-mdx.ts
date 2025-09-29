import fs from "node:fs/promises";
import path from "node:path";

// Accept content dir as a CLI argument, or fallback to env var, or default to "content"
const CONTENT_DIR =
  process.argv[2] ||
  process.env.CONTENT_DIR ||
  path.resolve(process.cwd(), "content");

const POSTS_DIR = path.resolve(CONTENT_DIR, "posts");

const BLOCK_REGEX =
  /<BuilderBlock\s+name="Rich Text Quote"\s+options=\{\{([\s\S]*?)\}\}\s*>\s*<\/BuilderBlock>/gs;

function htmlToMarkdown(html: string): string {
  if (!html) return "";
  let md = html;
  // Replace paragraphs with newlines
  md = md.replace(/<p>/g, "");
  md = md.replace(/<\/p>/g, "\n\n");
  // Bold
  md = md.replace(/<strong>(.*?)<\/strong>/g, "**$1**");
  // Italic
  md = md.replace(/<em>(.*?)<\/em>/g, "*$1*");
  // Links
  md = md.replace(/<a href="(.*?)">(.*?)<\/a>/g, "[$2]($1)");
  // Unescape common HTML entities
  md = md.replace(/&amp;/g, "&");
  md = md.replace(/&lt;/g, "<");
  md = md.replace(/&gt;/g, ">");
  md = md.replace(/&quot;/g, '"');
  md = md.replace(/&#39;/g, "'");
  return md.trim();
}

async function processFile(filePath: string): Promise<boolean> {
  const content = await fs.readFile(filePath, "utf8");
  let updated = content;

  updated = updated.replace(BLOCK_REGEX, (match, optionsStr) => {
    try {
      const opts = new Function(`return ({ ${optionsStr.trim()} })`)();
      const author = opts.author || {};
      const name = author.name || "";
      const role = author.role?.Default || "";
      const company = author.company?.Default || "";
      const quoteHtml = opts.quote?.Default || "";
      const quoteMd = htmlToMarkdown(quoteHtml);
      if (!quoteMd) return match;

      let cite = "";
      if (name) {
        cite = `— ${name}`;
        if (role) cite += `, ${role}`;
        if (company) cite += `, ${company}`;
      }

      const quoteLines = quoteMd.split("\n").map((line) => `> ${line}`);
      if (cite) {
        quoteLines.push("> ");
        quoteLines.push(`> ${cite}`);
      }

      return quoteLines.join("\n");
    } catch (e) {
      console.error(`Error processing quote in ${filePath}: ${e}`);
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
    const files = await fs.readdir(POSTS_DIR);
    const mdxFiles = files.filter((f) => f.endsWith(".mdx"));

    let converted = 0;
    for (const file of mdxFiles) {
      const filePath = path.join(POSTS_DIR, file);
      const changed = await processFile(filePath);
      if (changed) {
        converted++;
        console.log(`Converted quotes in ${file}`);
      }
    }

    console.log(
      `Processed ${mdxFiles.length} MDX files, converted quotes in ${converted} files`
    );
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

main();
