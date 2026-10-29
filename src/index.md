---
title: SEG-Y analyzer
---

# SEG-Y analyzer

Analyse SEG-Y files. Files are not uploaded to a server; they are read locally by your browser.
Big and little endian files are both handled, as are ASCII and EBCDIC text headers.
An EBCDIC textual 3200 byte header and a 400 byte binary header are expected to exist. A future option is to add a switch to enable Seismic Unix, or other formats, which do not have these headers, but have existing 240 byte trace headers.

## 1. Provide file

```js
import * as Plot from "npm:@observablehq/plot";
import {SegY, readFile, FORMATS} from "./components/segy.js";
import {decodeTextHeader} from "./components/ebcdic.js";
import {sectionViewer} from "./components/sectionViewer.js";
import {TRACE_HEADER_FIELDS} from "./components/traceHeaderFields.js";
import {BINARY_HEADER_FIELDS} from "./components/binaryHeaderFields.js";

const fileInput = Inputs.file({label: "SEG-Y file", accept: ".sgy,.segy"});
const file = Generators.input(fileInput);
```

```js
view(fileInput)
```

```js
const exampleName = "stk00819t_first5.sgy";
const sourceName = file ? file.name : `${exampleName} (included example file)`;
const progress = display(html`<progress value=0 max=1 style="width:100%"></progress>`);
const segy = new SegY(
  file
    ? await readFile(file, (p) => (progress.value = p))
    : await FileAttachment("data/stk00819t_first5.sgy").arrayBuffer()
);
progress.remove();
```

```js
display(html`<p>File <b>${sourceName}</b> has <b>${segy.buffer.byteLength.toLocaleString()}</b> bytes, ${segy.traceCount.toLocaleString()} traces.${file ? "" : " Choose a file above to analyse your own data instead."}</p>`);
```

## 2. Text header

```js
if (segy) {
  const h = decodeTextHeader(segy.buffer);
  display(html`<p>Encoding detected: <b>${h.encoding}</b></p>
    <pre style="font-size:10px;line-height:1.2">${h.lines.join("\n")}</pre>`);
}
```

## 3. Binary Header

```js
const customOffsetInput = Inputs.number([1, 399], {label: "custom offset", value: 27, step: 1, placeholder: "1 to 399"});
const customOffset = Generators.input(customOffsetInput);
```

```js
view(customOffsetInput)
```

```js
if (segy) {
  const b = segy.binary;
  const rows = [
    {offset: "1-4", description: "job id", value: b.jobId},
    {offset: "5-8", description: "(in-)line number", value: b.lineNo},
    {offset: "9-12", description: "reel number", value: b.reelNo},
    {offset: "17-18", description: "sample interval in µs", value: b.dt},
    {offset: "21-22", description: "number of samples", value: b.ns},
    {offset: "25-26", description: "data format code", value: `${b.format} (${segy.fmt.txt})`},
    {offset: "301-302", description: "SEG-Y revision", value: `${b.revMajor}.${b.revMinor}`},
    {offset: "303-304", description: "trace length fixed", value: `${b.fixedLength} (${b.fixedLength ? "use 21-22" : "use 115-116 in trace header"})`},
    {offset: "-", description: "byte order", value: segy.littleEndian ? "little endian" : "big endian"}
  ];
  if (Number.isInteger(customOffset) && customOffset >= 1 && customOffset <= 399) {
    const c = segy.binaryValue(customOffset);
    rows.push({offset: `${customOffset}-${customOffset + 1}`, description: "custom field 16bit", value: c.int16 ?? "out of range"});
    rows.push({offset: `${customOffset}-${customOffset + 3}`, description: "custom field 32bit", value: c.int32 ?? "out of range"});
  } else {
    rows.push({offset: "-", description: "custom field", value: "enter an offset from 1 to 399"});
  }
  display(Inputs.table(rows, {layout: "auto", rows: 20}));
}
```

## 4. Trace Header Values and Plots

Values of the trace header fields for the first trace, the selected trace, and the last trace. The custom offset adds 16 bit and 32 bit values at any byte offset of the 240 byte trace header.

```js
const traceInput = Inputs.range([1, segy?.traceCount ?? 1], {label: "trace to analyse", step: 1, value: Math.floor((segy?.traceCount ?? 1) / 2)});
const traceNo = Generators.input(traceInput);
```

```js
view(traceInput)
```

```js
const traceOffsetInput = Inputs.number([1, 237], {label: "custom offset", value: 21, step: 1, placeholder: "1 to 237"});
const traceOffset = Generators.input(traceOffsetInput);
```

```js
view(traceOffsetInput)
```

```js
if (segy) {
  const last = segy.traceCount;
  const custom = Number.isInteger(traceOffset) && traceOffset >= 1 && traceOffset <= 237;
  const rows = [];
  if (custom) {
    rows.push({offset: traceOffset, shortName: "custom 16 bit",
      first: segy.headerInt(1, traceOffset, 2), value: segy.headerInt(traceNo, traceOffset, 2), last: segy.headerInt(last, traceOffset, 2)});
    rows.push({offset: traceOffset, shortName: "custom 32 bit",
      first: segy.headerInt(1, traceOffset, 4), value: segy.headerInt(traceNo, traceOffset, 4), last: segy.headerInt(last, traceOffset, 4)});
  } else {
    rows.push({offset: "-", shortName: "custom", first: "enter an offset from 1 to 237", value: "", last: ""});
  }
  for (const f of TRACE_HEADER_FIELDS) {
    rows.push({offset: f.offset, shortName: f.name,
      first: segy.headerValue(1, f), value: segy.headerValue(traceNo, f), last: segy.headerValue(last, f)});
  }
  display(Inputs.table(rows, {rows: 20, layout: "auto"}));
}
```

```js
const xInput = Inputs.number([1, 237], {label: "offset for x", value: 73, step: 4});
const yInput = Inputs.number([1, 237], {label: "offset for y", value: 77, step: 4});
const offsetX = Generators.input(xInput);
const offsetY = Generators.input(yInput);
```

```js
view(xInput); view(yInput);
```

```js
if (segy) {
  const pts = segy.coordinates(offsetX, offsetY);
  display(html`<p>${pts.length.toLocaleString()} of ${segy.traceCount.toLocaleString()} traces shown</p>`);
  display(Plot.plot({
    width,
    height: 400,
    grid: true,
    inset: 10,
    x: {label: `offset ${offsetX}`},
    y: {label: `offset ${offsetY}`},
    marks: [Plot.dot(pts, {x: "x", y: "y", r: 1.5, fill: "steelblue", tip: true})]
  }));
}
```

## 5. Trace Data

Shows the trace selected in section 4.

```js
if (segy) {
  const s = segy.samples(traceNo);
  const n = s.values.length;
  const maxSamples = Math.min(500, n);
  const stride = Math.max(1, Math.floor(n / maxSamples));

  display(Inputs.table([{"samples min": s.min, "samples max": s.max}]));

  // Histogram of up to 500 non-zero samples
  const nonZero = [];
  for (let i = 0; i < n; i += stride) if (s.values[i] !== 0) nonZero.push(s.values[i]);
  display(Plot.plot({
    width,
    height: 140,
    title: `histogram (zeros not counted), ${nonZero.length} out of ${n} samples`,
    y: {label: "count"},
    x: {label: "amplitude"},
    marks: [Plot.rectY(nonZero, Plot.binX({y: "count"}, {thresholds: 30, fill: "steelblue", tip: true}))]
  }));

  // Color coded amplitude strip, one cell per (subsampled) sample
  const strip = [];
  for (let i = 0; i < n; i += stride) strip.push({index: i, data: s.values[i]});
  display(Plot.plot({
    width,
    height: 90,
    marginBottom: 35,
    x: {label: "sample number"},
    y: {axis: null},
    color: {type: "linear", scheme: "ylgnbu", legend: true, label: "amplitude"},
    marks: [Plot.rect(strip, {x1: "index", x2: (d) => d.index + stride, fill: "data", tip: true})]
  }));
}
```

## 6. Section

```js
const centerInput = Inputs.range([1, segy?.traceCount ?? 1], {label: "center trace", step: 1, value: Math.floor((segy?.traceCount ?? 1) / 2)});
const contrastInput = Inputs.range([0, 0.9], {label: "contrast", step: 0.05, value: 0.2});
const brightnessInput = Inputs.range([0.1, 0.9], {label: "brightness", step: 0.02, value: 0.5});
const smoothInput = Inputs.toggle({label: "smooth samples", value: true});
const invertInput = Inputs.toggle({label: "invert grey scale", value: false});
const center = Generators.input(centerInput);
const contrast = Generators.input(contrastInput);
const brightness = Generators.input(brightnessInput);
const smooth = Generators.input(smoothInput);
const invert = Generators.input(invertInput);
```

```js
view(centerInput); view(contrastInput); view(brightnessInput); view(smoothInput); view(invertInput);
```

```js
// Rebuilt only when the file, center trace or page width changes.
const section = segy.section(center);
display(html`<p>${section.cols.length} traces by ${section.cols[0].length} samples, time step ${section.dt.toFixed(4)} s.</p>`);
const viewer = display(sectionViewer(section, {width}));
display(html`<small>Wheel to zoom, drag to pan, double click to reset.</small>`);
```

```js
// Contrast, brightness, smooth and invert update the existing view, so zoom and pan are kept.
viewer.update({contrast, brightness, smooth, invert});
```

## SEG-Y trace header table

The 87 trace header fields of the SEG-Y specification.

```js
display(Inputs.table(TRACE_HEADER_FIELDS.map((f) => ({
  offset: f.range,
  size: f.size,
  name: f.name,
  description: f.description
})), {rows: 100, layout: "auto", width: {description: 520}}));
```

## SEG-Y Binary Header table

```js
display(Inputs.table(BINARY_HEADER_FIELDS, {rows: 100, layout: "auto", width: {description: 700}}));
```
