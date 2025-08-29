import { NewsList } from "@/components/news-list";

export default function DevelopersPage() {
  return (
    <NewsList
      title="Developers"
      description="Articles for developers."
      audience="developers"
      enOnly
    />
  );
}
