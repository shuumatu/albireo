/** Albireo / Orbital Relic II. Original procedural artwork; center is the hotspot. */
export type AlbireoCursorState =
  | 'default' | 'hover' | 'text' | 'precision' | 'working'
  | 'busy' | 'move' | 'resize' | 'blocked' | 'zoom-in' | 'zoom-out'

export interface AlbireoCursorOptions {
  x: number
  y: number
  size: number
  state: AlbireoCursorState
  t: number
  light?: boolean
  energy?: number
  /** Optional normalized phase for a seamless, cached browser-cursor loop. */
  phase?: number
}

type Paint = string | CanvasGradient
type Tone = 'gold' | 'blue'
const TAU = Math.PI * 2

export function drawAlbireoCursor(ctx: CanvasRenderingContext2D, opts: AlbireoCursorOptions) {
  const size = Math.max(1, Number(opts.size) || 64);
  const x = Number(opts.x) || 0;
  const y = Number(opts.y) || 0;
  const t = Number(opts.t) || 0;
  const energy = opts.energy == null ? 1 : Math.max(0, Number(opts.energy) || 0);
  const time = t;
  const light = !!opts.light;
  const detail = size >= 100;
  const state = opts.state || 'default';
  const ink = light ? '#263d51' : '#071426';
  const edge = light ? 'rgba(30,53,74,.86)' : 'rgba(2,10,22,.98)';

  ctx.save();
  ctx.beginPath();
  ctx.rect(x - size / 2, y - size / 2, size, size);
  ctx.clip();
  ctx.translate(x, y);
  ctx.scale(size / 100, size / 100);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const gold = ctx.createLinearGradient(-34, -38, 36, 37);
  gold.addColorStop(0, '#fff0bd');
  gold.addColorStop(.18, '#dcb879');
  gold.addColorStop(.37, '#fff3cb');
  gold.addColorStop(.54, '#a8793b');
  gold.addColorStop(.73, '#e2ba76');
  gold.addColorStop(1, '#fff0bd');
  const blue = ctx.createLinearGradient(-34, -31, 35, 37);
  blue.addColorStop(0, '#c5f4ff');
  blue.addColorStop(.2, '#74c7fb');
  blue.addColorStop(.48, '#318bcc');
  blue.addColorStop(.72, '#153a79');
  blue.addColorStop(1, '#8bd3ff');
  const breath = Math.sin(opts.phase === undefined ? time * 1.8 : opts.phase * TAU) * energy;

  function stroke(path: Path2D, color: Paint, width: number, rim = true) {
    ctx.save();
    if (rim !== false) {
      ctx.strokeStyle = edge;
      ctx.lineWidth = width + (detail ? 1.45 : 2.1);
      ctx.stroke(path);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke(path);
    ctx.restore();
  }

  function arc(r: number, a: number, b: number, color: Paint = gold, width = 2, thin = false) {
    const p = new Path2D();
    p.arc(0, 0, r, a, b);
    stroke(p, color || gold, width || 2, !thin);
  }

  function ticks(r: number, a: number, b: number, count: number, color?: string) {
    if (!detail) return;
    ctx.save();
    ctx.strokeStyle = color || (light ? 'rgba(153,112,58,.62)' : 'rgba(228,196,143,.62)');
    ctx.lineWidth = .55;
    const p = new Path2D();
    for (let i = 0; i <= count; i++) {
      const z = a + (b - a) * i / count;
      const long = i % 4 === 0 ? 2.6 : 1.25;
      p.moveTo(Math.cos(z) * r, Math.sin(z) * r);
      p.lineTo(Math.cos(z) * (r + long), Math.sin(z) * (r + long));
    }
    ctx.stroke(p);
    ctx.restore();
  }

  function pearl(px: number, py: number, r: number, color: Tone) {
    ctx.save();
    ctx.translate(px, py);
    ctx.beginPath();
    ctx.arc(0, 0, r + .7, 0, TAU);
    ctx.fillStyle = ink;
    ctx.fill();
    const g = ctx.createRadialGradient(-r * .28, -r * .38, 0, 0, 0, r);
    g.addColorStop(0, '#fffcec');
    g.addColorStop(.23, color === 'blue' ? '#c8f4ff' : '#ffeab3');
    g.addColorStop(.7, color === 'blue' ? '#49a8e6' : '#d7ae68');
    g.addColorStop(1, color === 'blue' ? '#205985' : '#916532');
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  function star(px: number, py: number, r: number, rotation: number, color: Tone) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rotation || 0);
    const p = new Path2D();
    p.moveTo(0, -r);
    p.quadraticCurveTo(r * .16, -r * .16, r * .76, 0);
    p.quadraticCurveTo(r * .16, r * .16, 0, r);
    p.quadraticCurveTo(-r * .16, r * .16, -r * .76, 0);
    p.quadraticCurveTo(-r * .16, -r * .16, 0, -r);
    p.closePath();
    ctx.strokeStyle = ink;
    ctx.lineWidth = detail ? 1.3 : 1.9;
    ctx.stroke(p);
    ctx.fillStyle = color === 'blue' ? blue : gold;
    ctx.fill(p);
    if (detail) {
      ctx.strokeStyle = color === 'blue' ? '#c3eeff' : '#fff2ca';
      ctx.lineWidth = .42;
      ctx.beginPath();
      ctx.moveTo(0, -r * .67);
      ctx.lineTo(0, r * .67);
      ctx.stroke();
    }
    ctx.restore();
  }

  function gem(px: number, py: number, r: number, rotation: number) {
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(rotation || 0);
    const p = new Path2D();
    p.moveTo(0, -r * 1.2);
    p.lineTo(r * .8, 0);
    p.lineTo(0, r * 1.2);
    p.lineTo(-r * .8, 0);
    p.closePath();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.stroke(p);
    ctx.fillStyle = blue;
    ctx.fill(p);
    ctx.strokeStyle = '#9ad7f5';
    ctx.lineWidth = .7;
    ctx.stroke(p);
    if (detail) {
      const facet = new Path2D();
      facet.moveTo(0, -r * 1.2);
      facet.lineTo(0, r * 1.2);
      facet.lineTo(-r * .8, 0);
      facet.closePath();
      ctx.fillStyle = 'rgba(208,245,255,.34)';
      ctx.fill(facet);
    }
    ctx.restore();
  }

  function moon(r: number, rotation: number, scale: number, color: Tone) {
    ctx.save();
    ctx.rotate(rotation);
    ctx.scale(scale == null ? 1 : scale, 1);
    const a = 1.04;
    const tipX = Math.cos(a) * r;
    const tipY = Math.sin(a) * r;
    const p = new Path2D();
    p.moveTo(tipX, -tipY);
    p.arc(0, 0, r, -a, a);
    p.bezierCurveTo(r * .95, r * .34, r * .95, -r * .34, tipX, -tipY);
    p.closePath();
    ctx.strokeStyle = ink;
    ctx.lineWidth = 2;
    ctx.stroke(p);
    const enamel = ctx.createLinearGradient(tipX, -tipY, r, tipY);
    if (color === 'gold') {
      enamel.addColorStop(0, '#fff0c9');
      enamel.addColorStop(.32, '#d5a564');
      enamel.addColorStop(.6, '#fff0bd');
      enamel.addColorStop(1, '#9c713b');
    } else {
      enamel.addColorStop(0, '#b7edff');
      enamel.addColorStop(.27, '#65bbed');
      enamel.addColorStop(.48, '#348acb');
      enamel.addColorStop(.7, '#215a99');
      enamel.addColorStop(1, '#7ad3f6');
    }
    ctx.fillStyle = enamel;
    ctx.fill(p);
    ctx.strokeStyle = color === 'gold' ? '#ffe8b2' : '#a8e1fb';
    ctx.lineWidth = detail ? .6 : .85;
    ctx.stroke(p);
    if (detail) {
      ctx.save();
      ctx.clip(p);
      ctx.strokeStyle = color === 'gold' ? 'rgba(94,54,23,.3)' : 'rgba(194,238,255,.35)';
      ctx.lineWidth = .7;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(r * .7, i * r * .27);
        ctx.lineTo(r * 1.07, i * r * .18 + r * .19);
        ctx.stroke();
      }
      ctx.restore();
      arc(r - .3, -.8, .77, color === 'gold' ? 'rgba(255,246,221,.8)' : 'rgba(224,251,255,.85)', .36, true);
    }
    ctx.restore();
  }

  function track(r: number, a: number, b: number, phase: number, color?: string) {
    if (!detail) return;
    const span = b - a;
    const f = ((phase % 1) + 1) % 1;
    const start = a + f * (span - .24);
    arc(r, start, start + .24, color || '#fff4d9', .95, true);
  }

  function classic(working: boolean) {
    arc(28.6, 1.63, 5.89, gold, 2.3);
    if (detail) {
      arc(25.3, 2.1, 4.74, light ? 'rgba(165,125,75,.55)' : 'rgba(217,183,128,.45)', .5, true);
      ticks(31.6, 1.91, 4.79, 20);
      track(28.6, 1.7, 5.7, time * .07);
    }
    moon(31.2, .72, 1, 'blue');
    star(-21.3, -20.3, 5.8, -.11, 'gold');
    if (working) {
      const a = (opts.phase === undefined ? time * 1.28 : opts.phase * TAU) - .62;
      gem(Math.cos(a) * 36.4, Math.sin(a) * 36.4, 3.4, a + .4);
      if (detail) arc(36.4, a - .44, a - .17, 'rgba(110,191,243,.45)', .65, true);
    } else {
      gem(24.8, -18.1, 3.1, .26);
    }
    pearl(-1.3, 29, 1.65, 'gold');
  }

  switch (state) {
    case 'hover': {
      const spread = 1.35 + (breath + 1) * .45;
      arc(22.7, 2.05, 4.25, gold, 1.55);
      arc(22.7, -.88, 1.31, gold, 1.55);
      ctx.save();
      ctx.translate(spread, -spread * .5);
      moon(30.2, -.64, 1, 'blue');
      ctx.restore();
      ctx.save();
      ctx.translate(-spread, spread * .5);
      moon(30.2, Math.PI - .64, 1, 'gold');
      ctx.restore();
      star(-14.4, -29, 5.1, .14, 'gold');
      gem(14.4, 29, 3.7, -.24);
      if (detail) {
        ticks(35.5, -.99, -.33, 5);
        ticks(35.5, 2.15, 2.8, 5);
        arc(18.8, .98, 2.12, 'rgba(112,181,225,.5)', .55, true);
      }
      break;
    }
    case 'text': {
      // Slender I-beam: a fixed stem with short, gently curved end caps.
      // Gold above and a sapphire accent below retain the double-star palette.
      const stem = new Path2D();
      stem.moveTo(0, -28);
      stem.lineTo(0, 28);
      stroke(stem, gold, 1.65);
      const lowerStem = new Path2D();
      lowerStem.moveTo(0, 15);
      lowerStem.lineTo(0, 28);
      stroke(lowerStem, blue, 1.15, false);
      const topCap = new Path2D();
      topCap.moveTo(-6, -29);
      topCap.quadraticCurveTo(0, -27, 6, -29);
      stroke(topCap, gold, 1.8);
      const bottomCap = new Path2D();
      bottomCap.moveTo(-6, 29);
      bottomCap.quadraticCurveTo(0, 27, 6, 29);
      stroke(bottomCap, blue, 1.8);
      // Only a small highlight breathes; the insertion silhouette never moves.
      ctx.save();
      ctx.globalAlpha = .5 + .16 * breath;
      const glint = new Path2D();
      glint.moveTo(-2.6, -28.35);
      glint.lineTo(2.6, -28.35);
      stroke(glint, '#fff3cf', .8, false);
      ctx.restore();
      break;
    }
    case 'precision': {
      for (let i = 0; i < 4; i++) {
        const a = Math.PI / 4 + i * Math.PI / 2;
        arc(23.5, a - .35, a + .35, i % 2 ? blue : gold, 2.4);
        if (detail) arc(29.1, a - .2, a + .2, i % 2 ? 'rgba(123,204,248,.55)' : 'rgba(230,197,143,.55)', .6, true);
      }
      pearl(-22.5, -22.5, 1.4, 'gold');
      pearl(22.5, 22.5, 1.4, 'blue');
      break;
    }
    case 'working':
      classic(true);
      break;
    case 'busy': {
      const a = (opts.phase === undefined ? time * 2.15 : opts.phase * TAU) - .45;
      const b = (opts.phase === undefined ? -time * 1.7 : -opts.phase * TAU) + 2.42;
      function orbit(rotation: number, color: Paint, phase: number, starColor: Tone) {
        ctx.save();
        ctx.rotate(rotation);
        ctx.scale(1, .62);
        arc(34.5, .14, TAU - .14, color, 1.6);
        if (detail) arc(31.2, 2.8, 4.94, color, .38, true);
        ctx.restore();
        const ox = 34.5 * Math.cos(phase);
        const oy = 34.5 * .62 * Math.sin(phase);
        const px = ox * Math.cos(rotation) - oy * Math.sin(rotation);
        const py = ox * Math.sin(rotation) + oy * Math.cos(rotation);
        if (starColor === 'gold') star(px, py, 4.9, opts.phase === undefined ? phase * .18 : phase, 'gold');
        else gem(px, py, 4.1, opts.phase === undefined ? phase * .35 : phase);
      }
      orbit(-.68, gold, a, 'gold');
      orbit(.68, blue, b, 'blue');
      if (detail) {
        arc(40, -1.89, -1.39, 'rgba(220,186,133,.55)', .65, true);
        arc(40, 1.24, 1.74, 'rgba(127,194,237,.55)', .65, true);
      }
      break;
    }
    case 'move': {
      const r = 29 + breath * 1.4;
      for (let i = 0; i < 4; i++) {
        ctx.save();
        ctx.rotate(i * Math.PI / 2);
        arc(r, -.36, .36, i % 2 ? blue : gold, 3.4);
        if (detail) arc(r + 4, -.21, .21, i % 2 ? 'rgba(109,189,240,.6)' : 'rgba(223,187,126,.65)', .55, true);
        pearl(r, 0, 1.5, i % 2 ? 'blue' : 'gold');
        ctx.restore();
      }
      if (detail) {
        arc(17.8, -.32, .32, 'rgba(221,188,134,.45)', .55, true);
        arc(17.8, Math.PI - .32, Math.PI + .32, 'rgba(116,187,232,.45)', .55, true);
      }
      break;
    }
    case 'resize': {
      const r = 30 + breath * 1.7;
      for (let i = 0; i < 2; i++) {
        const a = -Math.PI / 4 + i * Math.PI;
        arc(r, a - .6, a + .6, i ? gold : blue, 3.3);
        if (detail) arc(r - 4.7, a - .42, a + .42, i ? 'rgba(222,186,129,.52)' : 'rgba(122,198,243,.55)', .6, true);
        for (let n = -1; n <= 1; n += 2) {
          const z = a + n * .6;
          pearl(Math.cos(z) * r, Math.sin(z) * r, 1.75, i ? 'gold' : 'blue');
        }
        const px = Math.cos(a) * (r + 5.5);
        const py = Math.sin(a) * (r + 5.5);
        if (i) star(px, py, 3.5, .75, 'gold');
        else gem(px, py, 2.8, .75);
      }
      break;
    }
    case 'blocked': {
      arc(27.4, .11, Math.PI - .11, blue, 2.65);
      arc(27.4, Math.PI + .11, TAU - .11, blue, 2.65);
      if (detail) {
        arc(23.1, .44, 2.7, 'rgba(99,169,221,.58)', .62, true);
        arc(23.1, 3.58, 5.85, 'rgba(99,169,221,.58)', .62, true);
        ticks(31.2, .42, 2.72, 12, 'rgba(95,160,209,.48)');
        ticks(31.2, 3.56, 5.85, 12, 'rgba(95,160,209,.48)');
      }
      for (const yy of [-29.2, 29.2]) {
        const p = new Path2D();
        p.moveTo(-9, yy);
        p.lineTo(9, yy);
        stroke(p, gold, 3.6);
        if (detail) {
          const seam = new Path2D();
          seam.moveTo(-5.8, yy - .45);
          seam.lineTo(5.8, yy - .45);
          stroke(seam, '#fff0bc', .5, false);
        }
      }
      gem(-27.4, 0, 2.3, 0);
      gem(27.4, 0, 2.3, 0);
      break;
    }
    case 'zoom-in':
    case 'zoom-out': {
      classic(false);
      const symbol = new Path2D();
      symbol.moveTo(-6, -12); symbol.lineTo(6, -12);
      if (state === 'zoom-in') { symbol.moveTo(0, -18); symbol.lineTo(0, -6); }
      stroke(symbol, blue, 2.6);
      break;
    }
    default:
      classic(false);
  }

  // The shared, fixed central jewel is the actual click point in every state.
  // Nothing in the moving ornament crosses this clear central area.
  ctx.save();
  const halo = ctx.createRadialGradient(0, 0, 0, 0, 0, 5.5);
  halo.addColorStop(0, light ? 'rgba(60,124,163,.13)' : 'rgba(173,218,248,.2)');
  halo.addColorStop(1, 'rgba(109,184,225,0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(0, 0, 5.5, 0, TAU);
  ctx.fill();
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(0, 0, 2.35, 0, TAU);
  ctx.fill();
  ctx.fillStyle = light ? '#f8e8b5' : '#ffedba';
  ctx.beginPath();
  ctx.arc(0, 0, 1.38, 0, TAU);
  ctx.fill();
  if (detail) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-.32, -.37, .5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
  ctx.restore();
}
