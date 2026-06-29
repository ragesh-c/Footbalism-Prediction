// ─────────────────────────────────────────────
//  fx-background.js — Cursor-reactive painted hero texture
//  Three.js full-screen shader quad: domain-warped fbm "paint"
//  in the brand palette, locally swirled and lit by the cursor.
//
//  Perf guards: Three.js (~600KB) is dynamically imported only on
//  fine-pointer devices, after window load + idle, so it never
//  competes with the LCP and never ships to phones (no cursor to
//  react to there). DPR capped, rendering paused when the hero is
//  off-screen or the tab is hidden, skipped for reduced motion,
//  silent no-op if WebGL/CDN is unavailable.
// ─────────────────────────────────────────────

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js";

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 1.0);
  }
`;

const FRAG = /* glsl */`
  precision highp float;

  uniform float uTime;
  uniform vec2  uRes;
  uniform vec2  uMouse;       // 0..1, aspect-corrected in shader
  uniform float uMouseGlow;   // rises with pointer speed, decays

  varying vec2 vUv;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i),                 hash(i + vec2(1.0, 0.0)), u.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
    for (int i = 0; i < 4; i++) {
      v += a * noise(p);
      p = rot * p * 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    float aspect = uRes.x / max(uRes.y, 1.0);
    vec2 p = vUv * vec2(aspect, 1.0) * 1.7;
    vec2 m = uMouse * vec2(aspect, 1.0) * 1.7;
    float t = uTime * 0.045;

    // Cursor field: tight falloff, swirls the paint around the pointer.
    // The smoothstep fades the swirl out at the very center, avoiding a
    // pinch artifact where the direction vector degenerates.
    float md = distance(p, m);
    float influence = exp(-md * 2.4);
    vec2 away = (p - m) / max(md, 0.001);
    vec2 swirl = vec2(-away.y, away.x) * influence * smoothstep(0.0, 0.22, md)
               * (0.35 + uMouseGlow * 0.5);

    // Domain-warped fbm — the "painted" body
    vec2 q = vec2(
      fbm(p + t),
      fbm(p + vec2(5.2, 1.3) - t * 0.7)
    );
    vec2 r = vec2(
      fbm(p + 1.8 * q + vec2(1.7, 9.2) + 0.12 * t),
      fbm(p + 1.8 * q + vec2(8.3, 2.8) - 0.10 * t)
    );
    r += swirl;
    float f = fbm(p + 1.9 * r);

    // Brand palette: deep navy → royal blue → trophy gold, a breath of red
    vec3 navy = vec3(0.039, 0.055, 0.102);
    vec3 blue = vec3(0.114, 0.239, 0.561);
    vec3 gold = vec3(0.957, 0.773, 0.259);
    vec3 red  = vec3(0.902, 0.224, 0.275);

    vec3 col = mix(navy, blue, smoothstep(0.15, 0.75, f));
    col = mix(col, gold, smoothstep(0.45, 0.9, f * f + influence * 0.4) * 0.5);
    col = mix(col, red,  smoothstep(0.72, 0.95, q.y) * 0.18);

    // Cursor light: warm bloom that follows the pointer
    col += gold * influence * (0.18 + uMouseGlow * 0.55);

    // Vignette so edges melt into the hero
    float vig = smoothstep(1.25, 0.45, distance(vUv, vec2(0.5)));
    col *= vig;

    gl_FragColor = vec4(col, 1.0);
  }
`;

const PaintedBackground = (() => {
  let renderer, scene, camera, material;
  let container = null;
  let running = false;
  let inView = true;
  let rafId = 0;

  // Pointer state (lerped each frame for that painty lag)
  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5, glow: 0, lastX: 0.5, lastY: 0.5 };

  let THREE = null;

  function init(threeModule) {
    THREE = threeModule;
    container = document.getElementById("paint-bg");
    if (!container) return;

    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: "low-power" });
    } catch {
      return; // no WebGL — hero gradient layers carry the design alone
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    resize();
    container.appendChild(renderer.domElement);

    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uTime:      { value: 0 },
        uRes:       { value: new THREE.Vector2(1, 1) },
        uMouse:     { value: new THREE.Vector2(0.5, 0.5) },
        uMouseGlow: { value: 0 }
      }
    });
    scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));

    syncResolution();
    window.addEventListener("resize", () => { resize(); syncResolution(); }, { passive: true });
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    // Only burn GPU while the hero is actually visible
    const hero = document.getElementById("hero");
    if (hero && "IntersectionObserver" in window) {
      new IntersectionObserver(entries => {
        inView = entries[0].isIntersecting;
        toggle();
      }, { threshold: 0.02 }).observe(hero);
    }
    document.addEventListener("visibilitychange", toggle);

    toggle();
  }

  function onPointerMove(e) {
    const rect = container.getBoundingClientRect();
    if (rect.bottom < 0) return;
    mouse.tx = (e.clientX - rect.left) / Math.max(rect.width, 1);
    mouse.ty = 1 - (e.clientY - rect.top) / Math.max(rect.height, 1);
    const dx = mouse.tx - mouse.lastX;
    const dy = mouse.ty - mouse.lastY;
    mouse.glow = Math.min(1, mouse.glow + Math.hypot(dx, dy) * 6);
    mouse.lastX = mouse.tx;
    mouse.lastY = mouse.ty;
  }

  function resize() {
    if (!renderer || !container) return;
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
  }

  function syncResolution() {
    if (!material || !container) return;
    material.uniforms.uRes.value.set(container.clientWidth || 1, container.clientHeight || 1);
  }

  function toggle() {
    const shouldRun = inView && !document.hidden;
    if (shouldRun && !running) {
      running = true;
      rafId = requestAnimationFrame(loop);
    } else if (!shouldRun && running) {
      running = false;
      cancelAnimationFrame(rafId);
    }
  }

  function loop(now) {
    if (!running) return;
    renderFrame(now);
    rafId = requestAnimationFrame(loop);
  }

  function renderFrame(now) {
    // Painty cursor lag + glow decay
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;
    mouse.glow *= 0.95;

    material.uniforms.uTime.value = now * 0.001;
    material.uniforms.uMouse.value.set(mouse.x, mouse.y);
    material.uniforms.uMouseGlow.value = mouse.glow;
    renderer.render(scene, camera);
  }

  return { init };
})();

// ── Bootstrap: only where it earns its keep ──
(() => {
  function start() {
    if (!window.matchMedia("(pointer: fine)").matches) return;        // no cursor, no effect
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!document.getElementById("paint-bg")) return;
    const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 350));
    idle(() => {
      import(THREE_URL)
        .then(three => PaintedBackground.init(three))
        .catch(() => {}); // CDN blocked — hero gradient layers carry the design
    });
  }

  if (document.readyState === "complete") {
    start();
  } else {
    window.addEventListener("load", start, { once: true });
  }
})();

window.__paintFX = PaintedBackground;
