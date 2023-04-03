'use client';

import ClientOnly from "../components/ClientOnly";
import ClientBody from "./ClientBody";

export default function Simulator() {
  return (
    <ClientOnly>
      <ClientBody />
    </ClientOnly>
  );
}