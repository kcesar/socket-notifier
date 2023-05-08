import type { Socket as NetSocket } from 'net';
import type { Server as HTTPServer } from 'http';
import { WebSocketServer } from 'ws';
import { NextApiResponse } from 'next';
import { SocketConnection } from './socketConnection';
import { getServices } from './services';

export type SocketHTTPServer = HTTPServer & { ss?: SocketServer };

export interface NextSocketApiResponse extends NextApiResponse {
  socket: NetSocket & {
    server: SocketHTTPServer;
  };
}

function hasHttpServer(object: NextApiResponse): object is NextSocketApiResponse {
  return 'socket' in object;
}

function fromMultiValue(str: string|string[]|undefined): string|undefined {
  if (str == null || typeof str === 'string') return str;
  return str[0];
}


export class SocketServer {
  private readonly wss: WebSocketServer;
  

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
    getServices().then(services => services.gmailService.newMailStream.subscribe(email => this.notifyDevices(email)));
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

  notifyDevices(email: string) {
    for (const conn of Object.values(this.connections)) {
      const channels = conn.channels.filter(c => c.email === email).forEach(channel => {
        console.log(`SEND NOTICE TO ${conn.callsign} about ${channel.email}!!`);
        channel.commands.forEach(cmd => conn.sendCommand(cmd));
      });
    }
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