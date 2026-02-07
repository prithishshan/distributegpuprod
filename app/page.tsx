"use client";

import dynamic from "next/dynamic";

const MosaicUpload = dynamic(() => import("./components/MosaicUpload"), {
  ssr: false,
});

export default function Home() {
  return (
    <main className="min-h-screen">
      <MosaicUpload />
    </main>
  );
}
