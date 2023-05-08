import { WebSocket } from 'ws';
import { v4 as uuid } from 'uuid';
import { DeviceMongo, ChannelsMongo } from './mongodb';
import { getServices } from './services';
import { ChannelDoc } from './data/channelDoc';

export class SocketConnection {
  private ws: WebSocket;
  readonly id = uuid();
  callsign: string = '';
  readonly since: number = new Date().getTime();
  readonly addr?: string;
  private isAlive: boolean = true;

  channels: ChannelDoc[] = [];
  
  handshakeTimeout?: NodeJS.Timeout;

  constructor(ws: WebSocket, remoteAddr?: string, onClose?: (id: string) => void) {
    this.ws = ws;
    this.addr = remoteAddr;
    ws.on('error', err => console.log('error:', err));
    ws.on('message', (data) => this.handleMessage(String(data)));
    ws.on('close', () => onClose?.(this.id));
    ws.on('pong', () => this.isAlive = true);
  }

  private async handleMessage(data: string) {
    const parts = data.split(' ');
    switch (parts[0]) {
      case 'HELLO':
        this.callsign = parts[1];
        await this.onHello(parts[2]);
        break;

      case 'BUTTON':
        await DeviceMongo.deviceInteraction(this.callsign, new Date().getTime());
        console.log(this.id, 'clicked button');
        break;
    }
  }

  /**
   * 
   * @param firmware partition hash of the device's firmware
   * @returns void
   */
  private async onHello(firmware: string) {
    const device = await DeviceMongo.deviceCheckin(this.callsign, firmware, new Date().getTime());
    if (!device) {
      this.ws.send('ERROR device not known');
      this.ws.close();
      return;
    }

    if (device.expectedVersion && (device.expectedVersion !== 'ignore') && (device.expectedVersion !== firmware)) {
      console.log(this.id, `${this.callsign} on firmware ${firmware} should be on ${device.expectedVersion}`);
      this.ws.send(`OTA ${device.expectedVersion}`);
      this.ws.close();
      return;
    }

    const gmail = (await getServices()).gmailService;
    for (const deviceChannel of device.channels) {
      const channel = await ChannelsMongo.getChannel(deviceChannel.id);
      if (channel) {
        this.channels.push(channel);
        await gmail.refreshInterest(channel.email);
      } else {
        console.log(`Could not find channel ${deviceChannel.id} for device ${this.callsign}`);
      }
    }

    console.log(this.id, `Handshake complete for ${this.callsign}`);
    this.ws.send('WELCOME ' + this.id);
  }

  run() {
    this.handshakeTimeout = setTimeout(() => {
      if (!this.callsign && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send('ERROR No handshake');
        this.ws.close();
      }
    }, 5000);
  }

  close() {
    if (this.handshakeTimeout) {
      clearTimeout(this.handshakeTimeout);
      this.handshakeTimeout = undefined;
    }
    this.ws.close();
  }

  ping() {
    if (!this.isAlive) {
      this.close();
      this.ws.terminate();
    }

    this.isAlive = false;
    this.ws.ping();
  }

  private sendLed(idx: number, on: boolean, timeMs?: number) {
    // LED 1 ON 2000
    this.ws.send(`LED ${idx} ${on ? 'ON' : 'OFF'}${timeMs ?? 0 > 0 ? ' ' + timeMs : ''}`);
  }

  sendCommand(cmd: string) {
    this.ws.send(cmd);
  }

  sendTest() {
    console.log(this.id, 'Running test');
    //this.ws.send('BEEP 1 3 262 200 294 200 330 200 349 200 392 200 440 200 494 200 523 400 0 400');
    this.sendCommand('BEEP 0 3 1000 500 0 100 1000 500 0 100 1000 750 0 500');
    this.sendCommand('LED 1 10 FF0000 1000 00FF00 1000 0000FF 1000')
  }
}
