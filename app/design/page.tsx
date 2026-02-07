"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, useEffect } from "react";
import TaskPreview from "../components/TaskPreview";
import QRCode from "react-qr-code";

const MosaicUpload = dynamic(() => import("../components/MosaicUpload"), {
  ssr: false,
});

export default function DesignPage() {
  const [taskId, setTaskId] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const taskUrl = taskId && origin ? `${origin}/job?taskId=${taskId}` : "";

  return (
    <main className="min-h-screen design-page-wrap">
      <div className="mosaic-back-link">
        <Link href="/">← Back</Link>
      </div>

      <div className="max-w-6xl mx-auto px-4 mb-8 pt-4">
        <div className="flex gap-4 items-center glass-panel p-6">
          <span className="font-bold text-lg">View Existing Task:</span>
          <input
            type="text"
            placeholder="Enter Task ID"
            className="mosaic-input flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const val = (e.target as HTMLInputElement).value.trim();
                if (val) setTaskId(val);
              }
            }}
          />
          <button
            className="job-start-btn"
            onClick={(e) => {
              const input = e.currentTarget.previousElementSibling as HTMLInputElement;
              const val = input.value.trim();
              if (val) setTaskId(val);
            }}
          >
            Load
          </button>
        </div>
      </div>

      <MosaicUpload onTaskCreated={setTaskId} />

      {taskId && (
        <div className="mt-8 max-w-6xl mx-auto px-4 space-y-8">
          <div className="p-6 glass-panel">
            <h2 className="text-xl font-bold mb-6" style={{ color: 'var(--mosaic-text)' }}>Share Task</h2>
            <div className="flex flex-col md:flex-row gap-8 items-center">
              <div className="bg-white p-4 rounded-xl border border-[var(--mosaic-border)] shadow-sm">
                <QRCode value={taskUrl} size={150} />
              </div>
              <div className="flex-1 space-y-6">
                <div>
                  <label className="text-sm block mb-2 font-medium" style={{ color: 'var(--mosaic-muted)' }}>Task URL</label>
                  <div className="flex gap-3">
                    <input
                      readOnly
                      value={taskUrl}
                      className="mosaic-input flex-1 font-mono text-sm !py-2.5"
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(taskUrl)}
                      className="bg-[#0071e3] hover:bg-[#0077ed] text-white px-5 py-2 rounded-full font-medium transition-all shadow-sm hover:shadow-md"
                    >
                      Copy
                    </button>
                  </div>
                </div>
                <div>
                  <Link
                    href={`/job?taskId=${taskId}`}
                    target="_blank"
                    className="inline-block bg-[#0071e3] hover:bg-[#0077ed] text-white px-6 py-2.5 rounded-full font-medium transition-all shadow-sm hover:shadow-md hover:-translate-y-0.5"
                  >
                    Open Worker Node →
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <TaskPreview taskId={taskId} />
        </div>
      )}
    </main>
  );
}
