import type { NextApiRequest, NextApiResponse } from 'next';
import { SocketServer } from '@/lib/server/SocketServer';
import { getAuthFromApiCookies } from '@/lib/server/auth';
import { getDevice } from '@/lib/server/mongodb';
import Utils from '@/lib/server/utils';

export default async function DeviceTest(req: NextApiRequest, res: NextApiResponse) {
  const callsign = Utils.fromMultiValue(req.query.callsign)!;

  const user = await getAuthFromApiCookies(req.cookies);
  if (!user) {
    res.status(401).json({message: 'Must authenticate'});
    return;
  }
  
  const device = await getDevice(callsign);

  if (device == null) {
    res.status(404).json({message: 'Not found'});
    return;
  }
  if (device.email !== user.email && !user.isAdmin) {
    res.status(403).json({message: 'Permission denied'});
    return;
  }

  console.log(`${user.email} is testing ${callsign}`);
  const wss = SocketServer.fromResponse(res);
  wss.testDevice(callsign);

  res.json({
    status: 'ok'
  });
};
