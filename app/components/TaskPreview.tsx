"use client";

import { useEffect, useRef, useState } from "react";

interface Job {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    status: string;
    result_data?: string; // base64
}

interface TaskPreviewProps {
    taskId: string;
}

export default function TaskPreview({ taskId }: TaskPreviewProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
    const [taskDims, setTaskDims] = useState({ width: 0, height: 0 });

    // Poll for updates
    useEffect(() => {
        if (!taskId) return;

        let isMounted = true;
        const fetchJobs = async () => {
            try {
                const res = await fetch(`/api/jobs/all?taskId=${taskId}`);
                if (!res.ok) return;
                const data = await res.json();

                if (isMounted && data.jobs) {
                    setJobs(data.jobs);
                    setLastUpdated(new Date());

                    // Try to infer dimensions if not set (or we could fetch task details)
                    // For now, looking at the jobs can give us max bounds
                    if (data.jobs.length > 0) {
                        let maxX = 0;
                        let maxY = 0;
                        data.jobs.forEach((j: Job) => {
                            maxX = Math.max(maxX, j.x + j.width);
                            maxY = Math.max(maxY, j.y + j.height);
                        });
                        setTaskDims(prev => {
                            if (Math.abs(prev.width - maxX) > 1 || Math.abs(prev.height - maxY) > 1) {
                                return { width: maxX, height: maxY };
                            }
                            return prev;
                        });
                    }
                }
            } catch (err) {
                console.error("Poll error", err);
            }
        };

        fetchJobs(); // Initial
        const interval = setInterval(fetchJobs, 3000);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [taskId]);

    // Render to Canvas
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || taskDims.width === 0) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Clear only if needed, but we mostly overdraw
        // ctx.clearRect(0, 0, canvas.width, canvas.height);

        jobs.forEach(job => {
            if (job.status === "completed" && job.result_data) {
                try {
                    // Decode Base64 to binary string
                    const binaryString = atob(job.result_data);
                    const len = binaryString.length;
                    const bytes = new Uint8Array(len);
                    for (let i = 0; i < len; i++) {
                        bytes[i] = binaryString.charCodeAt(i);
                    }

                    // Create ImageData
                    // Assuming RGBA (4 channels)
                    // If the buffer size doesn't match width*height*4, we might have an issue
                    // But let's try.
                    const expectedSize = job.width * job.height * 4;
                    if (bytes.length !== expectedSize) {
                        console.warn(`Job ${job.id} data mismatch. Expected ${expectedSize}, got ${bytes.length}`);
                        return;
                    }

                    const imageData = new ImageData(new Uint8ClampedArray(bytes.buffer), job.width, job.height);
                    ctx.putImageData(imageData, job.x, job.y);

                    // Draw a border for debugging? No, let's keep it clean.
                } catch (e) {
                    console.error("Error drawing job", job.id, e);
                }
            } else if (job.status === "started") {
                // Draw a yellow box or something to show it's working?
                ctx.fillStyle = "rgba(255, 255, 0, 0.1)";
                ctx.fillRect(job.x, job.y, job.width, job.height);
            }
        });

    }, [jobs, taskDims]);

    const handleDownload = () => {
        if (!canvasRef.current) return;
        try {
            const link = document.createElement('a');
            link.download = `render-${taskId}-${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
            link.href = canvasRef.current.toDataURL("image/png");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (e) {
            console.error("Download failed", e);
        }
    };

    if (!taskId) return null;

    return (
        <div className="task-preview mt-8 p-6 glass-panel">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-bold" style={{ color: 'var(--mosaic-text)' }}>Live Render Preview</h3>
                <div className="flex items-center gap-3">
                    <span className="text-sm" style={{ color: 'var(--mosaic-muted)' }}>Last updated: {lastUpdated.toLocaleTimeString()}</span>
                    <button
                        onClick={handleDownload}
                        className="bg-[#0071e3] hover:bg-[#0077ed] text-white px-4 py-1.5 rounded-full text-sm font-medium transition-all shadow-sm hover:shadow-md"
                        title="Download Render"
                    >
                        Download
                    </button>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[var(--mosaic-border)] flex justify-center bg-black/5">
                {taskDims.width > 0 ? (
                    <canvas
                        ref={canvasRef}
                        width={taskDims.width}
                        height={taskDims.height}
                        className="max-w-full h-auto"
                        style={{ imageRendering: 'pixelated' }}
                    />
                ) : (
                    <div className="p-12 text-[var(--mosaic-muted)]">Waiting for job data...</div>
                )}
            </div>
            <div className="mt-3 text-sm text-[var(--mosaic-muted)] text-center">
                Completed: {jobs.filter(j => j.status === 'completed').length} / {jobs.length} tiles
            </div>
        </div>
    );

}
