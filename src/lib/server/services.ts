import { OAuth2Client } from 'google-auth-library';

export interface Services {
  authClient: OAuth2Client;
}

let instance: Services;

export async function getServices(): Promise<Services> {
  if (!instance) {
    
    instance = {
      authClient: new OAuth2Client(process.env.GOOGLE_ID),
    };
  }
  return instance;
}