import { makeShaderDataDefinitions, makeStructuredView } from "webgpu-utils";
import { vec3 } from "gl-matrix";

import { Scene } from "@/shaders/Scene";
import raytracerShaderSrc from "@/shaders/shader-bts/raytracer";
import CommonShaderChunk from "@/shaders/shader-bts/utils/common";
import CameraShaderChunk from "@/shaders/shader-bts/utils/camera";

export class WorkerRenderer {
    device: GPUDevice;
    scene: Scene;
    pipeline: GPUComputePipeline;
    bindGroup0Layout: GPUBindGroupLayout;
    bindGroup1Layout: GPUBindGroupLayout;

    // Buffers and Uniforms
    commonUniformsBuffer: GPUBuffer;
    cameraUniformsBuffer: GPUBuffer;
    rngStateBuffer: GPUBuffer;
    raytracedStorageBuffer: GPUBuffer;

    commonUniformValues: any;
    cameraUniformValues: any;

    width: number = 0;
    height: number = 0;

    constructor(device: GPUDevice) {
        this.device = device;
        this.scene = new Scene(device);

        // Define Uniform Layouts
        const commonShaderDefs = makeShaderDataDefinitions(CommonShaderChunk);
        this.commonUniformValues = makeStructuredView(commonShaderDefs.structs.CommonUniforms);

        const cameraShaderDefs = makeShaderDataDefinitions(CameraShaderChunk);
        this.cameraUniformValues = makeStructuredView(cameraShaderDefs.structs.Camera);

        // Create Uniform Buffers
        this.commonUniformsBuffer = device.createBuffer({
            size: this.commonUniformValues.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        this.cameraUniformsBuffer = device.createBuffer({
            size: this.cameraUniformValues.arrayBuffer.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Initialize layouts (placeholders until configured)
        this.bindGroup0Layout = device.createBindGroupLayout({ entries: [] });
        this.bindGroup1Layout = device.createBindGroupLayout({ entries: [] });
        this.pipeline = device.createComputePipeline({
            layout: "auto",
            compute: { module: device.createShaderModule({ code: "" }), entryPoint: "" }
        }) as any; // Dummy initialization

        // RNG and Storage buffers are created per job due to size changes (or we max them out)
        // For simplicity, we'll create them in `renderTile` or `resize`.
        // But since jobs are usually 10x10, it's small.
        // Let's create max sized buffers or re-create them.
        this.rngStateBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.STORAGE });
        this.raytracedStorageBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.STORAGE });
    }

    get isSceneLoaded(): boolean {
        return Scene.MODELS_COUNT > 0;
    }

    async init(objUrl: string, mtlUrl: string) {
        await this.scene.loadModels(objUrl, mtlUrl);
        await this.compilePipeline();
    }

    private async compilePipeline() {
        // Create Bind Groups Layouts matching `raytracer.ts`
        this.bindGroup0Layout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }, // image
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } }, // rng
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }, // common uniforms
                { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }, // camera uniforms
            ],
        });

        this.bindGroup1Layout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } }, // faces
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } }, // aabbs
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "read-only-storage" } }, // materials
            ],
        });

        const module = this.device.createShaderModule({ code: raytracerShaderSrc });

        this.pipeline = this.device.createComputePipeline({
            layout: this.device.createPipelineLayout({
                bindGroupLayouts: [this.bindGroup0Layout, this.bindGroup1Layout],
            }),
            compute: {
                module,
                entryPoint: "main",
                constants: {
                    WORKGROUP_SIZE_X: 16,
                    WORKGROUP_SIZE_Y: 16,
                    OBJECTS_COUNT_IN_SCENE: Scene.MODELS_COUNT,
                    MAX_BVs_COUNT_PER_MESH: Scene.MAX_NUM_BVs_PER_MESH,
                    MAX_FACES_COUNT_PER_MESH: Scene.MAX_NUM_FACES_PER_MESH,
                },
            },
        });
    }

    async renderTile(
        job: { x: number; y: number; width: number; height: number },
        task: {
            cam_position_x: number, cam_position_y: number, cam_position_z: number,
            cam_target_x: number, cam_target_y: number, cam_target_z: number,
            fov: number, width: number, height: number, max_bounces: number
        },
        samples: number = 500
    ): Promise<Uint8Array> {

        const tileW = job.width;
        const tileH = job.height;

        // Resize buffers if needed
        const pixelCount = tileW * tileH;
        const storageSize = Float32Array.BYTES_PER_ELEMENT * 3 * pixelCount; // vec3f (no alpha in shader? logic check)
        // raytracer.ts: `raytraceImageBuffer: array<vec3f>`
        // Note: Structs are aligned. vec3f is often padded to vec4f in arrays in some contexts, but `array<vec3f>` is tight? 
        // WGSL `array<vec3f>` has stride 16 (vec4 alignment). So actually 4 floats per pixel.
        const bufferSize = Float32Array.BYTES_PER_ELEMENT * 4 * pixelCount;

        if (this.raytracedStorageBuffer.size < bufferSize) {
            this.raytracedStorageBuffer.destroy();
            this.raytracedStorageBuffer = this.device.createBuffer({
                size: bufferSize,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
            });
            this.rngStateBuffer.destroy();
            this.rngStateBuffer = this.device.createBuffer({
                size: Uint32Array.BYTES_PER_ELEMENT * pixelCount,
                usage: GPUBufferUsage.STORAGE,
                mappedAtCreation: true,
            });
            const rngData = new Uint32Array(this.rngStateBuffer.getMappedRange());
            for (let i = 0; i < pixelCount; i++) rngData[i] = Math.random() * 0xffffffff;
            this.rngStateBuffer.unmap();
        }

        // Setup Bind Groups
        const bindGroup0 = this.device.createBindGroup({
            layout: this.bindGroup0Layout,
            entries: [
                { binding: 0, resource: { buffer: this.raytracedStorageBuffer } },
                { binding: 1, resource: { buffer: this.rngStateBuffer } },
                { binding: 2, resource: { buffer: this.commonUniformsBuffer } },
                { binding: 3, resource: { buffer: this.cameraUniformsBuffer } },
            ],
        });

        const bindGroup1 = this.device.createBindGroup({
            layout: this.bindGroup1Layout,
            entries: [
                { binding: 0, resource: { buffer: this.scene.facesBuffer } },
                { binding: 1, resource: { buffer: this.scene.aabbsBuffer } },
                { binding: 2, resource: { buffer: this.scene.materialsBuffer } },
            ],
        });

        // Loop for samples
        for (let s = 0; s < samples; s++) {
            // Update Uniforms
            this.commonUniformValues.set({
                seed: [Math.random() * 1000, Math.random() * 1000, Math.random() * 1000],
                frameCounter: s,
                maxBounces: task.max_bounces,
                flatShading: 0,
                debugNormals: 0
            });
            this.device.queue.writeBuffer(this.commonUniformsBuffer, 0, this.commonUniformValues.arrayBuffer);

            this.cameraUniformValues.set({
                viewportSize: [tileW, tileH],
                imageWidth: task.width,
                imageHeight: task.height,
                aspectRatio: task.width / task.height,
                vfov: task.fov,
                lookFrom: [task.cam_position_x, task.cam_position_y, task.cam_position_z],
                lookAt: [task.cam_target_x, task.cam_target_y, task.cam_target_z],
                vup: [0, 1, 0],
                defocusAngle: 0,
                focusDist: 10, // TODO: From task?
                tileOffsetX: job.x,
                tileOffsetY: job.y
            });
            this.device.queue.writeBuffer(this.cameraUniformsBuffer, 0, this.cameraUniformValues.arrayBuffer);

            const commandEncoder = this.device.createCommandEncoder();
            const pass = commandEncoder.beginComputePass();
            pass.setPipeline(this.pipeline);
            pass.setBindGroup(0, bindGroup0);
            pass.setBindGroup(1, bindGroup1);
            pass.dispatchWorkgroups(Math.ceil(tileW / 16), Math.ceil(tileH / 16));
            pass.end();
            this.device.queue.submit([commandEncoder.finish()]);

            await this.device.queue.onSubmittedWorkDone();
        }

        // Read back
        const readBuffer = this.device.createBuffer({
            size: bufferSize,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ
        });

        const commandEncoder = this.device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(this.raytracedStorageBuffer, 0, readBuffer, 0, bufferSize);
        this.device.queue.submit([commandEncoder.finish()]);

        await readBuffer.mapAsync(GPUMapMode.READ);
        const copyArrayBuffer = readBuffer.getMappedRange();
        const data = new Float32Array(copyArrayBuffer);

        // Convert Float32 RGB to Uint8 RGBA (add alpha)
        // WGSL array<vec3f> has stride 16 (r, g, b, padding).
        // Web canvas ImageData requires 4 bytes per pixel (RGBA).
        const output = new Uint8Array(tileW * tileH * 4);
        let ptr = 0;
        for (let i = 0; i < tileW * tileH; i++) {
            // Basic gamma correction (sqrt) + scaling
            let r = Math.sqrt(data[i * 4 + 0]) * 255;
            let g = Math.sqrt(data[i * 4 + 1]) * 255;
            let b = Math.sqrt(data[i * 4 + 2]) * 255;

            output[ptr++] = Math.min(255, Math.max(0, r));
            output[ptr++] = Math.min(255, Math.max(0, g));
            output[ptr++] = Math.min(255, Math.max(0, b));
            output[ptr++] = 255; // Alpha
        }

        readBuffer.unmap();
        readBuffer.destroy();
        return output;
    }
}
