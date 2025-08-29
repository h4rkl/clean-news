import matter from "gray-matter";
import readingTime from "reading-time";

export function parseMdx(content: string) {
  const { data: frontmatter, content: mdxContent } = matter(content);
  const readingTimeStats = readingTime(mdxContent);
  return { frontmatter, readingTime: readingTimeStats, content: mdxContent };
}

export type ContentMetadata = {
  title: string;
  description: string;
  slug: string;
  date: string;
  audiences: string[];
  topics: string[];
  heroImage?: string;
  simdNumber?: number;
};
