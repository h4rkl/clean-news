import fs from "node:fs/promises";
import path from "node:path";

const REPO_ROOT = process.cwd();
const CONTENT_DIR = path.resolve(REPO_ROOT, "content/news/en");

const BLOCK_REGEX =
  /<BuilderBlock\s+name="Code Block"\s+options=\{\{([\s\S]*?)\}\}\s*>\s*<\/BuilderBlock>/gs;

function extractOptions(
  optionsStr: string
): { code: string; language: string } | null {
  // Clean up the string: remove extra spaces, but preserve newlines in code
  const cleaned = optionsStr
    .replace(/^\s+/gm, "") // Remove leading whitespace per line
    .replace(/\s+/g, " ") // Normalize other whitespace
    .trim();

  // Extract code and language using regex
  const codeMatch = optionsStr.match(/"code":\s*"([\s\S]*?)",\s*"language"/);
  const languageMatch = optionsStr.match(/"language":\s*"([^"]*)"/);

  if (!codeMatch || !languageMatch) return null;

  let code = codeMatch[1]
    .replace(/\\n/g, "\n") // Restore newlines
    .replace(/\\"/g, '"'); // Unescape quotes

  const language = languageMatch[1];

  return { code, language };
}

async function processFile(filePath: string): Promise<boolean> {
  const content = await fs.readFile(filePath, "utf8");
  let updated = content;

  const matches = [...content.matchAll(BLOCK_REGEX)];
  for (const match of matches) {
    const optionsStr = match[1];
    const opts = extractOptions(optionsStr);
    if (!opts) continue;

    const md = `\`\`\`${opts.language}\n${opts.code.trim()}\n\`\`\``;

    updated = updated.replace(match[0], `\n${md}\n`);
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
        console.log(`Converted code blocks in ${file}`);
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
