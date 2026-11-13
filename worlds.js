// The Lantern Isles beyond the town: Whispering Woods, Moon Market, Sunken Shrine, Clockwork Sky.
// Each world is built in code from the same tilesets as the town and has the same shape as the town map
// ({ ground, props, solid }), so the game can swap between them.
'use strict';

const Worlds = (() => {
  const TS = 16, SC = 2, TW = TS * SC;
  const key = (x, y) => x + ',' + y;

  function make(spec, IMG) {
    const W = spec.W, H = spec.H;
    let rs = spec.seed;
    const rnd = () => { rs = (rs * 16807) % 2147483647; return rs / 2147483647; };
    const choice = a => a[Math.floor(rnd() * a.length)];
    const solid = Array.from({ length: H }, () => new Array(W).fill(false));
    const props = [], water = new Set(), path = new Set(), walk = new Set(), voidc = new Set(), objects = [];
    const prop = (img, sx, sy, w, h, x, y, solidRows = h, extra = {}) => {
      const p = Object.assign({ img, sx, sy, w, h, x, y }, extra); props.push(p);
      for (let yy = y + h - solidRows; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (yy >= 0 && yy < H && xx >= 0 && xx < W) solid[yy][xx] = true;
      return p;
    };
    const rect = (set, x0, y0, x1, y1) => { for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) set.add(key(x, y)); };
    const clear = (x, y) => !path.has(key(x, y)) && !water.has(key(x, y)) && !voidc.has(key(x, y)) && !solid[y]?.[x] && x > 0 && y > 0 && x < W - 1 && y < H - 1;
    const free2 = (x, y) => [0, 1].every(a => [0, 1].every(b => clear(x + a, y + b)));
    const api = { W, H, rnd, choice, prop, rect, water, path, walk, voidc, solid, objects, free2, clear, key };
    const P = spec.layout(api);

    // collision: water, the void and the edges
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if ((water.has(key(x, y)) || voidc.has(key(x, y))) && !walk.has(key(x, y))) solid[y][x] = true;
      if (x === 0 || y === 0 || x === W - 1 || y === H - 1) solid[y][x] = true;
    }
    for (const o of objects) if (o.solid) solid[Math.floor(o.y)][Math.floor(o.x)] = true;

    // paint
    const ground = document.createElement('canvas'); ground.width = W * TW; ground.height = H * TW;
    const g = ground.getContext('2d'); g.imageSmoothingEnabled = false;
    const tile = (img, sx, sy, x, y) => g.drawImage(IMG[img], sx * TS, sy * TS, TS, TS, x * TW, y * TW, TW, TW);
    g.fillStyle = spec.voidColor || '#2a6f97'; g.fillRect(0, 0, W * TW, H * TW);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (voidc.has(key(x, y))) continue;
      const t = rnd() < .75 ? spec.base[0] : choice(spec.base); tile('floor', t[0], t[1], x, y);
    }
    const hw = (x, y) => water.has(key(x, y)) || voidc.has(key(x, y)) || x < 0 || y < 0 || x >= W || y >= H;
    for (const k of water) { const [x, y] = k.split(',').map(Number); const u = hw(x, y - 1), d = hw(x, y + 1), l = hw(x - 1, y), r = hw(x + 1, y); tile('water', l && r ? 1 : (!l ? 0 : 2), u && d ? 7 : (!u ? 6 : 8), x, y); }
    const hp = (x, y) => path.has(key(x, y)) || water.has(key(x, y)) || x < 0 || y < 0 || x >= W || y >= H;
    const pr = spec.pathRows || [7, 8, 9];
    for (const k of path) { const [x, y] = k.split(',').map(Number); const u = hp(x, y - 1), d = hp(x, y + 1), l = hp(x - 1, y), r = hp(x + 1, y); tile('floor', l && r ? 1 : (!l ? 0 : 2), u && d ? pr[1] : (!u ? pr[0] : pr[2]), x, y); }
    for (const k of walk) { if (!water.has(k) && !voidc.has(k)) continue; const [x, y] = k.split(',').map(Number); tile('water', 1, 12, x, y); }
    // the edge of floating islands: a darker lip under the floor
    if (spec.islands) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!voidc.has(key(x, y)) && voidc.has(key(x, y + 1))) {
      g.fillStyle = '#8a7a6a'; g.fillRect(x * TW, (y + 1) * TW, TW, 10); g.fillStyle = '#5e5248'; g.fillRect(x * TW, (y + 1) * TW + 10, TW, 8);
    }
    for (let i = 0; i < (spec.details || 0); i++) {
      const x = Math.floor(rnd() * W), y = Math.floor(rnd() * H);
      if (clear(x, y)) tile(spec.detailImg || 'detail', Math.floor(rnd() * 8), spec.detailRow || 2, x, y);
    }
    const mini = document.createElement('canvas'); mini.width = 176; mini.height = 102;
    const m = mini.getContext('2d'); m.drawImage(ground, 0, 0, 176, 102);
    return { id: spec.id, name: spec.name, W, H, map: { ground, props, solid }, mini, P, objects, spec };
  }

  // ---------------------------------------------------------------- Whispering Woods
  const woods = {
    id: 'woods', name: 'Whispering Woods', W: 60, H: 44, seed: 77, zone: 1, music: 'woods', dark: true, tint: 'rgba(10,40,30,.28)',
    base: [[11, 12], [12, 12], [13, 12], [14, 12]], details: 260, detailRow: 2,
    layout(a) {
      // a winding path from the south edge to the clearing, and on to the old gate in the north
      const pts = [[30, 43], [30, 38], [24, 33], [26, 27], [30, 22], [36, 16], [32, 10], [30, 5]];
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        for (let k = 0; k <= n; k++) { const x = Math.round(x0 + (x1 - x0) * k / n), y = Math.round(y0 + (y1 - y0) * k / n); a.rect(a.path, x - 1, y, x, y); }
      }
      a.rect(a.path, 24, 16, 36, 24); // the clearing
      a.rect(a.water, 8, 8, 14, 13); a.rect(a.water, 44, 30, 51, 35); // still ponds
      a.rect(a.walk, 9, 13, 9, 13);
      // braziers (the puzzle), around the clearing
      const br = [[25.5, 17.2], [34.5, 17.2], [34.5, 23.2], [25.5, 23.2]];
      br.forEach(([x, y], i) => a.objects.push({ kind: 'brazier', i, x, y, solid: true }));
      a.objects.push({ kind: 'tablet', x: 30.5, y: 20.4, solid: true, text: 'Light the four flames in the order the wind whispers today. A wrong flame puts them all out.' });
      a.objects.push({ kind: 'gate', x: 30.5, y: 3.6, text: 'An old spirit gate, sealed. The Great Spirit sleeps beyond it.' });
      // old torii and stones
      a.prop('house', 0, 5, 3, 2, 29, 6, 1); a.prop('house', 0, 19, 3, 3, 40, 18); a.prop('house', 4, 19, 2, 3, 18, 26);
      // dense trees: dead and living
      const trees = [[0, 0], [2, 0], [4, 0], [4, 0], [6, 0]];
      for (let x = 1; x < a.W - 2; x += 2) for (let y = 1; y < a.H - 2; y += 2) if (a.rnd() < .72 && a.free2(x, y)) a.prop('nature', ...a.choice(trees), 2, 2, x, y, 1);
      return { spawn: { x: 30.5, y: 41.6 }, exit: { x: 30.5, y: 42.8, to: 'town', label: 'BACK TO TOWN' }, gate: { x: 30.5, y: 3.6 } };
    },
  };

  // ---------------------------------------------------------------- Moon Market (night only)
  const moon = {
    id: 'moon', name: 'Moon Market', W: 40, H: 30, seed: 91, zone: 4, music: 'moon', night: true, tint: 'rgba(40,20,80,.38)',
    base: [[0, 12], [1, 12], [2, 12]], details: 120, detailImg: 'nature', detailRow: 11,
    layout(a) {
      a.rect(a.path, 4, 13, 35, 17); a.rect(a.path, 18, 4, 21, 26);
      a.rect(a.water, 26, 21, 33, 26);
      // stalls and lanterns
      for (const [x, y] of [[6, 10], [12, 10], [24, 10], [30, 10]]) a.prop('house', 16, 16, 3, 2, x, y, 1);
      for (const [x, y] of [[6, 19], [12, 19], [24, 19]]) a.prop('house', 16 + (x % 3), 14, 1, 1, x + 1, y);
      for (let i = 0; i < 6; i++) a.prop('house', 22 + (i % 4), 20, 1, 2, 5 + i * 5, 4, 1);
      a.prop('house', 0, 5, 3, 2, 18, 26, 0); // the moon gate back home
      a.objects.push({ kind: 'merchant', x: 15.5, y: 12.8, solid: true, text: 'Rita runs the duel table at night.' });
      a.objects.push({ kind: 'lamp', x: 9.5, y: 15.2, text: 'A moon lamp. Its flame burns blue at night, when spirits trade their secrets.' });
      a.objects.push({ kind: 'lamp', x: 28.5, y: 15.2, text: 'Scratched under the lamp: "Rita sells what she lies about. Watch her stall."' });
      a.objects.push({ kind: 'lamp', x: 19.5, y: 7.2, text: 'The tallest lamp. From here you can see the whole Moon Market, and the dark woods to the north.' });
      for (let x = 1; x < a.W - 2; x += 2) for (const y of [1, a.H - 3]) if (a.free2(x, y)) a.prop('nature', 14, 0, 2, 2, x, y, 1);
      return { spawn: { x: 19.5, y: 24.6 }, exit: { x: 19.5, y: 27.6, to: 'town', label: 'THROUGH THE MOON GATE, HOME' } };
    },
  };

  // ---------------------------------------------------------------- Sunken Shrine (needs a water spirit)
  const shrine = {
    id: 'shrine', name: 'Sunken Shrine', W: 50, H: 40, seed: 53, zone: 2, music: 'shrine', tint: 'rgba(20,90,120,.25)', needs: 1,
    base: [[0, 5], [1, 5], [2, 5]], details: 90, detailRow: 0,
    layout(a) {
      a.rect(a.water, 1, 1, a.W - 2, a.H - 2);
      const isl = [[22, 32, 28, 37], [8, 20, 16, 27], [21, 16, 29, 23], [34, 20, 42, 27], [21, 3, 29, 9]];
      for (const [x0, y0, x1, y1] of isl) for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) a.water.delete(a.key(x, y));
      const plank = (x0, y0, x1, y1) => a.rect(a.walk, x0, y0, x1, y1);
      plank(24, 24, 25, 31); plank(17, 22, 20, 23); plank(30, 22, 33, 23); plank(24, 10, 25, 15);
      a.prop('house', 0, 19, 3, 3, 23, 4); a.prop('house', 4, 19, 2, 3, 10, 21); a.prop('house', 4, 19, 2, 3, 38, 21);
      a.prop('house', 0, 21, 2, 2, 27, 5);
      // three bells, one on each side island and one in the middle
      [[11.5, 25.2], [25.5, 18.2], [39.5, 25.2]].forEach(([x, y], i) => a.objects.push({ kind: 'bell', i, x, y, solid: true }));
      a.objects.push({ kind: 'tablet', x: 23.5, y: 21.4, solid: true, text: 'Ring the three bells in the order the tide sings today. A wrong bell silences them all.' });
      a.objects.push({ kind: 'gate', x: 25.5, y: 7.6, text: "The drowned keeper's door. Something knocks from the other side. (Chapter 3)" });
      return { spawn: { x: 25.5, y: 35.6 }, exit: { x: 25.5, y: 36.8, to: 'town', label: 'SWIM BACK UP' } };
    },
  };

  // ---------------------------------------------------------------- Clockwork Sky (needs a wind spirit)
  const sky = {
    id: 'sky', name: 'Clockwork Sky', W: 50, H: 36, seed: 37, zone: 3, music: 'sky', tint: 'rgba(200,230,255,.10)', needs: 2, islands: true, voidColor: '#8fd3f4',
    base: [[0, 19], [1, 19], [2, 19]], details: 70, detailRow: 3,
    layout(a) {
      a.rect(a.voidc, 0, 0, a.W - 1, a.H - 1);
      const isl = [[20, 27, 29, 33], [6, 15, 15, 22], [21, 13, 29, 20], [35, 15, 44, 22], [21, 2, 29, 8]];
      for (const [x0, y0, x1, y1] of isl) for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) a.voidc.delete(a.key(x, y));
      const bridge = (x0, y0, x1, y1) => a.rect(a.walk, x0, y0, x1, y1);
      bridge(24, 21, 25, 26); bridge(16, 18, 20, 19); bridge(30, 18, 34, 19); bridge(24, 9, 25, 12);
      for (const [x, y] of [[7, 16], [13, 20], [36, 16], [42, 20], [22, 3], [27, 3]]) a.prop('nature', 8, 0, 2, 2, x, y, 1);
      [[10.5, 19.2], [24.5, 15.2], [39.5, 19.2], [24.5, 5.2]].forEach(([x, y], i) => a.objects.push({ kind: 'gear', i, x, y, solid: true }));
      a.objects.push({ kind: 'tablet', x: 27.5, y: 30.4, solid: true, text: 'Wind the four gears in the order the clock ticks today. A wrong gear jams them all.' });
      return { spawn: { x: 24.5, y: 31.6 }, exit: { x: 24.5, y: 32.8, to: 'town', label: 'FLOAT BACK DOWN' } };
    },
  };

  const SPECS = { woods, moon, shrine, sky };
  const built = {};
  return {
    SPECS, TW,
    get(id, IMG) { if (!built[id]) built[id] = make(SPECS[id], IMG); return built[id]; },
    PUZZLE_OF: { woods: 0, shrine: 1, sky: 2 },
  };
})();
