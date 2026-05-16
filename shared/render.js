// shared/render.js — paint a poster spec onto a 2D canvas.
// One render() entry point. Templates live as case branches; they share
// helpers (paintBackground, applyCase, drawTokens) so a new template is
// a small addition rather than a copy of 300 lines.
'use strict';

(function(){
const { rngFor, range, pick, chance } = window.__seed;

// ---------- helpers ----------

function applyCase(word, caps){
  if(caps === 'all')      return word.toUpperCase();
  if(caps === 'sentence') return word;
  if(caps === 'title')    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  return word;
}

function relLuminance(hex){
  const c = hex.replace('#','');
  const r = parseInt(c.substr(0,2),16)/255;
  const g = parseInt(c.substr(2,2),16)/255;
  const b = parseInt(c.substr(4,2),16)/255;
  const f = v => v<=.03928 ? v/12.92 : Math.pow((v+.055)/1.055,2.4);
  return .2126*f(r) + .7152*f(g) + .0722*f(b);
}
function pickContrastPair(palette){
  // pick darkest as ink, lightest as paper; accents = the rest
  const sorted = palette.slice().sort((a,b)=>relLuminance(a)-relLuminance(b));
  const ink = sorted[0], paper = sorted[sorted.length-1];
  const accents = sorted.slice(1, -1);
  return { ink, paper, accents: accents.length ? accents : [sorted[Math.floor(sorted.length/2)]] };
}

function paintBackground(ctx, w, h, spec, rng){
  const { paper, ink, accents } = pickContrastPair(spec.palette.colors);
  ctx.fillStyle = paper; ctx.fillRect(0,0,w,h);
  if(spec.bg === 'split'){
    const accent = accents[0] || ink;
    const split = 0.32 + rng()*0.36;
    ctx.fillStyle = accent;
    ctx.fillRect(0, h*split, w, h*(1-split));
  } else if(spec.bg === 'noise'){
    const id = ctx.getImageData(0,0,w,h);
    const data = id.data;
    for(let i=0;i<data.length;i+=4){
      const n = (rng()-.5)*22;
      data[i]   = Math.max(0, Math.min(255, data[i]+n));
      data[i+1] = Math.max(0, Math.min(255, data[i+1]+n));
      data[i+2] = Math.max(0, Math.min(255, data[i+2]+n));
    }
    ctx.putImageData(id,0,0);
  } else if(spec.bg === 'grain'){
    ctx.save();
    ctx.globalAlpha = 0.06;
    for(let i=0;i<w*h/40;i++){
      ctx.fillStyle = rng() < .5 ? ink : (accents[0]||ink);
      ctx.fillRect(rng()*w, rng()*h, 1, 1);
    }
    ctx.restore();
  } else if(spec.bg === 'grid-ghost'){
    ctx.save();
    ctx.strokeStyle = ink; ctx.globalAlpha = 0.06; ctx.lineWidth = 1;
    const cells = 24;
    for(let i=1;i<cells;i++){
      ctx.beginPath(); ctx.moveTo(w*i/cells,0); ctx.lineTo(w*i/cells,h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,h*i/cells); ctx.lineTo(w,h*i/cells); ctx.stroke();
    }
    ctx.restore();
  }
  return { ink, paper, accents };
}

function fitFont(ctx, text, weight, family, targetWidth, maxHeight){
  // Binary-search a font size so `text` measures close to targetWidth.
  let lo = 8, hi = 1400, best = 24;
  while(lo <= hi){
    const mid = (lo+hi)>>1;
    ctx.font = `${weight} ${mid}px ${family}`;
    const m = ctx.measureText(text).width;
    if(m <= targetWidth){ best = mid; lo = mid+1; } else { hi = mid-1; }
  }
  // Cap by vertical budget so short tokens don't blow past their line.
  if(maxHeight && best > maxHeight) best = Math.floor(maxHeight);
  return best;
}

// Draw text with a wordart-style treatment layered on the glyph.
// All callers should funnel through this instead of ctx.fillText so adding
// new treatments (e.g. underline-thick) doesn't require touching every
// template. ctx state (font, textAlign, textBaseline, fillStyle) is honored
// as the BASE; treatment may override fillStyle internally.
function drawTreated(ctx, text, x, y, treatment, palette){
  const ink = palette.ink, accent = (palette.accents && palette.accents[0]) || ink;
  switch(treatment){
    case 'outline': {
      const prev = ctx.fillStyle;
      ctx.lineWidth = Math.max(2, parseInt(ctx.font)*0.03);
      ctx.strokeStyle = prev;
      ctx.strokeText(text, x, y);
      return;
    }
    case 'double-strike': {
      const prev = ctx.fillStyle;
      ctx.fillStyle = accent;
      ctx.fillText(text, x+6, y+6);
      ctx.fillStyle = prev;
      ctx.fillText(text, x, y);
      return;
    }
    case 'shadow-hard': {
      const prev = ctx.fillStyle;
      ctx.fillStyle = ink;
      ctx.fillText(text, x+4, y+4);
      ctx.fillStyle = prev;
      ctx.fillText(text, x, y);
      return;
    }
    case 'shadow-soft': {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 12; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 4;
      ctx.fillText(text, x, y);
      ctx.restore();
      return;
    }
    case 'stencil-cut': {
      ctx.fillText(text, x, y);
      // Carve two horizontal slits through the glyph using background color.
      const fs = parseInt(ctx.font);
      const m = ctx.measureText(text);
      const bgColor = palette.paper;
      ctx.save();
      ctx.fillStyle = bgColor;
      const baseY = ctx.textBaseline === 'middle' ? y - fs*0.4 : y - fs*0.7;
      ctx.fillRect(x - 4, baseY + fs*0.25, m.width + 8, fs*0.06);
      ctx.fillRect(x - 4, baseY + fs*0.55, m.width + 8, fs*0.06);
      ctx.restore();
      return;
    }
    case 'mirror-y': {
      ctx.save();
      ctx.fillText(text, x, y);
      const prev = ctx.fillStyle;
      ctx.globalAlpha = 0.30;
      ctx.scale(1, -1);
      const fs = parseInt(ctx.font);
      ctx.fillText(text, x, -y - fs*0.1);
      ctx.restore();
      return;
    }
    case 'split-color': {
      const fs = parseInt(ctx.font);
      const m = ctx.measureText(text);
      const prev = ctx.fillStyle;
      ctx.save();
      ctx.beginPath();
      const top = (ctx.textBaseline === 'middle') ? (y - fs*0.5) : (y - fs);
      ctx.rect(x - 4, top, m.width + 8, fs*0.5);
      ctx.clip();
      ctx.fillStyle = accent;
      ctx.fillText(text, x, y);
      ctx.restore();
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - 4, top + fs*0.5, m.width + 8, fs*0.6);
      ctx.clip();
      ctx.fillStyle = prev;
      ctx.fillText(text, x, y);
      ctx.restore();
      return;
    }
    case 'halftone-fill': {
      // Draw text into offscreen, then dot-pattern fill where opaque.
      const fs = parseInt(ctx.font);
      const m = ctx.measureText(text);
      const off = document.createElement('canvas');
      off.width = Math.ceil(m.width) + 20; off.height = Math.ceil(fs * 1.4) + 20;
      const oc = off.getContext('2d');
      oc.font = ctx.font; oc.textBaseline = 'top';
      oc.fillStyle = '#000';
      oc.fillText(text, 10, 10);
      const id = oc.getImageData(0,0,off.width,off.height);
      const prev = ctx.fillStyle;
      const top = (ctx.textBaseline === 'middle') ? (y - fs*0.6) : (y - fs);
      const dot = Math.max(2, fs*0.06);
      const step = dot * 2.2;
      for(let py = 0; py < off.height; py += step){
        for(let px = 0; px < off.width; px += step){
          const i = (py*off.width + px)*4 + 3;
          if(id.data[i] > 80){
            ctx.beginPath();
            ctx.arc(x + px - 10, top + py, dot, 0, Math.PI*2);
            ctx.fill();
          }
        }
      }
      ctx.fillStyle = prev;
      return;
    }
    default: // 'solid'
      ctx.fillText(text, x, y);
  }
}

// Per-token treatment: spec.tokenTreatments is a map { tokenWord: treatmentName }
// set via the customize panel. If the focal token has its own treatment, it
// overrides the per-poster one; otherwise we fall back to spec.treatment.
function getTokenTreatment(spec, token){
  const w = (token && token.w) || '';
  if(spec.tokenTreatments && spec.tokenTreatments[w]) return spec.tokenTreatments[w];
  // Legibility guard: stop-words and short non-focal tokens always render solid.
  // Fancy treatments belong on the focal payoff, not on "of" / "in" / "to".
  if(token && token.isStop) return 'solid';
  const isFocal = token && token.intentRole && token.intentRole.includes('payoff');
  if(!isFocal) return 'solid';
  return spec.treatment || 'solid';
}
function drawTreatedToken(ctx, text, x, y, treatment, pal){
  return drawTreated(ctx, text, x, y, treatment, pal);
}

function flattenTokens(tree, caps){
  const out = [];
  (tree.beats||[]).forEach(b=>{
    (b.tokens || b.words.map(w=>({w,intentScale:1,intentRole:null,isStop:false}))).forEach(t=>{
      out.push({ ...t, display: applyCase(t.w, caps) });
    });
  });
  return out;
}

// ---------- per-template renderers ----------

function renderSwissGrid(ctx, w, h, spec, rng){
  const pal = paintBackground(ctx, w, h, spec, rng);
  const { ink, paper, accents } = pal;
  const tokens = flattenTokens(spec.tree, spec.caps);
  const P = spec.params || {};
  const pad = P.align === 'asymmetric-left' ? w*0.06
            : P.align === 'asymmetric-right' ? w*0.14
            : w*0.08;
  const contentW = w - pad*2;
  const contentH = h - pad*2;

  // Title block: payoff word large, rest above as a setup band.
  const payoff = tokens.find(t => t.intentRole && t.intentRole.includes('payoff')) || tokens[tokens.length-1];
  const setup = tokens.filter(t => t !== payoff).map(t => t.display).join(' ');

  // Setup small at top-left.
  const setupSize = Math.max(20, h*0.030);
  ctx.fillStyle = ink;
  ctx.font = `${spec.fonts.weight} ${setupSize}px ${spec.fonts.body}`;
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  if(setup) ctx.fillText(setup, pad, pad);

  // Payoff: huge, fitted to width.
  const fitSize = fitFont(ctx, payoff.display, 900, spec.fonts.display, contentW);
  ctx.fillStyle = accents[0] || ink;
  ctx.font = `900 ${fitSize}px ${spec.fonts.display}`;
  ctx.textBaseline = 'alphabetic';
  drawTreated(ctx, payoff.display, pad, h - pad, spec.treatment, pal);

  // Cap rule (Swiss signature) — style controlled by params.
  const ruleStyle = P.ruleStyle || 'hairline';
  if(ruleStyle !== 'none'){
    ctx.strokeStyle = ink;
    ctx.lineWidth = ruleStyle === 'thick' ? Math.max(6, h*0.006) : Math.max(2, h*0.002);
    const draw = pos => { ctx.beginPath(); ctx.moveTo(pad, pos); ctx.lineTo(w-pad, pos); ctx.stroke(); };
    const topY = pad - setupSize*0.4;
    const botY = h - pad*0.4;
    if(P.rulePosition === 'top' || P.rulePosition === 'both' || P.rulePosition === 'split') draw(topY);
    if(P.rulePosition === 'bottom' || P.rulePosition === 'both') draw(botY);
    if(ruleStyle === 'double'){ draw(topY + 8); }
  }
  // Accent block (Swiss decoration).
  if(P.accentBlock === 'top-strip'){
    ctx.fillStyle = accents[0] || ink; ctx.fillRect(0, 0, w, h*0.012);
  } else if(P.accentBlock === 'side-bar'){
    ctx.fillStyle = accents[0] || ink; ctx.fillRect(0, 0, w*0.012, h);
  } else if(P.accentBlock === 'corner'){
    ctx.fillStyle = accents[0] || ink; ctx.fillRect(w-w*0.12, 0, w*0.12, h*0.04);
  }

  // Tag on bottom right.
  ctx.fillStyle = ink; ctx.font = `500 ${Math.max(12,h*0.014)}px ${spec.fonts.body}`;
  ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('poster · '+spec.palette.inheritedName.toLowerCase(), w-pad, h-pad*0.35);
}

function renderEditorialSerif(ctx, w, h, spec, rng){
  const pal = paintBackground(ctx, w, h, spec, rng);
  const { ink, paper, accents } = pal;
  const P = spec.params || {};
  const pad = P.margin === 'wide' ? w*0.14 : P.margin === 'narrow' ? w*0.06 : w*0.10;
  const family = spec.fonts.display;

  // Use FORM's DP layout: each token gets a box, lines block-justified.
  const measure = document.createElement('canvas').getContext('2d');
  const layout = window.__formLayout.phraseBoxes(spec.tree, {
    widthOf: (word, intentScale, unit) => {
      measure.font = `700 ${unit*intentScale}px ${family}`;
      return measure.measureText(applyCase(word.w, spec.caps)).width;
    },
    heightOf: (intentScale, unit) => unit * intentScale * 0.82,
    interWordRatio: 0.32,
    lineGapRatio: P.leading === 'tight' ? 0.06 : P.leading === 'open' ? 0.25 : 0.12,
    targetW: w - pad*2,
    targetH: h - pad*2,
    minUnit: 22, maxUnit: Math.round(h*0.20),
    maxBlockScale: 1.9,
    alignX: P.align === 'left' ? 'left' : P.align === 'right' ? 'right' : 'center',
    cx: w/2, cy: h/2,
  });

  ctx.fillStyle = ink;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  layout.boxes.forEach((b) => {
    const t = b.wordObj;
    ctx.font = `700 ${b.unitPx}px ${family}`;
    const isPayoff = t.intentRole && t.intentRole.includes('payoff');
    if(isPayoff && P.accentWord === 'italic'){
      ctx.font = `italic 700 ${b.unitPx}px ${family}`;
    } else if(isPayoff && P.accentWord === 'small-caps' && spec.caps !== 'all'){
      ctx.font = `700 ${b.unitPx}px ${family}`;
    }
    ctx.fillStyle = isPayoff && P.accentWord === 'italic' ? (accents[0]||ink) : ink;
    drawTreatedToken(ctx, applyCase(b.word, spec.caps), b.x, b.baselineY, getTokenTreatment(spec, b.wordObj), pal);
  });

  // Hairline rules.
  const rule = P.ruleStyle || 'hairline-both';
  ctx.strokeStyle = ink; ctx.lineWidth = 1;
  if(rule === 'hairline-both' || rule === 'hairline-top'){
    ctx.beginPath(); ctx.moveTo(pad, pad*0.5); ctx.lineTo(w-pad, pad*0.5); ctx.stroke();
  }
  if(rule === 'hairline-both'){
    ctx.beginPath(); ctx.moveTo(pad, h-pad*0.5); ctx.lineTo(w-pad, h-pad*0.5); ctx.stroke();
  }
  if(rule === 'ornament'){
    // small centered diamond.
    ctx.save();
    ctx.translate(w/2, pad*0.55); ctx.rotate(Math.PI/4);
    ctx.fillStyle = ink; ctx.fillRect(-4, -4, 8, 8);
    ctx.restore();
  }
  // Optional kicker at top + pull quote at bottom from article ingestion.
  if(spec.ingested && spec.ingested.kicker){
    ctx.fillStyle = accents[0] || ink;
    ctx.font = `500 ${Math.max(12,h*0.014)}px ${spec.fonts.body}`;
    ctx.textAlign = P.align === 'right' ? 'right' : 'left';
    ctx.fillText(spec.ingested.kicker.toUpperCase(), P.align==='right'?w-pad:pad, pad);
  }
  if(spec.ingested && spec.ingested.pullQuote){
    ctx.fillStyle = ink; ctx.globalAlpha = 0.65;
    ctx.font = `italic 400 ${Math.max(12,h*0.016)}px ${family}`;
    ctx.textAlign = 'center';
    const pq = spec.ingested.pullQuote.length > 110
      ? spec.ingested.pullQuote.slice(0,107) + '…' : spec.ingested.pullQuote;
    ctx.fillText('"'+pq+'"', w/2, h - pad*0.55);
    ctx.globalAlpha = 1;
  }
}

function wrapText(ctx, text, maxW, weight, family, size){
  ctx.font = `${weight} ${size}px ${family}`;
  const words = text.split(/\s+/);
  const lines = [];
  let cur = '';
  for(const w of words){
    const test = cur ? cur + ' ' + w : w;
    if(ctx.measureText(test).width > maxW && cur){ lines.push(cur); cur = w; }
    else cur = test;
  }
  if(cur) lines.push(cur);
  return lines;
}

function renderBrutalistBlock(ctx, w, h, spec, rng){
  const pal = paintBackground(ctx, w, h, spec, rng);
  const { ink, paper, accents } = pal;
  const tokens = flattenTokens(spec.tree, 'all');
  const P = spec.params || {};
  const pad = w*0.04;
  const align = P.align || 'hard-left';
  const lineH = h / Math.max(3, Math.min(tokens.length, 8));
  ctx.textBaseline = 'middle';
  ctx.textAlign = align === 'hard-right' ? 'right' : 'left';
  const colorFn = (i) => {
    if(P.coloring === 'ink-only') return ink;
    if(P.coloring === 'one-accent') return i === Math.floor(tokens.length/2) ? (accents[0]||ink) : ink;
    return i % 2 === 0 ? ink : (accents[0] || ink);
  };
  tokens.forEach((t,i)=>{
    const fs = fitFont(ctx, t.display, 800, spec.fonts.display, w - pad*2, lineH*0.85);
    ctx.fillStyle = colorFn(i);
    ctx.font = `800 ${fs}px ${spec.fonts.display}`;
    const x = align === 'hard-right' ? (w - pad) : pad;
    drawTreated(ctx, t.display, x, lineH*(i+0.5), spec.treatment, pal);
  });
}

function renderMonumentalStack(ctx, w, h, spec, rng){
  const pal = paintBackground(ctx, w, h, spec, rng);
  const { ink, paper, accents } = pal;
  let tokens = flattenTokens(spec.tree, spec.caps);
  const P = spec.params || {};
  const pad = w*0.06;
  // CONCEIT: antonyms-fight → exaggerate scale gap to maximum.
  if(spec.conceit === 'antonyms-fight'){
    tokens = tokens.map(t => {
      if(t.intentRole === 'antonym-payoff') return { ...t, intentScale: 3.2 };
      if(t.intentRole === 'antonym-setup')  return { ...t, intentScale: 0.5 };
      return t;
    });
  }
  // CONCEIT: monosyllable-thunder → ignore lesser tokens entirely.
  if(spec.conceit === 'monosyllable-thunder' && tokens.length > 1){
    const focal = tokens.find(t => t.intentRole && t.intentRole.includes('payoff')) || tokens[tokens.length-1];
    tokens = [{ ...focal, intentScale: 4.0 }];
  }
  // CONCEIT: whisper-then-shout → enforce ladder.
  if(spec.conceit === 'whisper-then-shout'){
    tokens = tokens.map(t => {
      if(t.intentRole && t.intentRole.includes('payoff')) return { ...t, intentScale: 2.6 };
      return { ...t, intentScale: 0.55 };
    });
  }
  const totalScale = tokens.reduce((s,t)=>s+(t.intentScale||1),0);
  const usable = h - pad*2;
  ctx.textBaseline = 'middle';
  ctx.textAlign = P.align === 'left' ? 'left' : P.align === 'right' ? 'right' : 'center';
  const xAnchor = P.align === 'left' ? pad : P.align === 'right' ? (w-pad) : w/2;
  let y = pad;
  tokens.forEach(t=>{
    const slot = usable * ((t.intentScale||1)/totalScale);
    const fs = fitFont(ctx, t.display, spec.fonts.weight, spec.fonts.display, w-pad*2, slot*0.92);
    const isPayoff = t.intentRole && t.intentRole.includes('payoff');
    ctx.fillStyle = isPayoff
      ? (P.payoffColor === 'ink' ? ink : (accents[0]||ink))
      : ink;
    ctx.font = `${spec.fonts.weight} ${fs}px ${spec.fonts.display}`;
    drawTreated(ctx, t.display, xAnchor, y + slot/2, spec.treatment, pal);
    y += slot;
  });
  if(P.accentLine === 'underline-payoff'){
    ctx.strokeStyle = accents[0] || ink; ctx.lineWidth = Math.max(4, h*0.005);
    const payoffIdx = tokens.findIndex(t => t.intentRole && t.intentRole.includes('payoff'));
    if(payoffIdx >= 0){
      let yy = pad;
      for(let i=0;i<payoffIdx;i++) yy += usable * ((tokens[i].intentScale||1)/totalScale);
      const slot = usable * ((tokens[payoffIdx].intentScale||1)/totalScale);
      ctx.beginPath(); ctx.moveTo(pad, yy + slot*0.92); ctx.lineTo(w-pad, yy + slot*0.92); ctx.stroke();
    }
  }
}

function renderKineticSlice(ctx, w, h, spec, rng){
  const { ink, paper, accents } = paintBackground(ctx, w, h, spec, rng);
  const tokens = flattenTokens(spec.tree, spec.caps);
  const pad = w*0.05;
  ctx.save();
  ctx.translate(w/2, h/2);
  ctx.rotate((spec.rotation||0) * Math.PI/180);
  ctx.translate(-w/2, -h/2);
  // Diagonal scatter, payoff dominant.
  const payoff = tokens.find(t=>t.intentRole && t.intentRole.includes('payoff')) || tokens[tokens.length-1];
  tokens.forEach((t,i)=>{
    const isPay = t === payoff;
    const fs = fitFont(ctx, t.display, 800, spec.fonts.display, isPay ? (w-pad*2) : (w*0.4));
    ctx.fillStyle = isPay ? (accents[0]||ink) : ink;
    ctx.font = `800 ${fs}px ${spec.fonts.display}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    const x = pad + (i*w*0.06) % (w*0.4);
    const y = pad + (i*h*0.11) % (h-fs-pad);
    ctx.fillText(t.display, x, y);
  });
  ctx.restore();
  // Slice bars across.
  ctx.fillStyle = accents[0] || ink;
  for(let i=0;i<3;i++){
    const y = h*(0.2 + i*0.25);
    ctx.fillRect(0, y, w, 4);
  }
}

function renderPainterlyField(ctx, w, h, spec, rng){
  const pal = paintBackground(ctx, w, h, spec, rng);
  const { ink, paper, accents } = pal;
  const P = spec.params || {};
  // CONCEIT: question-leaves-space → blank top-right quadrant, push fields away.
  const blankQuadrant = spec.conceit === 'question-leaves-space';
  const density = P.density || 60;
  const [lo, hi] = P.alphaRange || [0.06, 0.20];
  const shape = P.fieldShape || 'circles';
  // Background fields.
  for(let i=0;i<density;i++){
    const a = lo + rng()*(hi-lo);
    ctx.globalAlpha = a;
    ctx.fillStyle = accents[i%accents.length] || ink;
    let cx = rng()*w, cy = rng()*h;
    if(blankQuadrant){
      // reject draws into the top-right quadrant
      let tries = 0;
      while(cx > w*0.55 && cy < h*0.45 && tries < 6){ cx = rng()*w; cy = rng()*h; tries++; }
      if(cx > w*0.55 && cy < h*0.45) continue;
    }
    if(shape === 'circles'){
      const r = 40 + rng()*220;
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fill();
    } else if(shape === 'ovals'){
      const rx = 50 + rng()*220, ry = 30 + rng()*180;
      const rot = rng()*Math.PI;
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot); ctx.scale(rx/100, ry/100);
      ctx.beginPath(); ctx.arc(0,0,100,0,Math.PI*2); ctx.fill();
      ctx.restore();
    } else if(shape === 'rectangles'){
      const ww = 60 + rng()*260, hh = 30 + rng()*200;
      const rot = (rng()-0.5)*0.4;
      ctx.save(); ctx.translate(cx,cy); ctx.rotate(rot);
      ctx.fillRect(-ww/2, -hh/2, ww, hh);
      ctx.restore();
    } else { // organic-blobs
      const pts = 8 + (rng()*5|0);
      const r = 60 + rng()*180;
      ctx.beginPath();
      for(let k=0;k<pts;k++){
        const a2 = (k/pts) * Math.PI*2;
        const rr = r * (0.7 + rng()*0.45);
        const px = cx + Math.cos(a2)*rr, py = cy + Math.sin(a2)*rr;
        if(k===0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
  // Centered payoff with optional caption position.
  const tokens = flattenTokens(spec.tree, spec.caps);
  const payoff = tokens.find(t=>t.intentRole && t.intentRole.includes('payoff')) || tokens[tokens.length-1];
  const place = P.textPosition || 'center';
  let ty;
  if(place === 'top')         ty = h*0.18;
  else if(place === 'bottom') ty = h*0.78;
  else if(place === 'lower-third') ty = h*0.66;
  else ty = h/2;
  const fs = fitFont(ctx, payoff.display, 800, spec.fonts.display, w*0.86, h*0.30);
  ctx.fillStyle = ink;
  ctx.font = `800 ${fs}px ${spec.fonts.display}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  drawTreatedToken(ctx, payoff.display, w/2, ty, getTokenTreatment(spec, payoff), pal);
  // Caption position.
  if(P.captionPos !== 'none'){
    const cap = Math.max(13, h*0.018);
    ctx.fillStyle = ink; ctx.globalAlpha = 0.75;
    ctx.font = `400 ${cap}px ${spec.fonts.body}`;
    let cy = h - h*0.05;
    if(P.captionPos === 'above') cy = h*0.06;
    else if(P.captionPos === 'side'){ ctx.textAlign = 'right'; cy = h/2; }
    ctx.fillText(spec.tree.raw, ctx.textAlign==='right'? w - w*0.04 : w/2, cy);
    ctx.globalAlpha = 1;
  }
}

function renderMaximalCollage(ctx, w, h, spec, rng){
  const pal = paintBackground(ctx, w, h, spec, rng);
  const { ink, paper, accents } = pal;
  const tokens = flattenTokens(spec.tree, spec.caps);
  const P = spec.params || {};
  const rotPolicy = P.tokenRotation || 'mild';
  const colorPolicy = P.colorPolicy || 'duotone';
  const colorOf = (i, isPay) => {
    if(colorPolicy === 'ink-only') return ink;
    if(colorPolicy === 'rainbow') return accents[i % accents.length] || ink;
    return isPay ? (accents[0]||ink) : (i%2 ? ink : (accents[1]||accents[0]||ink));
  };
  // Big payoff first, anchored center.
  const payoffI = tokens.findIndex(t => t.intentRole && t.intentRole.includes('payoff'));
  const payoffIdx = payoffI < 0 ? tokens.length-1 : payoffI;
  const payoff = tokens[payoffIdx];
  const otherTokens = tokens.filter((_,i) => i !== payoffIdx);
  // Payoff
  {
    const fs = fitFont(ctx, payoff.display, 900, spec.fonts.display, w*0.95, h*0.42);
    ctx.save();
    ctx.translate(w/2, h/2);
    if(rotPolicy === 'wild') ctx.rotate((rng()-0.5)*0.7);
    else if(rotPolicy === 'mild') ctx.rotate((rng()-0.5)*0.15);
    ctx.fillStyle = colorOf(payoffIdx, true);
    ctx.font = `900 ${fs}px ${spec.fonts.display}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    drawTreatedToken(ctx, payoff.display, 0, 0, getTokenTreatment(spec, payoff), pal);
    ctx.restore();
  }
  // Others orbit, deterministically placed.
  const layoutR = Math.min(w,h) * 0.36;
  otherTokens.forEach((t,i) => {
    const angle = (i / otherTokens.length) * Math.PI*2 + rng()*0.3;
    const r = layoutR + (rng()-0.5)*layoutR*0.4;
    const cx = w/2 + Math.cos(angle)*r;
    const cy = h/2 + Math.sin(angle)*r;
    const fs = fitFont(ctx, t.display, 800, spec.fonts.display, w*0.36, h*0.10);
    ctx.save();
    ctx.translate(cx, cy);
    if(rotPolicy === 'orthogonal') ctx.rotate(rng() < 0.5 ? 0 : -Math.PI/2);
    else if(rotPolicy === 'wild') ctx.rotate((rng()-0.5)*1.0);
    else ctx.rotate((rng()-0.5)*0.4);
    ctx.fillStyle = colorOf(i+1, false);
    ctx.font = `800 ${fs}px ${spec.fonts.display}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    drawTreatedToken(ctx, t.display, 0, 0, getTokenTreatment(spec, t), pal);
    ctx.restore();
  });
}

function renderWoodType(ctx, w, h, spec, rng){
  const pal = paintBackground(ctx, w, h, spec, rng);
  const { ink, paper, accents } = pal;
  const tokens = flattenTokens(spec.tree, 'all');
  const P = spec.params || {};
  const pad = w*0.05;
  const lineH = (h - pad*2) / Math.max(2, tokens.length);
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const colorFn = (i) => {
    if(P.coloring === 'ink-only') return ink;
    if(P.coloring === 'descending') return [ink, accents[0]||ink, accents[1]||accents[0]||ink][Math.min(i,2)] || ink;
    if(P.coloring === 'one-accent') return i === Math.floor(tokens.length/2) ? (accents[0]||ink) : ink;
    return i%2 ? (accents[0]||ink) : ink;
  };
  tokens.forEach((t,i)=>{
    const fs = fitFont(ctx, t.display, 900, spec.fonts.display, w-pad*2, lineH*0.88);
    ctx.fillStyle = colorFn(i);
    ctx.font = `900 ${fs}px ${spec.fonts.display}`;
    drawTreated(ctx, t.display, pad, pad + lineH*(i+0.5), spec.treatment, pal);
  });
  if(P.rule === 'border'){
    ctx.strokeStyle = ink; ctx.lineWidth = Math.max(2, h*0.003);
    ctx.strokeRect(pad*0.4, pad*0.4, w - pad*0.8, h - pad*0.8);
  } else if(P.rule === 'between-each'){
    ctx.strokeStyle = ink; ctx.lineWidth = 1;
    for(let i=1;i<tokens.length;i++){
      const y = pad + lineH*i;
      ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(w-pad, y); ctx.stroke();
    }
  }
}

// ---------- pixart-inspired image substrate ----------
function paintImageSubstrate(ctx, w, h, spec, rng, palette){
  const P = spec.params || {};
  const effect = P.effect || 'halftone';
  const intensity = P.intensity === 'high' ? 1.4 : P.intensity === 'low' ? 0.6 : 1.0;
  // Source field: user-uploaded image if present, otherwise procedural.
  let field;
  if(window.__posterImage && window.__posterImage.field){
    const src = window.__posterImage;
    field = resampleField(src.field, src.w, src.h, w, h);
  } else {
    field = generateField(w, h, rng);
  }

  switch(effect){
    case 'halftone':       applyHalftone(ctx, field, w, h, palette, intensity); break;
    case 'dither':         applyDither(ctx, field, w, h, palette, intensity); break;
    case 'contour':        applyContour(ctx, field, w, h, palette, intensity); break;
    case 'ascii-grid':     applyAsciiGrid(ctx, field, w, h, palette, intensity); break;
    case 'flow-field':     applyFlowField(ctx, field, w, h, palette, intensity, rng); break;
    case 'cmyk-shift':     applyCmykShift(ctx, field, w, h, palette, intensity); break;
    case 'ink-wash':       applyInkWash(ctx, field, w, h, palette, intensity, rng); break;
    case 'cellular':       applyCellular(ctx, field, w, h, palette, intensity, rng); break;
    default:               applyHalftone(ctx, field, w, h, palette, intensity);
  }
}

// Sampling helper: bilinear resample an arbitrary-size luminance source into the target w×h grid.
function resampleField(src, sw, sh, w, h){
  const out = new Float32Array(w*h);
  for(let y=0;y<h;y++){
    const sy = (y / h) * sh;
    const y0 = Math.floor(sy), y1 = Math.min(sh-1, y0+1);
    const fy = sy - y0;
    for(let x=0;x<w;x++){
      const sx = (x / w) * sw;
      const x0 = Math.floor(sx), x1 = Math.min(sw-1, x0+1);
      const fx = sx - x0;
      const a = src[y0*sw+x0], b = src[y0*sw+x1], c = src[y1*sw+x0], d = src[y1*sw+x1];
      out[y*w+x] = (a*(1-fx) + b*fx)*(1-fy) + (c*(1-fx) + d*fx)*fy;
    }
  }
  return out;
}

function generateField(w, h, rng){
  // Procedural radial gradient + ripples — deterministic from rng.
  const cx = w*(0.3 + rng()*0.4), cy = h*(0.3 + rng()*0.4);
  const f = new Float32Array(w*h);
  const k = 0.005 + rng()*0.01;
  for(let y=0;y<h;y++){
    for(let x=0;x<w;x++){
      const dx = x-cx, dy = y-cy;
      const d = Math.sqrt(dx*dx + dy*dy);
      const v = 0.5 + 0.4*Math.cos(d*k) - d/Math.max(w,h)*0.5;
      f[y*w+x] = Math.max(0, Math.min(1, v));
    }
  }
  return f;
}

function applyHalftone(ctx, field, w, h, pal, intensity){
  const step = 14;
  ctx.fillStyle = pal.ink;
  for(let y=step/2; y<h; y+=step){
    for(let x=step/2; x<w; x+=step){
      const v = field[(y|0)*w + (x|0)] || 0;
      const r = step*0.55 * v * intensity;
      if(r < 0.6) continue;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill();
    }
  }
}
function applyDither(ctx, field, w, h, pal, intensity){
  const step = 4;
  const id = ctx.getImageData(0,0,w,h);
  const inkRgb = hexToRgb(pal.ink);
  for(let y=0;y<h;y+=step){
    for(let x=0;x<w;x+=step){
      const v = field[y*w + x];
      const on = (((x>>2) ^ (y>>2)) & 1) ? v > 0.45 : v > 0.6;
      if(on){
        for(let dy=0;dy<step;dy++) for(let dx=0;dx<step;dx++){
          const i = ((y+dy)*w + (x+dx))*4;
          id.data[i] = inkRgb.r; id.data[i+1] = inkRgb.g; id.data[i+2] = inkRgb.b;
        }
      }
    }
  }
  ctx.putImageData(id,0,0);
}
function applyContour(ctx, field, w, h, pal, intensity){
  ctx.strokeStyle = pal.ink; ctx.lineWidth = 1.2 * intensity;
  const levels = 12;
  const step = 2;
  for(let l=1; l<levels; l++){
    const thr = l/levels;
    ctx.beginPath();
    for(let y=step;y<h-step;y+=step){
      for(let x=step;x<w-step;x+=step){
        const v = field[y*w+x];
        if(Math.abs(v - thr) < 0.005){
          ctx.moveTo(x,y); ctx.lineTo(x+1,y+1);
        }
      }
    }
    ctx.stroke();
  }
}
function applyAsciiGrid(ctx, field, w, h, pal, intensity){
  const chars = ' .,:;ox%@#';
  const step = 18;
  ctx.fillStyle = pal.ink;
  ctx.font = `${step}px "JetBrains Mono", monospace`;
  ctx.textBaseline = 'top';
  for(let y=0;y<h;y+=step){
    for(let x=0;x<w;x+=step){
      const v = field[(y|0)*w + (x|0)];
      const ci = Math.min(chars.length-1, (v * intensity * chars.length)|0);
      const c = chars[ci];
      if(c !== ' ') ctx.fillText(c, x, y);
    }
  }
}
function applyFlowField(ctx, field, w, h, pal, intensity, rng){
  ctx.strokeStyle = pal.ink; ctx.lineWidth = 0.6;
  ctx.globalAlpha = 0.55;
  const N = (300 * intensity)|0;
  for(let i=0;i<N;i++){
    let x = rng()*w, y = rng()*h;
    ctx.beginPath(); ctx.moveTo(x,y);
    for(let s=0;s<80;s++){
      const v = field[((y|0)|0)*w + (x|0)] || 0;
      const a = v * Math.PI*4;
      x += Math.cos(a)*1.6; y += Math.sin(a)*1.6;
      if(x<0||x>=w||y<0||y>=h) break;
      ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function applyCmykShift(ctx, field, w, h, pal, intensity){
  const off = 6 * intensity;
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = '#00aaee'; ctx.globalAlpha = 0.25;
  drawFieldDots(ctx, field, w, h, off, 0);
  ctx.fillStyle = '#ee2255';
  drawFieldDots(ctx, field, w, h, 0, off);
  ctx.fillStyle = '#ffd200';
  drawFieldDots(ctx, field, w, h, -off, off);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
function drawFieldDots(ctx, field, w, h, ox, oy){
  const step = 12;
  for(let y=step/2; y<h; y+=step){
    for(let x=step/2; x<w; x+=step){
      const v = field[(y|0)*w + (x|0)] || 0;
      const r = step*0.5 * v;
      if(r < 1) continue;
      ctx.beginPath(); ctx.arc(x+ox, y+oy, r, 0, Math.PI*2); ctx.fill();
    }
  }
}
function applyInkWash(ctx, field, w, h, pal, intensity, rng){
  ctx.fillStyle = pal.ink;
  ctx.globalAlpha = 0.10 * intensity;
  for(let i=0;i<400 * intensity;i++){
    const x = rng()*w, y = rng()*h;
    const v = field[(y|0)*w + (x|0)] || 0;
    if(v < 0.3) continue;
    const r = 20 + rng()*80 * v;
    ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function applyCellular(ctx, field, w, h, pal, intensity, rng){
  ctx.fillStyle = pal.ink;
  const N = (40 * intensity)|0;
  const pts = [];
  for(let i=0;i<N;i++) pts.push({x:rng()*w, y:rng()*h});
  const step = 10;
  for(let y=0;y<h;y+=step){
    for(let x=0;x<w;x+=step){
      let dMin = Infinity;
      for(const p of pts){
        const dx = x-p.x, dy = y-p.y; const d = dx*dx+dy*dy;
        if(d < dMin) dMin = d;
      }
      const dist = Math.sqrt(dMin);
      const v = Math.min(1, dist/180);
      if(v > 0.7) ctx.fillRect(x, y, step-1, step-1);
    }
  }
}
function hexToRgb(hex){
  const c = hex.replace('#','');
  return {
    r: parseInt(c.substr(0,2),16),
    g: parseInt(c.substr(2,2),16),
    b: parseInt(c.substr(4,2),16),
  };
}

function renderImageSubstrate(ctx, w, h, spec, rng){
  const pal = paintBackground(ctx, w, h, spec, rng);
  paintImageSubstrate(ctx, w, h, spec, rng, pal);
  const tokens = flattenTokens(spec.tree, spec.caps);
  const P = spec.params || {};
  // Scrim for legibility.
  if(P.scrim && P.scrim !== 'none'){
    ctx.save();
    const g = ctx.createLinearGradient(0, 0, 0, h);
    if(P.scrim === 'top-fade'){ g.addColorStop(0, pal.paper); g.addColorStop(0.45, 'rgba(0,0,0,0)'); }
    else if(P.scrim === 'bottom-fade'){ g.addColorStop(0.55, 'rgba(0,0,0,0)'); g.addColorStop(1, pal.paper); }
    else { g.addColorStop(0, 'rgba(0,0,0,0.25)'); g.addColorStop(1, 'rgba(0,0,0,0.25)'); }
    ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
    ctx.restore();
  }
  const payoff = tokens.find(t => t.intentRole && t.intentRole.includes('payoff')) || tokens[tokens.length-1];
  const restored = tokens.filter(t => t !== payoff).map(t=>t.display).join(' ');
  const pad = w*0.06;
  const place = P.textPlacement || 'bottom';
  let textY;
  if(place === 'top') textY = pad + h*0.10;
  else if(place === 'center') textY = h/2;
  else if(place === 'corner') textY = h - pad;
  else textY = h - pad;
  const color = P.textColor === 'paper' ? pal.paper : P.textColor === 'accent' ? (pal.accents[0]||pal.ink) : pal.ink;
  ctx.fillStyle = color;
  ctx.textAlign = place === 'corner' ? 'right' : 'left';
  ctx.textBaseline = 'alphabetic';
  if(restored){
    const sub = Math.max(16, h*0.025);
    ctx.font = `500 ${sub}px ${spec.fonts.body}`;
    ctx.fillText(restored, place==='corner' ? w-pad : pad, textY - sub*2.6);
  }
  const fs = fitFont(ctx, payoff.display, 900, spec.fonts.display, w - pad*2, h*0.20);
  ctx.font = `900 ${fs}px ${spec.fonts.display}`;
  drawTreated(ctx, payoff.display, place==='corner' ? w-pad : pad, textY, spec.treatment, pal);
}

// Magazine Cover — kicker at top, big serif/grotesk title that wraps generously,
// optional issue tag, accent word treatment for the payoff. Designed for long
// lowercase conversational headlines.
function renderMagazineCover(ctx, w, h, spec, rng){
  const pal = paintBackground(ctx, w, h, spec, rng);
  const { ink, paper, accents } = pal;
  const P = spec.params || {};
  const pad = w*0.07;

  // Kicker (article kicker if available, otherwise tag derived from archetype).
  const kicker = (spec.ingested && spec.ingested.kicker)
    ? spec.ingested.kicker
    : `${spec.archetype.label.toLowerCase()} · ${spec.template.name.toLowerCase()}`;
  const kickerSize = Math.max(11, h*0.014);
  ctx.fillStyle = accents[0] || ink;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  if(P.kickerStyle === 'caps-spaced'){
    ctx.font = `600 ${kickerSize}px ${spec.fonts.body}`;
    ctx.fillText(kicker.toUpperCase().split('').join(' '), pad, pad);
  } else if(P.kickerStyle === 'small-italic'){
    ctx.font = `italic 500 ${kickerSize+2}px ${spec.fonts.body}`;
    ctx.fillText(kicker, pad, pad);
  } else {
    ctx.font = `700 ${kickerSize}px ${spec.fonts.body}`;
    ctx.fillText(kicker.toUpperCase(), pad, pad);
  }

  // Title — full headline using DP layout, generous leading.
  const text = (spec.tree.raw || '');
  const titleText = P.titleCase === 'title'
    ? text.replace(/\b\w/g, c => c.toUpperCase())
    : text;
  // Build a faux tree from the title for the layout DP.
  const titleTree = window.__parse.basic(titleText);
  const measure = document.createElement('canvas').getContext('2d');
  const display = spec.fonts.display;
  const leadingRatio = P.leading === 'tight' ? 0.05 : P.leading === 'open' ? 0.28 : 0.15;
  const layout = window.__formLayout.phraseBoxes(titleTree, {
    widthOf: (word, intentScale, unit) => {
      measure.font = `800 ${unit*intentScale}px ${display}`;
      return measure.measureText(word.w).width;
    },
    heightOf: (intentScale, unit) => unit * intentScale * 0.82,
    interWordRatio: 0.30,
    lineGapRatio: leadingRatio,
    targetW: w - pad*2,
    targetH: h - pad*2.8,
    minUnit: 26, maxUnit: Math.round(h*0.16),
    maxBlockScale: 1.5,
    alignX: 'left',
    cx: w/2, cy: h*0.55,
  });

  ctx.fillStyle = ink;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  layout.boxes.forEach(b => {
    const t = b.wordObj;
    const isPayoff = t.intentRole && t.intentRole.includes('payoff');
    ctx.font = `800 ${b.unitPx}px ${display}`;
    if(isPayoff && P.accentWord === 'italic-payoff'){
      ctx.font = `italic 800 ${b.unitPx}px ${display}`;
      ctx.fillStyle = accents[0] || ink;
    } else if(isPayoff && P.accentWord === 'color-payoff'){
      ctx.fillStyle = accents[0] || ink;
    } else {
      ctx.fillStyle = ink;
    }
    drawTreatedToken(ctx, b.word, b.x, b.baselineY, getTokenTreatment(spec, t), pal);
    if(isPayoff && P.accentWord === 'underline-payoff'){
      ctx.strokeStyle = accents[0] || ink;
      ctx.lineWidth = Math.max(2, b.unitPx*0.04);
      ctx.beginPath(); ctx.moveTo(b.x, b.baselineY + b.unitPx*0.10); ctx.lineTo(b.x + b.w, b.baselineY + b.unitPx*0.10); ctx.stroke();
    }
  });

  // Rule.
  if(P.rule === 'top-thick'){
    ctx.fillStyle = ink; ctx.fillRect(pad, pad - kickerSize*1.4, w-pad*2, Math.max(3, h*0.004));
  } else if(P.rule === 'top-hairline'){
    ctx.strokeStyle = ink; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(pad, pad - kickerSize*1.0); ctx.lineTo(w-pad, pad - kickerSize*1.0); ctx.stroke();
  } else if(P.rule === 'frame'){
    ctx.strokeStyle = ink; ctx.lineWidth = 1;
    ctx.strokeRect(pad*0.5, pad*0.5, w - pad, h - pad);
  }
  // Issue number.
  if(P.issueNumber){
    ctx.fillStyle = ink; ctx.font = `400 ${Math.max(10,h*0.012)}px ${spec.fonts.body}`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    const seed = (spec.tree.raw||'').length;
    const num = String(100 + (seed*7)%900).padStart(3,'0');
    ctx.fillText(`№ ${num}`, w-pad, pad);
  }
  // Sidebar tags.
  if(P.sidebar === 'left-tag' || P.sidebar === 'right-tag'){
    const tx = P.sidebar === 'left-tag' ? pad*0.4 : w-pad*0.4;
    ctx.save();
    ctx.translate(tx, h/2);
    ctx.rotate(-Math.PI/2);
    ctx.fillStyle = ink; ctx.font = `500 ${Math.max(10,h*0.012)}px ${spec.fonts.body}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(`poster · ${spec.archetype.label.toLowerCase()}`, 0, 0);
    ctx.restore();
  }
}

// Question Card — for headlines that ask a question. Huge mark, the question wraps,
// negative space preserved for the implicit answer.
function renderQuestionCard(ctx, w, h, spec, rng){
  const pal = paintBackground(ctx, w, h, spec, rng);
  const { ink, paper, accents } = pal;
  const P = spec.params || {};
  const pad = w*0.08;

  // The mark.
  if(P.markStyle === 'huge-mark'){
    ctx.fillStyle = accents[0] || ink;
    ctx.globalAlpha = 0.18;
    ctx.font = `900 ${h*0.78}px ${spec.fonts.display}`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('?', w - pad*0.5, h - pad*0.5);
    ctx.globalAlpha = 1;
  } else if(P.markStyle === 'subtle-mark'){
    ctx.fillStyle = ink;
    ctx.globalAlpha = 0.30;
    ctx.font = `900 ${h*0.30}px ${spec.fonts.display}`;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText('?', pad, pad + h*0.30);
    ctx.globalAlpha = 1;
  } else if(P.markStyle === 'corner-mark'){
    ctx.fillStyle = accents[0] || ink;
    ctx.font = `900 ${h*0.25}px ${spec.fonts.display}`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText('?', w-pad*0.5, pad*0.5);
  }

  // The question text — DP layout, anchored to bottom-left (leaving top-right for the mark/space).
  const titleTree = spec.tree;
  const measure = document.createElement('canvas').getContext('2d');
  const display = spec.fonts.display;
  const targetW = P.answerSpace === 'right-side' ? w*0.55 : w - pad*2;
  const cx = P.answerSpace === 'right-side' ? pad + targetW/2 : w/2;
  const cy = P.position === 'top-anchored' ? h*0.32
           : P.position === 'bottom-anchored' ? h*0.72
           : h*0.55;
  const layout = window.__formLayout.phraseBoxes(titleTree, {
    widthOf: (word, intentScale, unit) => {
      measure.font = `800 ${unit*intentScale}px ${display}`;
      return measure.measureText(word.w).width;
    },
    heightOf: (intentScale, unit) => unit * intentScale * 0.82,
    interWordRatio: 0.30,
    lineGapRatio: P.leading === 'tight' ? 0.05 : 0.14,
    targetW, targetH: h*0.7,
    minUnit: 24, maxUnit: Math.round(h*0.14),
    maxBlockScale: 1.4,
    alignX: 'left', cx, cy,
  });
  ctx.fillStyle = ink;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  layout.boxes.forEach(b => {
    ctx.font = `800 ${b.unitPx}px ${display}`;
    drawTreatedToken(ctx, b.word, b.x, b.baselineY, getTokenTreatment(spec, b.wordObj), pal);
  });
}

// Quote Stack — every word/phrase on its own line, generous breath. The phrase reads
// like a pull quote. Excellent for headlines that are themselves quote-like.
function renderQuoteStack(ctx, w, h, spec, rng){
  const pal = paintBackground(ctx, w, h, spec, rng);
  const { ink, paper, accents } = pal;
  const P = spec.params || {};
  const pad = w*0.08;
  const display = spec.fonts.display;

  // Split into natural phrases via FORM's break scores.
  const tokens = window.__formLayout.flattenWords(spec.tree);
  const breaks = window.__formLayout.computeBreakAfter(tokens);
  const lines = [[]];
  tokens.forEach((t, i) => {
    lines[lines.length-1].push(t);
    if(i < tokens.length-1 && breaks[i] >= 60) lines.push([]);
  });
  if(lines.at(-1).length === 0) lines.pop();

  // Measure lines to fit the canvas.
  const measure = document.createElement('canvas').getContext('2d');
  let unit = h*0.10;
  function measureLine(line, unit){
    measure.font = `700 ${unit}px ${display}`;
    const text = line.map(t=>t.w).join(' ');
    return measure.measureText(text).width;
  }
  while(unit > 18 && lines.some(l => measureLine(l, unit) > w - pad*2)){
    unit *= 0.94;
  }
  const leading = (P.leading === 'tight' ? 1.06 : P.leading === 'open' ? 1.55 : 1.22) * unit;
  const totalH = lines.length * leading;
  let y = h/2 - totalH/2 + leading*0.7;
  const alignLeft = P.align === 'left';
  ctx.fillStyle = ink;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = alignLeft ? 'left' : 'center';

  // Optional opening mark.
  if(P.markStyle === 'open-quote'){
    ctx.font = `900 ${unit*1.6}px ${display}`;
    ctx.globalAlpha = 0.35;
    ctx.fillText('"', alignLeft ? pad : w/2 - measureLine(lines[0], unit)/2 - unit*0.4, y - leading*0.4);
    ctx.globalAlpha = 1;
  } else if(P.markStyle === 'pull-bar'){
    ctx.fillStyle = accents[0] || ink;
    ctx.fillRect(pad, y - leading*1.1, Math.max(3, w*0.005), totalH + leading*0.2);
    ctx.fillStyle = ink;
  }

  lines.forEach(line => {
    line.forEach((t, i) => { t.display = applyCase(t.w, spec.caps); });
    const text = line.map(t=>t.display).join(' ');
    const hasPayoff = line.some(t => t.intentRole && t.intentRole.includes('payoff'));
    ctx.font = (hasPayoff ? '900' : '700') + ` ${unit}px ${display}`;
    ctx.fillStyle = hasPayoff && (P.markStyle === 'em-dash' || P.markStyle === 'pull-bar') ? (accents[0] || ink) : ink;
    const x = alignLeft ? pad : w/2;
    if(P.markStyle === 'em-dash' && hasPayoff){
      drawTreatedToken(ctx, '— '+text, x, y, spec.treatment, pal);
    } else {
      drawTreatedToken(ctx, text, x, y, spec.treatment, pal);
    }
    y += leading;
  });

  // Attribution.
  if(P.attribution === 'em-dash-author'){
    ctx.fillStyle = ink;
    ctx.font = `400 ${Math.max(12, h*0.014)}px ${spec.fonts.body}`;
    ctx.textAlign = alignLeft ? 'left' : 'center';
    ctx.fillText('— iamkesava.com', alignLeft ? pad : w/2, h - pad*0.4);
  } else if(P.attribution === 'tiny-bottom'){
    ctx.fillStyle = ink; ctx.globalAlpha = 0.55;
    ctx.font = `500 ${Math.max(10, h*0.012)}px ${spec.fonts.body}`;
    ctx.textAlign = 'center';
    ctx.fillText('iamkesava.com'.toUpperCase().split('').join(' '), w/2, h - pad*0.35);
    ctx.globalAlpha = 1;
  }
}

// Numbered Grid — extracts numerals from the phrase or numbers each phrase fragment.
// Best when the title has a numeric idea like "34 and 55".
function renderNumberedGrid(ctx, w, h, spec, rng){
  const pal = paintBackground(ctx, w, h, spec, rng);
  const { ink, paper, accents } = pal;
  const P = spec.params || {};
  const pad = w*0.08;
  const display = spec.fonts.display;
  const body = spec.fonts.body;

  // Find numerals.
  const text = spec.tree.raw || '';
  const numerals = text.match(/\d+/g) || [];

  // Headline (the rest of the phrase minus numerals + connectors). Keep it short.
  const headline = text
    .replace(/\s*\d+\s*/g, ' ')        // remove the numerals
    .replace(/\s+and\s+/gi, ' / ')      // collapse 'and'
    .replace(/\s{2,}/g, ' ').trim();

  // Headline at top.
  ctx.fillStyle = ink;
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const measure = document.createElement('canvas').getContext('2d');
  let headSize = h * 0.045;
  measure.font = `700 ${headSize}px ${display}`;
  while(headSize > 16 && measure.measureText(headline).width > w - pad*2){
    headSize *= 0.95; measure.font = `700 ${headSize}px ${display}`;
  }
  ctx.font = `700 ${headSize}px ${display}`;
  // Word-wrap headline manually using measure.
  const headlineLines = [];
  {
    const words = headline.split(/\s+/);
    let cur = '';
    for(const word of words){
      const test = cur ? cur + ' ' + word : word;
      if(measure.measureText(test).width > w - pad*2 && cur){ headlineLines.push(cur); cur = word; }
      else cur = test;
    }
    if(cur) headlineLines.push(cur);
  }
  headlineLines.forEach((line, i) => {
    ctx.fillText(line, pad, pad + headSize*(i+1));
  });
  const headlineBottom = pad + headSize*(headlineLines.length) + headSize*0.6;

  // The big numerals fill the rest of the canvas.
  const items = numerals.length >= 2 ? numerals.slice(0, 4) : ['01','02'];
  const numAreaTop = headlineBottom;
  const numAreaH = h - numAreaTop - pad;
  const cols = items.length <= 2 ? items.length : 2;
  const rows = Math.ceil(items.length / cols);
  const cellW = (w - pad*2) / cols;
  const cellH = numAreaH / rows;

  items.forEach((n, i) => {
    const cx = pad + (i % cols) * cellW;
    const cy = numAreaTop + Math.floor(i/cols) * cellH;
    // Big numeral, fitted to cell.
    let numSize = Math.min(cellH*0.92, cellW*0.85);
    if(P.numberStyle === 'serif'){
      ctx.font = `700 ${numSize}px 'EB Garamond', Georgia, serif`;
    } else if(P.numberStyle === 'mono'){
      ctx.font = `700 ${numSize*0.88}px ${body}`;
    } else {
      ctx.font = `900 ${numSize}px ${display}`;
    }
    // Re-fit if numerical is too wide.
    while(measure.measureText(n).width * (numSize/parseInt(ctx.font)) > cellW*0.92){
      numSize *= 0.95;
      ctx.font = ctx.font.replace(/\d+px/, `${Math.round(numSize)}px`);
    }
    ctx.fillStyle = i === 0 ? ink : (accents[0] || ink);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillText(n, cx, cy + numSize*0.92);
  });

  // Optional rule between rows.
  if(P.rule === 'between' && rows > 1){
    ctx.strokeStyle = ink; ctx.lineWidth = 1;
    for(let r=1;r<rows;r++){
      ctx.beginPath(); ctx.moveTo(pad, numAreaTop + r*cellH); ctx.lineTo(w-pad, numAreaTop + r*cellH); ctx.stroke();
    }
  } else if(P.rule === 'border'){
    ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.strokeRect(pad*0.6, pad*0.6, w - pad*1.2, h - pad*1.2);
  }
}
// Word-boundary-safe clause extraction. Walks back/forward whole tokens until
// the clause length sits in a usable range.
function extractClauseBefore(text, n){
  const i = text.indexOf(n);
  if(i < 0) return '';
  const before = text.slice(0, i).replace(/\s+$/,'');
  const words = before.split(/\s+/).filter(Boolean);
  // Last 3-5 words.
  return words.slice(Math.max(0, words.length-5)).join(' ').replace(/[,:;]+$/,'');
}
function extractClauseAfter(text, n){
  const i = text.indexOf(n);
  if(i < 0) return '';
  const after = text.slice(i + n.length).replace(/^\s+/, '');
  const words = after.split(/\s+/).filter(Boolean);
  return words.slice(0, 5).join(' ').replace(/^[,:;]+/,'').replace(/[,:;]+$/,'');
}

const RENDERERS = {
  'swiss-grid': renderSwissGrid,
  'editorial-serif': renderEditorialSerif,
  'brutalist-block': renderBrutalistBlock,
  'monumental-stack': renderMonumentalStack,
  'kinetic-slice': renderKineticSlice,
  'painterly-field': renderPainterlyField,
  'maximal-collage': renderMaximalCollage,
  'wood-type': renderWoodType,
  'magazine-cover': renderMagazineCover,
  'question-card': renderQuestionCard,
  'quote-stack': renderQuoteStack,
  'numbered-grid': renderNumberedGrid,
  'image-substrate': renderImageSubstrate,
  'mycelium': (ctx, w, h, spec, rng) => {
    // Bind palette into spec so mycelium can read it.
    const pal = pickContrastPair(spec.palette.colors);
    spec._palCache = pal;
    window.__mycelium.renderMycelium(ctx, w, h, spec, rng);
    // Cap with a small caption so phrase is still visible legibly.
    ctx.fillStyle = pal.ink;
    ctx.font = `500 ${Math.max(14, h*0.018)}px ${spec.fonts.body}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    ctx.fillText((spec.tree.raw||'').toLowerCase(), w/2, h - h*0.04);
  },
};

function render(canvas, spec){
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const w = canvas.width, h = canvas.height;
  const rng = rngFor(spec.tree.raw || '', 'render:'+spec.label+':'+spec.template.id);
  const fn = RENDERERS[spec.template.id] || renderMonumentalStack;
  ctx.save();
  fn(ctx, w, h, spec, rng);
  ctx.restore();
}

window.__render = { render, RENDERERS };
})();
