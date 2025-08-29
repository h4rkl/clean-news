import { getLocale } from "next-intl/server";
import { loadLocalizedContent } from "@/lib/load-content";
import { Mdx } from "@/components/mdx-components";

export default async function NewsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const locale = await getLocale();
  const { slug } = await params;
  const { frontmatter, readingTime, content } = await loadLocalizedContent(
    slug,
    locale
  );

  return (
    <article className="prose prose-lg mx-auto max-w-4xl px-4 py-8 lg:px-0">
      <h1 className="text-4xl font-bold mb-4">{frontmatter?.title}</h1>
      {frontmatter?.description ? (
        <p className="text-xl text-gray-600 mb-6">{frontmatter.description}</p>
      ) : null}
      {readingTime ? (
        <p className="text-sm text-gray-500 italic mb-8">
          {Math.ceil(readingTime.minutes)} min read
        </p>
      ) : null}
      {content ? <Mdx source={content} /> : null}
    </article>
  );
}
