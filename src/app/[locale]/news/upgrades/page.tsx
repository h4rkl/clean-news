import { NewsList } from "@/components/news-list";

export default function DevelopersPage() {
  return (
    <NewsList
      title="Upgrades"
      description="Articles for upgrades."
      audience="upgrades"
      enOnly
    />
  );
}
