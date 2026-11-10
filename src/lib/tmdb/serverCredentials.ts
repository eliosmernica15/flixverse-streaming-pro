/**
 * Server-only TMDB credentials. These must never use NEXT_PUBLIC_ variables.
 */
export function getServerTmdbAuth(): {
  headers: Record<string, string>;
  queryApiKey?: string;
} {
  const bearer = (
    process.env.TMDB_ACCESS_TOKEN || ""
  ).trim();
  const apiKey = (process.env.TMDB_API_KEY || "").trim();

  if (bearer) {
    return {
      headers: { Accept: "application/json", Authorization: `Bearer ${bearer}` },
    };
  }
  if (apiKey) {
    return {
      headers: { Accept: "application/json" },
      queryApiKey: apiKey,
    };
  }
  return { headers: { Accept: "application/json" } };
}

export function hasServerTmdbCredentials(): boolean {
  const auth = getServerTmdbAuth();
  return Boolean(auth.headers.Authorization || auth.queryApiKey);
}
