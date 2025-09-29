import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";
import TurndownService from "turndown";

const CONTENT_DIR =
  process.argv[2] ||
  process.env.CONTENT_DIR ||
  path.resolve(process.cwd(), "content");

const POSTS_DIR = path.resolve(CONTENT_DIR, "posts");

function getAllFiles(dir: string, fileList: string[] = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (file.endsWith(".mdx")) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

function processFile(filePath: string) {
  let content = fs.readFileSync(filePath, "utf8");
  const $ = cheerio.load(content, {
    xml: {
      lowerCaseTags: false,
      lowerCaseAttributeNames: false,
      recognizeSelfClosing: true,
      decodeEntities: false,
    },
  });

  const turndown = new TurndownService();

  const selectors = "p, h1, h2, h3, h4, h5, h6, ul, br, strong, em";
  const elements = $(selectors);

  const blockTags = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "ul"]);

  elements.each((i, elem) => {
    const html = $.html(elem);
    const md = turndown.turndown(html);
    const tag = elem.tagName.toLowerCase();
    const replacement = blockTags.has(tag) ? md + "\n\n" : md;
    $(elem).replaceWith(replacement);
  });

  let newContent = $("body").html();
  if (newContent === null) {
    newContent = $.html();
  }

  fs.writeFileSync(filePath, newContent, "utf8");
  console.log(`Processed ${filePath}`);
}

function main() {
  const allFiles = getAllFiles(POSTS_DIR);
  for (const filePath of allFiles) {
    processFile(filePath);
  }
}

main();
