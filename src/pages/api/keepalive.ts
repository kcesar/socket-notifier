import type { NextApiRequest, NextApiResponse } from 'next';
import { SocketServer } from '@/lib/server/SocketServer';

export default async function KeepAlive(_req: NextApiRequest, res: NextApiResponse) {
  SocketServer.fromResponse(res);
  res.json({ status: 'ok' });
}
