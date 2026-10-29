// EBCDIC (IBM037) to Unicode lookup for the fallback path.
// Built from the common cp037 mapping; unmapped bytes become a space.
const CP037 = (() => {
  const t = new Array(256).fill(" ");
  const put = (start, str) => [...str].forEach((c, i) => (t[start + i] = c));
  put(0x40, " ");
  put(0x4a, "\u00a2.<(+|&");
  put(0x5a, "!$*);\u00ac-/");
  put(0x6a, "\u00a6,%_>?");
  put(0x79, "`:#@'=\"");
  put(0x81, "abcdefghi");
  put(0x91, "jklmnopqr");
  put(0xa1, "~stuvwxyz");
  put(0xc0, "{ABCDEFGHI");
  put(0xd0, "}JKLMNOPQR");
  put(0xe0, "\\ STUVWXYZ");
  put(0xf0, "0123456789");
  return t;
})();

function looksAscii(bytes) {
  // Printable ASCII spaces (0x20) and letters dominate in ASCII headers.
  // In EBCDIC, 0x40 is the space and 0xC1-0xE9 are letters.
  let ascii = 0, ebcdic = 0;
  for (const b of bytes) {
    if (b === 0x20 || (b >= 0x41 && b <= 0x7a)) ascii++;
    if (b === 0x40 || (b >= 0xc1 && b <= 0xe9) || (b >= 0xf0 && b <= 0xf9)) ebcdic++;
  }
  return ascii > ebcdic;
}

function decodeEbcdic(bytes) {
  try {
    return new TextDecoder("ibm037").decode(bytes);
  } catch {
    return Array.from(bytes, (b) => CP037[b]).join("");
  }
}

/**
 * Returns { encoding, lines } where lines is an array of 40 strings of 80 chars.
 */
export function decodeTextHeader(buffer, offset = 0, length = 3200) {
  const bytes = new Uint8Array(buffer, offset, length);
  const ascii = looksAscii(bytes);
  const text = ascii ? new TextDecoder("ascii").decode(bytes) : decodeEbcdic(bytes);
  const lines = [];
  for (let i = 0; i < text.length; i += 80) lines.push(text.slice(i, i + 80).trimEnd());
  return { encoding: ascii ? "ASCII" : "EBCDIC (IBM037)", lines };
}
