// ocean.js — animated cyan/teal ocean shimmer canvas
// Renders behind the Leaflet tile pane using mix-blend-mode: lighten
// so it only shows through the (near-transparent after filter) ocean areas.

(function () {
  "use strict";

  const canvas = document.getElementById("ocean-canvas");
  if (!canvas) return;

  const ctx = canvas.getContext("2d");
  let W, H, t = 0;

  // Wave layers — each has its own speed, amplitude, wavelength, opacity
  const WAVES = [
    { speed: 0.00018, amp: 0.008, freq: 3.1,  phase: 0,    alpha: 0.045, color: [0, 180, 220] },
    { speed: 0.00024, amp: 0.005, freq: 5.7,  phase: 1.2,  alpha: 0.035, color: [0, 212, 255] },
    { speed: 0.00013, amp: 0.012, freq: 2.0,  phase: 2.5,  alpha: 0.030, color: [0, 150, 200] },
    { speed: 0.00031, amp: 0.003, freq: 9.4,  phase: 0.8,  alpha: 0.025, color: [80, 220, 255] },
    { speed: 0.00010, amp: 0.018, freq: 1.3,  phase: 3.8,  alpha: 0.020, color: [0, 100, 160] },
  ];

  // Subtle sparkle points
  const SPARKLES = Array.from({ length: 120 }, () => ({
    x: Math.random(),
    y: Math.random(),
    r: 0.4 + Math.random() * 1.2,
    speed: 0.0004 + Math.random() * 0.0012,
    phase: Math.random() * Math.PI * 2,
    alpha: 0.05 + Math.random() * 0.18,
  }));

  function resize() {
    const wrap = canvas.parentElement;
    W = canvas.width  = wrap.offsetWidth;
    H = canvas.height = wrap.offsetHeight;
  }

  function drawFrame(ts) {
    t = ts;
    ctx.clearRect(0, 0, W, H);

    // Deep ocean base gradient — very dark, almost invisible under land tiles
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0,   "rgba(2, 12, 22, 0.92)");
    grad.addColorStop(0.5, "rgba(3, 18, 30, 0.88)");
    grad.addColorStop(1,   "rgba(1,  8, 16, 0.95)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Animated wave bands — horizontal sine strips
    for (const wave of WAVES) {
      const [r, g, b] = wave.color;
      const phaseOffset = t * wave.speed + wave.phase;
      const stripH = H * 0.015; // height of each sine strip

      ctx.save();
      ctx.globalAlpha = wave.alpha;

      // Draw multiple sine-displaced horizontal lines across the canvas
      const lineCount = Math.ceil(H / (stripH * 3));
      for (let i = 0; i < lineCount; i++) {
        const baseY = (i / lineCount) * H;
        ctx.beginPath();

        for (let x = 0; x <= W; x += 3) {
          const nx = x / W;
          // Two overlapping sines for organic feel
          const y = baseY
            + Math.sin(nx * wave.freq * Math.PI * 2 + phaseOffset) * H * wave.amp
            + Math.sin(nx * wave.freq * 0.61 * Math.PI * 2 + phaseOffset * 1.3) * H * wave.amp * 0.4;

          if (x === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        // Close into a thin filled band
        ctx.lineTo(W, baseY + stripH);
        ctx.lineTo(0, baseY + stripH);
        ctx.closePath();
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fill();
      }
      ctx.restore();
    }

    // Sparkle glints — tiny bright dots that pulse
    for (const sp of SPARKLES) {
      const px = sp.x * W;
      const py = sp.y * H
        + Math.sin(t * sp.speed * 0.7 + sp.phase) * H * 0.006
        + Math.sin(t * 0.00008 + sp.phase * 2.1) * H * 0.004;

      const pulse = 0.5 + 0.5 * Math.sin(t * sp.speed * 6 + sp.phase);
      const alpha = sp.alpha * pulse;

      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#a0eeff";
      ctx.beginPath();
      ctx.arc(px, py, sp.r * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Subtle vignette — darkens edges so the glow feels "open water"
    const vig = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.85);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();

    requestAnimationFrame(drawFrame);
  }

  // Boot
  resize();
  window.addEventListener("resize", resize);
  requestAnimationFrame(drawFrame);
})();
