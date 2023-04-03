import type { NextApiRequest, NextApiResponse } from 'next';
import { SocketServer } from '@/lib/server/SocketServer';
import { NextSocketApiResponse } from './socket-keepalive';

function hasHttpServer(object: NextApiResponse): object is NextSocketApiResponse {
  return 'socket' in object;
}

export default async function SocketHandler(_req: NextApiRequest, res: NextApiResponse) {
  if (hasHttpServer(res)) {
    const server = res.socket.server;
    if (!server.ss) {
      console.log('Initializing websocket server');
      server.ss = new SocketServer(server);
    }
    server.ss.reset();
    res.json({
      status: 'ok'
    });
  }
};
