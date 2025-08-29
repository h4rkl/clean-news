import { NewsList } from "@/components/news-list";
import {
  parseTopicsFromSearchParams,
  type FilterSearchParams,
} from "@/lib/search-params";

export default function FinancePage({
  searchParams,
}: {
  searchParams?: FilterSearchParams;
}) {
  const topics = parseTopicsFromSearchParams(searchParams);

  return (
    <NewsList
      title="Finance"
      description="Articles for finance."
      audience="finance"
      enOnly
      topics={topics}
    />
  );
}
