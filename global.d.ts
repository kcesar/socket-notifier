import { GmailService } from '@/lib/server/gmailService';
import { MongoClient } from 'mongodb';

declare global {
  var _mongoClientPromise: Promise<MongoClient>;
  var _devGmailService: GmailService|undefined;
}