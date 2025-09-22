import fs from "fs/promises";
import path from "path";

async function main() {
  const contentDir = path.join(__dirname, "..", "content", "news", "en");
  const publicDir = path.join(__dirname, "..", "public");

  const files = await fs.readdir(contentDir);
  for (const file of files) {
    if (!file.endsWith(".mdx")) continue;

    const slug = file.replace(".mdx", "");
    const postDir = path.join(publicDir, slug);
    await fs.mkdir(postDir, { recursive: true }); // Create directory if it doesn't exist, recursively

    const filePath = path.join(contentDir, file);
    let content = await fs.readFile(filePath, "utf8");

    const urlRegex =
      /https:\/\/cdn\.builder\.io\/api\/v1\/image\/assets%2F\w+%2F\w+/g;
    const urls = [...new Set(content.match(urlRegex) || [])];

    const replacements = new Map<string, string>();

    await Promise.all(
      urls.map(async (url) => {
        try {
          const response = await fetch(url);
          if (!response.ok) throw new Error(`Failed to fetch ${url}`);

          const contentType =
            response.headers.get("content-type") || "image/jpeg";
          let ext = "jpg";
          if (contentType.includes("png")) ext = "png";
          else if (contentType.includes("gif")) ext = "gif";
          else if (contentType.includes("jpeg")) ext = "jpg";
          // Add more types if needed, e.g., 'webp', 'svg+xml' -> 'svg'

          const imageId = url.split("%2F").pop()!;
          const filename = `${imageId}.${ext}`;
          const localPath = path.join(postDir, filename);

          const buffer = await response.arrayBuffer();
          await fs.writeFile(localPath, Buffer.from(buffer));

          const newUrl = `/${slug}/${filename}`;
          replacements.set(url, newUrl);
          console.log(
            `Downloaded ${url} to ${localPath} and will replace with ${newUrl}`
          );
        } catch (error) {
          console.error(`Error processing ${url} for ${file}:`, error);
        }
      })
    );

    // Apply replacements
    for (const [oldUrl, newUrl] of replacements) {
      content = content.replaceAll(oldUrl, newUrl);
    }

    await fs.writeFile(filePath, content);
    console.log(`Updated ${file} with local image references`);
  }
}

main().catch(console.error);
