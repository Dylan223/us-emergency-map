// ocean.js
// Animated cyan ocean glow that sits behind the map tiles.
// The land tiles (CARTO Dark Matter) blend over the top with
// mix-blend-mode: screen, so the canvas brightness only shows
// in the darker ocean pixels, not the pure-black land.

(function () {
  "use strict";

  const canvas = document.getElementById("ocean-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let W = 0, H = 0;

  // 4 large soft "glow" blobs that drift in figure-8 paths.
  // Each is a radial gradient — when summed they create gently moving
  // patches of brighter cyan across the whole map.
  const BLOBS = [
    { cx: 0.20, cy: 0.30, r: 0.55, speed: 0.000045, phase: 0.0,  hue: [10,  150, 195] },
    { cx: 0.75, cy: 0.40, r: 0.50, speed: 0.000055, phase: 1.7,  hue: [25,  175, 220] },
    { cx: 0.50, cy: 0.75, r: 0.60, speed: 0.000035, phase: 3.1,  hue: [5,   120, 175] },
    { cx: 0.85, cy: 0.20, r: 0.45, speed: 0.000065, phase: 4.6,  hue: [40,  200, 240] },
  ];

  // Sparkle highlights — small bright dots, sparse, slow flicker.
  const SPARKLES = Array.from({ length: 90 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 0.5 + Math.random() * 1.4,
    speed: 0.0005 + Math.random() * 0.0015,
    phase: Math.random() * Math.PI * 2,
    alpha: 0.08 + Math.random() * 0.20,
  }));

  function resize() {
    const wrap = canvas.parentElement;
    if (!wrap) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = wrap.offsetWidth;
    H = wrap.offsetHeight;
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    canvas.width  = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function drawFrame(t) {
    if (W === 0 || H === 0) {
      requestAnimationFrame(drawFrame);
      return;
    }

    // Base ocean color — deep teal/cyan. This is what shows everywhere
    // the tiles haven't loaded, AND is what "screen" blends with the
    // dark ocean tile pixels.
    ctx.fillStyle = "#04243a";
    ctx.fillRect(0, 0, W, H);

    // Drifting glow blobs — each follows a slow elliptical path.
    for (const b of BLOBS) {
      const a = t * b.speed + b.phase;
      const driftX = Math.sin(a) * 0.10;
      const driftY = Math.cos(a * 0.7) * 0.08;
      const cx = (b.cx + driftX) * W;
      const cy = (b.cy + driftY) * H;
      const radius = b.r * Math.min(W, H);

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
      const [r, g, bl] = b.hue;
      grad.addColorStop(0,    `rgba(${r}, ${g}, ${bl}, 0.55)`);
      grad.addColorStop(0.4,  `rgba(${r}, ${g}, ${bl}, 0.22)`);
      grad.addColorStop(1,    `rgba(${r}, ${g}, ${bl}, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, H);
    }

    // Sparkle glints — tiny bright dots flickering. Adds subtle motion
    // even in calm patches of the map.
    for (const sp of SPARKLES) {
      const pulse = 0.5 + 0.5 * Math.sin(t * sp.speed * 4 + sp.phase);
      if (pulse < 0.4) continue; // skip when dim, saves draws
      const drift = Math.sin(t * sp.speed * 0.6 + sp.phase) * 6;
      ctx.fillStyle = `rgba(160, 230, 255, ${sp.alpha * pulse})`;
      ctx.beginPath();
      ctx.arc(sp.x * W, sp.y * H + drift, sp.r * pulse, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(drawFrame);
  }

  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(drawFrame);
})();
