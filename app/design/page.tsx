"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";
import TaskPreview from "../components/TaskPreview";

const MosaicUpload = dynamic(() => import("../components/MosaicUpload"), {
  ssr: false,
});

export default function DesignPage() {
  const [taskId, setTaskId] = useState<string | null>(null);

  return (
    <main className="min-h-screen design-page-wrap">
      <div className="mosaic-back-link">
        <Link href="/">← Back</Link>
      </div>

      <div className="max-w-6xl mx-auto px-4 mb-8 pt-4">
        <div className="flex gap-4 items-center bg-gray-900 p-4 rounded-lg border border-gray-700">
          <span className="text-white font-bold">View Existing Task:</span>
          <input
            type="text"
            placeholder="Enter Task ID"
            className="bg-black text-white px-3 py-2 rounded border border-gray-600 flex-1"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const val = (e.target as HTMLInputElement).value.trim();
                if (val) setTaskId(val);
              }
            }}
          />
          <button
            className="bg-blue-600 px-4 py-2 rounded text-white hover:bg-blue-500"
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
        <div className="mt-8 max-w-6xl mx-auto px-4">
          <TaskPreview taskId={taskId} />
        </div>
      )}
    </main>
  );
}
