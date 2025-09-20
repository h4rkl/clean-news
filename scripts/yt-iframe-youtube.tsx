import fs from "fs";
import path from "path";

const dir = "/Users/karambit/Sites/solana-news/content/news/en";

const files = fs.readdirSync(dir).filter((f) => f.endsWith(".mdx"));

for (const file of files) {
  const fullPath = path.join(dir, file);
  let content = fs.readFileSync(fullPath, "utf8");

  // Regex to match YouTube iframe tags, capturing the video ID
  // Handles multiline tags and attributes in any order
  const regex =
    /<iframe\b[\s\S]*?\bsrc="https:\/\/www\.youtube\.com\/embed\/([^?"]+)[^"]*"[\s\S]*?<\/iframe>/g;

  let matchCount = 0;
  content = content.replace(regex, (match, videoId) => {
    matchCount++;
    return `<YouTube videoId="${videoId}" />`;
  });

  if (matchCount > 0) {
    fs.writeFileSync(fullPath, content, "utf8");
    console.log(`Updated ${file} with ${matchCount} replacements.`);
  }
}

console.log("Conversion complete.");
