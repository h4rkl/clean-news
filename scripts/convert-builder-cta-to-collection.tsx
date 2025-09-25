import fs from "node:fs/promises";
import path from "node:path";

// Accept content dir as a CLI argument, or fallback to env var, or default to "content"
const CONTENT_DIR =
  process.argv[2] ||
  process.env.CONTENT_DIR ||
  path.resolve(process.cwd(), "content");

const POSTS_DIR = path.resolve(CONTENT_DIR, "posts");
const CTAS_DIR = path.resolve(CONTENT_DIR, "ctas");

const BLOCK_REGEX =
  /<BuilderBlock\s+name="Content Editor"\s+options=\{\{([\s\S]*?)\}\}\s*>\s*<\/BuilderBlock>/gs;

async function processFile(filePath: string): Promise<boolean> {
  const content = await fs.readFile(filePath, "utf8");
  let updated = content;

  const matches = [...content.matchAll(BLOCK_REGEX)];
  let ctaCount = 0;

  for (const match of matches) {
    const optionsStr = match[1].trim();
    let opts;
    try {
      opts = new Function(`return ({ ${optionsStr} })`)();
    } catch (e) {
      console.error(`Error parsing options in ${filePath}: ${e}`);
      continue;
    }

    const callToAction = opts.callToAction;
    if (!callToAction) continue;

    const eyebrow = callToAction.eyebrow?.Default || "";
    const headline = callToAction.headline?.Default || "";
    const description = callToAction.description?.Default || "";
    const buttonLabel = callToAction.button?.label?.Default || "";
    const buttonUrl = callToAction.button?.url || "";
    const className = callToAction.className || ""; // Assuming non-localized

    if (!buttonLabel || !buttonUrl) continue;

    const postName = path.basename(filePath, ".mdx");
    ctaCount++;
    const suffix = matches.length > 1 ? `-${ctaCount}` : "";
    const filename = `${postName}-cta${suffix}.mdx`;
    const ctaPath = path.join(CTAS_DIR, filename);

    const title =
      headline || description.substring(0, 50) || `CTA for ${postName}`;

    const frontmatter = `---
title: ${title}
eyebrow: ${eyebrow}
headline: ${headline}
description: | 
${description
  .split("\n")
  .map((l: string) => `  ${l}`)
  .join("\n")}
button:
  label: ${buttonLabel}
  url: ${buttonUrl}
className: ${className}
---

`;

    await fs.writeFile(ctaPath, frontmatter, "utf8");

    updated = updated.replace(match[0], "");

    if (ctaCount > 0) {
      const ctaRef = `content/ctas/${postName}-cta.mdx`;
      const fmRegex = /^---\n([\s\S]*?)---\n/;
      updated = updated.replace(
        fmRegex,
        (_, fm) => `---\n${fm.trimEnd()}\ncta: ${ctaRef}\n---\n`
      );
    }
  }

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
        console.log(`Converted CTAs in ${file}`);
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
