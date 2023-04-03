'use client';

import { notFound } from 'next/navigation';

export default function ViewDevice({ params }: { params: { callsign: string }}) {

  if (params.callsign === 'missing') {
    notFound();
  }

  function startTest() {
    fetch('/api/device-test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({callsign: params.callsign})
    })
  }

  return (
    <div style={{padding:10}}>
      <div>hi there</div>
      <button onClick={() => startTest()}>DO TEST</button>
    </div>
  )
}