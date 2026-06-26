import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const token = req.headers.get('Authorization'); // Get token from request

    const backendRes = await fetch(`${BACKEND_URL}/extract/`, {
      method: 'POST',
      body: formData,
      headers: {
        ...(token ? { 'Authorization': token } : {})
      },
    });

    const data = await backendRes.json();
    return NextResponse.json(data, { status: backendRes.status });
  } catch (error) {
    console.error('Extract proxy error:', error);
    return NextResponse.json({ detail: 'Failed to connect to extraction service' }, { status: 500 });
  }
}
