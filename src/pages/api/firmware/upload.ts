import { getAuthFromApiCookies } from '@/lib/server/auth';
import { FirmwareMongo } from '@/lib/server/mongodb';
import { IncomingForm, Fields, Files } from 'formidable';
import { promises as fs } from 'fs';
import { NextApiRequest, NextApiResponse } from 'next';

export const config = {
  api: {
    bodyParser: false,
  }
}

const VERSION_MAGIC = "curgycid";

function findVersion(data: Buffer) {
  let len = 0;
  for (let i=0; i<data.length; i++) {
    if (data[i] === VERSION_MAGIC.charCodeAt(len)) {
      len++;
      if (len == VERSION_MAGIC.length) {
        for (let end=i; end<data.length; end++) {
          if (data[end] === 0) {
            const versionText = data.toString('utf-8', i + 1, end);
            console.log('found version string', versionText);
            return versionText;
          }
        }
      }
    } else {
      len = 0;
    }
  }
  return undefined;
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
    version,
    file: data,
    uploaded: new Date().getTime(),
    creator: user.email,
  });

  res.json({ ok: true });
}