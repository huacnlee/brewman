import { SCENE } from '../../../src/ui/scene';

// Runs the app's night scene (the same WGSL as its window backdrop) on a canvas with WebGPU. Without WebGPU the canvas
// stays hidden and the CSS sky behind it shows. Paused while the hero is off screen or the tab is hidden; under
// reduced motion it draws one still frame.

// The app's theme tokens: night, beam, primary, background.
const COLORS = ['#0b0e15', '#c9d4ff', '#f5c542', '#050608'];
// A moment with the eyes open and no lightning, for the still frame.
const STILL_TIME = 3.2;
// The scene's per-pixel cost is high; past this density the rain gets no sharper.
const MAX_SCALE = 1.5;

const PRELUDE = /* wgsl */ `
struct Frame { size: vec2f, pixels: vec2f, time: f32 }
@group(0) @binding(0) var<uniform> nsh: Frame;
@group(0) @binding(1) var<uniform> uniforms: Uniforms;

@vertex fn vertex(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  let p = vec2f(f32((i << 1u) & 2u), f32(i & 2u));
  return vec4f(p * 2.0 - 1.0, 0.0, 1.0);
}
@fragment fn fragment(@builtin(position) at: vec4f) -> @location(0) vec4f {
  return shade(at.xy / nsh.pixels);
}`;

function rgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
}

export async function startNight(canvas: HTMLCanvasElement) {
  const adapter = await navigator.gpu?.requestAdapter().catch(() => null);
  const device = await adapter?.requestDevice().catch(() => null);
  const context = canvas.getContext('webgpu');
  if (!device || !context) return;

  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({ device, format, alphaMode: 'opaque' });
  const module = device.createShaderModule({ code: SCENE + PRELUDE });
  const pipeline = await device.createRenderPipelineAsync({
    layout: 'auto',
    vertex: { module, entryPoint: 'vertex' },
    fragment: { module, entryPoint: 'fragment', targets: [{ format }] },
  }).catch(() => null);
  if (!pipeline) return;

  const frame = device.createBuffer({ size: 32, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const colors = device.createBuffer({ size: 64, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  device.queue.writeBuffer(colors, 0, new Float32Array(COLORS.flatMap(rgb)));
  const bindings = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [{ binding: 0, resource: { buffer: frame } }, { binding: 1, resource: { buffer: colors } }],
  });

  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let width = 0, height = 0, visible = true, raf = 0;
  const start = performance.now();

  function draw(now: number) {
    raf = 0;
    if (!width || !height) return;
    const time = still.matches ? STILL_TIME : (now - start) / 1000;
    device!.queue.writeBuffer(frame, 0, new Float32Array([width, height, canvas.width, canvas.height, time]));
    const encoder = device!.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{ view: context!.getCurrentTexture().createView(), loadOp: 'clear', storeOp: 'store' }],
    });
    pass.setPipeline(pipeline!);
    pass.setBindGroup(0, bindings);
    pass.draw(3);
    pass.end();
    device!.queue.submit([encoder.finish()]);
    canvas.classList.add('ready');
    schedule();
  }
  function schedule() {
    if (!raf && visible && !document.hidden && !still.matches) raf = requestAnimationFrame(draw);
  }
  function redraw() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(draw);
  }

  new ResizeObserver(([entry]) => {
    ({ width, height } = entry.contentRect);
    const scale = Math.min(devicePixelRatio, MAX_SCALE);
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    redraw();
  }).observe(canvas);
  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; schedule(); }).observe(canvas);
  document.addEventListener('visibilitychange', schedule);
  still.addEventListener('change', redraw);
}
