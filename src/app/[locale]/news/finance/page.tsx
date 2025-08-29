import { NewsList } from "@/components/news-list";

export default function DevelopersPage() {
  return (
    <NewsList
      title="Finance"
      description="Articles for finance."
      audience="finance"
      enOnly
    />
  );
}
