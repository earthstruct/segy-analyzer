// Pick "nice" tick values (1, 2, 5 x 10^k) inside [min, max].
export function niceTicks(min, max, count, minStep = 0) {
  const range = Math.max(max - min, 1e-12);
  const raw = range / Math.max(1, count);
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const nice = f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10;
  const step = Math.max(nice * pow, minStep);
  const decimals = Math.max(0, Math.ceil(-Math.log10(step) - 1e-9));
  const values = [];
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) {
    values.push(Math.round(v / step) * step);
  }
  return { values, decimals };
}

export function sectionViewer(
  section,
  { width = 900, height = 600, contrast = 0.2, brightness = 0.5, smooth = true, invert = false } = {}
) {
  const margin = { top: 10, right: 15, bottom: 48, left: 62 };
  const pw = Math.max(50, width - margin.left - margin.right); // plot area size in canvas pixels
  const ph = Math.max(50, height - margin.top - margin.bottom);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.style.cssText = "display:block;width:100%;max-width:" + width + "px;cursor:grab;touch-action:none";
  const ctx = canvas.getContext("2d");

  const cols = section.cols.length;
  const rows = section.cols[0].length;

  // Render the amplitude data once into an offscreen canvas.
  const off = document.createElement("canvas");
  off.width = cols;
  off.height = rows;
  const octx = off.getContext("2d");
  const img = octx.createImageData(cols, rows);
  const range = section.max - section.min || 1;
  // (Re)render the grey scale image; needed again only when contrast, brightness or invert change.
  function renderImage() {
    const stretch = (v) => (v - 127.5 + (brightness - 0.5) * 255) / (1 - contrast) + 127.5;
    for (let x = 0; x < cols; x++) {
      const col = section.cols[x];
      for (let y = 0; y < rows; y++) {
        const g = Math.max(0, Math.min(255, stretch(((col[y] - section.min) / range) * 255)));
        const i = (y * cols + x) * 4;
        const v = invert ? 255 - g : g;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
    }
    octx.putImageData(img, 0, 0);
  }
  renderImage();

  // Scale x and y independently so the section always fills the plot area.
  // Zoom changes both by the same factor. tx, ty are relative to the plot area origin.
  const fit = () => ({ sx: pw / cols, sy: ph / rows });
  let { sx, sy } = fit();
  let tx = 0, ty = 0;
  const reset = () => { ({ sx, sy } = fit()); tx = ty = 0; draw(); };

  // Image column c (continuous, cell i centered at i + 0.5) <-> trace number, row r <-> time in s.
  const traceAt = (c) => section.first + (c - 0.5) * section.tStep;
  const colOf = (trace) => (trace - section.first) / section.tStep + 0.5;
  const timeAt = (r) => (r - 0.5) * section.dt;
  const rowOf = (time) => time / section.dt + 0.5;

  function draw() {
    const cs = getComputedStyle(canvas);
    const fg = cs.color || "#888";
    const font = `12px ${cs.fontFamily || "sans-serif"}`;
    ctx.clearRect(0, 0, width, height);

    // image, clipped to the plot area
    ctx.save();
    ctx.beginPath();
    ctx.rect(margin.left, margin.top, pw, ph);
    ctx.clip();
    ctx.imageSmoothingEnabled = smooth;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(off, margin.left + tx, margin.top + ty, cols * sx, rows * sy);
    ctx.restore();

    // axes
    ctx.strokeStyle = fg;
    ctx.fillStyle = fg;
    ctx.lineWidth = 1;
    ctx.font = font;
    ctx.globalAlpha = 0.7;
    ctx.strokeRect(margin.left + 0.5, margin.top + 0.5, pw, ph);

    // horizontal axis: trace number
    const c0 = (0 - tx) / sx, c1 = (pw - tx) / sx;
    const xt = niceTicks(Math.min(traceAt(c0), traceAt(c1)), Math.max(traceAt(c0), traceAt(c1)), Math.floor(pw / 90), 1);
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const v of xt.values) {
      const px = Math.round(margin.left + tx + colOf(v) * sx) + 0.5;
      if (px < margin.left || px > margin.left + pw) continue;
      ctx.beginPath();
      ctx.moveTo(px, margin.top + ph);
      ctx.lineTo(px, margin.top + ph + 5);
      ctx.stroke();
      ctx.fillText(v.toFixed(xt.decimals), px, margin.top + ph + 8);
    }

    // vertical axis: time in s, increasing downwards
    const r0 = (0 - ty) / sy, r1 = (ph - ty) / sy;
    const yt = niceTicks(Math.min(timeAt(r0), timeAt(r1)), Math.max(timeAt(r0), timeAt(r1)), Math.floor(ph / 45));
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (const v of yt.values) {
      const py = Math.round(margin.top + ty + rowOf(v) * sy) + 0.5;
      if (py < margin.top || py > margin.top + ph) continue;
      ctx.beginPath();
      ctx.moveTo(margin.left - 5, py);
      ctx.lineTo(margin.left, py);
      ctx.stroke();
      ctx.fillText(v.toFixed(yt.decimals), margin.left - 8, py);
    }

    // axis titles
    ctx.globalAlpha = 1;
    ctx.textAlign = "center";
    ctx.textBaseline = "bottom";
    ctx.fillText("trace No", margin.left + pw / 2, height - 3);
    ctx.save();
    ctx.translate(13, margin.top + ph / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textBaseline = "top";
    ctx.fillText("time in s", 0, 0);
    ctx.restore();

    drawLegend(fg, font);
  }

  // Amplitude color scale in the top left corner of the plot, as in the original notebook.
  // Vertical bar spanning the amplitudes that map to black and white after contrast and brightness.
  // Plain decimal labels (no scientific notation) with about 3 significant digits.
  const formatAmp = (v) => {
    if (v === 0) return "0";
    const digits = Math.min(20, Math.max(0, 2 - Math.floor(Math.log10(Math.abs(v)))));
    const s = v.toFixed(digits);
    return s.includes(".") ? s.replace(/\.?0+$/, "") : s;
  };
  function pageBackground(fg) {
    for (const el of [document.body, document.documentElement]) {
      const c = getComputedStyle(el).backgroundColor;
      if (c && c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c)) return c;
    }
    const m = /\d+/.exec(fg || "");
    return m && +m[0] > 128 ? "#14171c" : "#ffffff"; // light text implies a dark page
  }
  function drawLegend(fg, font) {
    const bw = 14, bh = 100, pad = 6, gap = 7;
    const bx = margin.left + 10, by = margin.top + 10;
    const ampAt = (G) =>
      section.min + (((G - 127.5) * (1 - contrast) + 127.5 - (brightness - 0.5) * 255) / 255) * range;
    const a0 = ampAt(0), a1 = ampAt(255);
    if (!(a1 > a0)) return;
    const top = formatAmp(a1), bottom = formatAmp(a0);

    ctx.save();
    ctx.font = font;
    const textW = (s) => (ctx.measureText(s) || { width: 40 }).width;
    const labelW = Math.max(textW(top), textW(bottom));
    const inner = Math.max(textW("amplitude"), bw + gap + labelW);
    const boxW = inner + 2 * pad, boxH = pad + 16 + bh + pad;

    ctx.globalAlpha = 0.8;
    ctx.fillStyle = pageBackground(fg);
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.globalAlpha = 1;
    ctx.fillStyle = fg;
    ctx.strokeStyle = fg;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("amplitude", bx + pad, by + pad);

    const gx = bx + pad, gy = by + pad + 16;
    const grad = ctx.createLinearGradient(0, gy, 0, gy + bh);
    grad.addColorStop(0, invert ? "#000000" : "#ffffff"); // high amplitude at the top
    grad.addColorStop(1, invert ? "#ffffff" : "#000000");
    ctx.fillStyle = grad;
    ctx.fillRect(gx, gy, bw, bh);
    ctx.fillStyle = fg;
    ctx.globalAlpha = 0.7;
    ctx.strokeRect(gx + 0.5, gy + 0.5, bw, bh);
    ctx.globalAlpha = 1;

    // labeled ticks at the two extremes only
    for (const y of [gy + 0.5, gy + bh + 0.5]) {
      ctx.beginPath();
      ctx.moveTo(gx + bw, y);
      ctx.lineTo(gx + bw + 4, y);
      ctx.stroke();
    }
    ctx.textBaseline = "top";
    ctx.fillText(top, gx + bw + gap, gy);
    ctx.textBaseline = "bottom";
    ctx.fillText(bottom, gx + bw + gap, gy + bh);
    ctx.restore();
  }

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    const r = canvas.getBoundingClientRect();
    const mx = ((e.clientX - r.left) / r.width) * width - margin.left;
    const my = ((e.clientY - r.top) / r.height) * height - margin.top;
    const k = Math.exp(-e.deltaY * 0.001);
    tx = mx - (mx - tx) * k;
    ty = my - (my - ty) * k;
    sx *= k;
    sy *= k;
    draw();
  }, { passive: false });

  let drag = null;
  canvas.addEventListener("pointerdown", (e) => {
    drag = { x: e.clientX, y: e.clientY, tx, ty };
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = "grabbing";
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const r = canvas.getBoundingClientRect();
    tx = drag.tx + ((e.clientX - drag.x) / r.width) * width;
    ty = drag.ty + ((e.clientY - drag.y) / r.height) * height;
    draw();
  });
  const endDrag = () => { drag = null; canvas.style.cursor = "grab"; };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("dblclick", reset);

  // Axis colors come from the page's text color, so redraw when the theme changes.
  const redraw = () => { if (canvas.isConnected) draw(); else stop(); };
  const observer = new MutationObserver(redraw);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", redraw);
  function stop() {
    observer.disconnect();
    media.removeEventListener("change", redraw);
  }

  // Change display options in place, keeping the current zoom and pan.
  canvas.update = (o = {}) => {
    const imageChanged =
      (o.contrast !== undefined && o.contrast !== contrast) ||
      (o.brightness !== undefined && o.brightness !== brightness) ||
      (o.invert !== undefined && o.invert !== invert);
    if (o.contrast !== undefined) contrast = o.contrast;
    if (o.brightness !== undefined) brightness = o.brightness;
    if (o.invert !== undefined) invert = o.invert;
    if (o.smooth !== undefined) smooth = o.smooth;
    if (imageChanged) renderImage();
    draw();
  };

  draw();
  requestAnimationFrame(draw); // once attached, the computed text color is available
  return canvas;
}
