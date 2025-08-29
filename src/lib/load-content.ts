import { parseMdx } from "./parse-mdx";
import { notFound } from "next/navigation";
import fs from "node:fs/promises";
import { getNewsIndex } from "@/lib/content-index";

export async function loadLocalizedContent(slug: string, locale: string) {
  const normalize = (l: string) => l.toLowerCase().split("-")[0];
  const normalizedLocale = normalize(locale);

  const index = await getNewsIndex();

  const matchForLocale = index.find(
    (item) => item.slug === slug && normalize(item.locale) === normalizedLocale
  );

  const matchForEn = index.find(
    (item) => item.slug === slug && normalize(item.locale) === "en"
  );

  const match = matchForLocale ?? matchForEn;
  if (!match) {
    notFound();
  }

  const content = await fs.readFile(match.path, "utf8");
  return parseMdx(content);
}
