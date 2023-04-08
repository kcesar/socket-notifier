'use client';

import { useEffect, useState } from 'react';


import { DeviceStatus } from '@/lib/api/deviceStatus';
import { RelativeTimeText } from '@/app/components/RelativeTimeText';
import { clearInterval } from 'timers';


export default function DevicesAdmin() {
  const [ list, setList ] = useState<DeviceStatus[]>([]);
  const [ now, setNow ] = useState<number>(new Date().getTime());

  async function refresh() {
    const response = await fetch('/api/devices/connected');
    const result = await response.json() as { list: DeviceStatus[] };
    setList(result.list);
  }

  useEffect(() => {
    const timer = setInterval(() => refresh(), 10000);
    const clock = setInterval(() => setNow(new Date().getTime()), 1000);
    refresh();
    return () => {
      clearInterval(timer);
      clearInterval(clock);
    }
  }, []);

  function startTest(callsign: string) {
    if (!confirm(`Send test to ${callsign}? The device will make sounds.`)) {
      return;
    }

    fetch('/api/device-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({callsign})
    })
  }

  return (
    <div style={{padding:10}}>
      <div>Current Devices:</div>
      {list.length == 0 ? <div>No connected devices</div> : (
      <table>
        <thead>
          <tr>
            <th>Call Sign</th>
            <th>Connection ID</th>
            <th>Since</th>
            <th>IP Address</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {list.map(d => (
            <tr key={d.id}>
              <td>{d.callsign}</td>
              <td>{d.id}</td>
              <td><RelativeTimeText time={d.since} baseTime={now} showSeconds /></td>
              <td>{d.remoteAddr?.split(':').slice(-1)}</td>
              <td>
                <button onClick={() => startTest(d.callsign)}>TEST</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      )}
    </div>
  )
}