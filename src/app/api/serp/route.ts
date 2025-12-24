import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  // console.log('query from GET: ', query);
  try {
    // const response = await fetch(
    //   `https://serpapi.com/search?q=${query}&location=${'Dubai,Dubai,United Arab Emirates'}&engine=google&api_key=${
    //     process.env.NEXT_PUBLIC_SERPAPI_KEY
    //   }`
    const response = await fetch(
      `https://api.avesapi.com/search?apikey=${process.env.NEXT_PUBLIC_AVES_API_KEY}&type=web&query=${query}&google_domain=google.ae&gl=ae&hl=en&device=desktop&output=json&num=10`
    );
    // console.log('response: ', response);

    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const jsonData = await response.json();
    // console.log('jsonData: ', jsonData);
    return NextResponse.json(jsonData);
  } catch {
    return NextResponse.error();
  }
}
