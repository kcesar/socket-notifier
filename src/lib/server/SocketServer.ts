import type { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuid } from 'uuid';

export type SocketHTTPServer = HTTPServer & { ss?: SocketServer };

class SocketConnection {
  private ws: WebSocket;
  readonly id = uuid();
  callsign: string = '';
  since: number = new Date().getTime();
  addr?: string;

  handshakeTimeout?: NodeJS.Timeout;
  flashTimer?: NodeJS.Timeout;

  constructor(ws: WebSocket, remoteAddr?: string, onClose?: (id: string) => void) {
    this.ws = ws;
    this.addr = remoteAddr;
    ws.on('error', err => console.log('error:', err));
    ws.on('message', (data) => this.handleMessage(String(data)));
    ws.on('close', () => onClose?.(this.id));
  }

  private handleMessage(data: string) {
    const parts = data.split(' ');
    switch (parts[0]) {
      case 'HELLO':
        this.callsign = parts[1];
        console.log(this.id, `Handshake complete for ${this.callsign}`);
        this.ws.send('WELCOME ' + this.id);
        break;

      case 'BUTTON':
        console.log(this.id, 'clicked button');
        break;
    }
  }

  run() {
    this.handshakeTimeout = setTimeout(() => {
      if (!this.callsign && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('ERROR No handshake');
        this.ws.close();
      }
    }, 5000);

    let led: boolean = false;
    this.flashTimer = setInterval(() => {
      led = !led;
      this.ws.send('LED 1 ' + (led ? 'ON' : 'OFF'));
    }, 700)

  }

  close() {
    if (this.handshakeTimeout) {
      clearTimeout(this.handshakeTimeout);
      this.handshakeTimeout = undefined;
    }
    if (this.flashTimer) {
      clearInterval(this.flashTimer);
      this.flashTimer = undefined;
    }
    this.ws.close();
  }
}

export class SocketServer {
  ws: WebSocketServer;

  connections: Record<string, SocketConnection> = {};

  constructor(server: SocketHTTPServer) {
    this.ws = new WebSocketServer({ server, path: '/ws' });
    this.ws.on('connection', (ws, req) => {
      const conn = new SocketConnection(ws, req.socket.remoteAddress, closeId => this.handleClose(closeId));
      this.connections[conn.id] = conn;
      console.log(conn.id, 'new connection');
      conn.run();
    });
    this.ws.on('error', err => console.log('outer error', err));
    this.ws.on('close', () => console.log('outer close'));
  }

  private handleClose(closeId: string) {
    console.log(closeId, 'lost connection');
    delete this.connections[closeId];
  }

  reset() {
    for (const conn of Object.values(this.connections)) {
      conn.close();
    }
    this.connections = {};
  }
}