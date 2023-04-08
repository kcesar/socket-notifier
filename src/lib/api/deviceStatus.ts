import { DeviceDoc } from "@/lib/server/data/deviceDoc";

export interface DeviceStatus {
  id: string;
  callsign: string;
  since: number;
  remoteAddr?: string;
}

export interface ConnectedDevice extends DeviceDoc {
  status?: DeviceStatus;
}