// src/lib/search-params.ts
export type FilterSearchParams = {
  audience?: string;
  topic?: string;
  topics?: string | string[];
};

export function parseTopicsFromSearchParams(
  searchParams?: FilterSearchParams
): string[] {
  const topicsRaw = searchParams?.topics ?? searchParams?.topic;
  return Array.isArray(topicsRaw)
    ? topicsRaw
    : typeof topicsRaw === "string"
    ? topicsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

export function parseAudienceFromSearchParams(
  searchParams?: FilterSearchParams
): string | undefined {
  return typeof searchParams?.audience === "string"
    ? searchParams.audience
    : undefined;
}
