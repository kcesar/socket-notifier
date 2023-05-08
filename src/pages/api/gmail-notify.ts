import type { NextApiRequest, NextApiResponse } from 'next';
import { getServices } from '@/lib/server/services';

export default async function GMailNotify(req: NextApiRequest, res: NextApiResponse) {
  const gmail = (await getServices()).gmailService;
  const notification = JSON.parse(Buffer.from(req.body.message.data, 'base64').toString());

  // fire and forget
  gmail.notify(notification);
  res.json({ status: 'ok' });
}
