export const FORMATS = {
  1: { size: 4, txt: "4-byte IBM floating-point" },
  2: { size: 4, txt: "4-byte two's complement integer" },
  3: { size: 2, txt: "2-byte two's complement integer" },
  5: { size: 4, txt: "4-byte IEEE floating-point" },
  6: { size: 8, txt: "8-byte IEEE floating-point" },
  8: { size: 1, txt: "1-byte two's complement integer" },
  9: { size: 8, txt: "8-byte two's complement integer" },
  10: { size: 4, txt: "4-byte unsigned integer" },
  11: { size: 2, txt: "2-byte unsigned integer" },
  16: { size: 1, txt: "1-byte unsigned integer" }
};

const TEXT_HEADER = 3200;
const BIN_HEADER = 400;
const TRACE_HEADER = 240;

export function ibmToFloat(u32) {
  const sign = u32 >>> 31 ? -1 : 1;
  const exponent = (u32 >>> 24) & 0x7f;
  const fraction = (u32 & 0x00ffffff) / 0x1000000;
  return sign * fraction * Math.pow(16, exponent - 64);
}

export class SegY {
  constructor(buffer) {
    this.buffer = buffer;
    const view = new DataView(buffer, TEXT_HEADER, BIN_HEADER);

    // Byte order check: 16909060 (0x01020304) when big endian.
    const marker = view.getInt32(96, false);
    this.littleEndian = marker === 0x04030201;
    const le = this.littleEndian;

    this.binary = {
      jobId: view.getInt32(0, le),
      lineNo: view.getInt32(4, le),
      reelNo: view.getInt32(8, le),
      tracesPerEnsemble: view.getInt16(12, le),
      dt: view.getInt16(16, le),
      ns: view.getInt16(20, le),
      format: view.getInt16(24, le),
      revMajor: view.getUint8(300),
      revMinor: view.getUint8(301),
      fixedLength: view.getInt16(302, le),
      extHeaders: view.getInt16(304, le)
    };
    // Revision 2 extended fields override the 16-bit ones when nonzero.
    const extNs = view.getInt32(68, le);
    if (extNs > 0) this.binary.ns = extNs;

    const fmt = FORMATS[this.binary.format];
    if (!fmt) throw new Error(`Unsupported sample format code ${this.binary.format}`);
    this.fmt = fmt;
    this.dataStart = TEXT_HEADER + BIN_HEADER + Math.max(0, this.binary.extHeaders) * 3200;
    this.traceBytes = TRACE_HEADER + this.binary.ns * fmt.size;
    this.traceCount = Math.floor((buffer.byteLength - this.dataStart) / this.traceBytes);
  }

  traceStart(trace) {
    return this.dataStart + (trace - 1) * this.traceBytes;
  }

  headerInt(trace, offset, size = 4) {
    const view = new DataView(this.buffer, this.traceStart(trace), TRACE_HEADER);
    return size === 2
      ? view.getInt16(offset - 1, this.littleEndian)
      : view.getInt32(offset - 1, this.littleEndian);
  }

  /** Value of one trace header field from the spec, handling 2, 4, 6 and 8 byte fields. */
  headerValue(trace, field) {
    const view = new DataView(this.buffer, this.traceStart(trace), TRACE_HEADER);
    const le = this.littleEndian;
    const o = field.offset - 1;
    switch (field.size) {
      case 2: return view.getInt16(o, le);
      case 4: return view.getInt32(o, le);
      case 6:
        if (o === 218) {
          // vertical, crossline, inline components, in tenths
          return [view.getInt16(o, le), view.getInt16(o + 2, le), view.getInt16(o + 4, le)]
            .map((v) => v / 10).join(", ");
        }
        // 32-bit mantissa and exponent byte, as in the original notebook
        return view.getInt32(o, le) * Math.pow(10, view.getInt8(o + 4));
      case 8: return "0x" + view.getBigUint64(o, le).toString(16);
      default: return null;
    }
  }

  /** 16 and 32 bit signed values at a 1-based byte offset in the 400 byte binary header. */
  binaryValue(offset) {
    const view = new DataView(this.buffer, TEXT_HEADER, BIN_HEADER);
    const o = offset - 1;
    const le = this.littleEndian;
    return {
      int16: o >= 0 && o + 2 <= BIN_HEADER ? view.getInt16(o, le) : null,
      int32: o >= 0 && o + 4 <= BIN_HEADER ? view.getInt32(o, le) : null
    };
  }

  samples(trace) {
    const ns = this.headerInt(trace, 115, 2) || this.binary.ns;
    const n = Math.min(ns, this.binary.ns);
    const view = new DataView(this.buffer, this.traceStart(trace) + TRACE_HEADER, n * this.fmt.size);
    const le = this.littleEndian;
    const size = this.fmt.size;
    const out = new Float32Array(n);
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < n; i++) {
      const p = i * size;
      let v;
      switch (this.binary.format) {
        case 1: v = ibmToFloat(view.getUint32(p, le)); break;
        case 2: v = view.getInt32(p, le); break;
        case 3: v = view.getInt16(p, le); break;
        case 5: v = view.getFloat32(p, le); break;
        case 6: v = view.getFloat64(p, le); break;
        case 8: v = view.getInt8(p); break;
        case 9: v = Number(view.getBigInt64(p, le)); break;
        case 10: v = view.getUint32(p, le); break;
        case 11: v = view.getUint16(p, le); break;
        case 16: v = view.getUint8(p); break;
        default: v = 0;
      }
      out[i] = v;
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return { values: out, min, max };
  }

  /** Reads two 32-bit header words for every trace, e.g. X and Y coordinates. */
  coordinates(offsetX, offsetY, maxPoints = 20000) {
    const step = Math.max(1, Math.floor(this.traceCount / maxPoints));
    const pts = [];
    for (let t = 1; t <= this.traceCount; t += step) {
      pts.push({ trace: t, x: this.headerInt(t, offsetX), y: this.headerInt(t, offsetY) });
    }
    return pts;
  }

  /** Subsampled amplitude matrix for the section viewer. */
  section(centerTrace, halfWindow = 500, maxTraces = 1000, maxSamples = 1000) {
    const first = Math.max(1, centerTrace - halfWindow);
    const last = Math.min(this.traceCount, centerTrace + halfWindow);
    const tStep = Math.max(1, Math.ceil((last - first + 1) / maxTraces));
    const sStep = Math.max(1, Math.ceil(this.binary.ns / maxSamples));
    const cols = [];
    let min = Infinity, max = -Infinity;
    for (let t = first; t <= last; t += tStep) {
      const s = this.samples(t);
      if (s.min < min) min = s.min;
      if (s.max > max) max = s.max;
      const col = new Float32Array(Math.ceil(s.values.length / sStep));
      for (let i = 0, j = 0; i < s.values.length; i += sStep, j++) col[j] = s.values[i];
      cols.push(col);
    }
    return { cols, min, max, first, last, tStep, sStep, dt: this.binary.dt * sStep / 1e6 };
  }
}

/** Reads a File (or Observable FileAttachment) in chunks and reports progress. */
export async function readFile(file, onProgress = () => {}) {
  // Inputs.file gives a FileAttachment-like object whose stream() is async.
  const stream = await file.stream();
  const reader = stream.getReader();
  const size = file.size || 0;
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
    if (size) onProgress(total / size);
  }
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out.buffer;
}
