import Link from "next/link";
import { getLocale } from "next-intl/server";
import { getNewsIndex, filterArticles } from "@/lib/content-index";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type NewsListProps = {
  title: string;
  description?: string;
  audience?: string;
  section?: string;
  enOnly?: boolean;
  topics?: string[];
  topicMode?: "any" | "all";
};

export async function NewsList({
  title,
  description,
  audience,
  section,
  enOnly = true,
  topics = [],
  topicMode = "any",
}: NewsListProps) {
  const locale = await getLocale();
  const index = await getNewsIndex();

  const normalize = (l: string) => l.toLowerCase().split("-")[0];
  const base = enOnly
    ? index.filter((i) => normalize(i.locale) === "en")
    : index.filter((i) => normalize(i.locale) === normalize(locale));

  const articles = filterArticles({
    items: base,
    audience,
    section,
    topics,
    topicMode,
    status: "published",
  });

  const basePath = audience ? `/${locale}/news/${audience}` : `/${locale}/news`;
  const topicHref = (t: string) =>
    `${basePath}?topics=${encodeURIComponent(t)}`;
  const audienceHref = (a: string) => `/${locale}/news/${a}`;

  return (
    <div className="min-h-screen p-8 sm:p-20">
      <main className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">{title}</h1>
          {description ? (
            <p className="text-muted-foreground">{description}</p>
          ) : null}
        </header>

        {articles.length === 0 ? (
          <p className="text-muted-foreground">No articles found.</p>
        ) : (
          <ul className="space-y-4">
            {articles.map((a) => (
              <li key={`${a.locale}:${a.slug}`}>
                <Card className="hover:bg-accent/40 transition-colors">
                  <CardHeader>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-muted-foreground">
                        {a.date ? new Date(a.date).toLocaleDateString() : ""}
                      </span>
                      {a.audiences?.map((aud) => (
                        <Link key={aud} href={audienceHref(aud)}>
                          <Badge variant="outline">{aud}</Badge>
                        </Link>
                      ))}
                    </div>
                    <CardTitle className="mt-1">
                      <Link href={`/${locale}/news/${a.slug}`}>{a.title}</Link>
                    </CardTitle>
                    {a.description ? (
                      <CardDescription>{a.description}</CardDescription>
                    ) : null}
                  </CardHeader>
                  {a.topics?.length ? (
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {a.topics.map((t) => (
                          <Link key={t} href={topicHref(t)}>
                            <Badge variant="outline">{t}</Badge>
                          </Link>
                        ))}
                      </div>
                    </CardContent>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
