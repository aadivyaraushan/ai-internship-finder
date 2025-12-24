export type NormalizedSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

type TavilySearchResponse = {
  query?: string;
  answer?: string;
  results?: Array<{
    title?: string;
    url?: string;
    content?: string;
    snippet?: string;
    raw_content?: string;
  }>;
};

/**
 * Server-side web search via Tavily.
 *
 * Env required: TAVILY_API_KEY
 *
 * Docs: https://docs.tavily.com/documentation/quickstart
 */
export async function tavilySearch(
  query: string,
  maxResults = 10
): Promise<NormalizedSearchResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return [];
  if (!query?.trim()) return [];

  let resp: Response;
  try {
    resp = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: maxResults,
        include_answer: false,
        include_raw_content: false,
        search_depth: 'basic',
      }),
    });
  } catch {
    return [];
  }

  if (!resp.ok) return [];

  let data: TavilySearchResponse | null = null;
  try {
    data = (await resp.json()) as TavilySearchResponse;
  } catch {
    return [];
  }

  const results = Array.isArray(data?.results) ? data.results : [];
  const out: NormalizedSearchResult[] = [];
  for (const r of results) {
    const url = typeof r?.url === 'string' ? r.url : '';
    if (!url.startsWith('http')) continue;
    out.push({
      title: typeof r?.title === 'string' ? r.title : '',
      url,
      snippet:
        (typeof r?.snippet === 'string' && r.snippet) ||
        (typeof r?.content === 'string' && r.content) ||
        '',
    });
  }

  return out.slice(0, maxResults);
}


