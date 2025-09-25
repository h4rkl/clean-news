import fs from "node:fs/promises";
import path from "node:path";

// Accept content dir as a CLI argument, or fallback to env var, or default to "content"
const CONTENT_DIR =
  process.argv[2] ||
  process.env.CONTENT_DIR ||
  path.resolve(process.cwd(), "content");

const POSTS_DIR = path.resolve(CONTENT_DIR, "posts");
const SWITCHBACKS_DIR = path.resolve(CONTENT_DIR, "switchbacks");

const BLOCK_REGEX =
  /<BuilderBlock\s+name="Conversion Panel"\s+options=\{\{([\s\S]*?)\}\}\s*>\s*<\/BuilderBlock>/gs;

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

  const matches = [...content.matchAll(BLOCK_REGEX)];
  if (matches.length > 1) {
    console.warn(
      `Multiple Conversion Panel blocks found in ${filePath}. Skipping.`
    );
    return false;
  }
  if (matches.length === 0) return false;

  const match = matches[0];
  const optionsStr = match[1].trim();
  let opts;
  try {
    opts = new Function(`return ({ ${optionsStr} })`)();
  } catch (e) {
    console.error(`Error parsing options in ${filePath}: ${e}`);
    return false;
  }

  const eyebrow = opts.eyebrow?.Default || opts.eyebrow || "";
  const headline = opts.heading?.Default || opts.heading || "";
  const bodyHtml = opts.body?.Default || opts.body || "";
  const bodyMd = htmlToMarkdown(bodyHtml);
  const imageSrc = opts.image?.src ? `/builder${opts.image.src}` : "";
  const imageAlt = opts.image?.alt?.Default || opts.image?.alt || "";
  const buttons = (opts.buttons || [])
    .map((b: any) => ({
      label: b.label?.Default || b.label || "",
      url: b.url || "",
    }))
    .filter((b: any) => b.label && b.url);

  const postName = path.basename(filePath, ".mdx");
  const filename = `${postName}-switchback.mdx`;
  const switchbackPath = path.join(SWITCHBACKS_DIR, filename);

  const title =
    headline || bodyMd.substring(0, 50) || `Conversion Panel for ${postName}`;

  let frontmatter = `---
title: ${title}
`;
  if (imageSrc) {
    frontmatter += `image:
  src: ${imageSrc}
  alt: ${imageAlt}
`;
  }
  frontmatter += `eyebrow: ${eyebrow}
headline: ${headline}
`;
  if (bodyMd) {
    frontmatter += `body: | 
${bodyMd
  .split("\n")
  .map((l: string) => `  ${l}`)
  .join("\n")}
`;
  }
  if (buttons.length > 0) {
    frontmatter += `buttons:
${buttons
  .map((b: any) => `  - label: ${b.label}\n    url: ${b.url}`)
  .join("\n")}
`;
  }
  frontmatter += `---
`;

  await fs.writeFile(switchbackPath, frontmatter, "utf8");

  updated = updated.replace(match[0], "");

  const ref = `content/switchbacks/${filename}`;
  const fmRegex = /^---\n([\s\S]*?)---\n/;
  updated = updated.replace(
    fmRegex,
    (_, fm) => `---\n${fm.trimEnd()}\nswitchback: ${ref}\n---\n`
  );

  if (updated !== content) {
    await fs.writeFile(filePath, updated, "utf8");
    return true;
  }
  return false;
}

async function main() {
  try {
    await fs.mkdir(SWITCHBACKS_DIR, { recursive: true });
    const files = await fs.readdir(POSTS_DIR);
    const mdxFiles = files.filter((f) => f.endsWith(".mdx"));

    let converted = 0;
    for (const file of mdxFiles) {
      const filePath = path.join(POSTS_DIR, file);
      const changed = await processFile(filePath);
      if (changed) {
        converted++;
        console.log(`Converted Conversion Panel in ${file}`);
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
