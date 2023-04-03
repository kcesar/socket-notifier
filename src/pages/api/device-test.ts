import type { NextApiRequest, NextApiResponse } from 'next';
import { SocketServer } from '@/lib/server/SocketServer';
import { NextSocketApiResponse } from './socket-keepalive';

function hasHttpServer(object: NextApiResponse): object is NextSocketApiResponse {
  return 'socket' in object;
}

interface Body {
  callsign: string;
}

export default async function DeviceTest(req: NextApiRequest, res: NextApiResponse) {
  if (hasHttpServer(res)) {
    const server = res.socket.server;
    if (!server.ss) {
      console.log('Initializing websocket server');
      server.ss = new SocketServer(server);
    }
    
    const body = req.body as Body;
    server.ss.testDevice(body.callsign);

    res.json({
      status: 'ok'
    });
  }
};
