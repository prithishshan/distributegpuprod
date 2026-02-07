"use client";

import Link from "next/link";
import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { WorkerRenderer } from "@/app/components/WorkerRenderer";
import { Scene } from "@/shaders/Scene";

// if (typeof Float16Array === 'undefined') {
//   (globalThis as any).Float16Array = Uint16Array;
// }

function JobPageContent() {
  const searchParams = useSearchParams();
  const [taskId, setTaskId] = useState("");
  const [status, setStatus] = useState("idle");
  const [logs, setLogs] = useState<string[]>([]);
  const rendererRef = useRef<WorkerRenderer | null>(null);
  const workerId = useRef("worker-" + Math.random().toString(36).substr(2, 9));

  // Auto-start logic
  useEffect(() => {
    const urlTaskId = searchParams.get("taskId");
    if (urlTaskId) {
      setTaskId(urlTaskId);
      if (status === "idle") {
        // We pass the URL task ID explicitly because state updates are async
        startWorker(urlTaskId);
      }
    }
  }, [searchParams]);

  const addLog = (msg: string) => setLogs((prev) => [msg, ...prev].slice(0, 50));

  const startWorker = async (explicitTaskId?: string) => {
    const currentTaskId = explicitTaskId || taskId;
    if (!currentTaskId) return alert("Please enter a Task ID");
    if (!navigator.gpu) return alert("WebGPU not supported");

    setStatus("initializing");
    addLog("Initializing WebGPU...");

    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) throw new Error("No GPU adapter");
      const device = await adapter.requestDevice();

      const renderer = new WorkerRenderer(device);
      rendererRef.current = renderer;

      setStatus("running");
      processNextJob(currentTaskId); // Pass task ID to ensure correct context

    } catch (e: any) {
      addLog("Error: " + e.message);
      setStatus("error");
    }
  };

  const processNextJob = async (currentTaskId: string) => {
    // Note: This check relies on the captured closure or strict state. 
    // Since we are in a functional component, 'status' here is from the render where processNextJob was defined.
    // However, since processNextJob is defined in the component body, it is recreated on every render.
    // The recursive calls need to be careful.
    // Actually, 'status' from state might be stale if we are in a long async loop? 
    // No, because we are not using a ref for status. 
    // Ideally we should use a Ref for status to stop loop reliably.
    // But let's keep existing logic structure but pass ID.
    // Wait, if "stopped" is set, the loop needs to see it.
    // The original code `if (status === "stopped")` works because `processNextJob` is recreated? 
    // No, if `processNextJob` calls `processNextJob`, it calls the *current* version or the *captured* version?
    // It calls `processNextJob` which is the function in the current scope.
    // But if we are in an async callback, the scope is the one when it was created.
    // So `status` will be stale.
    // The original code probably had this issue or `status` didn't change often.
    // Let's use a ref for status to be safe, like I did for workerId.

    // For now, I will use a ref for status check inside the loop to ensure robust stopping.
    if (statusRef.current === "stopped") return;

    try {
      addLog("Fetching next job...");
      const res = await fetch(`/api/jobs/next?taskId=${currentTaskId}`);
      if (res.status === 404) {
        addLog("No more jobs. Sleeping...");
        setTimeout(() => processNextJob(currentTaskId), 5000); // Poll
        return;
      }

      const data = await res.json();
      const job = data.job;

      if (!job) {
        setTimeout(() => processNextJob(currentTaskId), 2000);
        return;
      }

      // Claim the job
      addLog(`Claiming job ${job.id} (${job.x}, ${job.y})...`);
      const startRes = await fetch('/api/jobs/start', {
        method: 'POST',
        body: JSON.stringify({ jobId: job.id, workerId: workerId.current })
      });

      if (!startRes.ok) {
        addLog("Failed to claim job (locked). Retrying...");
        processNextJob(currentTaskId);
        return;
      }

      await processJob(rendererRef.current!, job, currentTaskId);

    } catch (e: any) {
      addLog("Error in loop: " + e.message);
      setTimeout(() => processNextJob(currentTaskId), 5000);
    }
  };

  const processJob = async (renderer: WorkerRenderer, job: any, currentTaskId: string) => {
    // Initialize scene if not loaded
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
      width: job.task_width,
      height: job.task_height,
      max_bounces: job.max_bounces
    };

    if (Scene.MODELS_COUNT === 0) {
      addLog(`Loading scene from ${task.scene_mesh_url}...`);
      await renderer.init(task.scene_mesh_url, task.scene_textures_url || task.scene_mesh_url.replace('.obj', '.mtl'));
    }

    addLog(`Rendering tile ${job.x},${job.y} (${job.width}x${job.height})...`);
    // Pass the task object which now has the correct params
    const pixelData = await renderer.renderTile(job, task, 50); 

    let nonZero = 0;
    for (let i = 0; i < pixelData.length; i += 4) {
      if (pixelData[i] > 0 || pixelData[i + 1] > 0 || pixelData[i + 2] > 0) nonZero++;
    }
    addLog(`Rendered. Non-black pixels: ${nonZero} / ${pixelData.length / 4}`);

    const binaryString = Array.from(pixelData).map(b => String.fromCharCode(b)).join('');
    const base64 = btoa(binaryString);

    addLog("Submitting results...");
    await fetch('/api/jobs/complete', {
      method: 'POST',
      body: JSON.stringify({ jobId: job.id, resultData: base64 })
    });

    addLog("Job complete!");
    processNextJob(currentTaskId);
  };

  // Status Ref to help with async loop
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);


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
            onClick={() => startWorker()}
            disabled={status === "running" || status === "initializing"}
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

export default function JobPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black text-white p-8">Loading...</div>}>
      <JobPageContent />
    </Suspense>
  );
}
