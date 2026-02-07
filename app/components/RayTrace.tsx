"use client";

import { useEffect, useRef, useState } from "react";

const shaderCode = `
struct VertexOutput {
  @builtin(position) Position : vec4f,
  @location(0) uv : vec2f,
}

@vertex
fn vs_main(@builtin(vertex_index) VertexIndex : u32) -> VertexOutput {
  var pos = array<vec2f, 6>(
    vec2f(-1.0, -1.0),
    vec2f( 1.0, -1.0),
    vec2f(-1.0,  1.0),
    vec2f(-1.0,  1.0),
    vec2f( 1.0, -1.0),
    vec2f( 1.0,  1.0)
  );

  var output : VertexOutput;
  output.Position = vec4f(pos[VertexIndex], 0.0, 1.0);
  output.uv = pos[VertexIndex] * 0.5 + 0.5; // 0..1
  return output;
}

struct Ray {
  origin : vec3f,
  direction : vec3f,
}

struct Sphere {
  center : vec3f,
  radius : f32,
  color : vec3f,
}

fn hit_sphere(center: vec3f, radius: f32, r: Ray) -> f32 {
  let oc = r.origin - center;
  let a = dot(r.direction, r.direction);
  let b = 2.0 * dot(oc, r.direction);
  let c = dot(oc, oc) - radius * radius;
  let discriminant = b * b - 4.0 * a * c;
  
  if (discriminant < 0.0) {
    return -1.0;
  } else {
    return (-b - sqrt(discriminant)) / (2.0 * a);
  }
}

@fragment
fn fs_main(@location(0) uv : vec2f) -> @location(0) vec4f {
  // Simple camera setup
  let aspect_ratio = 16.0 / 9.0;
  let viewport_height = 2.0;
  let viewport_width = aspect_ratio * viewport_height;
  let focal_length = 1.0;

  let origin = vec3f(0.0, 0.0, 0.0);
  let horizontal = vec3f(viewport_width, 0.0, 0.0);
  let vertical = vec3f(0.0, viewport_height, 0.0);
  let lower_left_corner = origin - horizontal/2.0 - vertical/2.0 - vec3f(0.0, 0.0, focal_length);

  // Map UV to world coordinates
  // UV is 0..1, need to map to viewport
  let u = uv.x;
  let v = 1.0 - uv.y; // Flip Y for typical image coords

  let direction = lower_left_corner + u*horizontal + v*vertical - origin;
  let r = Ray(origin, normalize(direction));

  // Scene
  let sphere = Sphere(vec3f(0.0, 0.0, -1.0), 0.5, vec3f(1.0, 0.0, 0.0)); // Red sphere

  let t = hit_sphere(sphere.center, sphere.radius, r);

  if (t > 0.0) {
    let P = r.origin + t * r.direction;
    let N = normalize(P - sphere.center);
    // Simple lighting (normal map style)
    return vec4f(0.5 * (N + 1.0), 1.0);
  }

  // Background gradient
  let unit_direction = normalize(r.direction);
  let t_bg = 0.5 * (unit_direction.y + 1.0);
  let color = (1.0 - t_bg) * vec3f(1.0, 1.0, 1.0) + t_bg * vec3f(0.5, 0.7, 1.0);
  
  return vec4f(color, 1.0);
}
`;

export default function RayTrace() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!navigator.gpu) {
            setError("WebGPU not supported on this browser.");
            return;
        }

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
            context.configure({
                device,
                format: presentationFormat,
                alphaMode: "premultiplied",
            });

            const module = device.createShaderModule({
                label: "Raytracing Shaders",
                code: shaderCode,
            });

            const pipeline = device.createRenderPipeline({
                label: "Raytracing Pipeline",
                layout: "auto",
                vertex: {
                    module,
                    entryPoint: "vs_main",
                },
                fragment: {
                    module,
                    entryPoint: "fs_main",
                    targets: [{ format: presentationFormat }],
                },
                primitive: {
                    topology: "triangle-list",
                },
            });

            const frame = () => {
                const commandEncoder = device.createCommandEncoder();
                const textureView = context.getCurrentTexture().createView();

                const renderPassDescriptor: GPURenderPassDescriptor = {
                    colorAttachments: [
                        {
                            view: textureView,
                            clearValue: { r: 0, g: 0, b: 0, a: 1 },
                            loadOp: "clear",
                            storeOp: "store",
                        },
                    ],
                };

                const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
                passEncoder.setPipeline(pipeline);
                passEncoder.draw(6); // Draw 6 vertices (2 triangles)
                passEncoder.end();

                device.queue.submit([commandEncoder.finish()]);

                // requestAnimationFrame(frame); // Uncomment for animation loop
            };

            requestAnimationFrame(frame);
        };

        initWebGPU().catch((err) => {
            console.error(err);
            setError(err.message);
        });
    }, []);

    if (error) {
        return <div className="text-red-500 p-4">Error: {error}</div>;
    }

    return (
        <div className="flex items-center justify-center h-screen bg-black">
            <canvas
                ref={canvasRef}
                width={1280}
                height={720}
                className="border border-gray-700"
            />
        </div>
    );
}
