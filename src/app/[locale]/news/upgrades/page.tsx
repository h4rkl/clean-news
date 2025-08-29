import { NewsList } from "@/components/news-list";
import {
  parseTopicsFromSearchParams,
  type FilterSearchParams,
} from "@/lib/search-params";

export default function UpgradesPage({
  searchParams,
}: {
  searchParams?: FilterSearchParams;
}) {
  const topics = parseTopicsFromSearchParams(searchParams);
  return (
    <NewsList
      title="Upgrades"
      description="Articles for upgrades."
      audience="upgrades"
      enOnly
    />
  );
}
