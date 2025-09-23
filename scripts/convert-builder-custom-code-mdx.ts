// ... existing code ...
/**
 * Convert Builder Custom Code blocks in MDX files to Markdown
 *
 * This script scans all MDX files in content/news/en/, finds <BuilderBlock name="Custom Code"> instances,
 * extracts the HTML from options.code, converts it to Markdown using turndown, and replaces the block with the Markdown.
 */

import fs from "node:fs/promises";
import path from "node:path";

const REPO_ROOT = process.cwd();
const CONTENT_DIR = path.resolve(REPO_ROOT, "content/news/en");

async function loadTurndown(): Promise<{
  TurndownService: any | null;
  gfm: any | null;
}> {
  try {
    // @ts-ignore
    const mod = await import("turndown");
    // @ts-ignore
    let gfm: any = null;
    try {
      // @ts-ignore
      const g = await import("turndown-plugin-gfm");
      gfm = g.gfm || g.default?.gfm || null;
    } catch {
      gfm = null;
    }
    const TurndownService = (mod as any).default || (mod as any);
    return { TurndownService, gfm };
  } catch {
    return { TurndownService: null, gfm: null };
  }
}

async function convertHtmlToMd(
  html: string,
  turndownCache: { svc?: any; hasGfm?: boolean }
) {
  if (!html.trim()) return "";
  if (!turndownCache?.svc) {
    return html; // Keep as HTML if turndown not available
  }
  const svc = turndownCache.svc;
  try {
    return svc.turndown(html);
  } catch {
    return html;
  }
}

function unwrapLocalized(v: any): string | null {
  if (typeof v === "string") return v;
  if (
    typeof v === "object" &&
    v["@type"] === "@builder.io/core:LocalizedValue"
  ) {
    return (
      v.Default ||
      Object.values(v).find(
        (val) => typeof val === "string" && val !== "@type"
      ) ||
      null
    );
  }
  return null;
}

async function processFile(
  filePath: string,
  turndownCache: { svc?: any; hasGfm?: boolean }
) {
  const content = await fs.readFile(filePath, "utf8");

  // Regex to match <BuilderBlock name="Custom Code" options={{ ... }}> ... </BuilderBlock>
  // Captures the inner options object content
  const regex =
    /<BuilderBlock name="Custom Code" options=\{\{([\s\S]*?)\}\}\s*>[\s\S]*?<\/BuilderBlock>/g;

  let newContent = content;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const optionsInnerStr = match[1].trim();
    let options;
    try {
      // Wrap in {} to form valid JSON object and parse
      options = JSON.parse(`{${optionsInnerStr}}`);
    } catch (e) {
      console.warn(`Failed to parse options in ${filePath}: ${e}`);
      continue;
    }

    let html = unwrapLocalized(options.code);
    if (!html) {
      console.warn(`No valid code found in options in ${filePath}`);
      continue;
    }

    // Unescape any unicode escapes if necessary (like \u003c to <)
    const unescapedHtml = html.replace(
      /\\u([\d\w]{4})/gi,
      (match: string, grp: string) => {
        return String.fromCharCode(parseInt(grp, 16));
      }
    );

    let replacement = unescapedHtml;
    if (!/\sid\s*=/i.test(unescapedHtml)) {
      // Only convert to MD if no id attributes, to preserve anchors
      const md = await convertHtmlToMd(unescapedHtml, turndownCache);
      replacement = md;
    }

    // Replace the whole match with the content, adding newlines for separation
    newContent = newContent.replace(match[0], `\n\n${replacement}\n\n`);
  }

  if (newContent !== content) {
    await fs.writeFile(filePath, newContent, "utf8");
    console.log(`Updated ${filePath}`);
  } else {
    console.log(`No changes in ${filePath}`);
  }
}

async function main() {
  const { TurndownService, gfm } = await loadTurndown();
  const turndownCache: { svc?: any; hasGfm?: boolean } = {};
  if (TurndownService) {
    const svc = new (TurndownService as any)({
      codeBlockStyle: "fenced",
      headingStyle: "atx",
      bulletListMarker: "-",
      emDelimiter: "_",
      hr: "---",
      linkStyle: "inlined",
    });
    if (gfm) {
      try {
        svc.use(gfm);
        turndownCache.hasGfm = true;
      } catch {
        turndownCache.hasGfm = false;
      }
    }
    // Keep complex tags, but since we're converting to MD, adjust if needed
    svc.keep([
      "iframe",
      "video",
      "audio",
      "pre",
      "code",
      "style",
      "script",
      "svg",
    ]);
    // Add rule to preserve tables as HTML if GFM doesn't handle well, but GFM should
    turndownCache.svc = svc;
  } else {
    console.warn(
      "turndown not found; keeping HTML as-is. Run: pnpm add -D turndown turndown-plugin-gfm"
    );
  }

  const files = await fs.readdir(CONTENT_DIR);
  const mdxFiles = files.filter((f) => f.endsWith(".mdx"));

  for (const file of mdxFiles) {
    const filePath = path.join(CONTENT_DIR, file);
    await processFile(filePath, turndownCache);
  }

  console.log("Processing complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
