import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const TARGET_DIR = path.join(ROOT, "content", "news", "en");

const isYouTube = (s: string) =>
  /(?:https?:)?\/\/(?:www\.)?(?:youtube\.com|youtu\.be)/i.test(s);

function getVideoId(url: string): string | null {
  const regExp =
    /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

function extractCodeString(block: string): string | null {
  // Capture the JSON string value of "code": "<...>"
  const m = block.match(/"code"\s*:\s*("(?:(?:\\.|[^"\\])*)")/s);
  if (!m) return null;
  const jsonString = m[1];
  try {
    const decoded = JSON.parse(jsonString);
    if (typeof decoded === "string") return decoded;
  } catch {
    // fallthrough
  }
  return null;
}

function extractUrlString(block: string): string | null {
  const m = block.match(/options=\{\{([\s\S]*?)\}\}/s);
  if (!m) return null;
  const optionsStr = "{" + m[1] + "}";
  try {
    const options = JSON.parse(optionsStr);
    return typeof options.url === "string" ? options.url : null;
  } catch {
    return null;
  }
}

function replaceCustomCodeBlocks(content: string): {
  updated: string;
  count: number;
} {
  let count = 0;
  const blockRe =
    /<BuilderBlock\s+name="(Custom Code|Youtube)"\s+options=\{\{[\s\S]*?\}\}>\s*[\s\S]*?<\/BuilderBlock>/g;

  const updated = content.replace(blockRe, (block) => {
    const nameMatch = block.match(/name="([^"]+)"/);
    const name = nameMatch ? nameMatch[1] : "";

    if (name === "Custom Code") {
      const code = extractCodeString(block);
      if (!code || !isYouTube(code)) return block;
      count += 1;
      const trimmed = code.trim();
      return `\n${trimmed}\n`;
    } else if (name === "Youtube") {
      const url = extractUrlString(block);
      if (!url || !isYouTube(url)) return block;
      const videoId = getVideoId(url);
      if (!videoId) return block;
      const iframe = `<iframe width="560" height="315" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
      count += 1;
      return `\n${iframe}\n`;
    }
    return block;
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
    const { updated, count } = replaceCustomCodeBlocks(original);

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
