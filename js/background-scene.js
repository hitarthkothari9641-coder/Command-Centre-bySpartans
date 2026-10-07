/**
 * Background scene — "surveillance control room meets cyber-tech reality show".
 *
 * Bundled with esbuild into vendor/background.bundle.js so the app ships a
 * tree-shaken (~120 KB) Three.js bundle instead of the full 2 MB library:
 *
 *    npm run build:vendor
 *
 * Visual language: a holographic grid floor receding to the horizon, a slow
 * drifting node network (constellation mesh) and a faint scanning "eye" motif
 * in the deep background. Everything is deliberately low-contrast so it reads
 * as atmosphere, never as content.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Clock,
  Color,
  Group,
  LineBasicMaterial,
  LineSegments,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  WebGLRenderer,
} from 'three';

const CYAN = 0x22d3ee;
const VIOLET = 0x8b5cf6;

export function createBackground(canvas, options = {}) {
  const mobile = window.matchMedia('(max-width: 860px)').matches;
  const nodeCount = options.nodeCount ?? (mobile ? 34 : 72);
  const dustCount = options.dustCount ?? (mobile ? 260 : 720);
  const connectionDistance = 10.5;

  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2)); // cap DPR at 2
  renderer.setClearColor(0x000000, 0);

  const scene = new Scene();
  const camera = new PerspectiveCamera(58, 1, 0.1, 220);
  camera.position.set(0, 5.4, 20);
  camera.lookAt(0, 2.6, -6);

  const world = new Group();
  scene.add(world);

  /* ── Holographic grid floor ─────────────────────────────────────── */
  const grid = new Group();
  const half = 46;
  const step = 4;
  const linePoints = [];
  for (let i = -half; i <= half; i += step) {
    linePoints.push(-half, 0, i, half, 0, i); // lateral rails
    linePoints.push(i, 0, -half, i, 0, half); // depth rails
  }
  const gridGeometry = new BufferGeometry();
  gridGeometry.setAttribute('position', new BufferAttribute(new Float32Array(linePoints), 3));
  const gridLines = new LineSegments(
    gridGeometry,
    new LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.075, blending: AdditiveBlending, depthWrite: false }),
  );
  grid.add(gridLines);

  // Horizon wash so the floor dissolves into the dark instead of ending hard.
  const horizon = new LineSegments(
    new BufferGeometry().setAttribute(
      'position',
      new BufferAttribute(new Float32Array([-half, 0.02, -half, half, 0.02, -half]), 3),
    ),
    new LineBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.16, blending: AdditiveBlending, depthWrite: false }),
  );
  grid.add(horizon);
  grid.position.y = -3.2;
  world.add(grid);

  /* ── Drifting node network ──────────────────────────────────────── */
  const nodes = [];
  for (let i = 0; i < nodeCount; i += 1) {
    nodes.push({
      x: (Math.random() - 0.5) * 62,
      y: Math.random() * 22 - 3,
      z: (Math.random() - 0.5) * 54 - 6,
      vx: (Math.random() - 0.5) * 0.012,
      vy: 0.006 + Math.random() * 0.016,
      vz: (Math.random() - 0.5) * 0.012,
      cool: Math.random() > 0.72,
    });
  }

  const nodePositions = new Float32Array(nodes.length * 3);
  const nodeColors = new Float32Array(nodes.length * 3);
  const cyan = new Color(CYAN);
  const violet = new Color(VIOLET);
  nodes.forEach((n, i) => {
    nodeColors[i * 3] = n.cool ? violet.r : cyan.r;
    nodeColors[i * 3 + 1] = n.cool ? violet.g : cyan.g;
    nodeColors[i * 3 + 2] = n.cool ? violet.b : cyan.b;
  });

  const nodeGeometry = new BufferGeometry();
  nodeGeometry.setAttribute('position', new BufferAttribute(nodePositions, 3));
  nodeGeometry.setAttribute('color', new BufferAttribute(nodeColors, 3));
  const nodePoints = new Points(
    nodeGeometry,
    new PointsMaterial({
      size: 0.42,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      blending: AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    }),
  );
  world.add(nodePoints);

  // Constellation edges — rebuilt each frame from a capped pair budget.
  const maxEdges = mobile ? 160 : 420;
  const edgePositions = new Float32Array(maxEdges * 2 * 3);
  const edgeColors = new Float32Array(maxEdges * 2 * 3);
  const edgeGeometry = new BufferGeometry();
  edgeGeometry.setAttribute('position', new BufferAttribute(edgePositions, 3));
  edgeGeometry.setAttribute('color', new BufferAttribute(edgeColors, 3));
  const edgeLines = new LineSegments(
    edgeGeometry,
    new LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.3,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  world.add(edgeLines);

  /* ── Faint "eye" motif with a slow scan sweep ───────────────────── */
  const eye = new Group();
  eye.position.set(0, 7.5, -30);
  const ringPoints = [];
  const R = 11.5;
  for (let i = 0; i <= 180; i += 1) {
    const t = (i / 180) * Math.PI * 2;
    ringPoints.push(Math.cos(t) * R, Math.sin(t) * R * 0.44, 0);
  }
  const eyeRing = new LineSegments(
    new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array(ringPoints), 3)),
    new LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.1, blending: AdditiveBlending, depthWrite: false }),
  );
  eye.add(eyeRing);

  const scanSweep = new LineSegments(
    new BufferGeometry().setAttribute(
      'position',
      new BufferAttribute(new Float32Array([-R, 0, 0, R, 0, 0]), 3),
    ),
    new LineBasicMaterial({ color: VIOLET, transparent: true, opacity: 0.14, blending: AdditiveBlending, depthWrite: false }),
  );
  eye.add(scanSweep);

  const pupil = new Points(
    new BufferGeometry().setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0]), 3)),
    new PointsMaterial({ color: CYAN, size: 1.5, transparent: true, opacity: 0.28, blending: AdditiveBlending, depthWrite: false }),
  );
  eye.add(pupil);
  world.add(eye);

  /* ── Ambient dust ───────────────────────────────────────────────── */
  const dustPositions = new Float32Array(dustCount * 3);
  const dustSpeed = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i += 1) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 90;
    dustPositions[i * 3 + 1] = Math.random() * 30 - 4;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 80 - 6;
    dustSpeed[i] = 0.004 + Math.random() * 0.02;
  }
  const dustGeometry = new BufferGeometry();
  dustGeometry.setAttribute('position', new BufferAttribute(dustPositions, 3));
  const dust = new Points(
    dustGeometry,
    new PointsMaterial({
      color: 0x7dd3fc,
      size: 0.16,
      transparent: true,
      opacity: 0.4,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  world.add(dust);

  /* ── Sizing / lifecycle ─────────────────────────────────────────── */
  let width = 1;
  let height = 1;
  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    if (w === width && h === height) return;
    width = w;
    height = h;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize, { passive: true });

  const clock = new Clock();
  let raf = 0;
  let running = true;
  let t = 0;

  function updateEdges() {
    let e = 0;
    for (let i = 0; i < nodes.length && e < maxEdges; i += 1) {
      for (let j = i + 1; j < nodes.length && e < maxEdges; j += 1) {
        const dx = nodes[i].x - nodes[j].x;
        const dy = nodes[i].y - nodes[j].y;
        const dz = nodes[i].z - nodes[j].z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > connectionDistance * connectionDistance) continue;
        const fade = 1 - Math.sqrt(d2) / connectionDistance;
        const o = e * 6;
        edgePositions[o] = nodes[i].x;
        edgePositions[o + 1] = nodes[i].y;
        edgePositions[o + 2] = nodes[i].z;
        edgePositions[o + 3] = nodes[j].x;
        edgePositions[o + 4] = nodes[j].y;
        edgePositions[o + 5] = nodes[j].z;
        for (let k = 0; k < 2; k += 1) {
          edgeColors[o + k * 3] = cyan.r * fade * 0.9;
          edgeColors[o + k * 3 + 1] = cyan.g * fade * 0.9;
          edgeColors[o + k * 3 + 2] = cyan.b * fade * 0.9;
        }
        e += 1;
      }
    }
    edgeGeometry.setDrawRange(0, e * 2);
    edgeGeometry.attributes.position.needsUpdate = true;
    edgeGeometry.attributes.color.needsUpdate = true;
  }

  function frame() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    t += dt;

    // Camera breathes very slightly — enough to feel alive, never enough to notice.
    camera.position.x = Math.sin(t * 0.06) * 2.2;
    camera.position.y = 5.4 + Math.sin(t * 0.09) * 0.5;
    camera.lookAt(0, 2.6, -6);

    // Grid floor scrolls toward the viewer.
    grid.position.z = (grid.position.z + dt * 1.5) % step;

    // Nodes drift upward and wrap around.
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i];
      n.x += n.vx;
      n.y += n.vy;
      n.z += n.vz;
      if (n.y > 19) n.y = -3;
      if (n.x > 31) n.x = -31;
      if (n.x < -31) n.x = 31;
      if (n.z > 21) n.z = -33;
      if (n.z < -33) n.z = 21;
      nodePositions[i * 3] = n.x;
      nodePositions[i * 3 + 1] = n.y;
      nodePositions[i * 3 + 2] = n.z;
    }
    nodeGeometry.attributes.position.needsUpdate = true;
    updateEdges();

    // Dust rises, eye pulses and its scan line sweeps across the pupil.
    const dustAttr = dustGeometry.attributes.position;
    for (let i = 0; i < dustCount; i += 1) {
      const y = dustAttr.array[i * 3 + 1] + dustSpeed[i] * 12 * dt;
      dustAttr.array[i * 3 + 1] = y > 26 ? -4 : y;
    }
    dustAttr.needsUpdate = true;

    const pulse = 0.5 + Math.sin(t * 1.1) * 0.5;
    eyeRing.material.opacity = 0.07 + pulse * 0.06;
    pupil.material.opacity = 0.18 + pulse * 0.16;
    pupil.material.size = 1.2 + pulse * 0.6;
    scanSweep.position.y = Math.sin(t * 0.5) * R * 0.42;
    scanSweep.material.opacity = 0.08 + pulse * 0.08;

    world.rotation.y = Math.sin(t * 0.035) * 0.05;

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (running) return;
    running = true;
    clock.getDelta();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    cancelAnimationFrame(raf);
  }

  // Pause when the tab is hidden; also stop when the canvas is detached.
  document.addEventListener('visibilitychange', () => {
    document.hidden ? stop() : start();
  });

  renderer.render(scene, camera); // first paint immediately (no layout shift)
  if (!document.hidden) start();

  return {
    start,
    stop,
    dispose() {
      stop();
      window.removeEventListener('resize', resize);
      renderer.dispose();
      [gridGeometry, nodeGeometry, edgeGeometry, dustGeometry].forEach((g) => g.dispose());
    },
  };
}
