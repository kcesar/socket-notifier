'use client';

import { useEffect, useMemo, useState } from "react";

export default function Simulator() {
  const [ id, setId ] = useState<string>('');
  const [ led, setLed ] = useState<boolean>(false);
  const [ silent, setSilent ] = useState<boolean>(true);
  const [ toning, setToning ] = useState<number>(0);
  const [ connected, setConnected ] = useState<boolean>(false);

  const client = useMemo(() => new SocketClient({
    doLed: setLed,
    doTone: setToning,
    doConnected: setConnected
  }), []);
  useEffect(() => { document.title = 'Simulator' }, []);

  function connect() {
    if (!id) {
      alert('id not set');
      return;
    }
    client.start(id);
  }

  function disconnect() {
    client.stop();
  }

  function handleClick() {
    setLed(false);
    client.click();
  }

  function handleSilent(newSilent: boolean) {
    setSilent(newSilent);
  }

  return (
    <div>
      <div>Id: <input type="text" value={id} onChange={evt => setId(evt.target.value)}/></div>
      <div>
        <button onClick={() => connect()} disabled={!id || connected}>Connect</button>
        <button onClick={() => disconnect()} disabled={!connected}>Disonnect</button>
      </div>
      <div>
        Silent tone: <input type="checkbox" checked={silent} onChange={evt => handleSilent(evt.target.checked)} />
      </div>
      <div style={{marginTop:'2rem'}}>{connected ? 'Connected' : 'Disconnected'}</div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div style={{width:50, height:50, borderRadius:'50%', backgroundColor: led ? '#f00' : '#400', margin: 15, flex: '0 0 auto' }} />
        <button onClick={() => handleClick()}>Silence</button>
        <div style={{width:50, height:50, borderRadius:'50%', backgroundColor: toning ? '#00f' : '#004', margin: 15, flex: '0 0 auto' }} />
      </div>
    </div>
  )
}

interface SocketClientOptions {
  doLed?: (led: boolean) => void;
  doTone?: (frequency: number) => void;
  doConnected?: (connected: boolean) => void;
}

class SocketClient {
  s?: WebSocket;
  id: string = 'not-set';
  options: SocketClientOptions;
  enabled: boolean = false;

  constructor(options: SocketClientOptions) {
    this.options = options;
  }

  start(id: string) {
    this.id = id;
    this.enabled = true;
    this.connect();
  }

  async connect() {
    try {
      await fetch('/api/socket-keepalive');

      const s = new WebSocket(`${window.location.origin.replace('http', 'ws')}/ws`);
      s.addEventListener('open', evt => {
        console.log('opened socket');
        s.send(`HELLO ${this.id}`);
      })
      s.addEventListener('message', evt => {
        this.handleMessage(evt.data);
      });
      s.addEventListener('close', evt => {
        this.lostConnection('connection closed');
      });
      s.addEventListener('error', evt => {
        console.log('socket error', evt);
      });
      this.s = s;
    } catch (err: unknown) {
      this.lostConnection('failed to connect');
    }
  }

  private lostConnection(reason: string) {
    console.log(reason);
    this.s = undefined;
    this.options.doConnected?.(false);
    if (this.enabled) {
      setTimeout(() => this.connect(), 3000);
    }
  }

  handleMessage(message: string) {
    console.log('handling message', message);
    const parts = message.split(' ');
    switch (parts[0]) {
      case 'WELCOME':
        this.options.doConnected?.(true);
        break;

      case 'LED':
        if (parts[1] === '1') {
          this.options.doLed?.(parts[2] === 'ON');
        }
        break;
    }
  }

  click() {
    console.log('button clicked', this.options, this.s);
    this.options.doLed?.(false);
    this.options.doTone?.(0);
    this.s?.send('BUTTON 1');
  }

  stop() {
    console.log('stopping by request');
    this.enabled = false;
    this.s?.close();
    this.s = undefined;
    this.options.doConnected?.(false);
  }
}