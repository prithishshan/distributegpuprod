"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import type { ChangeEvent } from "react";
import { useRouter } from "next/navigation";

const ModelViewer = dynamic(() => import("./ModelViewer"), { ssr: false });

interface MosaicUploadProps {
  onTaskCreated?: (taskId: string) => void;
}

export default function MosaicUpload({ onTaskCreated }: MosaicUploadProps) {
  const router = useRouter();
  const [objFile, setObjFile] = useState<File | null>(null);
  const [mtlFile, setMtlFile] = useState<File | null>(null);
  const [objUrl, setObjUrl] = useState<string | null>(null);
  const [mtlUrl, setMtlUrl] = useState<string | null>(null);
  const [gridBoxes, setGridBoxes] = useState(4); // 2–20, number of divisions per side
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState("");

  const handleObjChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (objUrl) URL.revokeObjectURL(objUrl);
    if (file) {
      setObjFile(file);
      setObjUrl(URL.createObjectURL(file));
    } else {
      setObjFile(null);
      setObjUrl(null);
    }
  }, [objUrl]);

  const handleMtlChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (mtlUrl) URL.revokeObjectURL(mtlUrl);
    if (file) {
      setMtlFile(file);
      setMtlUrl(URL.createObjectURL(file));
    } else {
      setMtlFile(null);
      setMtlUrl(null);
    }
  }, [mtlUrl]);

  const uploadFile = async (file: File) => {
    const res = await fetch('/api/upload-url', {
      method: 'POST',
      body: JSON.stringify({ filename: file.name, contentType: file.type || 'application/octet-stream' })
    });
    if (!res.ok) throw new Error('Failed to get upload URL');
    const { uploadUrl, fileUrl } = await res.json();

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type || 'application/octet-stream'
      }
    });

    if (!uploadRes.ok) {
      console.error("Upload failed", uploadRes.status, uploadRes.statusText);
      throw new Error(`Failed to upload file to S3: ${uploadRes.statusText}`);
    }
    return fileUrl;
  };

  const handleCreateTask = async () => {
    if (!objFile || !mtlFile) {
      alert("Please select both OBJ and MTL files.");
      return;
    }

    setIsUploading(true);
    setUploadStatus("Uploading files...");

    try {
      // 1. Upload OBJ
      const objS3Url = await uploadFile(objFile);

      // 2. Upload MTL
      const mtlS3Url = await uploadFile(mtlFile);

      setUploadStatus("Creating task...");

      // 3. Create Task
      const taskRes = await fetch('/api/create-task', {
        method: 'POST',
        body: JSON.stringify({
          scene_mesh_url: objS3Url,
          scene_textures_url: mtlS3Url, // Using textures_url for MTL for now
          scene_bvh_url: '', // Not used yet? Or maybe generated?
          cam_position_x: 0, cam_position_y: 5, cam_position_z: 10, // Defualts
          cam_target_x: 0, cam_target_y: 0, cam_target_z: 0,
          width: 1000,
          height: 1000,
          fov: 45,
          max_bounces: 3,
          // We should probably allow the user to set these in the UI, 
          // but for now hardcoded defaults + grid settings
        })
      });

      if (!taskRes.ok) throw new Error('Failed to create task');

      const data = await taskRes.json();
      alert(`Task Created! ID: ${data.taskId}`);

      if (onTaskCreated) {
        onTaskCreated(data.taskId);
      }

      // Redirect or clear
      // router.push('/job'); // Maybe?

    } catch (error: any) {
      console.error(error);
      alert("Error: " + error.message);
    } finally {
      setIsUploading(false);
      setUploadStatus("");
    }
  };

  const hasPreview = objUrl;

  return (
    <div className="mosaic-root">
      <div className="mosaic-grid-layout">
        {/* Header tile */}
        <header className="mosaic-tile mosaic-tile-header">
          <h1 className="mosaic-title">Mosaic GPU</h1>
          <p className="mosaic-subtitle">Create a Rendering Task</p>
        </header>

        {/* File inputs tile */}
        <section className="mosaic-tile mosaic-tile-inputs">
          <h2 className="mosaic-tile-title">Files</h2>
          <div className="mosaic-input-group">
            <label className="mosaic-label">
              <span>.OBJ</span>
              <input
                type="file"
                accept=".obj"
                onChange={handleObjChange}
                className="mosaic-file-input"
              />
              <span className="mosaic-file-name">
                {objFile?.name ?? "Choose file"}
              </span>
            </label>
          </div>
          <div className="mosaic-input-group">
            <label className="mosaic-label">
              <span>.MTL</span>
              <input
                type="file"
                accept=".mtl"
                onChange={handleMtlChange}
                className="mosaic-file-input"
              />
              <span className="mosaic-file-name">
                {mtlFile?.name ?? "Choose file"}
              </span>
            </label>
          </div>

          <div className="mosaic-create-btn-wrap mt-4">
            <button
              onClick={handleCreateTask}
              disabled={isUploading}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-500 disabled:bg-gray-600"
            >
              {isUploading ? uploadStatus : "Create Task"}
            </button>
          </div>

        </section>

        {/* Grid slider tile */}
        {/* <section className="mosaic-tile mosaic-tile-slider">
          <h2 className="mosaic-tile-title">Grid divisions</h2>
          <div className="mosaic-slider-wrap">
            <input
              type="range"
              min={2}
              max={20}
              value={gridBoxes}
              onChange={(e) => setGridBoxes(Number(e.target.value))}
              className="mosaic-slider"
            />
            <div className="mosaic-slider-labels">
              <span>2</span>
              <span className="mosaic-slider-value">{gridBoxes}×{gridBoxes}</span>
              <span>20</span>
            </div>
          </div>
          <p className="mosaic-hint">
            {gridBoxes * gridBoxes} tiles
          </p>
        </section> */}

        {/* Preview tile — main mosaic panel with grid overlay */}
        <section className="mosaic-tile mosaic-tile-preview">
          <h2 className="mosaic-tile-title">Preview</h2>
          <div className="mosaic-preview-wrap">
            {hasPreview ? (
              <>
                <div className="mosaic-preview-content">
                  <ModelViewer
                    objUrl={objUrl}
                    mtlUrl={mtlUrl}
                    className="mosaic-model-viewer"
                  />
                </div>
                <div
                  className="mosaic-grid-overlay"
                  style={{
                    gridTemplateColumns: `repeat(${gridBoxes}, 1fr)`,
                    gridTemplateRows: `repeat(${gridBoxes}, 1fr)`,
                  }}
                >
                  {Array.from({ length: gridBoxes * gridBoxes }).map((_, i) => (
                    <div key={i} className="mosaic-grid-cell" />
                  ))}
                </div>
              </>
            ) : (
              <div className="mosaic-preview-placeholder">
                <span>Upload .OBJ & .MTL to preview</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
