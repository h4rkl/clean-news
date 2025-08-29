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
  date: string; // or Date if you parse it
  audiences: string[];
  section: string;
  topics: string[];
  heroImage?: string;
  // Section-specific fields (optional, e.g., for 'upgrades' section)
  simdNumber?: number;
  // Add more section-specific fields as needed
};
