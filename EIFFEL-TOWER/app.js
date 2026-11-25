(() => {
  "use strict";

  const COLS = 88, ROWS = 74, CW = 9, CH = 14, W = COLS * CW, H = ROWS * CH;
  const TAU = Math.PI * 2, TOWER_M = 330, GROUND = -1.15, HEIGHT = 2.6, S = HEIGHT / TOWER_M;
  const CAM_DIST = 444, EYE_H = 1.6, STREET = 22, ROW_END = 170, ROOF = 3.5;
  const LAMP_X = 19, LAMP_D = [];
  for (let d = 28; d < ROW_END; d += 24) LAMP_D.push(d);
  const T_BUILD = [0.8, 7.2], T_GLOW = [7.8, 9.8], T_BEACON = 10.2, T_SPARKLE = 11, T_FIREWORKS = 12, FLASH = 0.6;
  const GIRDER = 0, BRACE = 1, ARCH = 2, DECK = 3, MESH = 4;
  const LINES = new Set([GIRDER, BRACE, ARCH]);
  const POOLS = ["1il!;:", "rtfjcvxz=+", "aeoun0{}[]<>", "08B$#&%Q"];
  const WHITE = [0.92, 0.95, 1], STEEL = [0.45, 0.62, 1], GOLD = [1, 0.62, 0.16], GOLD_HI = [1, 0.8, 0.36];
  const RED = [1, 0.16, 0.2], BEAM = [1, 0.92, 0.72], STONE = [0.85, 0.76, 0.6], ZINC = [0.55, 0.64, 0.85];
  const IRON = [0.62, 0.66, 0.8], WARM = [1, 0.74, 0.36], COOL = [0.7, 0.84, 1], LAMP = [1, 0.82, 0.5];
  const FIREWORK = [[1, 0.25, 0.3], [1, 0.78, 0.3], [0.35, 0.85, 1], [1, 0.45, 0.85],
    [0.5, 1, 0.55], [0.95, 0.95, 1], [0.6, 0.5, 1]];
  const GLYPH = ch => ch.charCodeAt(0) - 32;
  const FILL = POOLS.map(pool => Array.from({ length: 12 }, (_, i) => GLYPH(pool[i % pool.length])));
  const canvas = document.getElementById("eiffel"), ctx = canvas.getContext("2d", { alpha: false });
  const moveCanvas = document.createElement("canvas");
  const stillCanvas = document.createElement("canvas"), trailCanvas = document.createElement("canvas");
  const compositeCanvas = document.createElement("canvas");
  for (const c of [moveCanvas, stillCanvas, trailCanvas, compositeCanvas]) { c.width = W; c.height = H; }
  const moving = moveCanvas.getContext("2d"), still = stillCanvas.getContext("2d");
  const trail = trailCanvas.getContext("2d"), composite = compositeCanvas.getContext("2d");
  const count = COLS * ROWS, size3 = count * 3;
  let running = true, elapsed = 0, lastTime = 0;

  function rng(seed) {
    let a = seed >>> 0;
    return () => { a += 0x6D2B79F5; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const mod = (x, n) => ((x % n) + n) % n;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = x => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
  const vadd = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const vmul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = a => Math.hypot(a[0], a[1], a[2]);
  const unit = a => { const n = norm(a) || 1e-9; return [a[0] / n, a[1] / n, a[2] / n]; };
  function fibSphere(n) {
    const points = [], golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const k = i + 0.5, y = 1 - 2 * k / n, r = Math.sqrt(1 - y * y), th = golden * k;
      points.push([r * Math.cos(th), y, r * Math.sin(th)]);
    }
    return points;
  }
  function slopeChar(dx, dy) {
    const a = mod(Math.atan2(dy, dx) * 180 / Math.PI, 180);
    return GLYPH(a < 25 || a >= 155 ? "-" : a < 72 ? "/" : a < 108 ? "|" : "\\");
  }
  const halfWidth = h => 62.5 * Math.exp(-h / 98);
  const legSize = h => 0.12 * halfWidth(h) + 5;
  const H_MERGE = 98 * Math.log(62.5 * 0.76 / 10);
  const buildTime = h => T_BUILD[0] + (T_BUILD[1] - T_BUILD[0]) * Math.pow(clamp(h / TOWER_M, 0, 1), 0.7);

  const parts = [];
  function addPart(points, kind, part, options = {}) {
    const { tan = [0, 0, 0], n = null, appear = null, centre = null, base = 1, pop = false } = options;
    for (let pointIndex = 0; pointIndex < points.length; pointIndex++) {
      const p = points[pointIndex];
      const center = centre ? [centre[0] * S, GROUND + centre[1] * S, centre[2] * S] :
        [p[0] * S, GROUND + p[1] * S, p[2] * S];
      const normal = n ? unit(typeof n === "function" ? n(p) : n) :
        unit([p[0], 0.3 * Math.hypot(p[0], p[2]) + 1e-3, p[2]]);
      const tangent = typeof tan === "function" ? tan(p, pointIndex) : tan;
      parts.push({
        c: center, o: [(p[0] * S) - center[0], p[1] * S - (center[1] - GROUND), p[2] * S - center[2]],
        n: normal, tan: tangent, kind, part, base, pop,
        appear: appear === null ? buildTime(p[1]) : (typeof appear === "function" ? appear(p[1], p) : appear),
        h: p[1]
      });
    }
  }
  function line(points, kind, part, step = 2, options = {}) {
    const lengths = [0];
    for (let i = 1; i < points.length; i++) lengths.push(lengths[i - 1] + norm(vsub(points[i], points[i - 1])));
    const total = lengths[lengths.length - 1], samples = [];
    for (let u = 0; u < total; u += step) samples.push(u);
    samples.push(total);
    const out = [], tangents = [];
    let seg = 0;
    for (const u of samples) {
      while (seg < lengths.length - 2 && lengths[seg + 1] <= u) seg++;
      const span = lengths[seg + 1] - lengths[seg], f = span ? (u - lengths[seg]) / span : 0;
      out.push(points[seg].map((v, k) => v + (points[seg + 1][k] - v) * f));
      tangents.push(unit(vsub(points[seg + 1], points[seg])));
    }
    addPart(out, kind, part, { ...options, tan: (p, i) => tangents[i] });
  }
  function corner(qx, qz, i, h) {
    const w = halfWidth(h), s = legSize(h), lo = w - 2 * s, hi = w;
    const coords = [[lo, lo], [hi, lo], [hi, hi], [lo, hi]][i];
    return [qx * coords[0], h, qz * coords[1]];
  }
  function colCorner(i, h) {
    const w = halfWidth(h), signs = [[-1, -1], [1, -1], [1, 1], [-1, 1]][i];
    return [signs[0] * w, h, signs[1] * w];
  }
  function makeLevels(h0, h1, step) {
    const out = [h0];
    while (out[out.length - 1] + step(out[out.length - 1]) < h1 - 3) out.push(out[out.length - 1] + step(out[out.length - 1]));
    out.push(h1);
    return out;
  }
  function lattice(pointFn, levels, part) {
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      for (let k = 0; k < levels.length - 1; k++) {
        const h0 = levels[k], h1 = levels[k + 1];
        line([pointFn(i, h0), pointFn(j, h1)], BRACE, part, 2, { base: 0.85 });
        line([pointFn(j, h0), pointFn(i, h1)], BRACE, part, 2, { base: 0.85 });
        line([pointFn(i, h1), pointFn(j, h1)], BRACE, part, 2, { base: 0.95 });
      }
    }
  }
  function face(cornerA, cornerB, centreFn, h0, h1, part) {
    const points = [], inwardNormals = [];
    for (let h = h0; h < h1; h += 1.5) {
      const a = cornerA(h), b = cornerB(h), center = centreFn(h);
      for (let j = 0; j < 12; j++) {
        const u = 0.04 + (0.96 - 0.04) * j / 11;
        const p = a.map((v, k) => v * (1 - u) + b[k] * u);
        const inward = unit([(center[0] - p[0]), 0, center[2] - p[2]]);
        points.push(vadd(p, vmul(inward, 0.8)));
        inwardNormals.push(vmul(inward, -1));
      }
    }
    let i = 0;
    addPart(points, MESH, part, { n: () => inwardNormals[i++] , base: 0.62 });
  }
  function platform(h0, h1, hw, hole, part) {
    const appear = buildTime(h1) + 0.15, center = [0, h0, 0], u = [];
    for (let x = -hw; x < hw; x += 1) u.push(x);
    for (let y = h0; y < h1 + 0.1; y += 1.2) {
      for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const p = u.map(v => [sx * hw + sz * v, y, sz * hw - sx * v]);
        addPart(p, DECK, part, { n: [sx, 0.2, sz], appear, centre: center, pop: true });
      }
    }
    const g = [];
    for (let v = -hw; v <= hw + 0.1; v += 2) g.push(v);
    const deck = [];
    for (const z of g) for (const x of g) if (Math.max(Math.abs(x), Math.abs(z)) > hole) deck.push([x, h1, z]);
    addPart(deck, DECK, part, { n: [0, 1, 0], appear, centre: center, base: 0.7, pop: true });
  }
  function buildTower() {
    for (const [qx, qz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      const pointFn = (i, h) => corner(qx, qz, i, h);
      const heights = [];
      for (let h = 0; h < H_MERGE + 0.5; h += 1) heights.push(h);
      for (let i = 0; i < 4; i++) {
        line(heights.map(h => pointFn(i, h)), GIRDER, [[-1, -1], [1, -1], [1, 1], [-1, 1]].findIndex(v => v[0] === qx && v[1] === qz));
        face(h => pointFn(i, h), h => pointFn((i + 1) % 4, h),
          h => [qx * (halfWidth(h) - legSize(h)), h, qz * (halfWidth(h) - legSize(h))], 0, H_MERGE, 0);
      }
      lattice(pointFn, makeLevels(0, H_MERGE, y => 1.4 * legSize(y)),
        [[-1, -1], [1, -1], [1, 1], [-1, 1]].findIndex(v => v[0] === qx && v[1] === qz));
    }
    const th = Array.from({ length: 90 }, (_, i) => Math.PI * i / 89);
    const span = halfWidth(18) - 2 * legSize(18);
    for (const [a, b] of [[span, 34], [span - 3, 31]]) {
      const arc = th.map(t => [a * Math.cos(t), 18 + b * Math.sin(t)]);
      for (let k = 0; k < 4; k++) {
        const ca = Math.cos(k * TAU / 4), sa = Math.sin(k * TAU / 4);
        const pts = arc.map(([x, y]) => {
          const z = halfWidth(y) - 1.5;
          return [ca * x + sa * z, y, -sa * x + ca * z];
        });
        line(pts, ARCH, 9, 1.5, { base: 1.1, appear: y => buildTime(52) + 0.6 * clamp((y - 18) / 34, 0, 1) });
      }
    }
    platform(57, 64, halfWidth(57) + 3, 24, 5);
    platform(115, 121, halfWidth(115) + 2, 12, 6);
    const upper = [];
    for (let h = H_MERGE; h < 276.5; h += 1) upper.push(h);
    for (let i = 0; i < 4; i++) {
      line(upper.map(h => colCorner(i, h)), GIRDER, 4);
      face(h => colCorner(i, h), h => colCorner((i + 1) % 4, h), h => [0, h, 0], H_MERGE, 276, 4);
    }
    lattice((i, h) => colCorner(i, h), makeLevels(H_MERGE, 276, y => 1.3 * halfWidth(y)), 4);
    platform(274, 288, 7, 0, 7);
    platform(288, 293, 4, 0, 8);
    line([[0, 293, 0], [0, TOWER_M, 0]], GIRDER, 8, 0.8);
    for (const [y, r] of [[300, 2.5], [310, 1.5]]) line([[-r, y, 0], [r, y, 0]], GIRDER, 8, 0.8);
  }
  buildTower();
  const partRng = rng(1);
  for (const p of parts) p.glint = partRng();
  const APPEAR_MAX = Math.max(...parts.map(p => p.appear));
  const eyeY = GROUND + EYE_H * S, eyeZ = CAM_DIST * S;
  const ZOOM = 2.45, HORIZON = 0.83, KEY = unit([-0.5, 0.55, 0.65]);
  function camTower(x, y, z) { return [x, y - eyeY, -z + eyeZ]; }
  function camStreet(x, y, d) { return [x * S, (y - EYE_H) * S, d * S]; }
  function projectCam(p) {
    const z = p[2], zz = Math.max(z, 1e-3);
    return [(0.5 + p[0] / zz * ZOOM * 0.5) * COLS, (HORIZON - p[1] / zz * ZOOM * 0.5 * (COLS * CW) / (ROWS * CH)) * ROWS, z];
  }
  const aspect = W / H, cellAspect = CW / CH;

  const lineIndices = [];
  parts.forEach((p, i) => { if (LINES.has(p.kind)) lineIndices.push(i); });
  const sparkleRng = rng(9), shuffled = lineIndices.slice();
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(sparkleRng() * (i + 1)); [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const TW = shuffled.slice(0, 1100), twRng = rng(19);
  const TW_PHASE = TW.map(() => twRng()), TW_RATE = TW.map(() => 0.6 + 0.9 * twRng());

  function normalRandom(random) {
    const u = Math.max(random(), 1e-12), v = random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
  }
  const COATS = [[1, 0.3, 0.32], [0.38, 0.55, 1], [0.95, 0.8, 0.55], [0.75, 0.78, 0.86],
    [0.3, 0.85, 0.75], [1, 0.68, 0.3], [0.85, 0.5, 0.95]];
  const SKIN = [1, 0.82, 0.7], LEGS = [0.45, 0.5, 0.66], PHONE = [0.85, 0.95, 1];
  const headTemplate = fibSphere(40).map(p => [p[0] * 0.11, p[1] * 0.11 + 1.63, p[2] * 0.11]);
  const torsoTemplate = [], torsoNormals = [];
  for (let h = 0; h < 16; h++) for (let a = 0; a < 20; a++) {
    const angle = TAU * a / 20, y = 0.86 + (1.48 - 0.86) * h / 15, r = 0.22 - 0.05 * (y - 0.86) / 0.62;
    torsoTemplate.push([Math.cos(angle) * r, y, 0.6 * Math.sin(angle) * r]);
    torsoNormals.push([Math.cos(angle), 0, Math.sin(angle)]);
  }
  const limbSteps = Array.from({ length: 12 }, (_, i) => i / 11), phoneTemplate = [];
  for (let h = 0; h < 4; h++) for (let x = 0; x < 3; x++) phoneTemplate.push([-0.035 + x * 0.035, 1.47 + h * 0.04, 0.44]);
  const BODY_N = headTemplate.map(p => unit([p[0], p[1] - 1.63, p[2]])).concat(torsoNormals);
  const STREETLIGHT = unit([-0.3, 0.8, -0.5]);
  const crowdRng = rng(21), CROWD = [];
  for (let i = 0; i < 30; i++) {
    const mode = i < 20 ? 0 : i < 25 ? 1 : 2;
    const near = crowdRng() ** 1.5;
    const photoX = -10 + 20 * crowdRng();
    const directionChoice = crowdRng() < 0.5 ? -1 : 1, randomX = crowdRng();
    const x = mode === 2 ? photoX : directionChoice * 17 * randomX ** 1.4;
    const d = mode === 0 ? 12 + (ROW_END - 12) * near : mode === 1 ? 14 + 50 * crowdRng() : 14 + 26 * crowdRng();
    const dir = crowdRng() < 0.5 ? -1 : 1, speed = 1.1 + 0.5 * crowdRng(), scale = 0.9 + 0.18 * crowdRng();
    const phase = crowdRng() * TAU, coat = COATS[Math.floor(crowdRng() * COATS.length)];
    CROWD.push({ mode, x, d, dir, speed, scale, phase, coat });
  }

  const HASH = new Uint16Array(count);
  for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) HASH[y * COLS + x] = (y * 7919 + x * 104729) % 9973;
  const houseRng = rng(17), HOUSES = [];
  for (let side = 0; side < 2; side++) {
    let start = -20;
    const out = [];
    while (start < ROW_END) {
      const width = 14 + 10 * houseRng(), top = 17.5 + 5 * houseRng(), tone = houseRng();
      out.push({ start, top, tone }); start += width;
    }
    HOUSES.push(out);
  }
  const SHOP = 10000000;
  const background = makeStreet();
  const SKY_RNG = rng(5), SKY = Array.from({ length: 220 }, () => [SKY_RNG(), SKY_RNG(), SKY_RNG()]);
  const skyX = SKY.map(p => Math.floor(p[0] * COLS));
  const skyY = SKY.map(p => Math.floor(p[1] * Math.max(Math.floor(HORIZON * ROWS) - 1, 1)));
  const FIREWORK_RISE = 0.75, FIREWORK_LIFE = 1.9, FIREWORK_EVERY = 0.55;
  const METEOR_PERIOD = 7.5, METEOR_DURATION = 0.95;

  function emptyBody() {
    const body = { char: new Int16Array(count), rgb: new Float32Array(size3), lum: new Float32Array(count),
      depth: new Float32Array(count), part: new Int32Array(count), steady: new Uint8Array(count) };
    body.depth.fill(Infinity); body.part.fill(-1);
    return body;
  }
  const sceneBody = emptyBody();
  function addBodyPoint(cam, lum, rgb, part, glyph) {
    const q = projectCam(cam), x = Math.floor(q[0]), y = Math.floor(q[1]);
    if (q[2] <= 1e-3 || x < 0 || x >= COLS || y < 0 || y >= ROWS) return;
    const i = y * COLS + x;
    if (q[2] >= sceneBody.depth[i]) return;
    sceneBody.depth[i] = q[2]; sceneBody.part[i] = part; sceneBody.lum[i] = lum; sceneBody.char[i] = glyph;
    sceneBody.rgb[i * 3] = rgb[0]; sceneBody.rgb[i * 3 + 1] = rgb[1]; sceneBody.rgb[i * 3 + 2] = rgb[2];
  }
  function towerPoints(t) {
    sceneBody.depth.fill(Infinity); sceneBody.part.fill(-1); sceneBody.char.fill(0); sceneBody.lum.fill(0); sceneBody.rgb.fill(0);
    for (let k = 0; k < parts.length; k++) {
      const p = parts[k], age = t - p.appear;
      if (t < APPEAR_MAX && age < 0) continue;
      let grow = 1;
      if (t < APPEAR_MAX + FLASH && p.pop) grow = smooth(age / 0.25) * (1 + 0.25 * clamp(1 - age / FLASH, 0, 1) ** 2);
      const wx = p.c[0] + p.o[0] * grow, wy = p.c[1] + p.o[1] * grow, wz = p.c[2] + p.o[2] * grow;
      const cam = camTower(wx, wy, wz), q = projectCam(cam), x = Math.floor(q[0]), y = Math.floor(q[1]);
      if (q[2] <= 1e-3 || x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
      const index = y * COLS + x;
      if (q[2] > sceneBody.depth[index]) continue;
      const diff = clamp(dot(p.n, KEY), 0, 1);
      const onAt = T_GLOW[0] + (T_GLOW[1] - T_GLOW[0]) * p.h / TOWER_M;
      const lit = smooth((t - onAt) / 0.5), front = Math.exp(-(((t - onAt - 0.15) / 0.2) ** 2));
      let lum = p.base * (0.55 + 0.55 * diff) + 0.9 * front;
      const g = p.kind === MESH ? GOLD : GOLD_HI, factor = 0.88 + 0.2 * p.glint;
      let rgb = STEEL.map((v, j) => v + (g[j] * factor - v) * lit);
      rgb = rgb.map(v => v + (1 - v) * clamp(front, 0, 1) * 0.7);
      let glyph = LINES.has(p.kind) ? strokeGlyph(p.tan) : -1;
      if (t < T_BUILD[1] + 1 && age < 0.12 && p.kind !== MESH) { glyph = GLYPH("*"); lum = 1.3; rgb = WHITE; }
      if (t < APPEAR_MAX + FLASH && (p.kind === DECK || p.kind === ARCH)) {
        const f = clamp(1 - age / FLASH, 0, 1) ** 2;
        if (f > 0) { rgb = rgb.map(v => v + (1 - v) * f); lum += 1.3 * f; }
      }
      sceneBody.depth[index] = q[2]; sceneBody.part[index] = p.part; sceneBody.lum[index] = lum;
      sceneBody.char[index] = glyph;
      sceneBody.rgb[index * 3] = rgb[0]; sceneBody.rgb[index * 3 + 1] = rgb[1]; sceneBody.rgb[index * 3 + 2] = rgb[2];
    }
    renderCrowd(t);
  }
  function strokeGlyph(tan) {
    const dx = tan[0], dy = tan[1], dz = -tan[2];
    return Math.hypot(dx, dy) < 0.35 ? GLYPH("+") : slopeChar(dx, dy);
  }
  function renderCrowd(t) {
    for (let person = 0; person < CROWD.length; person++) {
      const m = CROWD[person], walk = m.mode === 0, cross = m.mode === 1, photo = m.mode === 2;
      const x = cross ? -STREET + mod(m.x + STREET + m.dir * m.speed * t, 2 * STREET) : m.x;
      const d = walk ? 12 + mod(m.d - 12 + m.dir * m.speed * t, ROW_END - 2) : m.d;
      const fx = cross ? m.dir : 0, fd = walk ? m.dir : photo ? 1 : 0, rx = fd, rd = -fx;
      const phi = m.speed * t / 0.75 * Math.PI + m.phase;
      const swing = photo ? 0 : 0.42 * Math.sin(phi), bob = photo ? 0 : 0.025 * Math.abs(Math.cos(phi));
      const local = [];
      for (const p of headTemplate) local.push([p[0] * m.scale, p[1] * m.scale + bob, p[2] * m.scale]);
      for (const p of torsoTemplate) local.push([p[0] * m.scale, p[1] * m.scale + bob, p[2] * m.scale]);
      const limbDirs = [];
      for (const side of [-1, 1]) {
        const a = side * swing, dir = [0, -Math.cos(a), Math.sin(a)];
        limbDirs.push(dir);
        for (const s of limbSteps) local.push([(side * 0.09 + s * 0.9 * dir[0]) * m.scale,
          (0.9 + s * 0.9 * dir[1]) * m.scale + bob, s * 0.9 * dir[2] * m.scale]);
      }
      for (const side of [-1, 1]) {
        const a = -0.8 * side * swing;
        let dir = unit([side * 0.12, -Math.cos(a), Math.sin(a)]).map(v => v * 0.6);
        if (photo) dir = [side * 0.04 - side * 0.22, 0.08, 0.42];
        limbDirs.push(dir);
        for (const s of limbSteps) local.push([(side * 0.22 + s * dir[0]) * m.scale,
          (1.44 + s * dir[1]) * m.scale + bob, s * dir[2] * m.scale]);
      }
      for (const p of phoneTemplate) local.push([p[0] * m.scale, p[1] * m.scale + bob, p[2] * m.scale]);
      for (let i = 0; i < local.length; i++) {
        if (i >= local.length - 12 && !photo) continue;
        const p = local[i], sx = p[0] * rx + p[2] * fx + x, sy = p[1], sd = p[0] * rd + p[2] * fd + d;
        const cam = camStreet(sx, sy, sd);
        let lum, rgb, glyph = -1;
        if (i < 40) {
          const n = unit([headTemplate[i][0], headTemplate[i][1] - 1.63, headTemplate[i][2]]);
          lum = 0.45 + 0.5 * clamp(dot([n[0] * rx + n[2] * fx, n[1], n[0] * rd + n[2] * fd], STREETLIGHT), 0, 1);
          rgb = SKIN.map(v => v * 0.8);
        } else if (i < 360) {
          const n = torsoNormals[i - 40], shade = clamp(dot([n[0] * rx + n[2] * fx, n[1], n[0] * rd + n[2] * fd], STREETLIGHT), 0, 1);
          lum = 0.45 + 0.5 * shade; rgb = m.coat.map(v => v * 0.8);
        } else if (i < local.length - 12) {
          const limb = i < 384 ? 0 : i < 396 ? 1 : i < 408 ? 2 : 3;
          const dir = limbDirs[limb], tx = dir[0] * rx + dir[2] * fx, ty = dir[1];
          glyph = Math.hypot(tx, ty) < 0.35 ? GLYPH("+") : slopeChar(tx, ty);
          lum = 0.7; rgb = i < 384 ? LEGS : m.coat.map(v => v * 0.72);
        } else { lum = 1.4; rgb = PHONE; glyph = GLYPH("#"); }
        addBodyPoint(cam, lum, rgb, 100 + person, glyph);
      }
    }
  }
  function makeStreet() {
    const char = new Int16Array(count), rgb = new Float32Array(size3), depth = new Float32Array(count);
    const win = new Float64Array(count), wet = new Uint8Array(count), uGrid = new Float64Array(count), vGrid = new Float64Array(count);
    depth.fill(Infinity); win.fill(-1);
    for (let yIndex = 0; yIndex < ROWS; yIndex++) for (let xIndex = 0; xIndex < COLS; xIndex++) {
      const i = yIndex * COLS + xIndex;
      const u = ((xIndex + 0.5) / COLS - 0.5) / (ZOOM * 0.5);
      const v = (HORIZON - (yIndex + 0.5) / ROWS) / (ZOOM * 0.5 * aspect);
      uGrid[i] = u; vGrid[i] = v;
      const d = STREET / Math.max(Math.abs(u), 1e-6), y = EYE_H + v * d;
      const dy = d / (ZOOM * 0.5 * aspect * ROWS), da = d * d / (STREET * ZOOM * 0.5 * COLS);
      const lo = y - dy / 2, hi = y + dy / 2, side = u < 0 ? -1 : 1, si = side < 0 ? 0 : 1;
      if (d < ROW_END && hi >= 0) {
        const houses = HOUSES[si];
        let k = 0;
        while (k + 1 < houses.length && houses[k + 1].start <= d) k++;
        const house = houses[k], a = d - house.start, top = house.top;
        const across = level => lo <= level && level < hi;
        const fa = step => mod(a / step, 1), fy = mod((y - 4.2) / 3.1, 1);
        const band = Math.floor((hi - 4.2) / 3.1) !== Math.floor((lo - 4.2) / 3.1);
        const roof = y >= top, ground = y < 4.2, edgeW = clamp(0.5 * da, 0.4, 1.5);
        const labels = [
          across(top + ROOF),
          a < edgeW || ROW_END - d < edgeW,
          across(top),
          roof && Math.abs(fa(3.6) - 0.5) < 0.16 && y - top > 1 && y - top < 2.8,
          band && Math.floor((hi - 4.2) / 3.1) === 1,
          false,
          ground && Math.abs(fa(6.5) - 0.5) < 0.4 && across(3.4),
          ground && Math.abs(fa(6.5) - 0.5) < 0.34 && y > 0.3 && y < 3,
          !ground && !roof && Math.abs(fa(3.6) - 0.5) < 0.2 && fy > 0.2 && fy < 0.85
        ];
        const hitsFacade = lo < top + ROOF;
        let label = 0;
        if (hitsFacade) for (let j = 0; j < labels.length; j++) if (labels[j]) { label = j + 1; break; }
        const perspective = slopeChar(side * STREET, y - EYE_H), fade = clamp(1.15 - d / 260, 0.5, 1);
        const awning = [[1, 0.25, 0.25], [0.25, 0.75, 0.45], [0.35, 0.45, 1]][Math.floor(house.tone * 3) % 3];
        let color = null, glyph = 0;
        if (label === 1) { glyph = perspective; color = ZINC.map(v => v * 0.62); }
        else if (label === 2) { glyph = GLYPH("|"); color = STONE.map(v => v * 0.55); }
        else if (label === 3) { glyph = perspective; color = STONE.map(v => v * 0.7); }
        else if (label === 5) { glyph = perspective; color = IRON.map(v => v * 0.55); }
        else if (label === 6) { glyph = perspective; color = STONE.map(v => v * 0.55); }
        else if (label === 7) { glyph = perspective; color = awning.map(v => v * 0.85); }
        if (color) { char[i] = glyph; setColor(rgb, i, color.map(v => v * fade)); }
        let id = ((si * 100 + k) * 100 + Math.floor((y - 4.2) / 3.1) + 10) * 100 + Math.floor(a / 3.6);
        if (label === 8) id = SHOP + (si * 100 + k) * 100 + Math.floor(a / 6.5);
        if (label === 4 || label === 8 || label === 9) win[i] = id;
        if (hitsFacade) depth[i] = d * S;
      }
    }
    for (let i = 0; i < count; i++) {
      const u = uGrid[i], v = vGrid[i];
      if (!(v < 0 && depth[i] === Infinity)) continue;
      const dg = EYE_H / Math.max(-v, 1e-6), x = u * dg, dx = dg / (ZOOM * 0.5 * COLS);
      for (const x0 of [-11, -3.5, 3.5, 11]) if (Math.abs(x - x0) < 0.5 * dx && dg < ROW_END) {
        char[i] = slopeChar(x0, -EYE_H);
        setColor(rgb, i, STONE.map(vv => vv * 0.4 * clamp(1.2 - dg / ROW_END, 0.3, 1)));
      }
      let pool = 0;
      for (const lx of [-LAMP_X, LAMP_X]) for (const ld of LAMP_D)
        pool += Math.exp(-((x - lx) ** 2 + (dg - ld) ** 2) / 18);
      if (char[i] === 0 && pool > 0.25) {
        char[i] = FILL[0][HASH[i] % 12];
        setColor(rgb, i, LAMP.map(vv => vv * (0.25 + 0.4 * clamp(pool, 0, 1))));
      }
      wet[i] = char[i] === 0 ? 1 : 0;
    }
    const groundMask = new Uint8Array(count);
    for (let i = 0; i < count; i++) groundMask[i] = vGrid[i] < 0 && depth[i] === Infinity ? 1 : 0;
    addStaticTrees(char, rgb, depth);
    for (let i = 0; i < count; i++) wet[i] = groundMask[i] && char[i] === 0 ? 1 : 0;
    return { char, rgb, depth, win, wet, u: uGrid, v: vGrid };
  }
  function setColor(rgb, i, c) { rgb[i * 3] = c[0]; rgb[i * 3 + 1] = c[1]; rgb[i * 3 + 2] = c[2]; }
  function addStaticTrees(char, rgb, depth) {
    const rand = rng(23), ball = fibSphere(160), points = [];
    let part = 0;
    for (const side of [-1, 1]) for (const rowX of [30, 42]) for (let td = ROW_END + 30; td < CAM_DIST - 70; td += 10) {
      const radius = 3.8 + 1.4 * rand(), x0 = side * (rowX + normalRandom(rand) * 1.5);
      const y0 = 6 + 1.5 * rand(), d0 = td + normalRandom(rand) * 2, scale = 0.85 + 0.15 * rand();
      for (const b of ball) {
        const p = [x0 + b[0] * radius * scale, y0 + b[1] * radius * scale, d0 + b[2] * radius * scale];
        const lum = 0.35 + 0.45 * clamp(b[1] * 0.6 + 0.4, 0, 1);
        points.push({ p, lum, color: [0.18, 0.55, 0.36], part, glyph: -1 });
      }
      part++;
    }
    for (const lx of [-LAMP_X, LAMP_X]) for (const ld of LAMP_D) {
      for (let j = 0; j < 60; j++) points.push({ p: [lx, 4.4 * j / 59, ld], lum: 0.6, color: IRON.map(v => v * 0.7), part, glyph: GLYPH("|") });
      points.push({ p: [lx, 4.7, ld], lum: 1.4, color: LAMP, part, glyph: GLYPH("@") }); part++;
    }
    stampStaticBodies(points, char, rgb, depth);
  }
  function stampStaticBodies(points, char, rgb, depth) {
    const body = emptyBody();
    for (const p of points) {
      const cam = camStreet(p.p[0], p.p[1], p.p[2]), q = projectCam(cam), x = Math.floor(q[0]), y = Math.floor(q[1]);
      if (q[2] <= 1e-3 || x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
      const i = y * COLS + x;
      if (q[2] > body.depth[i]) continue;
      body.depth[i] = q[2]; body.part[i] = p.part; body.lum[i] = p.lum; body.char[i] = p.glyph;
      body.rgb.set(p.color, i * 3);
    }
    shadeBodies(body, 0);
    for (let i = 0; i < count; i++) if (body.depth[i] < depth[i]) {
      depth[i] = body.depth[i]; char[i] = body.char[i]; rgb.set(body.rgb.subarray(i * 3, i * 3 + 3), i * 3);
    }
  }
  function shadeBodies(body, t) {
    const edge = new Uint8Array(count), gx = new Int8Array(count), gy = new Int8Array(count);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const i = y * COLS + x, part = body.part[i];
      if (part < 0) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const xx = x + dx, yy = y + dy, nb = xx < 0 || xx >= COLS || yy < 0 || yy >= ROWS ? -1 : body.part[yy * COLS + xx];
        const nz = xx < 0 || xx >= COLS || yy < 0 || yy >= ROWS ? Infinity : body.depth[yy * COLS + xx];
        if (nb < 0 || (nb !== part && nz > body.depth[i] * 1.012 + 0.004)) {
          gx[i] += dx; gy[i] += dy; if (!dx || !dy) edge[i] = 1;
        }
      }
    }
    for (let i = 0; i < count; i++) if (body.part[i] >= 0) {
      const h = HASH[i], L = body.lum[i], level = clamp(Math.floor(L * 3.2), 0, 3);
      const own = body.char[i], bright = edge[i] || own >= 0 ? Math.max(0.85, L) : clamp(0.45 + 0.55 * L / 0.9, 0.45, 1);
      let glyph = own >= 0 ? own : edge[i] ? outline(gx[i], gy[i]) : FILL[level][mod(h + Math.trunc(t * 4 + h % 11), 12)];
      body.char[i] = glyph;
      body.rgb[i * 3] *= Math.min(bright, 1.5);
      body.rgb[i * 3 + 1] *= Math.min(bright, 1.5);
      body.rgb[i * 3 + 2] *= Math.min(bright, 1.5);
    }
  }
  function outline(gx, gy) {
    const ax = Math.abs(gx), ay = Math.abs(gy);
    if (ax + ay === 0) return GLYPH("+");
    if (ax > 2 * ay) return GLYPH("|");
    if (ay > 2 * ax) return GLYPH(gy > 0 ? "_" : "-");
    return GLYPH(gx * gy > 0 ? "/" : "\\");
  }

  function windowLit(id, t) {
    const h1 = mod(id * 0.7548776662, 1), h2 = mod(id * 0.5698402910, 1), h3 = mod(id * 0.4142135624, 1);
    const shop = id >= SHOP, on = shop ? h1 < 0.8 : h1 < 0.45;
    return [on !== (!shop && h2 < 0.25 && t > 1 + 19 * h3), h2, shop];
  }
  function reflection(char, rgb, t) {
    const rr = new Float64Array(ROWS);
    for (let y = 0; y < ROWS; y++) rr[y] = y;
    const grow = clamp((t - T_BUILD[0]) / 6.4, 0, 1);
    for (let i = 0; i < count; i++) {
      if (!background.wet[i]) continue;
      const y = Math.floor(i / COLS), v = background.v[i], u = background.u[i];
      const hm = -v * CAM_DIST * 2.2;
      const xr = Math.abs(u * CAM_DIST + 5 * Math.sin(t * 1.7 + rr[y] * 1.9) + 2 * Math.sin(t * 3.1 + rr[y] * 0.7));
      const w = halfWidth(hm), s = legSize(hm);
      let shape = hm < H_MERGE ? xr <= w && xr >= w - 2 * s : xr <= w && hm < 300;
      shape = shape || ((hm > 54 && hm < 66 && xr <= halfWidth(57) + 3) || (hm > 113 && hm < 123 && xr <= 21));
      if (!shape || hm >= 400 || hm >= TOWER_M * grow) continue;
      const h = HASH[i];
      if ((h + Math.trunc(t * 9)) % 4 === 0) continue;
      const lit = smooth((t - (T_GLOW[0] + (T_GLOW[1] - T_GLOW[0]) * hm / TOWER_M)) / 0.5);
      const k = (0.12 + 0.22 * (h % 5) / 4) * Math.exp(-(-v) * 10) * (0.5 + 0.8 * lit);
      char[i] = FILL[0][mod(h + Math.trunc(t * 6), 12)];
      rgb[i * 3] = (STEEL[0] + (GOLD[0] - STEEL[0]) * lit) * k;
      rgb[i * 3 + 1] = (STEEL[1] + (GOLD[1] - STEEL[1]) * lit) * k;
      rgb[i * 3 + 2] = (STEEL[2] + (GOLD[2] - STEEL[2]) * lit) * k;
    }
  }
  function put(char, rgb, y, x, glyph, color, strength) {
    if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return;
    const i = y * COLS + x; char[i] = GLYPH(glyph);
    rgb[i * 3] = color[0] * strength; rgb[i * 3 + 1] = color[1] * strength; rgb[i * 3 + 2] = color[2] * strength;
  }
  function rays(char, rgb, cy, cx, reach, color, strength) {
    const arms = [[0, 1, "-"], [0, -1, "-"], [1, 0, "|"], [-1, 0, "|"]];
    for (let d = 1; d <= reach; d++) {
      const fade = (1 - d / (reach + 1)) * strength, dirs = arms.slice();
      if (d <= Math.floor(reach / 2)) dirs.push([1, 1, "\\"], [-1, -1, "\\"], [1, -1, "/"], [-1, 1, "/"]);
      for (const [dy, dx, glyph] of dirs) {
        const y = cy + dy * d, x = cx + dx * d * (dy === 0 ? 2 : 1);
        if (y < 0 || y >= ROWS || x < 0 || x >= COLS) continue;
        const i = y * COLS + x, k = fade * (dx && dy ? 0.7 : 1);
        if (Math.max(rgb[i * 3], rgb[i * 3 + 1], rgb[i * 3 + 2]) < k) put(char, rgb, y, x, glyph, color, k);
      }
    }
    put(char, rgb, cy, cx, "*", color, 1.3 * strength);
  }
  function projectWorld(p) {
    return projectCam([p[0], p[1] - eyeY, -p[2] + eyeZ]);
  }
  function shootingStar(char, rgb, sky, t) {
    const schedule = t + 2, cycle = Math.floor(schedule / METEOR_PERIOD);
    const phase = schedule - cycle * METEOR_PERIOD;
    if (phase > METEOR_DURATION) return;
    const random = rng(6000 + cycle), direction = random() < 0.5 ? 1 : -1;
    const travelX = 18 + random() * 16, travelY = 6 + random() * 7;
    const x0 = direction > 0 ? random() * (COLS - travelX) : travelX + random() * (COLS - travelX);
    const y0 = 1 + random() * Math.max(1, Math.floor(HORIZON * ROWS) - travelY - 3);
    const progress = phase / METEOR_DURATION, headX = x0 + direction * travelX * progress;
    const headY = y0 + travelY * progress, length = Math.hypot(travelX, travelY);
    const trailGlyph = slopeChar(direction * travelX, -travelY), fade = 1 - 0.5 * progress;
    for (let k = 8; k >= 0; k--) {
      const distance = k * 1.1, x = Math.round(headX - direction * travelX / length * distance);
      const y = Math.round(headY - travelY / length * distance);
      if (x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
      const i = y * COLS + x;
      if (!sky[i]) continue;
      const strength = fade * (1 - k / 12);
      char[i] = k === 0 ? GLYPH("*") : k < 3 ? GLYPH("+") : trailGlyph;
      rgb[i * 3] = (k === 0 ? WHITE[0] : 0.62) * strength;
      rgb[i * 3 + 1] = (k === 0 ? WHITE[1] : 0.78) * strength;
      rgb[i * 3 + 2] = strength;
    }
  }
  function beacon(char, rgb, sky, steady, t) {
    const on = smooth((t - T_BEACON) / 0.8), top = [0, GROUND + 291 * S, 0];
    const tq = projectWorld(top), toEye = unit([-top[0], eyeY - top[1], eyeZ + top[2]]);
    let flare = 0;
    for (let j = 0; j < 2; j++) {
      const ang = t * 0.9 + j * Math.PI, dx = Math.cos(ang), dz = Math.sin(ang);
      const far = projectWorld([top[0] + dx * 6, top[1] + 0.035 * 6, top[2] + dz * 6]);
      const near = projectWorld([top[0] + dx * 0.12, top[1] + 0.035 * 0.12, top[2] + dz * 0.12]);
      const beamDx = (far[0] - near[0]) * cellAspect, beamDy = near[1] - far[1];
      const beamGlyph = Math.hypot(beamDx, beamDy) < 2 ? GLYPH(".") : slopeChar(beamDx, beamDy);
      for (let q = 0; q < 420; q++) {
        const s = 6 + (0.12 - 6) * q / 419, p = [top[0] + dx * s, top[1] + 0.035 * s, top[2] + dz * s];
        const pos = projectWorld(p), x = Math.floor(pos[0]), y = Math.floor(pos[1]), z = pos[2];
        const b = on * 0.85 * Math.exp(-s / 2.4) * smooth((z - 1.2) / 1.5);
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS || z <= 0.3 || b <= 0.05 || !sky[y * COLS + x]) continue;
        const i = y * COLS + x;
        char[i] = b < 0.18 ? GLYPH(".") : beamGlyph;
        rgb[i * 3] = BEAM[0] * b; rgb[i * 3 + 1] = BEAM[1] * b; rgb[i * 3 + 2] = BEAM[2] * b;
        steady[i] = 1;
      }
      const flareDot = clamp(dx * toEye[0] + 0.035 * toEye[1] + dz * toEye[2], 0, 1);
      flare = Math.max(flare, flareDot ** 10);
    }
    flare *= on;
    if (flare > 0.1) rays(char, rgb, Math.floor(tq[1]), Math.floor(tq[0]), Math.floor(3 + 6 * flare), BEAM, flare);
  }
  function fireworks(t) {
    const points = [], glyph = [], colors = [], flashes = [];
    if (t < T_FIREWORKS) return { points, glyph, colors, flashes };
    const last = Math.floor((t - T_FIREWORKS) / FIREWORK_EVERY);
    for (let b = Math.max(0, last - 6); b <= last; b++) {
      const rand = rng(1000 + b), t0 = T_FIREWORKS + b * FIREWORK_EVERY + rand() * 0.3;
      if (t < t0) continue;
      const burst = [(rand() < 0.5 ? -1 : 1) * (0.35 + 1.35 * rand()), -0.1 + 1.4 * rand(), -1 + 1.5 * rand()];
      const launch = [burst[0] + normalRandom(rand) * 0.06, GROUND, burst[2]];
      const paletteIds = Array.from({ length: FIREWORK.length }, (_, i) => i);
      for (let i = paletteIds.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1)); [paletteIds[i], paletteIds[j]] = [paletteIds[j], paletteIds[i]];
      }
      const palette = [FIREWORK[paletteIds[0]], FIREWORK[paletteIds[1]]];
      if (t < t0 + FIREWORK_RISE) {
        for (let k = 0; k < 6; k++) {
          const u = clamp((t - k * 0.04 - t0) / FIREWORK_RISE, 0, 1), f = 1 - (1 - u) ** 2;
          points.push([launch[2] + (burst[2] - launch[2]) * f, launch[1] + (burst[1] - launch[1]) * f,
            launch[0] + (burst[0] - launch[0]) * f]);
          glyph.push(GLYPH(k === 0 ? "|" : ".")); colors.push(LAMP.map(v => v * (1.2 - 0.18 * k)));
        }
        continue;
      }
      const age = t - t0 - FIREWORK_RISE;
      if (age > FIREWORK_LIFE) continue;
      const n = 36 + Math.floor(rand() * 20), dirs = fibSphere(n).map(p => unit(p.map(v => v + normalRandom(rand) * 0.1)));
      const speed0 = 0.5 + 0.2 * rand(), speeds = Array.from({ length: n }, () => speed0 * (0.9 + 0.15 * rand()));
      const fade = (1 - age / FIREWORK_LIFE) ** 1.4;
      for (let i = 0; i < n; i++) {
        const tw = age > 0.9 ? 0.5 + 0.5 * Math.sin(age * 40 + i * 2.3) : 1;
        const base = palette[i % 3 === 0 ? 1 : 0], hot = clamp(1 - age / 0.25, 0, 1);
        for (let k = 4; k >= 0; k--) {
          const lag = k * 0.05, a = Math.max(age - lag, 0);
          const xyz = [0, 1, 2].map(axis => burst[axis] + dirs[i][axis] * speeds[i] *
            (1 - Math.exp(-1.8 * a)) / 1.8 - (axis === 1 ? 0.12 * a * a : 0));
          const vel = dirs[i].map((v, axis) => v * speeds[i] * Math.exp(-1.8 * age) - (axis === 1 ? 0.24 * age : 0));
          const rgbK = 1.5 * fade * tw * [1, 0.75, 0.55, 0.38, 0.24][k];
          const color = base.map(v => (v + (1 - v) * hot) * rgbK);
          const screenVel = [vel[0], vel[1]];
          const stroke = slopeChar(screenVel[0], screenVel[1]);
          const head = rgbK > 0.8 ? "*" : rgbK > 0.35 ? "+" : ".";
          points.push([xyz[2], xyz[1], xyz[0]]);
          glyph.push(GLYPH(k === 0 ? head : age > 1.1 ? "." : String.fromCharCode(stroke + 32)));
          colors.push(color);
        }
      }
      if (age < 0.18) flashes.push({ p: [burst[2], burst[1], burst[0]], k: 1 - age / 0.18, color: palette[0] });
    }
    return { points, glyph, colors, flashes };
  }
  function overlayWorldPoints(char, rgb, depth, points, glyphs, colors) {
    for (let k = 0; k < points.length; k++) {
      const q = projectWorld(points[k]), x = Math.floor(q[0]), y = Math.floor(q[1]);
      if (q[2] <= 0.3 || x < 0 || x >= COLS || y < 0 || y >= ROWS) continue;
      const i = y * COLS + x;
      if (q[2] >= depth[i]) continue;
      char[i] = glyphs[k]; rgb[i * 3] = colors[k][0]; rgb[i * 3 + 1] = colors[k][1]; rgb[i * 3 + 2] = colors[k][2];
    }
  }
  function compose(t) {
    towerPoints(t);
    shadeBodies(sceneBody, t);
    const char = background.char.slice(), rgb = background.rgb.slice(), depth = background.depth.slice();
    for (let i = 0; i < count; i++) {
      const id = background.win[i];
      if (id < 0) continue;
      const [lit, h2, shop] = windowLit(id, t), h = HASH[i];
      if (!lit) { char[i] = 0; setColor(rgb, i, [0, 0, 0]); }
      else {
        char[i] = shop ? FILL[2][h % 12] : GLYPH(h2 < 0.7 ? "#" : "=");
        setColor(rgb, i, (h2 < 0.85 ? WARM : COOL).map(v => v * 0.85));
      }
    }
    reflection(char, rgb, t);
    for (let i = 0; i < count; i++) if (sceneBody.depth[i] < depth[i]) {
      char[i] = sceneBody.char[i]; rgb[i * 3] = sceneBody.rgb[i * 3];
      rgb[i * 3 + 1] = sceneBody.rgb[i * 3 + 1]; rgb[i * 3 + 2] = sceneBody.rgb[i * 3 + 2];
      depth[i] = sceneBody.depth[i];
    }
    const fade = smooth(t / 0.8);
    for (let i = 0; i < rgb.length; i++) rgb[i] *= fade;

    const sky = new Uint8Array(count), horizon = Math.floor(HORIZON * ROWS);
    for (let y = 0; y < horizon; y++) for (let x = 0; x < COLS; x++) {
      const i = y * COLS + x; if (char[i] === 0) sky[i] = 1;
    }
    for (let i = 0; i < SKY.length; i++) {
      const x = skyX[i], y = skyY[i], index = y * COLS + x;
      if (!sky[index]) continue;
      const s = SKY[i][2], tw = 0.12 + 0.6 * Math.max(0, Math.sin(t * (1 + 2 * s) + s * 50)) ** 4;
      char[index] = GLYPH(tw < 0.35 ? "." : tw < 0.6 ? "+" : "*");
      setColor(rgb, index, WHITE.map(v => v * tw));
    }
    shootingStar(char, rgb, sky, t);
    const steady = new Uint8Array(count);
    if (t > T_BEACON) beacon(char, rgb, sky, steady, t);

    const fw = fireworks(t);
    overlayWorldPoints(char, rgb, depth, fw.points, fw.glyph, fw.colors);
    for (const f of fw.flashes) {
      const q = projectWorld(f.p), x = Math.floor(q[0]), y = Math.floor(q[1]);
      if (x >= 0 && x < COLS && y >= 0 && y < ROWS && q[2] < depth[y * COLS + x])
        rays(char, rgb, y, x, Math.floor(2 + 5 * f.k), f.color, f.k);
    }

    let sparkleCount = 0;
    if (t > T_SPARKLE) {
      const rate = 0.075 * smooth((t - T_SPARKLE) / 1.5), active = [];
      for (let j = 0; j < TW.length; j++) {
        const phase = mod(t * TW_RATE[j] + TW_PHASE[j], 1);
        if (phase < rate) active.push([j, phase / Math.max(rate, 1e-6)]);
      }
      sparkleCount = active.length;
      const candidates = [];
      for (const [j, fresh] of active) {
        const p = parts[TW[j]], q = projectCam(camTower(p.c[0] + p.o[0], p.c[1] + p.o[1], p.c[2] + p.o[2]));
        const x = Math.floor(q[0]), y = Math.floor(q[1]);
        if (x < 0 || x >= COLS || y < 0 || y >= ROWS || q[2] > depth[y * COLS + x] + 0.06) continue;
        const i = y * COLS + x; char[i] = GLYPH(fresh < 0.5 ? "*" : "+"); setColor(rgb, i, WHITE.map(v => v * 1.3));
        candidates.push({ x, y, fresh });
      }
      candidates.sort((a, b) => a.fresh - b.fresh);
      for (let j = 0; j < Math.min(3, candidates.length); j++) {
        const p = candidates[j]; rays(char, rgb, p.y, p.x, 4, WHITE, 0.9);
      }
    }
    if (t > T_GLOW[1]) {
      const q = projectWorld([0, GROUND + TOWER_M * S + 0.02, 0]), blink = Math.sin(t * 3.5) > 0.2;
      put(char, rgb, Math.floor(q[1]), Math.floor(q[0]), blink ? "@" : "o", RED, blink ? 1.3 : 0.35);
    }
    let letterCount = 0; for (const g of char) if (g > 0) letterCount++;
    return { char, rgb, steady, info: { sparkles: sparkleCount, fireworks: fw.points.length, letters: letterCount } };
  }
  function cssColor(r, g, b) {
    return `rgb(${Math.round(clamp(r, 0, 1.3) * 255)} ${Math.round(clamp(g, 0, 1.3) * 255)} ${Math.round(clamp(b, 0, 1.3) * 255)})`;
  }
  function drawGlyphs(target, char, rgb, steady, staticOnly) {
    target.clearRect(0, 0, W, H);
    target.font = "15px Consolas, Menlo, 'DejaVu Sans Mono', 'Courier New', monospace";
    target.textAlign = "center"; target.textBaseline = "middle";
    for (let i = 0; i < count; i++) {
      const g = char[i];
      if (g <= 0 || (staticOnly ? !steady[i] : steady[i])) continue;
      const x = i % COLS, y = Math.floor(i / COLS), rgbI = i * 3;
      target.fillStyle = cssColor(rgb[rgbI], rgb[rgbI + 1], rgb[rgbI + 2]);
      target.fillText(String.fromCharCode(g + 32), x * CW + CW / 2, y * CH + CH / 2);
    }
  }
  function drawHUD(info, t) {
    composite.font = "14px Consolas, Menlo, 'DejaVu Sans Mono', 'Courier New', monospace";
    composite.textAlign = "left"; composite.textBaseline = "alphabetic";
    composite.fillStyle = "rgb(176 168 196)"; composite.fillText("@tamphung.asci", 24, H - 74);
    composite.fillStyle = "rgb(110 104 120)";
    composite.fillText(`sparkles ${String(info.sparkles).padStart(4)}      fireworks ${String(info.fireworks).padStart(4)}`, 24, H - 48);
    composite.fillText(`letters ${info.letters.toLocaleString("en-US")}`, 24, H - 27);
    composite.fillStyle = "rgb(255 196 90)";
    composite.textAlign = "left";
    composite.fillText(`${Math.floor(t * 2) % 2 === 0 ? "●" : " "} t ${t.toFixed(2).padStart(5, "0")}s`, 24, 21);
  }
  function draw(t) {
    const frame = compose(t);
    drawGlyphs(moving, frame.char, frame.rgb, frame.steady, false);
    drawGlyphs(still, frame.char, frame.rgb, frame.steady, true);
    trail.globalCompositeOperation = "destination-in"; trail.globalAlpha = 0.45;
    trail.fillStyle = "#fff"; trail.fillRect(0, 0, W, H);
    trail.globalAlpha = 1; trail.globalCompositeOperation = "lighter";
    trail.drawImage(moveCanvas, 0, 0);
    trail.globalCompositeOperation = "source-over";
    composite.clearRect(0, 0, W, H); composite.drawImage(trailCanvas, 0, 0); composite.drawImage(stillCanvas, 0, 0);
    drawHUD(frame.info, t);
    ctx.fillStyle = "#030408"; ctx.fillRect(0, 0, W, H);
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.filter = "blur(3px)"; ctx.globalAlpha = 0.62;
    ctx.drawImage(compositeCanvas, 0, 0); ctx.filter = "blur(11px)"; ctx.globalAlpha = 0.34;
    ctx.drawImage(compositeCanvas, 0, 0); ctx.restore(); ctx.drawImage(compositeCanvas, 0, 0);
  }
  function restart() { elapsed = 0; trail.clearRect(0, 0, W, H); draw(0); }
  window.addEventListener("keydown", event => {
    if (event.code === "Space") { event.preventDefault(); running = !running; }
    else if (event.key.toLowerCase() === "r") restart();
    else if (event.key.toLowerCase() === "s") {
      const link = document.createElement("a"); link.download = `eiffel-${Math.floor(Date.now() / 1000)}.png`;
      link.href = canvas.toDataURL("image/png"); link.click();
    } else if (event.key === "Escape") { running = false; }
  });
  function animate(now) {
    if (!lastTime) lastTime = now;
    const dt = Math.min((now - lastTime) / 1000, 1 / 15); lastTime = now;
    if (running) { elapsed += dt; draw(elapsed); }
    requestAnimationFrame(animate);
  }
  draw(0); requestAnimationFrame(animate);
})();
