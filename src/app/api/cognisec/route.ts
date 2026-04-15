// app/api/cognisec/route.ts
// Proxies requests to Vertex AI Agent Engine with streaming SSE support.
// Runs server-side — credentials never exposed to the client.

import { NextRequest, NextResponse } from 'next/server';
import { GoogleAuth } from 'google-auth-library';

const auth = new GoogleAuth({
  scopes: ['https://www.googleapis.com/auth/cloud-platform'],
});

const PROJECT_ID = 'pandex-ai-core';
const LOCATION   = 'us-central1';
// Replace with your Reasoning Engine resource ID after deploying to Agent Engine.
// Find it at: console.cloud.google.com/vertex-ai/agents — click your agent — copy the numeric ID from the URL.
const RESOURCE_ID = process.env.COGNISEC_RESOURCE_ID ?? '';

export async function POST(req: NextRequest) {
  if (!RESOURCE_ID) {
    return NextResponse.json(
      { error: 'COGNISEC_RESOURCE_ID environment variable is not set.' },
      { status: 500 }
    );
  }

  const { message, sessionId, userId } = await req.json() as {
    message: string;
    sessionId?: string;
    userId?: string;
  };

  if (!message?.trim()) {
    return NextResponse.json({ error: 'message is required.' }, { status: 400 });
  }

  const client = await auth.getClient();
  const tokenResponse = await client.getAccessToken();
  const token = tokenResponse.token;

  const endpoint = `https://${LOCATION}-aiplatform.googleapis.com/v1/projects/${PROJECT_ID}/locations/${LOCATION}/reasoningEngines/${RESOURCE_ID}:streamQuery?alt=sse`;

  const body: Record<string, unknown> = {
    class_method: 'async_stream_query',
    input: {
      message,
      user_id: userId ?? 'panteray-user',
      ...(sessionId ? { session_id: sessionId } : {}),
    },
  };

  const upstream = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!upstream.ok) {
    const errText = await upstream.text();
    console.error('[CogniSec API] upstream error:', upstream.status, errText);
    return NextResponse.json(
      { error: `Agent Engine error ${upstream.status}`, detail: errText },
      { status: upstream.status }
    );
  }

  // Stream the SSE response directly back to the browser.
  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
