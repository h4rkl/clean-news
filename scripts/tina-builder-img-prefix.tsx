#!/usr/bin/env node

// Prefixes /builder to image paths in:
// - Frontmatter: heroImage, image, seo.image (inline or folded >-)
// - Markdown image syntax: ![...](/<path>[ "title"])
// Skips any paths already starting with /builder/

const fs = require("fs").promises;
const path = require("path");

// Run from the root of the repo
const POSTS_DIR = path.resolve(
  process.argv.find((a) => a.startsWith("--path="))?.slice("--path=".length) ||
    path.join(process.cwd(), "content", "posts")
);

const DRY_RUN = process.argv.includes("--dry");

async function listMdxFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...(await listMdxFiles(p)));
    else if (e.isFile() && p.endsWith(".mdx")) out.push(p);
  }
  return out;
}

function updateFrontMatter(fm: string) {
  // Folded values: key: >-\n  /path
  const folded = fm.replace(
    /^(\s*)(heroImage|image|seo\.image)\s*:\s*>-?\s*\n([ \t]*)(\/(?!builder\/)[^\n]+)$/gm,
    (_, i1, key, i2, p) => `${i1}${key}: >-\n${i2}/builder${p}`
  );

  // Inline values: key: /path or key: "/path" or key: '/path'
  const inline = folded.replace(
    /^(\s*)(heroImage|image|seo\.image)\s*:\s*(['"]?)(\/(?!builder\/)[^'"\n]+)\3(\s*)$/gm,
    (_, i1, key, q, p, tail) => `${i1}${key}: ${q}/builder${p}${q}${tail}`
  );

  // Nested seo: image inside seo: block is already handled by the generic "image" rule above.
  return inline;
}

function updateMarkdownImages(body: string) {
  // ![alt]( /path [ "title"] )
  return body.replace(
    /!\[([^\]]*)\]\(\s*(\/(?!builder\/)[^)\s]+)(\s+["'][^"']*["'])?\s*\)/g,
    (_, alt, p, title = "") => `![${alt}](/builder${p}${title})`
  );
}

function updateContent(content: string) {
  // Extract and update front matter if present
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
  let updated = content;
  if (fmMatch) {
    const full = fmMatch[0];
    const inner = fmMatch[1];
    const newInner = updateFrontMatter(inner);
    if (newInner !== inner) {
      updated = updated.replace(full, `---\n${newInner}\n---`);
    }
  }

  // Update markdown images in the whole document
  const afterMd = updateMarkdownImages(updated);
  return afterMd;
}

async function main() {
  const files = await listMdxFiles(POSTS_DIR);
  let changed = 0;

  for (const file of files) {
    const original = await fs.readFile(file, "utf8");
    const updated = updateContent(original);
    if (updated !== original) {
      changed++;
      if (DRY_RUN) {
        console.log(`[DRY] Would update: ${file}`);
      } else {
        await fs.writeFile(file, updated, "utf8");
        console.log(`Updated: ${file}`);
      }
    }
  }

  console.log(`${DRY_RUN ? "Would update" : "Updated"} ${changed} file(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
