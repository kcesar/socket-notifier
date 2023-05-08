import { OAuth2Client } from 'google-auth-library';
import { GmailService } from './gmailService';

export interface Services {
  authClient: OAuth2Client;
  gmailService: GmailService;
}

let instance: Services;

export async function getServices(): Promise<Services> {
  if (!instance) {
    
    instance = {
      authClient: new OAuth2Client(process.env.GOOGLE_ID),
      gmailService: GmailService.create(),
    };
  }
  return instance;
}