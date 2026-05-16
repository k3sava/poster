// shared/mycelium.js — static port of FORM's Mycelium effect.
// Renders the phrase as a luminance bitmap, then grows N tendrils from the
// letter edges outward, following the luminance field. The full FORM
// implementation is animated; here we run a fixed number of growth iterations
// for a single-frame poster. Deterministic from spec rng.
'use strict';

(function(){
  function simplex2(seed){
    // Minimal value-noise: not Gustavson simplex, but smooth, deterministic, fast.
    const G = (x,y) => {
      const xi = Math.floor(x), yi = Math.floor(y);
      const xf = x-xi, yf = y-yi;
      function dot(ix, iy){
        let h = ((ix*374761393) ^ (iy*668265263) ^ seed) >>> 0;
        h = (h ^ (h>>>13)) * 1274126177; h = h >>> 0;
        return ((h / 4294967296) - 0.5) * 2;
      }
      const u = xf*xf*(3-2*xf), v = yf*yf*(3-2*yf);
      const a = dot(xi,yi), b = dot(xi+1,yi), c = dot(xi,yi+1), d = dot(xi+1,yi+1);
      return (a + (b-a)*u) + ((c + (d-c)*u) - (a + (b-a)*u)) * v;
    };
    return G;
  }
  function rasterizeText(text, w, h, font){
    const oc = document.createElement('canvas');
    oc.width = w; oc.height = h;
    const cx = oc.getContext('2d', { willReadFrequently: true });
    cx.fillStyle = '#000'; cx.fillRect(0,0,w,h);
    cx.fillStyle = '#fff';
    cx.textAlign = 'center'; cx.textBaseline = 'middle';
    let size = h * 0.4;
    cx.font = `900 ${size}px ${font}`;
    while(cx.measureText(text).width > w*0.88 && size > 16){ size *= 0.92; cx.font = `900 ${size}px ${font}`; }
    cx.fillText(text, w/2, h/2);
    const img = cx.getImageData(0,0,w,h);
    const lum = new Float32Array(w*h);
    for(let i=0;i<lum.length;i++) lum[i] = img.data[i*4] / 255;
    return lum;
  }
  function findEdgeSeeds(lum, w, h, rng){
    const seeds = [];
    for(let y=2;y<h-2;y++){
      for(let x=2;x<w-2;x++){
        if(lum[y*w+x] > 0.08){
          const edge = lum[y*w+x+1] < 0.05 || lum[y*w+x-1] < 0.05
                    || lum[(y+1)*w+x] < 0.05 || lum[(y-1)*w+x] < 0.05;
          if(edge && rng() < 0.022) seeds.push([x,y]);
        }
      }
    }
    return seeds;
  }

  function renderMycelium(ctx, w, h, spec, rng){
    // 1. Background.
    const pal = spec._palCache || { ink:'#dbb274', paper:'#0a0a0a', accents:['#f2c14e'] };
    ctx.fillStyle = pal.paper;
    ctx.fillRect(0, 0, w, h);

    // 2. Rasterise phrase to a luminance bitmap.
    const text = (spec.tree.raw || '').toUpperCase();
    const family = spec.fonts.display;
    const lum = rasterizeText(text, w, h, family);

    // 3. Find seed points along letter edges.
    const seeds = findEdgeSeeds(lum, w, h, rng);
    const branchCount = Math.max(60, Math.min(220, (spec.params && spec.params.count) || 140));
    const wild = (spec.params && spec.params.wild) || 0.35;

    // 4. Initialise branches.
    const branches = [];
    for(let i=0;i<branchCount;i++){
      const s = seeds.length ? seeds[(rng()*seeds.length)|0] : [w/2,h/2];
      const ang = Math.atan2(s[1]-h/2, s[0]-w/2) + Math.PI + (rng()-0.5)*1.2;
      branches.push({
        x: s[0], y: s[1], ang,
        len: 0, maxLen: 60 + rng()*180,
        alive: true,
        hue: 28 + rng()*40,
        alpha: rng()*0.35 + 0.35,
      });
    }

    // 5. Grow. Each iteration advances every alive branch by `step` pixels.
    const N = simplex2((rng() * 0xffffffff) | 0);
    const STEPS = 90;
    const STEP_PX = 2.4;
    for(let it=0; it<STEPS; it++){
      for(const b of branches){
        if(!b.alive) continue;
        // Sniff for the most luminous direction within a small fan ahead.
        let bestAng = b.ang, bestScore = 0;
        for(let k=-3; k<=3; k++){
          const ta = b.ang + k * 0.4;
          const tx = b.x + Math.cos(ta)*12, ty = b.y + Math.sin(ta)*12;
          if(tx<0 || tx>=w || ty<0 || ty>=h) continue;
          const sc = lum[(ty|0)*w + (tx|0)] * (1 - Math.abs(k)*0.1);
          if(sc > bestScore){ bestScore = sc; bestAng = ta; }
        }
        const drift = N(b.x*0.01, b.y*0.01 + it*0.005) * wild * 1.5;
        b.ang = b.ang*0.7 + bestAng*0.3 + drift*0.08;

        const nx = b.x + Math.cos(b.ang)*STEP_PX;
        const ny = b.y + Math.sin(b.ang)*STEP_PX;
        if(nx<0 || nx>=w || ny<0 || ny>=h){ b.alive = false; continue; }
        const nl = lum[(ny|0)*w + (nx|0)];

        ctx.globalAlpha = b.alpha * (0.3 + Math.min(1, b.len/20) * 0.7);
        ctx.strokeStyle = `hsl(${b.hue|0}, ${(40+nl*30)|0}%, ${(45+nl*30)|0}%)`;
        ctx.lineWidth = 0.4 + nl*0.6;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y);
        ctx.lineTo(nx, ny);
        ctx.stroke();

        b.x = nx; b.y = ny;
        b.len += STEP_PX;
        if(b.len >= b.maxLen){ b.alive = false; }
      }
    }
    ctx.globalAlpha = 1;
  }

  window.__mycelium = { renderMycelium };
})();
