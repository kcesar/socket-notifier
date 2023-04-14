export const FIRMWARE_COLLECTION = "firmwares";

export interface FirmwareDoc {
  description: string;
  version: string;
  uploaded: number;
  creator: string;
  file: Buffer;
  archived?: boolean;
}