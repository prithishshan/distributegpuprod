"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import type { ChangeEvent } from "react";

const ModelViewer = dynamic(() => import("./ModelViewer"), { ssr: false });

export default function MosaicUpload() {
  const [objFile, setObjFile] = useState<File | null>(null);
  const [mtlFile, setMtlFile] = useState<File | null>(null);
  const [objUrl, setObjUrl] = useState<string | null>(null);
  const [mtlUrl, setMtlUrl] = useState<string | null>(null);
  const [pngFile, setPngFile] = useState<File | null>(null);
  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const [gridBoxes, setGridBoxes] = useState(4); // 2–20, number of divisions per side

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

  const handlePngChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (pngUrl) URL.revokeObjectURL(pngUrl);
    if (file) {
      setPngFile(file);
      setPngUrl(URL.createObjectURL(file));
    } else {
      setPngFile(null);
      setPngUrl(null);
    }
  }, [pngUrl]);

  const hasPreview = objUrl || pngUrl;
  const displayPng = pngUrl && !objUrl;

  return (
    <div className="mosaic-root">
      <div className="mosaic-grid-layout">
        {/* Header tile */}
        <header className="mosaic-tile mosaic-tile-header">
          <h1 className="mosaic-title">Distributed GPU</h1>
          <p className="mosaic-subtitle">OBJ · MTL · Grid</p>
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
          <div className="mosaic-input-group mosaic-optional">
            <label className="mosaic-label">
              <span>PNG (optional)</span>
              <input
                type="file"
                accept="image/png,.png"
                onChange={handlePngChange}
                className="mosaic-file-input"
              />
              <span className="mosaic-file-name">
                {pngFile?.name ?? "Divide a PNG"}
              </span>
            </label>
          </div>
        </section>

        {/* Grid slider tile */}
        <section className="mosaic-tile mosaic-tile-slider">
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
            {gridBoxes * gridBoxes} boxes
          </p>
        </section>

        {/* Preview tile — main mosaic panel with grid overlay */}
        <section className="mosaic-tile mosaic-tile-preview">
          <h2 className="mosaic-tile-title">Preview</h2>
          <div className="mosaic-preview-wrap">
            {hasPreview ? (
              <>
                <div className="mosaic-preview-content">
                  {displayPng ? (
                    <img
                      src={pngUrl}
                      alt="PNG preview"
                      className="mosaic-preview-img"
                    />
                  ) : (
                    <ModelViewer
                      objUrl={objUrl}
                      mtlUrl={mtlUrl}
                      className="mosaic-model-viewer"
                    />
                  )}
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
                <span>Upload .OBJ (+ .MTL) or PNG</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
