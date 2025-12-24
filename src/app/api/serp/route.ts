import { NextRequest, NextResponse } from 'next/server';
import { tavilySearch } from '@/lib/tavilySearch';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  try {
    if (!query) {
      return NextResponse.json({ error: 'Missing query' }, { status: 400 });
    }

    if (!process.env.TAVILY_API_KEY) {
      return NextResponse.json(
        { error: 'Missing TAVILY_API_KEY' },
        { status: 500 }
      );
    }

    const results = await tavilySearch(query, 10);

    // Backward-compatible shape for any existing callers expecting SerpAPI/Aves-like fields.
    return NextResponse.json({
      organic_results: results.map((r) => ({
        title: r.title,
        link: r.url,
        snippet: r.snippet,
      })),
    });
  } catch {
    return NextResponse.error();
  }
}
