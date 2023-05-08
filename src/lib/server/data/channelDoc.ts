export const CHANNEL_COLLECTION = "channels";

export interface ChannelDoc {
  name: string;
  type: 'gmail';
  email: string;
  commands: string[];
}