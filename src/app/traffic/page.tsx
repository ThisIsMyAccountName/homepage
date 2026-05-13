"use client";

import dynamic from "next/dynamic";

const TrafficContent = dynamic(() => import("./TrafficContent"), { ssr: false });

export default function TrafficPage() {
  return <TrafficContent />;
}
