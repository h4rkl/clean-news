import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";
import url from "url";

const ROOT = path.resolve(__dirname, "..");
const TARGET_DIR = path.join(ROOT, "content", "news", "en");

function extractOptions(
  block: string
): { url?: string; content?: string } | null {
  const m = block.match(/options=\{\{([\s\S]*?)\}\}/s);
  if (!m) return null;
  const optionsStr = "{" + m[1] + "}";
  try {
    const options = JSON.parse(optionsStr);
    return options;
  } catch {
    return null;
  }
}

function getYouTubeId(src: string): string | null {
  const parsedUrl = url.parse(src, true);
  const hostname = parsedUrl.hostname?.toLowerCase() || "";
  if (hostname === "youtu.be") {
    return parsedUrl.pathname?.substring(1).split("?")[0] || null;
  } else if (hostname.includes("youtube.com")) {
    if (parsedUrl.pathname?.startsWith("/embed/")) {
      return parsedUrl.pathname.split("/embed/")[1].split("?")[0];
    } else if (parsedUrl.pathname === "/watch") {
      return (parsedUrl.query.v as string) || null;
    } else if (parsedUrl.pathname?.startsWith("/v/")) {
      return parsedUrl.pathname.split("/v/")[1].split("?")[0];
    }
  }
  return null;
}

function getTweetId(src: string): string | null {
  const parsedUrl = url.parse(src, true);
  const hostname = parsedUrl.hostname?.toLowerCase() || "";
  if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
    const parts = parsedUrl.pathname?.split("/") || [];
    if (parts[3] && parts[2] === "status") {
      return parts[3].split("?")[0];
    }
  } else if (hostname.includes("twitframe.com")) {
    const tweetUrl = parsedUrl.query.url as string;
    if (tweetUrl) {
      const parts = tweetUrl.split("/");
      return parts[parts.length - 1];
    }
  } else if (parsedUrl.pathname?.includes("/embed/tweet.html")) {
    return parsedUrl.query.id as string;
  }
  return null;
}

function replaceEmbedBlocks(content: string): {
  updated: string;
  count: number;
} {
  let count = 0;
  const blockRe =
    /<BuilderBlock\s+name="Embed"\s+options=\{\{[\s\S]*?\}\}>[\s\S]*?<\/BuilderBlock>/g;

  const updated = content.replace(blockRe, (block) => {
    const options = extractOptions(block);
    if (!options) return block;

    let $ = null;
    if (options.content) {
      $ = cheerio.load(options.content);
    }

    let iframeSrc = null;
    if ($) {
      iframeSrc = $("iframe").attr("src");
    }

    // Handle Twitter/X embeds
    let tweetId = null;
    if (options.url) {
      tweetId = getTweetId(options.url);
    }
    if (!tweetId && iframeSrc) {
      tweetId = getTweetId(iframeSrc);
    }
    if (!tweetId && $) {
      const href = $("blockquote.twitter-tweet a:last-child").attr("href");
      if (href) {
        tweetId = getTweetId(href);
      }
    }
    if (tweetId) {
      count += 1;
      return `\n<div data-theme="dark">\n  <Tweet id="${tweetId}" />\n</div>\n`;
    }

    // Handle YouTube embeds
    let youTubeId = null;
    if (options.url) {
      youTubeId = getYouTubeId(options.url);
    }
    if (!youTubeId && iframeSrc) {
      youTubeId = getYouTubeId(iframeSrc);
    }
    if (youTubeId) {
      count += 1;
      return `\n<YouTube videoId="${youTubeId}" />\n`;
    }

    // For unrecognized embeds, keep the content HTML if available
    if (options.content) {
      return `\n${options.content}\n`;
    } else {
      return block;
    }
  });

  return { updated, count };
}

async function getMdxFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await getMdxFiles(full);
      out.push(...nested);
    } else if (entry.isFile() && full.endsWith(".mdx")) {
      out.push(full);
    }
  }
  return out;
}

async function run() {
  const dryRun = process.argv.includes("--dry-run");

  const files = await getMdxFiles(TARGET_DIR);
  let totalChanged = 0;
  let totalBlocks = 0;

  for (const file of files) {
    const original = await fs.promises.readFile(file, "utf8");
    const { updated, count } = replaceEmbedBlocks(original);

    if (count > 0) {
      totalBlocks += count;
      totalChanged += 1;
      if (!dryRun) {
        await fs.promises.writeFile(file, updated, "utf8");
      }
      console.log(
        `${dryRun ? "[dry-run] " : ""}Updated ${file} (${count} block${
          count > 1 ? "s" : ""
        })`
      );
    }
  }

  if (totalChanged === 0) {
    console.log("No matching BuilderBlocks found to convert.");
  } else {
    console.log(
      `Converted ${totalBlocks} block(s) across ${totalChanged} file(s).`
    );
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
