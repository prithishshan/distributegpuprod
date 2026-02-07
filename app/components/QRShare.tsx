"use client";

type QRShareProps = {
  url: string;
};

export default function QRShare({ url }: QRShareProps) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-200">
      <h2 className="text-base font-semibold text-white">Crowd Share</h2>
      <p className="mt-2 text-zinc-300">Join the render from any device:</p>
      <code className="mt-3 block rounded-lg bg-black/70 p-2 text-xs text-cyan-200">
        {url}
      </code>
      <div className="mt-3 flex h-32 items-center justify-center rounded-xl border border-dashed border-zinc-700 text-xs text-zinc-500">
        QR code placeholder (drop in a QR generator)
      </div>
    </div>
  );
}
