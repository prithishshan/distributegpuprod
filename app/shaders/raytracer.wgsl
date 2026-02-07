struct Params {
  resolution: vec2<f32>,
  time: f32,
  sampleIndex: f32,
  tileOffset: vec2<f32>,
  tileSize: vec2<f32>,
};

@group(0) @binding(0) var outputTex: texture_storage_2d<rgba8unorm, write>;
@group(0) @binding(1) var<storage, read_write> accumTex: texture_storage_2d<rgba16float, read_write>;
@group(0) @binding(2) var<uniform> params: Params;

fn random(seed: vec2<f32>) -> f32 {
  return fract(sin(dot(seed, vec2<f32>(12.9898, 78.233))) * 43758.5453);
}

@compute @workgroup_size(8, 8)
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
  if (gid.x >= u32(params.tileSize.x) || gid.y >= u32(params.tileSize.y)) {
    return;
  }
  let pixel = vec2<u32>(gid.xy) + vec2<u32>(params.tileOffset);
  let uv = (vec2<f32>(pixel) + 0.5) / params.resolution;
  let noise = random(uv + params.sampleIndex);
  let color = vec3<f32>(uv, noise);
  textureStore(outputTex, vec2<i32>(pixel), vec4<f32>(color, 1.0));
  textureStore(accumTex, vec2<i32>(pixel), vec4<f32>(color, 1.0));
}
