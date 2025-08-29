import { getLocale } from "next-intl/server";
import { loadLocalizedContent } from "@/lib/load-content";
import { Mdx } from "@/components/mdx-components";

export default async function NewsPage({
  params,
}: {
  params: { slug: string };
}) {
  const locale = await getLocale();
  const { frontmatter, readingTime, content } = await loadLocalizedContent(
    params.slug,
    locale
  );

  return (
    <article className="prose">
      <h1>{frontmatter?.title}</h1>
      {frontmatter?.description ? <p>{frontmatter.description}</p> : null}
      {readingTime ? <p>{Math.ceil(readingTime.minutes)} min read</p> : null}
      {content ? <Mdx source={content} /> : null}
    </article>
  );
}
