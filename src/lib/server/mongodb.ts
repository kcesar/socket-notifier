// SEE https://github.com/vercel/next.js/tree/canary/examples/with-mongodb
import { MongoClient } from 'mongodb';
import { DEVICE_COLLECTION, DeviceDoc } from './data/deviceDoc';
import { SETTINGS_COLLECTION, SettingsDoc } from './data/settingsDoc';

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

export async function getAllDevices() {
  const client = await clientPromise;
  const devices = await client.db().collection<DeviceDoc>(DEVICE_COLLECTION).find().sort({'email': 1, 'name': 1}).toArray();
  return devices;
}

export async function getDevice(callsign: string) {
  const client = await clientPromise;
  const device = await client.db().collection<DeviceDoc>(DEVICE_COLLECTION).findOne({ callsign });
  return device;
}