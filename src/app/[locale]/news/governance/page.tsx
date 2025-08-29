import { NewsList } from "@/components/news-list";

export default function DevelopersPage() {
  return (
    <NewsList
      title="Governance"
      description="Articles for governance."
      audience="governance"
      enOnly
    />
  );
}
