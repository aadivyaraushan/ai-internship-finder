// Global array to hold all the clients
let clients: Array<{
  id: number;
  controller: ReadableStreamDefaultController<Uint8Array>;
}> = [];

// Function to broadcast events to all clients
export function broadcastEvent(data: Record<string, unknown>) {
  clients.forEach(client => {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    client.controller.enqueue(new TextEncoder().encode(message));
  });
}

// Function to add a client
export function addClient(client: {
  id: number;
  controller: ReadableStreamDefaultController<Uint8Array>;
}) {
  clients.push(client);
}

// Function to remove a client
export function removeClient(clientId: number) {
  clients = clients.filter(client => client.id !== clientId);
}