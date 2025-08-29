import { NewsList } from "@/components/news-list";
import {
  parseTopicsFromSearchParams,
  type FilterSearchParams,
} from "@/lib/search-params";

export default function GovernancePage({
  searchParams,
}: {
  searchParams?: FilterSearchParams;
}) {
  const topics = parseTopicsFromSearchParams(searchParams);
  return (
    <NewsList
      title="Governance"
      description="Articles for governance."
      audience="governance"
      enOnly
    />
  );
}
