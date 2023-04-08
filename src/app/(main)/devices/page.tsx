'use client';

import { useEffect, useState } from 'react';
import { ConnectedDevice } from '@/lib/api/deviceStatus';
import { RelativeTimeText } from '@/app/components/RelativeTimeText';
import { useAppSelector } from '@/lib/client/store';

import styles from './page.module.css';

export default function ListDevicesPage() {
  const isAdmin = useAppSelector(state => state.auth.userInfo?.isAdmin ?? false);
  const [ list, setList ] = useState<ConnectedDevice[]>([]);
  const [ all, setAll ] = useState<boolean>(false);
  const [ now, setNow ] = useState<number>(new Date().getTime());

  async function refresh() {
    const response = await fetch(`/api/devices${all ? '?all=true' : ''}`);
    const result = await response.json() as { devices: ConnectedDevice[] };
    setList(result.devices);
  }

  useEffect(() => {
    const timer = setInterval(() => refresh(), 10000);
    const clock = setInterval(() => setNow(new Date().getTime()), 1000);
    refresh();
    return () => {
      clearInterval(timer);
      clearInterval(clock);
    }
  }, [all]);

  function startTest(callsign: string) {
    if (!confirm(`Send test to ${callsign}? The device will make sounds.`)) {
      return;
    }

    fetch(`/api/devices/${callsign}/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  }

  const adminTools = isAdmin ? (<>
    All: <input type="checkbox" checked={all} onChange={evt => setAll(evt.target.checked)} />
  </>) : undefined;

  return (
    <div style={{padding:10}}>
      <div>Current Devices: {adminTools}</div>
      {list.length == 0 ? <div>No connected devices</div> : (
      <table className={styles.deviceList}>
        <thead>
          <tr>
            {all && <th>Owner</th>}
            <th>Call Sign</th>
            <th>Name</th>
            <th>Connection ID</th>
            <th>Since</th>
            {isAdmin && <th>IP Address</th>}
            <th></th>
          </tr>
        </thead>
        <tbody>
          {list.map(d => (
            <tr key={d.callsign}>
              {all && <td><a href={`mailto:${d.email}`}>{d.email}</a></td>}
              <td><strong>{d.callsign}</strong></td>
              <td>{d.name}</td>
              <td><div className={`${styles.led} ${styles[`led-${d.status ? 'on' : 'off'}`]}`}></div> {d.status?.id.substring(0, 8)}</td>
              <td>{d.status && <RelativeTimeText time={d.status.since} baseTime={now} showSeconds />}</td>
              {isAdmin && <td>{d.status?.remoteAddr?.split(':').slice(-1)}</td>}
              <td>
                <button disabled={!d.status} onClick={() => startTest(d.callsign)}>TEST</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </div>
  )
}