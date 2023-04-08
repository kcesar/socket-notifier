import type { NextApiRequest, NextApiResponse } from 'next';

import Utils from '@/lib/server/utils';
import { SocketServer } from '@/lib/server/SocketServer';
import { getAuthFromApiCookies } from '@/lib/server/auth';
import { ConnectedDevice, DeviceStatus } from '@/lib/api/deviceStatus';
import { getAllDevices } from '@/lib/server/mongodb';
import { UserInfo } from '@/lib/userInfo';

export default async function ConnectedDevices(req: NextApiRequest, res: NextApiResponse) {
  const user = await getAuthFromApiCookies(req.cookies);
  if (!user) {
    res.status(401).json({ message: 'Must authenticate' });
    return;
  }

  if (req.method === 'GET') {
    await getDevices(user, req, res);
  }
  res.end();
}

async function getDevices(user: UserInfo, req: NextApiRequest, res: NextApiResponse) {
  let devices: ConnectedDevice[] = await getAllDevices({ stripIds: true });
  
  if (!(user.isAdmin && Utils.fromMultiValue(req.query.all))) {
    devices = devices.filter(f => f.email === user.email);
  }

  const lookup = devices.reduce((a, c) => ({ ...a, [c.callsign]: c }), {} as Record<string, ConnectedDevice>);

  const wss = SocketServer.fromResponse(res);
  Object.values(wss.connections)
    .filter(c => lookup[c.callsign])
    .map(c => {
      const status: DeviceStatus = {
        id: c.id,
        callsign: c.callsign,
        since: c.since,
        remoteAddr: c.addr,
      };
      return status;
    })
    .forEach(c => {
      lookup[c.callsign].status = c;
    });

  res.json({
    devices
  });
}

