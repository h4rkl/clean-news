import { parseMdx } from "./parse-mdx";
import { notFound } from "next/navigation";
import fs from "node:fs/promises";
import path from "node:path";

export async function loadLocalizedContent(slug: string, locale: string) {
  const filePath = (loc: string) =>
    path.join(process.cwd(), "content", "news", loc, `${slug}.mdx`);

  try {
    const content = await fs.readFile(filePath(locale), "utf8");
    return parseMdx(content);
  } catch {
    try {
      const fallbackContent = await fs.readFile(filePath("en"), "utf8");
      return parseMdx(fallbackContent);
    } catch {
      notFound();
    }
  }
}
