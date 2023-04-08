import type { NextApiRequest, NextApiResponse } from 'next';
import { SocketServer } from '@/lib/server/SocketServer';
import { getAuthFromApiCookies } from '@/lib/server/auth';

export default async function DisconnectDevices(req: NextApiRequest, res: NextApiResponse) {
  const user = await getAuthFromApiCookies(req.cookies);
  if (!user) {
    res.status(401).json({message: 'Must authenticate'});
    return;
  }
  if (!user.isAdmin) {
    res.status(403).json({message: 'Forbidden'});
    return;
  }
  
  const wss = SocketServer.fromResponse(res);
  console.log(`${user.email} is dropping all socket connections`);
  wss.reset();

  res.json({
    status: 'ok'
  });
}
