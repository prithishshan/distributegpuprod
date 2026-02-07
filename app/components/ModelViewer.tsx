"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";

function Scene({
  objUrl,
  mtlUrl,
}: {
  objUrl: string | null;
  mtlUrl: string | null;
}) {
  const [model, setModel] = useState<THREE.Group | null>(null);
  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    if (!objUrl) {
      setModel(null);
      return;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const mtlLoader = new MTLLoader();
        const objLoader = new OBJLoader();

        if (mtlUrl) {
          const materials = await mtlLoader.loadAsync(mtlUrl);
          materials.preload();
          objLoader.setMaterials(materials);
        }

        const object = await objLoader.loadAsync(objUrl);
        if (!cancelled) {
          const box = new THREE.Box3().setFromObject(object);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const maxDim = Math.max(size.x, size.y, size.z);
          const scale = 2 / maxDim;
          object.scale.setScalar(scale);
          object.position.sub(center.multiplyScalar(scale));
          setModel(object);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Load error:", err);
          setModel(null);
        }
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [objUrl, mtlUrl]);

  if (!model) return null;

  return (
    <group ref={groupRef}>
      <primitive object={model} />
    </group>
  );
}

export default function ModelViewer({
  objUrl,
  mtlUrl,
  className,
}: {
  objUrl: string | null;
  mtlUrl: string | null;
  className?: string;
}) {
  return (
    <div className={className} style={{ background: "#1a1a2e", minHeight: 280 }}>
      <Canvas
        camera={{ position: [2, 2, 2], fov: 50 }}
        gl={{ antialias: true, alpha: false }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <directionalLight position={[-5, 5, -5]} intensity={0.4} />
        <Suspense
          fallback={
            <mesh>
              <boxGeometry args={[1, 1, 1]} />
              <meshStandardMaterial color="#444" wireframe />
            </mesh>
          }
        >
          <Scene objUrl={objUrl} mtlUrl={mtlUrl} />
        </Suspense>
        <OrbitControls enableDamping dampingFactor={0.05} />
      </Canvas>
    </div>
  );
}
