"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { WorkerRenderer } from "@/app/components/WorkerRenderer";
import { Scene } from "@/shaders/Scene";

export default function JobPage() {
  const [taskId, setTaskId] = useState("");
  const [status, setStatus] = useState("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const rendererRef = useRef<WorkerRenderer | null>(null);
  const workerId = useRef("worker-" + Math.random().toString(36).substr(2, 9));

  const addLog = (msg: string) => setLogs((prev) => [msg, ...prev].slice(0, 50));

  const startWorker = async () => {
    if (!taskId) return alert("Please enter a Task ID");
    if (!navigator.gpu) return alert("WebGPU not supported");

    setStatus("initializing");
    addLog("Initializing WebGPU...");

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error("No GPU adapter");
      const device = await adapter.requestDevice();

      const renderer = new WorkerRenderer(device);
      rendererRef.current = renderer;

      // 1. Fetch Task Info (to get Scene URLs)
      // Since we don't have a specific endpoint for task details, we might need to assume 
      // the first job we pull gives us some context, or we create a GET /api/tasks/[id] endpoint.
      // BUT, the user said "queries the api/jobs/next endpoint... then set camera params".
      // The `next` job endpoint returns the job, but we need the Scene URL from somewhere.
      // Wait, the API `GET /api/jobs/next` returns a `job`.
      // Does it return the task details?
      // I only selected columns from `jobs`.
      // I should update `GET /api/jobs/next` to JOIN with tasks or return task params.
      // OR, fetches task details separately?

      // Let's assume for now we need to fetch task info. 
      // I'll assume the user might have task info or I can fetch it.
      // Let's UPDATE the `GET /api/jobs/next` to include task details (scene URL, cam params) in the response!
      // This is efficient.

      // For now, let's just implement the loop and expect `job` to contain what we need
      // or fetch it once.

      // Since I can't easily change the API in this step without a tool call, 
      // I will assume I can fetch the task info from `/api/tasks?id=...` if it existed,
      // or better, I will MODIFY the `GET /api/jobs/next` endpoint in the NEXT Step to return task info.

      // BUT user asked me to do it "Make it so app/jobs/page.tsx queries api/jobs/next...".
      // I'll write the code to expect `job.task` or similar.

      setStatus("running");
      processNextJob();

    } catch (e: any) {
      addLog("Error: " + e.message);
      setStatus("error");
    }
  };

  const processNextJob = async () => {
    if (status === "stopped") return;

    try {
      addLog("Fetching next job...");
      const res = await fetch(`/api/jobs/next?taskId=${taskId}`);
      if (res.status === 404) {
        addLog("No more jobs. Sleeping...");
        setTimeout(processNextJob, 5000); // Poll
        return;
      }

      const data = await res.json();
      const job = data.job;

      if (!job) {
        setTimeout(processNextJob, 2000);
        return;
      }

      // Claim the job
      addLog(`Claiming job ${job.id} (${job.x}, ${job.y})...`);
      const startRes = await fetch('/api/jobs/start', {
        method: 'POST',
        body: JSON.stringify({ jobId: job.id, workerId: workerId.current })
      });

      if (!startRes.ok) {
        addLog("Failed to claim job.");
        setTimeout(processNextJob, 1000);
        return;
      }

      // We need Task Details to render! 
      // Currently `job` has `x, y, width, height`.
      // We need scene URLs and camera params.
      // I'll fetch them from a hypothetical `task` object attached to the job
      // OR I'll fetch `/api/jobs/next` which I should Update to include Task data.

      // I will assume `job` has the task data merged or available.
      // I'll implement `processJob(rendererRef.current!, job)`

      await processJob(rendererRef.current!, job);

    } catch (e: any) {
      addLog("Error in loop: " + e.message);
      setTimeout(processNextJob, 5000);
    }
  };

  const processJob = async (renderer: WorkerRenderer, job: any) => {
    // Initialize scene if not loaded
    // We need task info!
    // NOTE: I really need to update the API to return task info.
    // I will add a TODO here and handle it.

    // The API returns a flat object with task fields joined
    const task = {
      scene_mesh_url: job.scene_mesh_url,
      scene_bvh_url: job.scene_bvh_url,
      scene_textures_url: job.scene_textures_url,
      cam_position_x: job.cam_position_x,
      cam_position_y: job.cam_position_y,
      cam_position_z: job.cam_position_z,
      cam_target_x: job.cam_target_x,
      cam_target_y: job.cam_target_y,
      cam_target_z: job.cam_target_z,
      fov: job.fov,
      width: job.task_width, // Note: Aliased in query
      height: job.task_height, // Note: Aliased in query
      max_bounces: job.max_bounces
    };

    if (Scene.MODELS_COUNT) {
      addLog(`Loading scene from ${task.scene_mesh_url}...`);
      // We might want to use the passed URLs directly if they are usually presigned or public
      // But here we are passing them to init
      await renderer.init(task.scene_mesh_url, task.scene_textures_url || task.scene_mesh_url.replace('.obj', '.mtl'));
    }

    addLog(`Rendering tile ${job.x},${job.y} (${job.width}x${job.height})...`);
    // Pass the task object which now has the correct params
    const pixelData = await renderer.renderTile(job, task, 10); // 10 samples

    // Debug: Check if we have any non-zero pixels
    let nonZero = 0;
    for (let i = 0; i < pixelData.length; i += 4) {
      if (pixelData[i] > 0 || pixelData[i + 1] > 0 || pixelData[i + 2] > 0) nonZero++;
    }
    addLog(`Rendered. Non-black pixels: ${nonZero} / ${pixelData.length / 4}`);

    // Convert to Base64
    // Use Buffer if available or manual conversion
    const binaryString = Array.from(pixelData).map(b => String.fromCharCode(b)).join('');
    const base64 = btoa(binaryString);

    addLog("Submitting results...");
    await fetch('/api/jobs/complete', {
      method: 'POST',
      body: JSON.stringify({ jobId: job.id, resultData: base64 })
    });

    addLog("Job complete!");
    processNextJob();
  };

  return (
    <main className="min-h-screen job-page p-8 text-white">
      <div className="mosaic-back-link mb-8">
        <Link href="/">← Back</Link>
      </div>
      <div className="job-content max-w-2xl mx-auto">
        <h1 className="job-title text-3xl font-bold mb-6">Worker Node</h1>

        <div className="flex gap-4 mb-6">
          <input
            type="text"
            placeholder="Task ID"
            className="bg-gray-800 p-2 rounded flex-1"
            value={taskId}
            onChange={e => setTaskId(e.target.value)}
          />
          <button
            onClick={startWorker}
            disabled={status === "running"}
            className={`px-6 py-2 rounded ${status === "running" ? "bg-green-600" : "bg-blue-600 hover:bg-blue-500"}`}
          >
            {status === "running" ? "Running..." : "Start Worker"}
          </button>
        </div>

        <div className="bg-black p-4 rounded h-96 overflow-y-auto font-mono text-sm border border-gray-800">
          {logs.map((log, i) => (
            <div key={i} className="mb-1">{log}</div>
          ))}
        </div>
      </div>
    </main>
  );
}
