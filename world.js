// Pixel Bazaar world: a 110 x 64 tile map with seven areas, built in code from the tilesets.
'use strict';

const World = (() => {
  const TS = 16, SC = 2, TW = TS * SC, W = 110, H = 64;
  let rs = 21;
  const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
  const choice = a => a[Math.floor(rnd() * a.length)];

  const ISLAND = { x0: 100, x1: 107, y0: 26, y1: 35 };
  const inIsland = (x, y) => x >= ISLAND.x0 && x <= ISLAND.x1 && y >= ISLAND.y0 && y <= ISLAND.y1;
  function zone(x, y) {
    if (inIsland(x, y)) return 'island';
    if (x >= 88) return 'sea';
    if (x <= 31) return 'farm';
    if (x >= 72 && y <= 17) return 'snow';
    if (x >= 34 && y <= 17) return 'woods';
    if (x >= 76) return 'harbor';
    return 'town';
  }
  const ZONE_NAME = { farm: 'Hill Farms', woods: 'Forest Edge', snow: 'Frost Camp', town: 'Town', harbor: 'Harbor', island: 'Secret Island', sea: 'Sea' };
  const BASE = {
    farm: [[0, 12], [1, 12], [3, 12]], town: [[0, 12], [1, 12], [2, 12], [3, 12], [4, 12]],
    woods: [[11, 12], [12, 12], [13, 12], [14, 12]], snow: [[0, 19], [1, 19], [2, 19]],
    harbor: [[0, 5], [1, 5], [2, 5]], island: [[0, 5], [1, 5], [2, 5]],
  };

  const water = new Set(), dirt = new Set(), walkable = new Set();
  const solid = Array.from({ length: H }, () => new Array(W).fill(false));
  const props = [];
  const key = (x, y) => x + ',' + y;
  let ground, gctx, IMG;

  function tileTo(ctx, img, sx, sy, x, y, w = 1, h = 1) {
    ctx.drawImage(IMG[img], sx * TS, sy * TS, w * TS, h * TS, x * TW, y * TW, w * TW, h * TW);
  }
  function prop(img, sx, sy, w, h, x, y, solidRows = h, extra = {}) {
    const p = Object.assign({ img, sx, sy, w, h, x, y }, extra);
    props.push(p);
    for (let yy = y + h - solidRows; yy < y + h; yy++)
      for (let xx = x; xx < x + w; xx++) if (yy >= 0 && yy < H && xx >= 0 && xx < W) solid[yy][xx] = true;
    return p;
  }
  function lake(x0, y0, x1, y1) { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) water.add(key(x, y)); }
  function road(x0, y0, x1, y1) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++)
      if (!water.has(key(x, y)) && ['farm', 'town', 'woods'].includes(zone(x, y))) dirt.add(key(x, y));
  }
  const free2 = (x, y) => [0, 1].every(a => [0, 1].every(b => !dirt.has(key(x + a, y + b)) && !water.has(key(x + a, y + b)) && !solid[y + b]?.[x + a]));

  // Special places (tile coordinates). The game reads these.
  const P = {
    start: { x: 40.5, y: 28.6 }, homeDoor: { x: 40, y: 27.5 },
    tomo: { x: 46.5, y: 39.7 }, board: { x: 54.5, y: 35.2 },
    mei: { x: 51.5, y: 33.6 }, bram: { x: 64.5, y: 49.6 }, ritaHome: { x: 67.5, y: 28.6 }, ritaMarket: { x: 45.5, y: 41.2 },
    sailor: { x: 94.5, y: 31.6 }, master: { x: 81.5, y: 24.6 }, farmer: { x: 15.5, y: 26.6 },
    hermit: { x: 79.5, y: 16.6 }, seer: { x: 45.5, y: 9.2 }, fisher: { x: 53.5, y: 52.6 },
    bridge: { x: 34.5, y: 31 }, boatDock: { x: 96.5, y: 39.6 }, boatIsland: { x: 101.5, y: 34.6 }, chest: { x: 103.5, y: 32.8 },
    v1: { x: 58.5, y: 31.6 }, v2: { x: 44.5, y: 45.6 }, kaito: { x: 42.5, y: 41.2 }, cat: { x: 41.5, y: 28.4 },
    // farm plots: 12 behind your house, 6 on the Hill Farms past the bridge
    plots: [...[18, 19].flatMap(y => [42, 43, 44, 45, 46, 47].map(x => ({ x, y }))), ...[18, 19, 20, 21, 22, 23].map(x => ({ x, y: 27 }))],
    rocks: [[41, 11], [52, 12], [80, 5], [79, 9], [83, 12], [73, 15], [81, 14], [86, 10]].map(([x, y]) => ({ x, y })),
    fishSpots: [{ x: 54.5, y: 49.9 }, { x: 92.5, y: 30.7 }],
    // doors to the other worlds
    gates: [
      { to: 'woods', x: 46.5, y: 2.4, label: 'INTO THE WHISPERING WOODS' },
      { to: 'moon', x: 55.5, y: 27.9, label: 'THROUGH THE MOON GATE', night: true },
      { to: 'shrine', x: 106.5, y: 30.6, label: 'DIVE TO THE SUNKEN SHRINE' },
      { to: 'sky', x: 83.5, y: 3.4, label: 'RIDE THE WIND TO THE CLOCKWORK SKY' },
    ],
  };

  function build(images) {
    IMG = images;
    // ---- water ----
    lake(88, 0, 109, 63); lake(32, 0, 33, 63); lake(46, 49, 60, 58);
    for (let x = ISLAND.x0; x <= ISLAND.x1; x++) for (let y = ISLAND.y0; y <= ISLAND.y1; y++) water.delete(key(x, y));
    // ---- roads ----
    road(0, 30, 75, 31); road(55, 10, 56, 48); road(40, 35, 68, 41); road(6, 12, 7, 29); road(6, 12, 26, 13); road(56, 15, 71, 16);
    road(39, 28, 40, 29); road(66, 29, 67, 29); road(46, 1, 47, 9);
    // ---- walkable planks over water: harbor docks, lake pier ----
    for (let x = 88; x <= 97; x++) for (const y of [30, 31]) walkable.add(key(x, y));
    for (let y = 32; y <= 39; y++) { walkable.add(key(96, y)); walkable.add(key(97, y)); }
    for (let y = 49; y <= 52; y++) { walkable.add(key(53, y)); walkable.add(key(54, y)); }
    for (let x = 100; x <= 101; x++) walkable.add(key(x, 35));

    // ---- props: Hill Farms ----
    for (const [x, y] of [[4, 15], [10, 15], [4, 19], [10, 19]]) prop('element', 13, 4, 3, 3, x, y, 0);
    for (let row = 36; row < 56; row += 3) for (let x = 4; x < 28; x++) prop('nature', row % 2 ? 9 : 8, 10, 1, 1, x, row, 0);
    for (let i = 0; i < 5; i++) prop('element', 1, 1, 1, 1, 18 + i * 2, 18, 1);
    prop('element', 15, 0, 1, 1, 16, 21, 1); prop('element', 0, 3, 2, 2, 22, 22, 1);
    prop('house', 25, 11, 4, 3, 18, 8); prop('house', 8, 0, 4, 3, 10, 7);
    // ---- Whispering Woods ----
    prop('house', 0, 7, 2, 2, 44, 6); prop('house', 0, 5, 3, 2, 58, 4, 1); prop('house', 1, 15, 2, 3, 64, 8);
    prop('nature', 0, 12, 2, 2, 48, 12); prop('nature', 4, 12, 2, 2, 40, 12);
    for (const [x, y] of [[51, 5], [37, 9], [67, 13], [46, 15]]) prop('nature', 0, 8, 2, 2, x, y, 1);
    // ---- Frost Camp ----
    prop('house', 0, 11, 3, 3, 75, 4); prop('house', 6, 11, 3, 3, 82, 8); prop('house', 3, 11, 3, 3, 76, 11);
    // ---- rocks to mine (boulders) ----
    P.rockProps = P.rocks.map((r, i) => prop('nature', i % 2 ? 4 : 0, 12, 2, 2, r.x, r.y, 1, { rock: i }));
    // ---- Town ----
    prop('house', 0, 5, 3, 2, 54, 26, 0);          // torii gate over the north road (walk-through)
    prop('house', 0, 0, 4, 3, 38, 24);             // your home
    prop('house', 16, 0, 3, 3, 44, 24); prop('house', 12, 0, 4, 3, 60, 24); prop('house', 23, 0, 3, 3, 66, 25);
    prop('house', 4, 0, 4, 3, 38, 43); prop('house', 8, 0, 4, 3, 62, 44); prop('house', 4, 4, 2, 1, 63, 43, 0);
    prop('house', 19, 0, 4, 3, 70, 34);
    for (let i = 0; i < 4; i++) prop('house', 22 + i, 20, 1, 2, 47 + i * 3, 32, 1);
    prop('house', 1, 15, 2, 3, 58, 36);
    prop('house', 16, 16, 3, 2, 43, 37, 1);
    [[16, 13], [17, 13], [18, 13], [19, 14], [20, 14], [16, 14], [17, 14]].forEach(([sx, sy], i) => prop('house', sx, sy, 1, 1, 47 + i, 38));
    prop('house', 3, 3, 1, 1, 54, 34);
    // ---- Harbor ----
    prop('house', 19, 0, 4, 3, 79, 20); prop('house', 12, 0, 4, 3, 80, 41);
    for (let i = 0; i < 9; i++) prop('house', 16 + i % 3, 14 + Math.floor(i / 3) % 2, 1, 1, 79 + i % 3, 33 + Math.floor(i / 3));
    for (let i = 0; i < 4; i++) prop('house', 16 + i % 2, 12, 1, 1, 84 + i % 2, 26 + Math.floor(i / 2));
    prop('water', 25, 0, 3, 1, 92, 22, 0); prop('water', 25, 0, 3, 1, 98, 38, 0, { boat: true }); prop('water', 25, 0, 3, 1, 56, 53, 0);
    // ---- Secret island ----
    prop('nature', 4, 13, 1, 1, 102, 28); prop('nature', 5, 13, 1, 1, 105, 33); prop('nature', 14, 0, 2, 2, 104, 27, 1);
    P.chestProp = prop('element', 8, 1, 1, 1, 103, 31);

    // ---- trees ----
    const broad = [[0, 0], [2, 0], [6, 0], [14, 0]], woods = [[0, 0], [2, 0], [4, 0], [6, 0]], snow = [[8, 0], [10, 0]];
    const keepClear = (x, y) => (x >= 43 && x <= 50 && y >= 0 && y <= 11) || (x >= 81 && x <= 86 && y >= 1 && y <= 5) || (x >= 56 && x <= 67 && y >= 2 && y <= 12) || (x >= 38 && x <= 57 && y >= 9 && y <= 14);
    for (let x = 34; x < 72; x += 2) for (let y = 0; y < 18; y += 2)
      if (rnd() < .6 && free2(x, y) && !keepClear(x, y)) prop('nature', ...choice(woods), 2, 2, x, y, 1);
    for (const [x, y] of [[72, 0], [74, 1], [84, 0], [86, 4], [72, 8], [85, 14], [80, 1], [78, 7]]) if (free2(x, y)) prop('nature', ...choice(snow), 2, 2, x, y, 1);
    for (let x = 0; x < 31; x += 2) for (const y of [0, 2, 60, 62]) if (free2(x, y)) prop('nature', ...choice(broad), 2, 2, x, y, 1);
    for (let x = 34; x < 88; x += 2) for (const y of [60, 62]) if (free2(x, y)) prop('nature', ...choice(broad), 2, 2, x, y, 1);
    for (let y = 18; y < 60; y += 2) if (free2(34, y) && y !== 30) prop('nature', ...choice(broad), 2, 2, 34, y, 1);
    for (const [x, y] of [[36, 20], [70, 20], [36, 46], [70, 47], [44, 47], [3, 4], [26, 4], [28, 26], [2, 58], [28, 58], [86, 45], [86, 52], [77, 55], [64, 53], [40, 55]])
      if (free2(x, y)) prop('nature', ...choice(broad), 2, 2, x, y, 1);

    // ---- collision from water ----
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (water.has(key(x, y)) && !walkable.has(key(x, y))) solid[y][x] = true;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) solid[y][x] = true;
    }
    // broken bridge stays solid until repaired
    for (const y of [30, 31]) for (const x of [32, 33]) solid[y][x] = true;

    // ---- paint ground ----
    ground = document.createElement('canvas'); ground.width = W * TW; ground.height = H * TW;
    gctx = ground.getContext('2d'); gctx.imageSmoothingEnabled = false;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const z = zone(x, y); if (z === 'sea') continue;
      const b = BASE[z]; const t = rnd() < .75 ? b[0] : choice(b);
      tileTo(gctx, 'floor', t[0], t[1], x, y);
    }
    const hw = (x, y) => water.has(key(x, y)) || x < 0 || y < 0 || x >= W || y >= H;
    for (const k of water) {
      const [x, y] = k.split(',').map(Number);
      const u = hw(x, y - 1), d = hw(x, y + 1), l = hw(x - 1, y), r = hw(x + 1, y);
      tileTo(gctx, 'water', l && r ? 1 : (!l ? 0 : 2), u && d ? 7 : (!u ? 6 : 8), x, y);
    }
    const hd = (x, y) => dirt.has(key(x, y)) || water.has(key(x, y)) || x < 0 || y < 0 || x >= W || y >= H || ['harbor', 'snow'].includes(zone(x, y));
    for (const k of dirt) {
      const [x, y] = k.split(',').map(Number);
      const u = hd(x, y - 1), d = hd(x, y + 1), l = hd(x - 1, y), r = hd(x + 1, y);
      tileTo(gctx, 'floor', l && r ? 1 : (!l ? 0 : 2), u && d ? 8 : (!u ? 7 : 9), x, y);
    }
    for (const k of walkable) { const [x, y] = k.split(',').map(Number); tileTo(gctx, 'water', 1, 12, x, y); }
    paintBridge(false);
    for (const [x, y] of [[48, 51], [57, 55], [50, 57], [58, 50]]) tileTo(gctx, 'water', 11, 3, x, y);
    // ground details per area
    for (let i = 0; i < 700; i++) {
      const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
      if (dirt.has(key(x, y)) || water.has(key(x, y)) || solid[y][x] || P.plots.some(p => p.x === x && p.y === y)) continue;
      const z = zone(x, y);
      if (z === 'farm' || z === 'town') tileTo(gctx, 'nature', Math.floor(rnd() * 8), 11, x, y);
      else if (z === 'woods') tileTo(gctx, 'detail', Math.floor(rnd() * 8), 2, x, y);
      else if (z === 'snow') tileTo(gctx, 'detail', Math.floor(rnd() * 8), 3, x, y);
      else if (z === 'harbor' || z === 'island') tileTo(gctx, 'detail', choice([2, 3, 11, 12, 15]), 0, x, y);
    }
    return { ground, props, solid, P };
  }
  function paintBridge(fixed) {
    for (const y of [30, 31]) {
      tileTo(gctx, 'water', 1, 12, 32, y);
      if (fixed) tileTo(gctx, 'water', 1, 12, 33, y); else { tileTo(gctx, 'water', 1, 7, 33, y); }
    }
  }
  function repairBridge() { paintBridge(true); for (const y of [30, 31]) for (const x of [32, 33]) solid[y][x] = false; }
  function minimap(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = true; x.fillStyle = '#4fb8d8'; x.fillRect(0, 0, w, h);
    x.drawImage(ground, 0, 0, w, h);
    for (const p of props) if (p.img === 'house' && p.h >= 3) { x.fillStyle = '#c0583a'; x.fillRect(p.x * w / W, p.y * h / H, p.w * w / W, p.h * h / H); }
    return c;
  }
  return { TS, SC, TW, W, H, zone, ZONE_NAME, build, repairBridge, minimap, P, inIsland };
})();
