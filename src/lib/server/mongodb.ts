// SEE https://github.com/vercel/next.js/tree/canary/examples/with-mongodb
import { MongoClient } from 'mongodb';
import { DEVICE_COLLECTION, DeviceDoc } from './data/deviceDoc';
import { SETTINGS_COLLECTION, SettingsDoc } from './data/settingsDoc';
import { FIRMWARE_COLLECTION, FirmwareDoc } from './data/firmwareDoc';
import ClientBody from '@/app/(main)/ClientBody';

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const uri = process.env.MONGODB_URI;
const options = {};

let client;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    console.log('Building mongo client', uri);
    console.log('USING URI ', uri);
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise;

interface MongoDoc {
  _id?: unknown;
}

interface StandardOptions {
  stripIds?: boolean
}


let settings: SettingsDoc|undefined;
export async function getSetting(key: keyof SettingsDoc) {
  if (!settings) {
    const client = await clientPromise;
    const doc = await client.db().collection<SettingsDoc>(SETTINGS_COLLECTION).findOne();
    if (!doc) throw new Error('settings document has not been created in store');
    settings = doc;
  }
  return settings[key];
}

export async function getAllDevices(opts?: StandardOptions) {
  const client = await clientPromise;
  const devices = await client.db().collection<DeviceDoc>(DEVICE_COLLECTION).find().sort({'email': 1, 'name': 1}).toArray();
  if (opts?.stripIds ?? false) {
    devices.forEach(d => delete (d as MongoDoc)._id);
  }
  return devices;
}

export async function getDevice(callsign: string, opts?: StandardOptions) {
  const client = await clientPromise;
  const device = await client.db().collection<DeviceDoc>(DEVICE_COLLECTION).findOne({ callsign });
  if (opts?.stripIds ?? false) {
    delete (device as MongoDoc)._id;
  }
  return device;
}

export async function deviceCheckin(callsign: string, version: string, time: number): Promise<DeviceDoc|null> {
  const client = await clientPromise;
  const update = { $set: { reportedVersion: version, lastConnected: time }};
  await client.db().collection<DeviceDoc>(DEVICE_COLLECTION).updateOne({callsign}, update);
  return await getDevice(callsign);
}

export async function deviceInteraction(callsign: string, time: number) {
  const client = await clientPromise;
  const update = { $set: { lastInteraction: time }};
  await client.db().collection<DeviceDoc>(DEVICE_COLLECTION).updateOne({callsign}, update);
}

export const DeviceMongo = {
  getAllDevices,
  getDevice,
  deviceCheckin,
  deviceInteraction,
}

export async function getFirmwareVersions(): Promise<string[]> {
  const client = await clientPromise;
  const versions = await client.db().collection<FirmwareDoc>(FIRMWARE_COLLECTION).find().project<{version: string}>({ version: 1 }).toArray();
  return versions.map(v => v.version);
}

export async function putFirmware(firmware: FirmwareDoc) {
  const client = await clientPromise;
  await client.db().collection<FirmwareDoc>(FIRMWARE_COLLECTION).replaceOne({ version: firmware.version }, firmware, { upsert: true });
}

export async function getFirmwareBinary(version: string): Promise<Buffer|undefined> {
  const client = await clientPromise;
  const document = await client.db().collection<FirmwareDoc>(FIRMWARE_COLLECTION).findOne({version});
  return document ? document.file : undefined;
}

export const FirmwareMongo = {
  getFirmwareVersions,
  putFirmware,
  getFirmwareBinary,
}