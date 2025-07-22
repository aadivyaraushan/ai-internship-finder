import { NextRequest, NextResponse } from 'next/server';
import { findConnections } from './services/connectionFinderService';
import { enrichPersonConnection } from './services/profileEnrichmentService';
import { enrichProgramConnection } from './services/programEnrichmentService';
import { postProcessConnections } from './services/postProcessConnectionsService';
import { Connection } from '@/lib/firestoreHelpers';
import { EventEmitter } from 'events';
import { ConnectionPreferences } from '@/components/ui/ConnectionPreferencesSelector';
import { ResumeAspects } from './services/resumeAnalysisService';
import { getResume } from '@/lib/firestoreHelpers';

// Create a global event emitter (consider using a request-specific emitter in production)
const globalEmitter = new EventEmitter();

type ConnectionRequest = {
  goalTitle: string;
  preferences: ConnectionPreferences;
  race: string;
  location: string;
  userId: string;
  resumeAspects: ResumeAspects;
  rawResumeText: string;
};

export async function POST(req: Request) {
  console.log('\n🚀 Starting connection search process');

  const encoder = new TextEncoder();
  let streamClosed = false;

  // Create the SSE stream
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const body: ConnectionRequest = await req.json();
        const {
          goalTitle,
          preferences,
          userId,
          race,
          location,
          resumeAspects,
          rawResumeText,
        } = body;

        // Helper to send SSE messages
        const sendSSE = (data: any) => {
          if (!streamClosed) {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
            );
          }
        };

        // Basic validation
        if (!goalTitle) {
          sendSSE({ type: 'error', message: 'Goal title is required' });
          controller.close();
          return;
        }
        if (!userId) {
          sendSSE({ type: 'error', message: 'User ID is required' });
          controller.close();
          return;
        }

        // Step 1: Use resumeAspects
        sendSSE({
          type: 'step-update',
          step: 0,
          message: 'Processing resume aspects...',
        });
        const aspects = resumeAspects as ResumeAspects;
        if (!aspects) {
          sendSSE({ type: 'error', message: 'No resume aspects provided' });
          controller.close();
          return;
        }
        logAspects(aspects);

        // Step 2: Find connections
        sendSSE({
          type: 'step-update',
          step: 1,
          message: 'Finding connections...',
        });
        console.log('preferences: ', preferences);
        const found = await findConnections({
          goalTitle,
          connectionAspects: aspects,
          preferences,
          race,
          location,
        });

        // Send found connections as they're discovered
        found.forEach((connection, index) => {
          sendSSE({
            type: 'connection-found',
            connection,
            count: index + 1,
            total: found.length,
          });
        });

        // // Process enrichment in batches to send updates
        // const enriched: Connection[] = [];
        // for (let i = 0; i < found.length; i++) {
        //   const conn = found[i];
        //   let enrichedConn: Connection;

        //   if (conn.type === 'person') {
        //     enrichedConn = await enrichPersonConnection(conn);
        //   } else if (conn.type === 'program') {
        //     enrichedConn = await enrichProgramConnection(conn);
        //   } else {
        //     enrichedConn = conn;
        //   }
        //   if (enrichedConn.verified_profile_url) {
        //     enriched.push(enrichedConn);
        //   }

        // Send progress update
        //   sendSSE({
        //     type: 'enrichment-progress',
        //     progress: ((i + 1) / found.length) * 100,
        //     current: i + 1,
        //     total: found.length,
        //   });
        // }

        // Step 4: Post-process
        sendSSE({
          type: 'step-update',
          step: 3,
          message: 'Finalizing results...',
        });
        const processed = postProcessConnections(found, rawResumeText);

        // Send final results
        sendSSE({
          type: 'complete',
          data: {
            connections: processed,
            aspects,
            goalTitle,
            timestamp: new Date().toISOString(),
            status: 'success',
          },
        });

        // Close the stream
        controller.close();
      } catch (err: any) {
        console.error('❌ Critical error in connection search:', err);
        if (!streamClosed) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'error',
                message: 'Failed to fetch connections',
                error: err.message,
              })}\n\n`
            )
          );
        }
        controller.close();
      }
    },

    cancel() {
      streamClosed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable Nginx buffering
    },
  });
}

// SSE endpoint for progress events
// IMPORTANT: This must be a GET handler for SSE
// We'll use a dynamic route parameter to identify the request
// This is a simplified example - in production you'd need a more robust system
// to match events to specific client requests

export async function GET(req: NextRequest) {
  const responseStream = new TransformStream();
  const writer = responseStream.writable.getWriter();
  const encoder = new TextEncoder();

  // Write the SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });

  const listener = (event: any) => {
    const eventName = event.type;
    const data = JSON.stringify(event);
    const sseMessage = `event: ${eventName}\ndata: ${data}\n\n`;
    console.log('Sending SSE:', sseMessage); // Temporary debug
    writer.write(encoder.encode(sseMessage));
  };

  // Use the global emitter for SSE
  globalEmitter.on('event', listener);

  // Cleanup on client disconnect
  req.signal.onabort = () => {
    globalEmitter.off('event', listener);
    writer.close();
  };

  // Send initial event to keep connection alive
  writer.write(encoder.encode(': ping\n\n'));

  return new Response(responseStream.readable, { headers });
}

// ---------------------------------------------------------------------------
function errorResponse(status: number, message: string, details?: string) {
  return NextResponse.json(
    { error: message, ...(details && { details }) },
    { status, headers: { 'Content-Type': 'application/json' } }
  );
}

function logAspects(aspects: any) {
  console.log('Connection aspects details:');
  for (const [k, v] of Object.entries(aspects)) {
    console.log(`- ${k}:`, JSON.stringify(v, null, 2));
  }
}
