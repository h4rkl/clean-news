import fs from "node:fs/promises";
import path from "node:path";
import * as cheerio from "cheerio";

// Note: This script assumes 'cheerio' is installed. If not, run: pnpm add cheerio

const REPO_ROOT = process.cwd();
const CONTENT_DIR = path.resolve(REPO_ROOT, "content/news/en");

// Regex to match the BuilderBlock with Custom Code, capturing the options object
// This regex handles multi-line and escaped quotes
const BLOCK_REGEX =
  /<BuilderBlock\s+name="Custom Code"\s+options={([^}]*?({.*?"code":\s*".*?".*?}.*?))}\s*>\s*<\/BuilderBlock>/gs;

// Regex to extract the "code" value from options, handling escaped quotes
const CODE_REGEX = /"code":\s*"((?:[^"\\]|\\.)*)"/s;

async function htmlTableToMarkdown(html: string): Promise<string> {
  const $ = cheerio.load(html);
  const table = $("table.custom");
  if (table.length === 0) {
    return ""; // No table found, return empty
  }

  const rows: string[][] = [];
  table.find("tr").each((_, tr) => {
    const row: string[] = [];
    $(tr)
      .find("td, th")
      .each((_, cell) => {
        let text = $(cell).html() || "";
        // Convert <br> to newlines
        text = text.replace(/<br\s*\/?>/gi, "\n");
        // Convert <a href="url">text</a> to [text](url)
        text = text.replace(
          /<a\s+href="([^"]+)"[^>]*>(.*?)<\/a>/gi,
          "[$2]($1)"
        );
        // Remove other tags, keep text
        text = text.replace(/<[^>]+>/g, "");
        // Trim and escape pipes
        text = text.trim().replace(/\|/g, "\\|");
        row.push(text);
      });
    if (row.length > 0) rows.push(row);
  });

  if (rows.length === 0) return "";

  // Determine column widths (max length per column)
  const colWidths = rows[0].map((_, colIdx) =>
    Math.max(...rows.map((row) => (row[colIdx] || "").length))
  );

  // Build markdown
  let md = "";
  rows.forEach((row, rowIdx) => {
    md +=
      "| " +
      row
        .map((cell, colIdx) => cell.padEnd(colWidths[colIdx], " "))
        .join(" | ") +
      " |\n";
    if (rowIdx === 0) {
      // Header separator
      md += "| " + colWidths.map((w) => "-".repeat(w)).join(" | ") + " |\n";
    }
  });

  return md.trim();
}

async function processFile(filePath: string): Promise<boolean> {
  const content = await fs.readFile(filePath, "utf8");
  let updated = content;

  const matches = [...content.matchAll(BLOCK_REGEX)];
  for (const match of matches) {
    const optionsStr = match[1];
    const codeMatch = optionsStr.match(CODE_REGEX);
    if (!codeMatch) continue;

    // Unescape the code string (handle \u003c etc.)
    let code = codeMatch[1].replace(/\\u003c/g, "<");
    code = code.replace(/\\"/g, '"'); // Any other escapes if needed

    // Check if it contains a table
    if (!/<table\s+class="custom"/i.test(code)) continue;

    const mdTable = await htmlTableToMarkdown(code);
    if (!mdTable) continue;

    // Replace the entire BuilderBlock with the MD table, adding newlines around
    updated = updated.replace(match[0], `\n${mdTable}\n`);
  }

  if (updated !== content) {
    await fs.writeFile(filePath, updated, "utf8");
    return true;
  }
  return false;
}

async function main() {
  const files = await fs.readdir(CONTENT_DIR);
  const mdxFiles = files.filter((f) => f.endsWith(".mdx"));

  let converted = 0;
  for (const file of mdxFiles) {
    const filePath = path.join(CONTENT_DIR, file);
    const changed = await processFile(filePath);
    if (changed) {
      converted++;
      console.log(`Converted tables in ${file}`);
    }
  }

  console.log(`Processed ${mdxFiles.length} MDX files, converted ${converted}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
