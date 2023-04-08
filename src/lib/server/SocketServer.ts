import type { Socket as NetSocket } from 'net';
import type { Server as HTTPServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuid } from 'uuid';
import { NextApiResponse } from 'next';
import { getDevice } from './mongodb';

export type SocketHTTPServer = HTTPServer & { ss?: SocketServer };

export interface NextSocketApiResponse extends NextApiResponse {
  socket: NetSocket & {
    server: SocketHTTPServer;
  };
}

function hasHttpServer(object: NextApiResponse): object is NextSocketApiResponse {
  return 'socket' in object;
}

class SocketConnection {
  private ws: WebSocket;
  readonly id = uuid();
  callsign: string = '';
  since: number = new Date().getTime();
  addr?: string;
  isAlive: boolean = true;

  handshakeTimeout?: NodeJS.Timeout;

  constructor(ws: WebSocket, remoteAddr?: string, onClose?: (id: string) => void) {
    this.ws = ws;
    this.addr = remoteAddr;
    ws.on('error', err => console.log('error:', err));
    ws.on('message', (data) => this.handleMessage(String(data)));
    ws.on('close', () => onClose?.(this.id));
    ws.on('pong', () => this.isAlive = true);
  }

  private async handleMessage(data: string) {
    const parts = data.split(' ');
    switch (parts[0]) {
      case 'HELLO':
        this.callsign = parts[1];
        const device = await getDevice(this.callsign);
        if (!device) {
          this.ws.send('ERROR device not known');
          this.ws.close();
          return;
        }
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
  }

  close() {
    if (this.handshakeTimeout) {
      clearTimeout(this.handshakeTimeout);
      this.handshakeTimeout = undefined;
    }
    this.ws.close();
  }

  ping() {
    if (!this.isAlive) {
      this.close();
      this.ws.terminate();
    }

    this.isAlive = false;
    this.ws.ping();
  }

  private sendLed(idx: number, on: boolean, timeMs?: number) {
    // LED 1 ON 2000
    this.ws.send(`LED ${idx} ${on ? 'ON' : 'OFF'}${timeMs ?? 0 > 0 ? ' ' + timeMs : ''}`);
  }

  sendTest() {
    console.log(this.id, 'Running test');
    this.ws.send('BEEP 1 2 262 200 294 200 330 200 349 200 392 200 440 200 494 200 523 400 0 400');
    this.sendLed(1, true, 5000);
  }
}

function fromMultiValue(str: string|string[]|undefined): string|undefined {
  if (str == null || typeof str === 'string') return str;
  return str[0];
}

export class SocketServer {
  wss: WebSocketServer;

  connections: Record<string, SocketConnection> = {};

  constructor(server: SocketHTTPServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.wss.on('connection', (ws, req) => {
      const remoteAddr = (fromMultiValue(req.headers['x-forwarded-for']) ?? req.socket.remoteAddress)?.split(':').pop();
      const conn = new SocketConnection(ws, remoteAddr, closeId => this.handleClose(closeId));
      this.connections[conn.id] = conn;
      console.log(conn.id, 'new connection');
      conn.run();
    });
    this.wss.on('error', err => console.log('outer error', err));
    this.wss.on('close', () => console.log('outer close'));

    setInterval(() => Object.values(this.connections).forEach(c => c.ping()), 20000);
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

  testDevice(callsign: string) {
    Object.values(this.connections).filter(c => c.callsign === callsign).forEach(c => c.sendTest());
  }

  static fromResponse(res: NextApiResponse): SocketServer {
    if (!hasHttpServer(res)) throw new Error('Not a socket server');

    const server = res.socket.server;
    if (!server.ss) {
      console.log('Initializing websocket server');
      server.ss = new SocketServer(server);
    }
    return server.ss;
  }
}