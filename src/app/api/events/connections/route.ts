import { NextRequest, NextResponse } from 'next/server';
import { addClient, removeClient } from './eventBroadcaster';

export async function GET(req: NextRequest) {
  // Set headers for SSE
  const headers = new Headers();
  headers.set('Content-Type', 'text/event-stream');
  headers.set('Connection', 'keep-alive');
  headers.set('Cache-Control', 'no-cache, no-transform');
  headers.set('Transfer-Encoding', 'chunked');

  const stream = new ReadableStream({
    start(controller) {
      // Send a comment to keep the connection alive
      const sendComment = () => {
        controller.enqueue(new TextEncoder().encode(`: ${Date.now()}\n\n`));
      };
      const intervalId = setInterval(sendComment, 30000);

      const clientId = Date.now();
      const newClient = {
        id: clientId,
        controller,
      };

      addClient(newClient);

      // When the client closes the connection
      req.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        removeClient(clientId);
      });
    },
  });

  return new NextResponse(stream, { headers });
}
