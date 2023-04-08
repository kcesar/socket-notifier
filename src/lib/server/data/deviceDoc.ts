export const DEVICE_COLLECTION = "devices";

export interface DeviceChannelSubscription {
  id: string;
  latch?: boolean;
}

export interface DeviceDoc {
  callsign: string;
  name: string;
  email: string;
  channels: DeviceChannelSubscription[];
}