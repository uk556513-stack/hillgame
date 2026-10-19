// Stage layouts. Each stage is a list of tokens turned into road polylines:
//   ['flat', len]            level road
//   ['rise', dx, dy]         slope (dy negative = up)   ['fall', dx, dy] slope (dy positive = down)
//   ['gap', len, dropY]      empty gap, landing dropY lower
//   ['bridge', len]          gap spanned by a sagging plank bridge
//   ['crates', xOffset, n]   n breakable crates placed on the road at x + xOffset
export const STAGES = 5;
export const START = { x: 180, y: 600 };

// Stage 1 follows the route seen in the reference video.
const STAGE1 = [
  ['flat', 700], ['rise', 130, -65], ['flat', 650], ['fall', 650, 40], ['crates', 150, 3],
  ['rise', 500, -90], ['rise', 200, -130], ['gap', 230, 70], ['flat', 520],
  ['bridge', 560], ['rise', 140, -70], ['fall', 1000, 260], ['crates', 200, 3], ['flat', 400],
  ['rise', 260, -110], ['gap', 190, 40], ['flat', 500], ['rise', 700, -120], ['flat', 900],
];

function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }

function procedural(n) {
  const r = rng(n * 7919 + 13);
  const t = [['flat', 700]];
  for (let i = 0; i < 12 + n * 4; i++) {
    const k = r();
    if (k < 0.2) t.push(['rise', 150 + r() * 300, -(40 + r() * (40 + n * 20))]);
    else if (k < 0.4) t.push(['fall', 200 + r() * 400, 30 + r() * (40 + n * 20)]);
    else if (k < 0.55) t.push(['flat', 250 + r() * 300]);
    else if (k < 0.7) t.push(['crates', 100 + r() * 100, 2 + ((r() * 3) | 0)], ['flat', 350]);
    else if (k < 0.85) t.push(['rise', 220, -80], ['gap', 110 + n * 15 + r() * 40, 30], ['flat', 400]);
    else t.push(['flat', 150], ['bridge', 380 + n * 30], ['flat', 300]);
  }
  t.push(['flat', 900]);
  return t;
}

export function buildStage(n) {
  const tokens = n === 1 ? STAGE1 : procedural(n);
  let x = 0, y = START.y;
  let cur = [[x, y]];
  const polys = [], bridges = [], crateReq = [];
  for (const [k, a, b] of tokens) {
    if (k === 'flat') { x += a; cur.push([x, y]); }
    else if (k === 'rise' || k === 'fall') { x += a; y += b; cur.push([x, y]); }
    else if (k === 'crates') crateReq.push([x + a, b]);
    else { // gap | bridge
      polys.push(cur);
      const x0 = x, y0 = y;
      x += a;
      if (k === 'gap') y += b; else bridges.push({ x1: x0, y1: y0, x2: x, y2: y });
      cur = [[x, y]];
    }
  }
  polys.push(cur);

  const groundY = (gx) => {
    for (const p of polys) for (let i = 0; i < p.length - 1; i++) {
      const [x1, y1] = p[i], [x2, y2] = p[i + 1];
      if (gx >= x1 && gx <= x2) return y1 + ((y2 - y1) * (gx - x1)) / (x2 - x1 || 1);
    }
    return START.y;
  };
  const crates = [];
  for (const [cx, count] of crateReq) for (let i = 0; i < count; i++) {
    const px = cx + i * 32; crates.push({ x: px, y: groundY(px) - 16 });
  }
  const maxY = Math.max(...polys.flat().map((p) => p[1]));
  return { polys, bridges, crates, finishX: x - 500, killY: maxY + 700 };
}
