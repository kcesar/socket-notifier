import type { Socket as NetSocket } from 'net';
import type { NextApiRequest, NextApiResponse } from 'next';
import { SocketHTTPServer, SocketServer } from '@/lib/server/SocketServer';

export interface NextSocketApiResponse extends NextApiResponse {
  socket: NetSocket & {
    server: SocketHTTPServer;
  };
}

function hasHttpServer(object: NextApiResponse): object is NextSocketApiResponse {
  return 'socket' in object;
}

export default async function SocketHandler(_req: NextApiRequest, res: NextApiResponse) {
  if (hasHttpServer(res)) {
    const server = res.socket.server;
    if (server.ss) {
      // Already initialized
    } else {
      console.log('Initializing websocket server');
      server.ss = new SocketServer(server);
    }
    res.json({status: 'ok'});
  }
};
