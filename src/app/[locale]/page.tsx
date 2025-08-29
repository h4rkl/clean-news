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

export default async function Home() {
  const locale = await getLocale();
  const index = await getNewsIndex();

  const normalize = (l: string) => l.toLowerCase().split("-")[0];

  const articles = filterArticles({
    items: index.filter((i) => normalize(i.locale) === normalize(locale)),
    status: "published",
  });

  return (
    <div className="min-h-screen p-8 sm:p-20">
      <main className="mx-auto max-w-3xl space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold">Latest news</h1>
          <p className="text-muted-foreground">
            Updates, ecosystem news, and more.
          </p>
        </header>

        {articles.length === 0 ? (
          <p className="text-muted-foreground">No articles found.</p>
        ) : (
          <ul className="space-y-4">
            {articles.map((a) => (
              <li key={`${a.locale}:${a.slug}`}>
                <Link href={`/${locale}/news/${a.slug}`} className="block">
                  <Card className="hover:bg-accent/40 transition-colors">
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        {a.section ? (
                          <Badge variant="secondary">{a.section}</Badge>
                        ) : null}
                        <span className="text-xs text-muted-foreground">
                          {a.date ? new Date(a.date).toLocaleDateString() : ""}
                        </span>
                      </div>
                      <CardTitle className="mt-1">{a.title}</CardTitle>
                      {a.description ? (
                        <CardDescription>{a.description}</CardDescription>
                      ) : null}
                    </CardHeader>
                    {a.topics?.length ? (
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          {a.topics.map((t) => (
                            <Badge key={t} variant="outline">
                              {t}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    ) : null}
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
