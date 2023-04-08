import type { NextApiRequest, NextApiResponse } from 'next';
import { SocketServer } from '@/lib/server/SocketServer';
import { NextSocketApiResponse } from '../socket-keepalive';
import { getAuthFromApiCookies } from '@/lib/server/auth';
import { DeviceStatus } from '@/lib/api/deviceStatus';

function hasHttpServer(object: NextApiResponse): object is NextSocketApiResponse {
  return 'socket' in object;
}

export default async function ConnectedDevices(req: NextApiRequest, res: NextApiResponse) {
  const user = await getAuthFromApiCookies(req.cookies);
  if (!user) {
    res.status(401).json({message: 'Must authenticate'});
    return;
  }
  
  if (hasHttpServer(res)) {
    const server = res.socket.server;
    if (!server.ss) {
      console.log('Initializing websocket server');
      server.ss = new SocketServer(server);
    }
    const list = Object.values(server.ss.connections).map(c => {
      const status: DeviceStatus = {
        id: c.id,
        callsign: c.callsign,
        since: c.since,
        remoteAddr: c.addr,
      };
      return status;
    });

    res.json({
      list
    });
  }
};
