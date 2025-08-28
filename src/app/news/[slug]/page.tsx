import { getLocale } from "next-intl/server";
import { loadLocalizedContent } from "@/lib/load-content";

export default async function NewsPage({
  params,
}: {
  params: { slug: string };
}) {
  const locale = await getLocale();
  const { frontmatter, readingTime } = await loadLocalizedContent(
    params.slug,
    locale
  );

  return (
    <article className="prose">
      <h1>{frontmatter?.title}</h1>
      {frontmatter?.description ? <p>{frontmatter.description}</p> : null}
      {readingTime ? <p>{Math.ceil(readingTime.minutes)} min read</p> : null}
    </article>
  );
}
