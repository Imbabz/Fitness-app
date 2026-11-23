/*
 * La clairière du soir, peinte en code.
 *
 * Direction artistique (la bible de l'univers, réponses du 23 novembre) :
 * silhouettes simples et lisibles, aucun contour, les formes rondes pour le
 * vivant et taillées pour la roche, des touches de pinceau visibles, des plans
 * qui se fondent dans une brume bleue, la palette « bruyère et ambre » en
 * saturation moyenne, jamais de noir pur, et l'orange du feu comme seul accent.
 *
 * Chaque plan existe deux fois, au crépuscule et à la nuit (deux palettes
 * distinctes) : la scène passe de l'une à l'autre au fil de la routine.
 *
 * Tout est dessiné sur des canvas, une fois, au chargement de la scène. Le
 * hasard est fixé par une graine : la clairière est la même à chaque soir.
 */

export type Hour = 'dusk' | 'night';

/** Les couleurs de la clairière, au crépuscule puis la nuit. */
export const PALETTE = {
  dusk: {
    skyTop: '#4d416f', skyMid: '#a77a9f', skyLow: '#f1b98c',
    peakLit: '#e8b892', peakShade: '#8a7aa6', snow: '#f6e3d6',
    ridge: '#9f8cb3', forestFar: '#8a87b2', forestMid: '#625d8a', pineNear: '#3c3555', pineLit: '#7c5f78',
    ground: '#8f8c86', groundWarm: '#a58f7b', heather: '#a58aae', path: '#c0a58a', grass: '#86937a',
    fore: '#2e2740', mist: '#a9bde2',
  },
  night: {
    skyTop: '#121532', skyMid: '#262a55', skyLow: '#4a3f6b',
    peakLit: '#7486b8', peakShade: '#2f3560', snow: '#a9b7dc',
    ridge: '#323a66', forestFar: '#2c3460', forestMid: '#212749', pineNear: '#171a31', pineLit: '#3a3557',
    ground: '#2c3040', groundWarm: '#3a3440', heather: '#3b3350', path: '#45404e', grass: '#283040',
    fore: '#100f1e', mist: '#4a5d8f',
  },
} as const;

function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  return [c, g];
}

function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `rgb(${pa.map((v, i) => Math.round(v + (pb[i]! - v) * t)).join(',')})`;
}

/**
 * La touche de pinceau : dans la forme déjà remplie (on peint « à
 * l'intérieur »), des centaines de traits allongés, de valeur légèrement
 * différente, orientés dans le sens du pinceau. C'est ce qui sépare une
 * peinture d'un aplat de vecteur.
 */
function brush(g: CanvasRenderingContext2D, w: number, h: number, base: string, opts: { n?: number; len?: number; angle?: number; light?: string; dark?: string; seed?: number; alpha?: number } = {}) {
  const r = rng(opts.seed ?? 11);
  const n = opts.n ?? Math.round((w * h) / 220);
  g.save();
  g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < n; i++) {
    const x = r() * w;
    const y = r() * h;
    const len = (opts.len ?? 18) * (0.5 + r());
    const tone = r();
    g.globalAlpha = (opts.alpha ?? 0.18) * (0.4 + r() * 0.6);
    g.fillStyle = tone < 0.5 ? mixHex(base, opts.light ?? '#ffffff', 0.12 + r() * 0.12) : mixHex(base, opts.dark ?? '#000000', 0.1 + r() * 0.12);
    g.beginPath();
    g.ellipse(x, y, len, len * (0.14 + r() * 0.12), (opts.angle ?? -0.1) + (r() - 0.5) * 0.5, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

/** Le grain du papier, très léger, posé sur tout ce qui est peint. */
function grain(g: CanvasRenderingContext2D, w: number, h: number, seed = 5, amount = 0.05) {
  const r = rng(seed);
  g.save();
  g.globalCompositeOperation = 'source-atop';
  for (let i = 0; i < (w * h) / 40; i++) {
    g.globalAlpha = amount * r();
    g.fillStyle = r() < 0.5 ? '#ffffff' : '#000000';
    g.fillRect(r() * w, r() * h, 1.2, 1.2);
  }
  g.restore();
}

// ------------------------------------------------------------------ le ciel
export function paintSky(hour: Hour): HTMLCanvasElement {
  const p = PALETTE[hour];
  const [c, g] = canvas(1024, 640);
  const grad = g.createLinearGradient(0, 0, 0, 640);
  grad.addColorStop(0, p.skyTop);
  grad.addColorStop(0.55, p.skyMid);
  grad.addColorStop(1, p.skyLow);
  g.fillStyle = grad;
  g.fillRect(0, 0, 1024, 640);
  // De longs nuages étirés, peints en traînées horizontales.
  const r = rng(hour === 'dusk' ? 3 : 4);
  for (let k = 0; k < 7; k++) {
    const y = 120 + r() * 300;
    const x = r() * 1024;
    const w = 220 + r() * 360;
    const col = hour === 'dusk' ? (y > 300 ? '#f3c7a4' : '#c99bb8') : '#3a3d6a';
    for (let s = 0; s < 40; s++) {
      g.globalAlpha = 0.05 + r() * 0.06;
      g.fillStyle = col;
      g.beginPath();
      g.ellipse(x + (r() - 0.5) * w, y + (r() - 0.5) * 18, 40 + r() * 90, 4 + r() * 7, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  if (hour === 'night') {
    for (let i = 0; i < 160; i++) {
      const sz = r() < 0.08 ? 1.8 : 1;
      g.globalAlpha = 0.35 + r() * 0.6;
      g.fillStyle = '#eef0fb';
      g.beginPath();
      g.arc(r() * 1024, r() * 420, sz, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  return c;
}

// ------------------------------------------------------------------ les sommets
/** Des pics taillés : chaque face éclairée ou dans l'ombre, de la neige aux crêtes. */
export function paintPeaks(hour: Hour): HTMLCanvasElement {
  const p = PALETTE[hour];
  const W = 2048;
  const H = 520;
  const [c, g] = canvas(W, H);
  const r = rng(21);
  const peaks: Array<[number, number]> = [];
  for (let x = -120; x < W + 200; x += 170 + r() * 160) peaks.push([x, 70 + r() * 230]);
  for (const [px, py] of peaks) {
    const half = 210 + r() * 160;
    const lx = px - half;
    const rx = px + half * (0.8 + r() * 0.5);
    const mid = px + (r() - 0.5) * 30;
    // Face au couchant (à droite) éclairée, l'autre dans l'ombre.
    g.fillStyle = p.peakShade;
    g.beginPath();
    g.moveTo(lx, H);
    g.lineTo(px, py);
    g.lineTo(mid, H);
    g.fill();
    g.fillStyle = p.peakLit;
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(rx, H);
    g.lineTo(mid, H);
    g.fill();
    // La neige : un bonnet taillé, avec ses coulées.
    const sn = 46 + r() * 40;
    g.fillStyle = p.snow;
    g.globalAlpha = hour === 'dusk' ? 0.85 : 0.6;
    g.beginPath();
    g.moveTo(px, py);
    g.lineTo(px + sn * 0.9, py + sn);
    g.lineTo(px + sn * 0.45, py + sn * 0.8);
    g.lineTo(px + sn * 0.2, py + sn * 1.25);
    g.lineTo(px - sn * 0.15, py + sn * 0.75);
    g.lineTo(px - sn * 0.6, py + sn * 0.95);
    g.closePath();
    g.fill();
    g.globalAlpha = 1;
  }
  brush(g, W, H, p.peakShade, { n: 2400, len: 22, angle: -0.6, light: p.snow, dark: p.skyTop, seed: 22, alpha: 0.14 });
  // La brume monte du pied des montagnes.
  const mist = g.createLinearGradient(0, H * 0.35, 0, H);
  mist.addColorStop(0, 'rgba(0,0,0,0)');
  mist.addColorStop(1, p.mist);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = mist;
  g.globalAlpha = 0.85;
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  grain(g, W, H, 23);
  return c;
}

// ------------------------------------------------------------------ les forêts
/** Un sapin du monde de Firmin : des étages arrondis, pas un triangle. */
function pine(g: CanvasRenderingContext2D, x: number, base: number, h: number, col: string, lit: string | null, r: () => number) {
  const w = h * (0.34 + r() * 0.08);
  g.fillStyle = col;
  g.fillRect(x - h * 0.02, base - h * 0.12, h * 0.04, h * 0.14);
  const tiers = 5 + Math.floor(r() * 2);
  for (let t = 0; t < tiers; t++) {
    const k = t / tiers;
    const ty = base - h * (0.08 + k * 0.82);
    const tw = w * (1 - k * 0.78) * (0.9 + r() * 0.2);
    const th = h * 0.2;
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x - tw / 2, ty);
    g.quadraticCurveTo(x - tw * 0.2, ty - th * 0.55, x, ty - th);
    g.quadraticCurveTo(x + tw * 0.2, ty - th * 0.55, x + tw / 2, ty);
    g.quadraticCurveTo(x, ty + th * 0.18, x - tw / 2, ty);
    g.fill();
    if (lit) {
      // Le côté du couchant prend la lumière.
      g.fillStyle = lit;
      g.globalAlpha = 0.55;
      g.beginPath();
      g.moveTo(x + tw * 0.08, ty - th * 0.9);
      g.quadraticCurveTo(x + tw * 0.25, ty - th * 0.5, x + tw / 2, ty);
      g.quadraticCurveTo(x + tw * 0.25, ty + th * 0.05, x + tw * 0.1, ty - th * 0.2);
      g.fill();
      g.globalAlpha = 1;
    }
  }
  g.beginPath();
  g.arc(x, base - h * 0.92, h * 0.025, 0, Math.PI * 2);
  g.fill();
}

/** Une rangée de forêt, de la profondeur donnée : plus loin, plus petite, plus bleue. */
export function paintForest(hour: Hour, kind: 'far' | 'mid'): HTMLCanvasElement {
  const p = PALETTE[hour];
  const W = 2048;
  const H = kind === 'far' ? 300 : 420;
  const [c, g] = canvas(W, H);
  const r = rng(kind === 'far' ? 31 : 41);
  const col = kind === 'far' ? p.forestFar : p.forestMid;
  // Le pied de la forêt : une masse continue, d'où sortent les cimes.
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= W; x += 40) g.lineTo(x, H * 0.62 + Math.sin(x * 0.006) * 14 + r() * 8);
  g.lineTo(W, H);
  g.fill();
  const step = kind === 'far' ? 26 : 44;
  for (let x = -20; x < W + 20; x += step * (0.6 + r() * 0.8)) {
    const hh = (kind === 'far' ? 150 : 260) * (0.6 + r() * 0.5);
    pine(g, x, H * 0.7 + r() * 20, hh, col, kind === 'mid' && hour === 'dusk' ? mixHex(col, p.peakLit, 0.35) : null, r);
  }
  brush(g, W, H, col, { n: kind === 'far' ? 1800 : 2600, len: 14, angle: -1.3, light: p.mist, dark: p.skyTop, seed: kind === 'far' ? 32 : 42, alpha: 0.16 });
  const mist = g.createLinearGradient(0, H * 0.3, 0, H);
  mist.addColorStop(0, 'rgba(0,0,0,0)');
  mist.addColorStop(1, p.mist);
  g.globalCompositeOperation = 'source-atop';
  g.fillStyle = mist;
  g.globalAlpha = kind === 'far' ? 0.75 : 0.5;
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  grain(g, W, H, kind === 'far' ? 33 : 43);
  return c;
}

/** Un grand sapin du premier plan, qui encadre la scène. */
export function paintNearPine(hour: Hour, seed: number): HTMLCanvasElement {
  const p = PALETTE[hour];
  const [c, g] = canvas(512, 1024);
  const r = rng(seed);
  pine(g, 256, 1010, 980, p.pineNear, hour === 'dusk' ? p.pineLit : mixHex(p.pineNear, '#6f7fae', 0.25), r);
  brush(g, 512, 1024, p.pineNear, { n: 2400, len: 16, angle: -1.2, light: p.pineLit, dark: '#0b0a14', seed: seed + 1, alpha: 0.2 });
  grain(g, 512, 1024, seed + 2);
  return c;
}

// ------------------------------------------------------------------ le sol
/**
 * Le sol de la clairière, vu à plat : la bruyère, l'herbe rase, la terre
 * tassée autour du camp et le sentier qui y mène. Peint en touches, jamais en
 * aplat.
 */
export function paintGround(hour: Hour): HTMLCanvasElement {
  const p = PALETTE[hour];
  const W = 1024;
  const H = 1024;
  const [c, g] = canvas(W, H);
  g.fillStyle = p.ground;
  g.fillRect(0, 0, W, H);
  const r = rng(51);
  // Le cœur du camp : une terre tassée, plus chaude, près du bas (le devant).
  const warm = g.createRadialGradient(W * 0.52, H * 0.86, 10, W * 0.52, H * 0.86, W * 0.42);
  warm.addColorStop(0, p.groundWarm);
  warm.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = warm;
  g.fillRect(0, 0, W, H);
  // Le sentier qui monte vers le fond.
  g.strokeStyle = p.path;
  g.globalAlpha = 0.55;
  g.lineCap = 'round';
  g.lineWidth = 46;
  g.beginPath();
  g.moveTo(W * 0.5, H);
  g.bezierCurveTo(W * 0.42, H * 0.7, W * 0.62, H * 0.45, W * 0.55, 0);
  g.stroke();
  g.globalAlpha = 1;
  // Taches de bruyère et d'herbe, en touches.
  for (let i = 0; i < 2600; i++) {
    const x = r() * W;
    const y = r() * H;
    g.globalAlpha = 0.12 + r() * 0.2;
    g.fillStyle = r() < 0.45 ? p.heather : r() < 0.8 ? p.grass : mixHex(p.ground, '#ffffff', 0.15);
    g.beginPath();
    g.ellipse(x, y, 6 + r() * 16, 2 + r() * 4, (r() - 0.5) * 0.4, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  grain(g, W, H, 52, 0.06);
  return c;
}

// ------------------------------------------------------------------ le premier plan
/** Bruyère et herbes hautes, tout près de l'objectif, en silhouette. */
export function paintForeground(hour: Hour, seed: number): HTMLCanvasElement {
  const p = PALETTE[hour];
  const W = 768;
  const H = 320;
  const [c, g] = canvas(W, H);
  const r = rng(seed);
  // Un rocher taillé.
  g.fillStyle = p.fore;
  g.beginPath();
  g.moveTo(W * 0.15, H);
  g.lineTo(W * 0.22, H * 0.55);
  g.lineTo(W * 0.38, H * 0.42);
  g.lineTo(W * 0.5, H * 0.6);
  g.lineTo(W * 0.56, H);
  g.fill();
  // Les herbes : des brins courbes, des touffes rondes de bruyère.
  for (let i = 0; i < 90; i++) {
    const x = r() * W;
    const hh = 60 + r() * 200;
    g.strokeStyle = p.fore;
    g.lineWidth = 3 + r() * 4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x, H);
    g.quadraticCurveTo(x + (r() - 0.5) * 40, H - hh * 0.6, x + (r() - 0.5) * 70, H - hh);
    g.stroke();
  }
  for (let i = 0; i < 14; i++) {
    g.fillStyle = mixHex(p.fore, p.heather, 0.25);
    g.beginPath();
    g.ellipse(r() * W, H - 20 - r() * 40, 30 + r() * 40, 22 + r() * 20, 0, 0, Math.PI * 2);
    g.fill();
  }
  brush(g, W, H, p.fore, { n: 900, len: 10, angle: -1.4, light: p.heather, dark: '#000000', seed: seed + 3, alpha: 0.25 });
  return c;
}

/**
 * Une carte de normales à partir de la transparence d'un canvas : les bords
 * s'arrondissent, le cœur se bombe. La même idée que tools/make_normal.py,
 * en plus simple, pour que le feu puisse modeler les plans peints ici.
 */
export function normalFromAlpha(src: HTMLCanvasElement, scale = 0.25, strength = 3): HTMLCanvasElement {
  const w = Math.max(8, Math.round(src.width * scale));
  const h = Math.max(8, Math.round(src.height * scale));
  const [small, sg] = canvas(w, h);
  sg.filter = 'blur(3px)';
  sg.drawImage(src, 0, 0, w, h);
  const a = sg.getImageData(0, 0, w, h).data;
  const [out, og] = canvas(w, h);
  const img = og.createImageData(w, h);
  const H = (x: number, y: number) => a[((Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))) << 2) + 3]! / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
      const n = Math.hypot(dx, dy, 1);
      const i = (y * w + x) << 2;
      img.data[i] = ((-dx / n) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((dy / n) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((1 / n) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  og.putImageData(img, 0, 0);
  void small;
  return out;
}
