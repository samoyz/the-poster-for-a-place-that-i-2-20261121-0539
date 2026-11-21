// VELMORA: a travel poster for a place that isn't there.
// Node 22, stdlib only. Renders a 1024x1536 PNG (pure JS encoder:
// raw RGBA buffer + node:zlib deflate + PNG chunks with CRC32) and
// writes it to /output/entry.png. No network, no dependencies.
import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";

const W = 1024;
const H = 1536;
const OUT = "/output/entry.png";

// ---------- palette ----------
const SKY_TOP: RGBA = [11, 46, 53, 255];      // deep teal
const SKY_LOW: RGBA = [242, 230, 201, 255];   // warm cream
const SUN: RGBA = [232, 180, 74, 255];        // soft gold
const SUN_HALO: RGBA = [240, 205, 120, 255];  // pale gold
const ISLAND: RGBA = [20, 51, 47, 255];       // dark slate teal
const ISLAND_FAR: RGBA = [38, 84, 78, 255];   // hazy far island
const GRASS: RGBA = [110, 139, 103, 255];     // sage green
const SEA: RGBA = [15, 58, 64, 255];          // deep sea teal
const SEA_LIGHT: RGBA = [46, 107, 102, 255];  // lighter wave teal
const ACCENT: RGBA = [232, 84, 47, 255];      // orange-red
const CREAM: RGBA = [242, 230, 201, 255];     // text cream
const INK: RGBA = [20, 32, 30, 255];          // silhouette ink
const WHITE: RGBA = [250, 246, 236, 255];     // lighthouse white

type RGBA = [number, number, number, number];

// ---------- pixel buffer ----------
const px = new Uint8Array(W * H * 4);

function setPixel(x: number, y: number, c: RGBA): void {
  if (x < 0 || x >= W || y < 0 || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
  px[i + 3] = c[3];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGBA): void {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(W, Math.ceil(x + w));
  const y1 = Math.min(H, Math.ceil(y + h));
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) setPixel(xx, yy, c);
  }
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function mix(c1: RGBA, c2: RGBA, t: number): RGBA {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t), 255];
}

function fillCircle(cx: number, cy: number, r: number, c: RGBA): void {
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy <= r2) setPixel(x, y, c);
    }
  }
}

// Simple scanline polygon fill (flat shapes, no anti-aliasing).
function fillPoly(points: Array<[number, number]>, c: RGBA): void {
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [, y] of points) {
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i];
      const [x2, y2] = points[(i + 1) % points.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        const t = (y - y1) / (y2 - y1);
        xs.push(x1 + t * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const x0 = Math.max(0, Math.ceil(xs[k]));
      const x1 = Math.min(W - 1, Math.floor(xs[k + 1]));
      for (let x = x0; x <= x1; x++) setPixel(x, y, c);
    }
  }
}

// ---------- 5x7 bitmap font (A-Z, 0-9, space and basic punctuation) ----------
// Each glyph is 7 rows; each row is a 5-bit number, most significant bit left.
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  "-": [0, 0, 0, 0x0e, 0, 0, 0],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ":": [0, 0x0c, 0, 0, 0, 0x0c, 0],
};

function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}

function drawText(text: string, cx: number, y: number, scale: number, c: RGBA): void {
  const w = textWidth(text, scale);
  let x = Math.round(cx - w / 2);
  for (const ch of text) {
    const glyph = FONT[ch] ?? FONT[" "];
    for (let r = 0; r < 7; r++) {
      const row = glyph[r];
      for (let col = 0; col < 5; col++) {
        if ((row >> (4 - col)) & 1) {
          fillRect(x + col * scale, y + r * scale, scale, scale, c);
        }
      }
    }
    x += 6 * scale;
  }
}

// ---------- the poster scene ----------
function drawScene(): void {
  // Sky: vertical gradient, deep teal at the top to warm cream at the horizon.
  for (let y = 0; y < 1080; y++) {
    const t = y / 1080;
    fillRect(0, y, W, 1, mix(SKY_TOP, SKY_LOW, Math.pow(t, 1.4)));
  }

  // Stars in the upper sky.
  const stars: Array<[number, number, number]> = [
    [90, 120, 3], [210, 70, 2], [330, 150, 3], [470, 90, 2], [620, 140, 3],
    [820, 80, 2], [920, 170, 3], [150, 240, 2], [760, 230, 2], [60, 330, 2],
    [540, 200, 2], [880, 290, 2], [400, 260, 2], [280, 320, 2],
  ];
  for (const [x, y, r] of stars) fillCircle(x, y, r, CREAM);

  // Sun: pale halo, then the gold disc, low and large.
  fillCircle(700, 430, 235, SUN_HALO);
  fillCircle(700, 430, 185, SUN);

  // Birds: a few small dark "v" marks.
  const birds: Array<[number, number, number]> = [
    [180, 420, 16], [250, 470, 12], [860, 380, 14], [800, 460, 11],
  ];
  for (const [bx, by, s] of birds) {
    fillPoly([[bx - s, by], [bx, by + s * 0.6], [bx - s * 0.45, by + s * 0.15]], INK);
    fillPoly([[bx + s, by], [bx, by + s * 0.6], [bx + s * 0.45, by + s * 0.15]], INK);
  }

  // Far floating island (hazy, higher up, smaller).
  fillPoly(
    [[90, 640], [300, 640], [330, 668], [300, 700], [210, 760], [160, 700], [120, 668]],
    ISLAND_FAR,
  );
  fillRect(90, 634, 210, 8, GRASS);
  // Tiny waterfall from the far island.
  fillRect(196, 760, 6, 90, CREAM);

  // Main floating island (large, left and centre).
  fillPoly(
    [[110, 780], [620, 780], [660, 820], [600, 880], [430, 1010], [330, 960], [220, 880], [140, 820]],
    ISLAND,
  );
  fillRect(110, 772, 510, 10, GRASS);

  // Small floating island on the right, lower.
  fillPoly(
    [[700, 880], [940, 880], [965, 905], [920, 950], [830, 1010], [780, 950], [720, 905]],
    ISLAND,
  );
  fillRect(700, 874, 240, 8, GRASS);

  // Waterfalls falling from the main island into the sea.
  fillRect(300, 1010, 7, 80, CREAM);
  fillRect(470, 1000, 5, 90, CREAM);
  fillRect(820, 1010, 6, 70, CREAM);

  // Lighthouse on the main island: white tower, orange-red cap, gold beam.
  fillRect(500, 690, 34, 84, WHITE);
  fillPoly([[494, 690], [540, 690], [534, 662], [500, 662]], ACCENT);
  fillCircle(517, 656, 7, SUN);
  fillPoly([[534, 668], [700, 640], [700, 700], [534, 690]], SUN_HALO);

  // Tiny traveller silhouette on the main island edge, for scale.
  fillCircle(200, 742, 6, INK);
  fillRect(195, 748, 10, 24, INK);

  // Sea: deep teal from y=1080 to the bottom.
  fillRect(0, 1080, W, H - 1080, SEA);
  // Wave bands, lighter teal, getting wider toward the bottom.
  const waves: Array<[number, number, number]> = [
    [70, 1120, 180], [620, 1130, 260], [300, 1180, 200], [760, 1200, 160],
    [120, 1330, 240], [560, 1340, 300], [40, 1420, 180], [700, 1440, 220],
    [260, 1490, 260], [820, 1500, 140],
  ];
  for (const [x, y, w] of waves) fillRect(x, y, w, 7, SEA_LIGHT);

  // Thin cream frame, classic poster border.
  fillRect(28, 28, W - 56, 8, CREAM);
  fillRect(28, H - 36, W - 56, 8, CREAM);
  fillRect(28, 28, 8, H - 56, CREAM);
  fillRect(W - 36, 28, 8, H - 56, CREAM);

  // ---------- text ----------
  // Place name, big and centred over the sea.
  drawText("VELMORA", W / 2, 1180, 18, CREAM);
  // Orange-red rule under the name.
  fillRect(W / 2 - 130, 1330, 260, 6, ACCENT);
  // Tagline.
  drawText("WHERE THE SKY KEEPS ITS ISLANDS", W / 2, 1372, 4, SUN);
  // Bottom line.
  drawText("VISIT VELMORA", W / 2, 1448, 5, CREAM);
}

// ---------- minimal PNG encoder ----------
const CRC_TABLE: Uint32Array = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type 6 = RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw scanlines, each prefixed with filter byte 0 (none).
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    const rowStart = y * (W * 4 + 1);
    raw[rowStart] = 0;
    raw.set(px.subarray(y * W * 4, (y + 1) * W * 4), rowStart + 1);
  }
  const idat = deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- main ----------
drawScene();
mkdirSync("/output", { recursive: true });
writeFileSync(OUT, encodePNG());
console.log(`wrote ${OUT} (${W}x${H})`);
