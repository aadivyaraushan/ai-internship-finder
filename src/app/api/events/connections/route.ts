import { NextRequest, NextResponse } from 'next/server';

// Global array to hold all the clients
let clients: any[] = [];

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
        controller.enqueue(`: ${Date.now()}\n\n`);
      };
      const intervalId = setInterval(sendComment, 30000);

      const clientId = Date.now();
      const newClient = {
        id: clientId,
        controller,
      };

      clients.push(newClient);

      // When the client closes the connection
      req.signal.addEventListener('abort', () => {
        clearInterval(intervalId);
        clients = clients.filter(client => client.id !== clientId);
      });
    },
  });

  return new NextResponse(stream, { headers });
}

// Function to broadcast events to all clients
export function broadcastEvent(data: any) {
  clients.forEach(client => {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    client.controller.enqueue(new TextEncoder().encode(message));
  });
}
