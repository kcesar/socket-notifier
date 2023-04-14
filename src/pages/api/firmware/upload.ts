import { getAuthFromApiCookies } from '@/lib/server/auth';
import { IncomingForm, Fields, Files } from 'formidable';
import { promises as fs } from 'fs';
import { NextApiRequest, NextApiResponse } from 'next';
import { FirmwareMongo } from '@/lib/server/mongodb';
import Utils from '@/lib/server/utils';
export const config = {
  api: {
    bodyParser: false,
  }
}

function findVersion(data: Buffer) {
  // https://docs.espressif.com/projects/esptool/en/latest/esp32/advanced-topics/firmware-image-format.html
  // Extended File Header is 16 bytes starting after the 8 byte File Header. Byte 15 of the Extended File Header
  // (8 + 15) is the "Hash appended" flag.
  if (data[0x17] !== 0x01) {
    return undefined;
  }

  // There is a system call on the ESP32 to get the hash of the currently running partition that matches the last
  // 32 bytes of the .bin file.
  return data.subarray(-32).toString('hex');
}

export default async function FirmwareUploadHandler(req: NextApiRequest, res: NextApiResponse) {
  const user = await getAuthFromApiCookies(req.cookies);
  if (!user) {
    res.status(401).json({message: 'Must authenticate'});
    return;
  }
  if (!user.isAdmin) {
    res.status(403).json({message: 'Forbidden'});
    return;
  }
  
  const formData = await new Promise<{ fields: Fields, files: Files }>((resolve, reject) => {
    const form = new IncomingForm();
    form.parse(req, (err, fields, files) => {
      if (err) return reject(err);
      resolve({ fields, files });
    });
  });

  const fileInfo = Array.isArray(formData.files['file']) ? formData.files['file'][0] : formData.files['file'];

  const data = await fs.readFile(fileInfo.filepath);
  const version = findVersion(data);

  if (!version) {
    res.status(400).json({message: 'Cant find version in file'});
    return;
  }
  const existing = (await FirmwareMongo.getFirmwareVersions()).includes(version);
  if (existing) {
    res.status(400).json({message: 'Version has already been uploaded'});
    return;
  }

  await FirmwareMongo.putFirmware({
    description: Utils.fromMultiValue(formData.fields['description']) ?? '',
    version,
    file: data,
    uploaded: new Date().getTime(),
    creator: user.email,
  });

  res.json({ ok: true });
}