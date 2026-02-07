"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const shaderCode = `
struct Params {
  resolution: vec2<f32>,
  time: f32,
  triCount: u32,
};

struct Vertex {
  position: vec4<f32>,
};

struct Index {
  i0: u32,
  i1: u32,
  i2: u32,
  pad: u32,
};

@group(0) @binding(0) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var<storage, read> vertices: array<Vertex>;
@group(0) @binding(2) var<storage, read> indices: array<Index>;
@group(0) @binding(3) var<storage, read> triIndices: array<u32>;

struct BvhNode {
  min: vec3<f32>,
  max: vec3<f32>,
  left: i32,
  right: i32,
  start: u32,
  count: u32,
};

@group(0) @binding(4) var<storage, read> bvhNodes: array<BvhNode>;
@group(0) @binding(5) var<uniform> params: Params;

fn intersectTriangle(ro: vec3<f32>, rd: vec3<f32>, a: vec3<f32>, b: vec3<f32>, c: vec3<f32>) -> f32 {
  let eps = 0.000001;
  let ab = b - a;
  let ac = c - a;
  let pvec = cross(rd, ac);
  let det = dot(ab, pvec);
  if (abs(det) < eps) {
    return -1.0;
  }
  let invDet = 1.0 / det;
  let tvec = ro - a;
  let u = dot(tvec, pvec) * invDet;
  if (u < 0.0 || u > 1.0) {
    return -1.0;
  }
  let qvec = cross(tvec, ab);
  let v = dot(rd, qvec) * invDet;
  if (v < 0.0 || u + v > 1.0) {
    return -1.0;
  }
  let t = dot(ac, qvec) * invDet;
  if (t > 0.0) {
    return t;
  }
  return -1.0;
}

fn intersectAabb(ro: vec3<f32>, rd: vec3<f32>, minB: vec3<f32>, maxB: vec3<f32>) -> f32 {
  let invDir = 1.0 / rd;
  let t0 = (minB - ro) * invDir;
  let t1 = (maxB - ro) * invDir;
  let tmin = max(max(min(t0.x, t1.x), min(t0.y, t1.y)), min(t0.z, t1.z));
  let tmax = min(min(max(t0.x, t1.x), max(t0.y, t1.y)), max(t0.z, t1.z));
  if (tmax >= max(tmin, 0.0)) {
    return tmin;
  }
  return -1.0;
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u32(params.resolution.x) || gid.y >= u32(params.resolution.y)) {
    return;
  }

  let uv = (vec2<f32>(gid.xy) + 0.5) / params.resolution;
  let aspect = params.resolution.x / params.resolution.y;
  let screen = (uv * 2.0 - 1.0) * vec2<f32>(aspect, 1.0);

  let ro = vec3<f32>(0.0, 0.3, -2.5);
  let rd = normalize(vec3<f32>(screen, 1.6));

  var closest = 1e9;
  var hitNormal = vec3<f32>(0.0, 1.0, 0.0);
  var hit = false;

  var stack = array<i32, 64>();
  var stackPtr = 0;
  stack[0] = 0;

  loop {
    if (stackPtr < 0) {
      break;
    }
    let nodeIndex = stack[stackPtr];
    stackPtr = stackPtr - 1;
    let node = bvhNodes[u32(nodeIndex)];
    let tBox = intersectAabb(ro, rd, node.min, node.max);
    if (tBox < 0.0 || tBox > closest) {
      continue;
    }

    if (node.count > 0u) {
      var j = 0u;
      loop {
        if (j >= node.count) {
          break;
        }
        let triIndex = triIndices[node.start + j];
        let idx = indices[triIndex];
        let a = vertices[idx.i0].position.xyz;
        let b = vertices[idx.i1].position.xyz;
        let c = vertices[idx.i2].position.xyz;
        let t = intersectTriangle(ro, rd, a, b, c);
        if (t > 0.0 && t < closest) {
          closest = t;
          hit = true;
          hitNormal = normalize(cross(b - a, c - a));
        }
        j = j + 1u;
      }
    } else {
      if (node.left >= 0) {
        stackPtr = stackPtr + 1;
        stack[stackPtr] = node.left;
      }
      if (node.right >= 0) {
        stackPtr = stackPtr + 1;
        stack[stackPtr] = node.right;
      }
    }
  }

  var color = vec3<f32>(0.02, 0.04, 0.08);
  if (hit) {
    let lightDir = normalize(vec3<f32>(-0.6, 0.8, -0.4));
    let diffuse = max(dot(hitNormal, lightDir), 0.0);
    color = vec3<f32>(0.2, 0.7, 1.0) * diffuse + vec3<f32>(0.05);
  } else {
    let sky = mix(vec3<f32>(0.1, 0.12, 0.2), vec3<f32>(0.5, 0.7, 1.0), uv.y);
    color = sky;
  }

  textureStore(outputTex, vec2<i32>(gid.xy), vec4<f32>(color, 1.0));
}

struct VSOut {
  @builtin(position) position: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@group(0) @binding(0) var screenSampler: sampler;
@group(0) @binding(1) var screenTexture: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) index: u32) -> VSOut {
  var positions = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0),
    vec2<f32>(3.0, -1.0),
    vec2<f32>(-1.0, 3.0)
  );
  var uvs = array<vec2<f32>, 3>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(2.0, 0.0),
    vec2<f32>(0.0, 2.0)
  );

  var out: VSOut;
  out.position = vec4<f32>(positions[index], 0.0, 1.0);
  out.uv = uvs[index];
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4<f32> {
  return textureSample(screenTexture, screenSampler, in.uv);
}
`;

type MeshData = {
  positions: Float32Array;
  indices: Uint32Array;
  triangleCount: number;
};

type BvhNodeData = {
  min: [number, number, number];
  max: [number, number, number];
  left: number;
  right: number;
  start: number;
  count: number;
};

function parseOBJ(text: string): MeshData {
  const positionsRaw: number[] = [];
  const indicesRaw: number[] = [];

  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("v ")) {
      const [, x, y, z] = trimmed.split(/\s+/);
      positionsRaw.push(Number(x), Number(y), Number(z));
    } else if (trimmed.startsWith("f ")) {
      const [, ...verts] = trimmed.split(/\s+/);
      const parsed = verts.map((v) => {
        const [idx] = v.split("/");
        return Number(idx);
      });
      if (parsed.length < 3) {
        continue;
      }
      for (let i = 1; i < parsed.length - 1; i += 1) {
        indicesRaw.push(parsed[0], parsed[i], parsed[i + 1]);
      }
    }
  }

  const vertexCount = positionsRaw.length / 3;
  const positions = new Float32Array(vertexCount * 4);
  for (let i = 0; i < vertexCount; i += 1) {
    positions[i * 4 + 0] = positionsRaw[i * 3 + 0];
    positions[i * 4 + 1] = positionsRaw[i * 3 + 1];
    positions[i * 4 + 2] = positionsRaw[i * 3 + 2];
    positions[i * 4 + 3] = 1.0;
  }

  const indices = new Uint32Array(indicesRaw.length);
  for (let i = 0; i < indicesRaw.length; i += 1) {
    const idx = indicesRaw[i];
    const resolved = idx < 0 ? vertexCount + idx : idx - 1;
    indices[i] = Math.max(0, resolved);
  }

  return {
    positions,
    indices,
    triangleCount: Math.floor(indices.length / 3),
  };
}

function buildDefaultMesh(): MeshData {
  const positions = new Float32Array([
    -0.6, -0.5, 0.0, 1.0,
    0.6, -0.5, 0.0, 1.0,
    0.0, 0.6, 0.0, 1.0,
  ]);
  const indices = new Uint32Array([0, 1, 2]);
  return { positions, indices, triangleCount: 1 };
}

function computeTriangleData(mesh: MeshData) {
  const triCount = mesh.triangleCount;
  const mins = new Float32Array(triCount * 3);
  const maxs = new Float32Array(triCount * 3);
  const centroids = new Float32Array(triCount * 3);
  const pos = mesh.positions;
  const idx = mesh.indices;

  for (let t = 0; t < triCount; t += 1) {
    const i0 = idx[t * 3 + 0] * 4;
    const i1 = idx[t * 3 + 1] * 4;
    const i2 = idx[t * 3 + 2] * 4;
    const ax = pos[i0];
    const ay = pos[i0 + 1];
    const az = pos[i0 + 2];
    const bx = pos[i1];
    const by = pos[i1 + 1];
    const bz = pos[i1 + 2];
    const cx = pos[i2];
    const cy = pos[i2 + 1];
    const cz = pos[i2 + 2];

    const minX = Math.min(ax, bx, cx);
    const minY = Math.min(ay, by, cy);
    const minZ = Math.min(az, bz, cz);
    const maxX = Math.max(ax, bx, cx);
    const maxY = Math.max(ay, by, cy);
    const maxZ = Math.max(az, bz, cz);

    mins[t * 3 + 0] = minX;
    mins[t * 3 + 1] = minY;
    mins[t * 3 + 2] = minZ;
    maxs[t * 3 + 0] = maxX;
    maxs[t * 3 + 1] = maxY;
    maxs[t * 3 + 2] = maxZ;
    centroids[t * 3 + 0] = (ax + bx + cx) / 3;
    centroids[t * 3 + 1] = (ay + by + cy) / 3;
    centroids[t * 3 + 2] = (az + bz + cz) / 3;
  }

  return { mins, maxs, centroids };
}

function buildBvh(mesh: MeshData) {
  const triCount = mesh.triangleCount;
  const { mins, maxs, centroids } = computeTriangleData(mesh);
  const triIndices = Array.from({ length: triCount }, (_, i) => i);
  const nodes: BvhNodeData[] = [];
  const maxLeafSize = 6;

  const buildNode = (start: number, count: number): number => {
    const nodeIndex = nodes.length;
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (let i = start; i < start + count; i += 1) {
      const tri = triIndices[i];
      minX = Math.min(minX, mins[tri * 3 + 0]);
      minY = Math.min(minY, mins[tri * 3 + 1]);
      minZ = Math.min(minZ, mins[tri * 3 + 2]);
      maxX = Math.max(maxX, maxs[tri * 3 + 0]);
      maxY = Math.max(maxY, maxs[tri * 3 + 1]);
      maxZ = Math.max(maxZ, maxs[tri * 3 + 2]);
    }

    const node: BvhNodeData = {
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
      left: -1,
      right: -1,
      start,
      count,
    };
    nodes.push(node);

    if (count <= maxLeafSize) {
      return nodeIndex;
    }

    let cminX = Infinity;
    let cminY = Infinity;
    let cminZ = Infinity;
    let cmaxX = -Infinity;
    let cmaxY = -Infinity;
    let cmaxZ = -Infinity;
    for (let i = start; i < start + count; i += 1) {
      const tri = triIndices[i];
      cminX = Math.min(cminX, centroids[tri * 3 + 0]);
      cminY = Math.min(cminY, centroids[tri * 3 + 1]);
      cminZ = Math.min(cminZ, centroids[tri * 3 + 2]);
      cmaxX = Math.max(cmaxX, centroids[tri * 3 + 0]);
      cmaxY = Math.max(cmaxY, centroids[tri * 3 + 1]);
      cmaxZ = Math.max(cmaxZ, centroids[tri * 3 + 2]);
    }

    const extentX = cmaxX - cminX;
    const extentY = cmaxY - cminY;
    const extentZ = cmaxZ - cminZ;
    let axis = 0;
    if (extentY > extentX && extentY >= extentZ) {
      axis = 1;
    } else if (extentZ > extentX && extentZ >= extentY) {
      axis = 2;
    }

    const range = triIndices.slice(start, start + count);
    range.sort((a, b) => centroids[a * 3 + axis] - centroids[b * 3 + axis]);
    for (let i = 0; i < range.length; i += 1) {
      triIndices[start + i] = range[i];
    }

    const mid = start + Math.floor(count / 2);
    node.start = 0;
    node.count = 0;
    node.left = buildNode(start, mid - start);
    node.right = buildNode(mid, start + count - mid);
    return nodeIndex;
  };

  buildNode(0, triCount);

  const triIndexArray = new Uint32Array(triIndices);
  const nodeBuffer = new ArrayBuffer(nodes.length * 48);
  const view = new DataView(nodeBuffer);
  nodes.forEach((node, i) => {
    const base = i * 48;
    view.setFloat32(base + 0, node.min[0], true);
    view.setFloat32(base + 4, node.min[1], true);
    view.setFloat32(base + 8, node.min[2], true);
    view.setFloat32(base + 16, node.max[0], true);
    view.setFloat32(base + 20, node.max[1], true);
    view.setFloat32(base + 24, node.max[2], true);
    view.setInt32(base + 32, node.left, true);
    view.setInt32(base + 36, node.right, true);
    view.setUint32(base + 40, node.start, true);
    view.setUint32(base + 44, node.count, true);
  });

  return { triIndexArray, nodeBuffer, nodeCount: nodes.length };
}

export default function RayTrace() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("Initializing WebGPU...");
  const [triangleCount, setTriangleCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const deviceRef = useRef<GPUDevice | null>(null);
  const contextRef = useRef<GPUCanvasContext | null>(null);
  const outputViewRef = useRef<GPUTextureView | null>(null);
  const outputTextureRef = useRef<GPUTexture | null>(null);
  const uniformBufferRef = useRef<GPUBuffer | null>(null);
  const computePipelineRef = useRef<GPUComputePipeline | null>(null);
  const renderPipelineRef = useRef<GPURenderPipeline | null>(null);
  const computeBindGroupRef = useRef<GPUBindGroup | null>(null);
  const renderBindGroupRef = useRef<GPUBindGroup | null>(null);
  const samplerRef = useRef<GPUSampler | null>(null);
  const meshBuffersRef = useRef<{
    positions?: GPUBuffer;
    indices?: GPUBuffer;
    triIndices?: GPUBuffer;
    bvhNodes?: GPUBuffer;
    triangleCount: number;
    nodeCount: number;
  }>({ triangleCount: 0, nodeCount: 0 });

  const supportsWebGPU = useMemo(
    () => typeof navigator !== "undefined" && Boolean(navigator.gpu),
    []
  );

  useEffect(() => {
    if (!supportsWebGPU) {
      setError("WebGPU not supported on this browser.");
      return;
    }

    let disposed = false;
    let animationFrameId = 0;

    const initWebGPU = async () => {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        setError("No appropriate GPUAdapter found.");
        return;
      }

      const device = await adapter.requestDevice();
      const canvas = canvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext("webgpu");
      if (!context) {
        setError("Could not get WebGPU context.");
        return;
      }

      const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
      deviceRef.current = device;
      contextRef.current = context;

      uniformBufferRef.current = device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      samplerRef.current = device.createSampler({
        magFilter: "linear",
        minFilter: "linear",
      });

      const module = device.createShaderModule({
        label: "OBJ Raytracing Shaders",
        code: shaderCode,
      });

      computePipelineRef.current = device.createComputePipeline({
        layout: "auto",
        compute: { module, entryPoint: "main" },
      });

      renderPipelineRef.current = device.createRenderPipeline({
        layout: "auto",
        vertex: { module, entryPoint: "vs" },
        fragment: {
          module,
          entryPoint: "fs",
          targets: [{ format: presentationFormat }],
        },
        primitive: { topology: "triangle-list" },
      });

      const rebuildResources = () => {
        if (!deviceRef.current || !contextRef.current || !canvas) {
          return;
        }

        const dpr = Math.max(1, window.devicePixelRatio || 1);
        const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
        const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
        canvas.width = width;
        canvas.height = height;

        contextRef.current.configure({
          device: deviceRef.current,
          format: presentationFormat,
          alphaMode: "opaque",
        });

        outputTextureRef.current?.destroy();
        outputTextureRef.current = deviceRef.current.createTexture({
          size: [width, height],
          format: "rgba8unorm",
          usage:
            GPUTextureUsage.STORAGE_BINDING |
            GPUTextureUsage.TEXTURE_BINDING,
        });
        outputViewRef.current = outputTextureRef.current.createView();

        buildBindGroups();
      };

      const buildBindGroups = () => {
        if (
          !deviceRef.current ||
          !computePipelineRef.current ||
          !renderPipelineRef.current ||
          !outputViewRef.current ||
          !uniformBufferRef.current ||
          !meshBuffersRef.current.positions ||
          !meshBuffersRef.current.indices ||
          !meshBuffersRef.current.triIndices ||
          !meshBuffersRef.current.bvhNodes ||
          !samplerRef.current
        ) {
          return;
        }

        computeBindGroupRef.current = deviceRef.current.createBindGroup({
          layout: computePipelineRef.current.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: outputViewRef.current },
            { binding: 1, resource: { buffer: meshBuffersRef.current.positions } },
            { binding: 2, resource: { buffer: meshBuffersRef.current.indices } },
            { binding: 3, resource: { buffer: meshBuffersRef.current.triIndices } },
            { binding: 4, resource: { buffer: meshBuffersRef.current.bvhNodes } },
            { binding: 5, resource: { buffer: uniformBufferRef.current } },
          ],
        });

        renderBindGroupRef.current = deviceRef.current.createBindGroup({
          layout: renderPipelineRef.current.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: samplerRef.current },
            { binding: 1, resource: outputViewRef.current },
          ],
        });
      };

      const uploadMesh = (mesh: MeshData) => {
        if (!deviceRef.current) return;

        meshBuffersRef.current.positions?.destroy();
        meshBuffersRef.current.indices?.destroy();
        meshBuffersRef.current.triIndices?.destroy();
        meshBuffersRef.current.bvhNodes?.destroy();

        const { triIndexArray, nodeBuffer, nodeCount } = buildBvh(mesh);

        meshBuffersRef.current.positions = deviceRef.current.createBuffer({
          size: mesh.positions.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        deviceRef.current.queue.writeBuffer(
          meshBuffersRef.current.positions,
          0,
          mesh.positions.buffer,
          mesh.positions.byteOffset,
          mesh.positions.byteLength
        );

        const packedIndices = new Uint32Array(mesh.triangleCount * 4);
        for (let i = 0; i < mesh.triangleCount; i += 1) {
          packedIndices[i * 4 + 0] = mesh.indices[i * 3 + 0];
          packedIndices[i * 4 + 1] = mesh.indices[i * 3 + 1];
          packedIndices[i * 4 + 2] = mesh.indices[i * 3 + 2];
          packedIndices[i * 4 + 3] = 0;
        }

        meshBuffersRef.current.indices = deviceRef.current.createBuffer({
          size: packedIndices.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        deviceRef.current.queue.writeBuffer(
          meshBuffersRef.current.indices,
          0,
          packedIndices.buffer,
          packedIndices.byteOffset,
          packedIndices.byteLength
        );

        meshBuffersRef.current.triIndices = deviceRef.current.createBuffer({
          size: triIndexArray.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        deviceRef.current.queue.writeBuffer(
          meshBuffersRef.current.triIndices,
          0,
          triIndexArray.buffer,
          triIndexArray.byteOffset,
          triIndexArray.byteLength
        );

        meshBuffersRef.current.bvhNodes = deviceRef.current.createBuffer({
          size: nodeBuffer.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
        });
        deviceRef.current.queue.writeBuffer(
          meshBuffersRef.current.bvhNodes,
          0,
          nodeBuffer
        );

        meshBuffersRef.current.triangleCount = mesh.triangleCount;
        meshBuffersRef.current.nodeCount = nodeCount;
        setTriangleCount(mesh.triangleCount);
        setStatus(`Mesh loaded: ${mesh.triangleCount} triangles · ${nodeCount} BVH nodes`);
        buildBindGroups();
      };

      rebuildResources();
      uploadMesh(buildDefaultMesh());

      const frame = (time: number) => {
        if (disposed) return;
        const device = deviceRef.current;
        const context = contextRef.current;
        const uniformBuffer = uniformBufferRef.current;
        const computePipeline = computePipelineRef.current;
        const renderPipeline = renderPipelineRef.current;
        const computeBindGroup = computeBindGroupRef.current;
        const renderBindGroup = renderBindGroupRef.current;
        if (
          !device ||
          !context ||
          !uniformBuffer ||
          !computePipeline ||
          !renderPipeline ||
          !computeBindGroup ||
          !renderBindGroup ||
          !outputTextureRef.current ||
          !meshBuffersRef.current.triangleCount
        ) {
          animationFrameId = requestAnimationFrame(frame);
          return;
        }

        const width = outputTextureRef.current.width;
        const height = outputTextureRef.current.height;
        const buffer = new ArrayBuffer(16);
        const floats = new Float32Array(buffer);
        const uints = new Uint32Array(buffer);
        floats[0] = width;
        floats[1] = height;
        floats[2] = time * 0.001;
        uints[3] = meshBuffersRef.current.triangleCount;
        device.queue.writeBuffer(uniformBuffer, 0, buffer);

        const encoder = device.createCommandEncoder();
        const computePass = encoder.beginComputePass();
        computePass.setPipeline(computePipeline);
        computePass.setBindGroup(0, computeBindGroup);
        computePass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
        computePass.end();

        const renderPass = encoder.beginRenderPass({
          colorAttachments: [
            {
              view: context.getCurrentTexture().createView(),
              loadOp: "clear",
              storeOp: "store",
              clearValue: { r: 0, g: 0, b: 0, a: 1 },
            },
          ],
        });
        renderPass.setPipeline(renderPipeline);
        renderPass.setBindGroup(0, renderBindGroup);
        renderPass.draw(3);
        renderPass.end();

        device.queue.submit([encoder.finish()]);
        animationFrameId = requestAnimationFrame(frame);
      };

      animationFrameId = requestAnimationFrame(frame);
      window.addEventListener("resize", rebuildResources);

      (canvas as HTMLCanvasElement & {
        uploadObj?: (text: string) => void;
      }).uploadObj = (text: string) => {
        uploadMesh(parseOBJ(text));
      };
    };

    initWebGPU().catch((err) => {
      console.error(err);
      setError(err instanceof Error ? err.message : "Unknown error");
    });

    return () => {
      disposed = true;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      outputTextureRef.current?.destroy();
      meshBuffersRef.current.positions?.destroy();
      meshBuffersRef.current.indices?.destroy();
      meshBuffersRef.current.triIndices?.destroy();
      meshBuffersRef.current.bvhNodes?.destroy();
    };
  }, [supportsWebGPU]);

  const handleFileUpload = async (file: File | null) => {
    if (!file || !canvasRef.current) return;
    const text = await file.text();
    const uploader = canvasRef.current as HTMLCanvasElement & {
      uploadObj?: (data: string) => void;
    };
    uploader.uploadObj?.(text);
  };

  if (error) {
    return <div className="text-red-500 p-4">Error: {error}</div>;
  }

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 bg-black px-6 py-10 text-white">
      <header className="flex w-full max-w-5xl flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
          OBJ Raytracing
        </p>
        <h1 className="text-3xl font-semibold">WebGPU Compute Raytracer</h1>
        <p className="text-sm text-zinc-400">
          Upload an OBJ file to raytrace triangles directly from GPU buffers.
        </p>
      </header>

      <div className="flex w-full max-w-5xl flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="file"
            accept=".obj"
            onChange={(event) => handleFileUpload(event.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <span className="text-xs text-zinc-400">{status}</span>
          <span className="text-xs text-zinc-500">
            Triangles: {triangleCount}
          </span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
          <canvas ref={canvasRef} className="h-[720px] w-full" />
        </div>
      </div>
    </div>
  );
}
