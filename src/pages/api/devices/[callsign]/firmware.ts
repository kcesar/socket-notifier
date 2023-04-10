import type { NextApiRequest, NextApiResponse } from 'next';
import { FirmwareMongo, getDevice } from '@/lib/server/mongodb';
import Utils from '@/lib/server/utils';

export default async function DeviceFirmwareDownload(req: NextApiRequest, res: NextApiResponse) {
  const callsign = Utils.fromMultiValue(req.query.callsign)!;
  const device = await getDevice(callsign);

  if (device == null || device.expectedVersion == null) {
    res.status(404).json({message: 'Not found'});
    return;
  }

  const firmware = await FirmwareMongo.getFirmwareBinary(device.expectedVersion);
  if (!firmware) {
    console.log(`Could not get firmware ${device.expectedVersion} from storage`);
    res.status(500).json({message: 'Expected version not found on server'});
    return;
  }

  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename=notify-firmware.${device.expectedVersion}.bin`);
  res.send(firmware.buffer);
}