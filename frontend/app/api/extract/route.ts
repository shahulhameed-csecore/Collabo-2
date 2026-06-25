import { NextRequest, NextResponse } from 'next/server';

const PRODUCTION_API_URL = 'https://api.mycollabo.online';

export async function POST(req: NextRequest) {
  const apiUrl = (process.env.NEXT_PUBLIC_API_URL ?? '').trim() || PRODUCTION_API_URL;
  const backendUrl = `${apiUrl}/campaigns/ai-parse/`;

  try {
    // Forward the original FormData from the client
    const formData = await req.formData();
    
    // Pass along the Authorization header
    const headers = new Headers();
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      headers.set('Authorization', authHeader);
    }

    // Forward the request to the FastAPI backend
    const response = await fetch(backendUrl, {
      method: 'POST',
      body: formData,
      headers,
    });

    // If the backend returns a 502/503/504, it might be a cold start
    if (response.status === 502 || response.status === 503 || response.status === 504) {
      return NextResponse.json(
        { detail: 'The AI server is waking up. Please try again in 15 seconds.' },
        { status: 503 }
      );
    }

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return NextResponse.json(
        { detail: data?.detail || 'AI extraction failed on the server.' },
        { status: response.status }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[API Proxy] Error forwarding extraction:', error);
    return NextResponse.json(
      { detail: 'Internal server error while communicating with AI service.' },
      { status: 500 }
    );
  }
}
