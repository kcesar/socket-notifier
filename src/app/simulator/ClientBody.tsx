'use client';

import { useEffect, useMemo, useState } from "react";
import { v4 as uuid } from 'uuid';

import styles from './simulator.module.css';

export default function ClientBody() {
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
  useEffect(() => {
     document.title = 'Simulator';
     (window as any).testSong = (message: string) => client.handleMessage(message);
  }, [client]);

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
    client.mute(newSilent);
    setSilent(newSilent);
  }

  return (
    <div>
      <div>Id: <input type="text" value={id} onChange={evt => setId(evt.target.value)}/></div>
      <div>
        <button onClick={() => connect()} disabled={!id || connected}>Connect</button>
        <button onClick={() => disconnect()} disabled={!connected}>Disconnect</button>
      </div>
      <div>
        Silent tone: <input type="checkbox" checked={silent} onChange={evt => handleSilent(evt.target.checked)} />
      </div>
      <div style={{marginTop:'2rem'}}>{connected ? 'Connected' : 'Disconnected'}</div>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <div className={styles.dot} style={{backgroundColor: led ? '#f00' : '#400'}} />
        <button onClick={() => handleClick()}>Silence</button>
        <div className={styles.dot} style={{backgroundColor: toning ? '#00f' : '#004'}}>{toning > 0 ? toning : ''}</div>
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
  private s?: WebSocket;
  private id: string = 'not-set';
  private readonly options: SocketClientOptions;
  private enabled: boolean = false;
  private ledTimerNonce?: string;
  private speakerRepeat: number = 0;
  private speakerCursor: number = 0;
  private speakerSong: number[] = [];
  private speakerTimer?: ReturnType<typeof setTimeout>;
  private muted: boolean = true;
  private readonly audio?: AudioContext;
  private oscillator?: any = undefined;

  constructor(options: SocketClientOptions) {
    this.options = options;
    const AudioCtor = (window.AudioContext || (window as any).webkitAudioContext);
    this.audio = AudioCtor ? new AudioCtor() : undefined;
  }

  start(id: string) {
    this.id = id;
    this.enabled = true;
    this.connect();
  }

  async connect() {
    try {
      await fetch('/api/keepalive');

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
      case 'ERROR':
        alert(message);
        this.enabled = false;
        break;

      case 'WELCOME':
        this.options.doConnected?.(true);
        break;

      case 'LED':
        if (parts[1] === '1') {
          this.options.doLed?.(parts[2] === 'ON');
          this.ledTimerNonce = undefined;

          const time = Number(parts[3] ?? 0);
          if (time > 0 && parts[2] === 'ON') {
            console.log(`flashing led for ${time}ms`);
            const nonce = uuid();
            this.ledTimerNonce = nonce;
            setTimeout(() => {
              if (this.ledTimerNonce !== nonce) return;
              this.options.doLed?.(false);
            }, time);
          }
        }
        break;

      case 'BEEP':
        if (parts[1] === '1') {
          this.speakerCursor = 0;
          this.speakerRepeat = Number(parts[2]);
          this.speakerSong = parts.slice(3).map(f => Number(f));
          this.playSong();
        }
        break;
    }
  }

  click() {
    console.log('button clicked');
    this.options.doLed?.(false);
    this.resetSpeaker();
    this.s?.send('BUTTON 1');
  }

  mute(value: boolean) {
    this.muted = value;
    if (this.muted) {
      this.stopNote();
    }
  }

  private playSong() {
    if (this.speakerCursor >= this.speakerSong.length) {
      if (this.speakerRepeat > 0) this.speakerRepeat--;
      if (this.speakerRepeat === 0) {
        return;
      }
      this.speakerCursor = 0;
    }

    this.startNote(this.speakerSong[this.speakerCursor]);
    this.speakerTimer = setTimeout(() => this.playSong(), this.speakerSong[this.speakerCursor + 1]);
    this.speakerCursor += 2;
  }



  private startNote(tone: number) {
    if (!this.muted) {
      if (tone <= 0) {
        this.oscillator?.stop();
        this.oscillator = undefined;
      } else {
        const isNew = !this.oscillator;
        this.oscillator = this.oscillator ?? this.audio?.createOscillator();
        if (!this.oscillator) return;
        this.oscillator.type = 'square';
        this.oscillator.frequency.value = tone;
        if (isNew) {
          this.oscillator.connect(this.audio?.destination);
          this.oscillator.start();
        }
      }
    }
    this.options.doTone?.(tone);
  }

  private stopNote() {
    this.oscillator?.stop();
    this.oscillator = undefined;
    this.options.doTone?.(0);
  }

  private resetSpeaker() {
    if (this.speakerTimer) {
      clearTimeout(this.speakerTimer);
      this.speakerTimer = undefined;
    }
    this.stopNote();
    this.speakerRepeat = 0;
    this.speakerCursor = 0;
    this.speakerSong = [];
  }

  stop() {
    console.log('stopping by request');
    this.enabled = false;
    this.s?.close();
    this.s = undefined;
    this.options.doConnected?.(false);
  }
}