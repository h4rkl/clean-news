import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

// Author data from your list
const authors = [
  "Rishin Sharma and Amira Valliani",
  "Solana Foundation and the Solana Identity Group",
  "Akshay BD and Ellie Platis",
  "Helio, Dialect, Backpack, Phantom, SolFlare, WEN, MonkeDAO, WIF, PONKE, Degenerate Ape Academy, BONK, Claynosuarz, SEND",
  "Akshay BD",
  "Nick Ducoff",
  "Colosseum",
  "Only Possible on Solana",
  "Jon Wong",
  "Anza",
  "Solana Foundation and Polygon Labs",
  "Matt Sorg",
  "Jacob Creech",
  "Sean Young",
  "Solana Labs",
  "Solana Foundation",
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove special characters
    .replace(/\s+/g, "-") // Replace spaces with hyphens
    .replace(/-+/g, "-") // Replace multiple hyphens with single hyphen
    .trim();
}

function getAvatarForAuthor(authorName: string): string {
  // Use Solana logo for Solana-related authors
  if (authorName.toLowerCase().includes("solana")) {
    return "/uploads/authors/solanaLogoMark.svg";
  }
  // Default avatar for others
  return "/uploads/authors/default-avatar.png";
}

function createAuthorFile(authorName: string, outputDir: string): void {
  const filename = `${slugify(authorName)}.md`;
  const filePath = join(outputDir, filename);
  const avatar = getAvatarForAuthor(authorName);

  const content = `---
name: ${authorName}
avatar: ${avatar}
---
`;

  writeFileSync(filePath, content, "utf8");
  console.log(`Created: ${filename}`);
}

function main(): void {
  const outputDir = join(process.cwd(), "content", "authors");

  // Ensure the output directory exists
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  console.log("Creating author files...\n");

  authors.forEach((authorName, index) => {
    // Check if file already exists
    const filename = `${slugify(authorName)}.md`;
    const filePath = join(outputDir, filename);

    if (existsSync(filePath)) {
      console.log(`Skipped: ${filename} (already exists)`);
    } else {
      createAuthorFile(authorName, outputDir);
    }
  });

  console.log(`\nCompleted! Created ${authors.length} author files.`);
  console.log(
    "\nNote: You may need to create a default avatar image at /public/uploads/authors/default-avatar.png"
  );
}

// Run the script
main();
