import fs from "fs";
import path from "path";

const ROOT = path.resolve(__dirname, "..");
const TARGET_DIR = path.join(ROOT, "content", "news", "en");

const isYouTube = (s: string) =>
  /(?:https?:)?\/\/(?:www\.)?(?:youtube\.com|youtu\.be)/i.test(s);

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

function replaceCustomCodeBlocks(content: string): {
  updated: string;
  count: number;
} {
  let count = 0;
  const blockRe =
    /<BuilderBlock\s+name="Custom Code"\s+options=\{\{[\s\S]*?\}\}>\s*[\s\S]*?<\/BuilderBlock>/g;

  const updated = content.replace(blockRe, (block) => {
    const code = extractCodeString(block);
    if (!code) return block;
    if (!isYouTube(code)) return block;

    // Use the decoded HTML (already unescaped by JSON.parse) to replace the whole block.
    count += 1;

    // Ensure surrounding blank lines so MDX parses cleanly, but don't over-indent.
    const trimmed = code.trim();
    // If the iframe is wrapped in an outer container (e.g., a responsive div), keep it as-is.
    return `\n${trimmed}\n`;
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
