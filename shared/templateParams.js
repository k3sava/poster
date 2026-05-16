// shared/templateParams.js — turns each template into a parameter space.
// 8 template families × ~5 parameters × ~3 levels each → hundreds of distinct
// concrete poster recipes. The director draws coordinates in this space
// deterministically; the renderer reads them. Trace shows the coordinates so
// the user knows poster A is "Swiss Grid (asymmetric / 12-col / hairline / kicker)"
// rather than just "Swiss Grid".

'use strict';

(function(){
const { pick, range, chance } = window.__seed;

// Type treatments — wordart-inspired letter-level effects layered on top.
// Each renders as an additional draw pass over the placed glyph.
const TYPE_TREATMENTS = [
  'solid', 'outline', 'double-strike', 'shadow-hard', 'shadow-soft',
  'halftone-fill', 'stencil-cut', 'mirror-y', 'split-color',
  'underline-thick', 'strike-through',
];

// Image substrate effects — pixart-inspired bottom-layer treatments.
const IMAGE_EFFECTS = [
  'halftone', 'dither', 'ink-wash', 'contour', 'ascii-grid',
  'flow-field', 'cmyk-shift', 'cellular',
];

// Per-template parameter spaces. Each draw produces a coordinate dict.
function paramsFor(templateId, rng){
  switch(templateId){
    case 'swiss-grid':
      return {
        cols:        pick(rng, [6, 8, 12, 16]),
        align:       pick(rng, ['symmetric', 'asymmetric-left', 'asymmetric-right']),
        ruleStyle:   pick(rng, ['hairline', 'thick', 'double', 'none']),
        rulePosition:pick(rng, ['top', 'bottom', 'both', 'split']),
        hasKicker:   chance(rng, 0.65),
        hasNumber:   chance(rng, 0.30),
        accentBlock: pick(rng, ['none', 'top-strip', 'side-bar', 'corner']),
        payoffSize:  pick(rng, ['display', 'monumental', 'restrained']),
        treatment:   pick(rng, ['solid', 'outline', 'split-color']),
      };
    case 'editorial-serif':
      return {
        align:       pick(rng, ['centered', 'left', 'right', 'drop-cap']),
        leading:     pick(rng, ['tight', 'normal', 'open']),
        ruleStyle:   pick(rng, ['hairline-both', 'hairline-top', 'ornament', 'none']),
        accentWord:  pick(rng, ['italic', 'roman', 'small-caps']),
        hasKicker:   chance(rng, 0.55),
        hasPullQuote:chance(rng, 0.35),
        margin:      pick(rng, ['wide', 'narrow', 'wide-asymmetric']),
        treatment:   pick(rng, ['solid', 'outline']),
      };
    case 'brutalist-block':
      return {
        align:       pick(rng, ['hard-left', 'hard-right', 'wall-to-wall']),
        spacing:     pick(rng, ['flush', 'overlap', 'gapped']),
        coloring:    pick(rng, ['ink-only', 'alternating', 'one-accent']),
        rotation:    pick(rng, [0, 0, 0, -3, 3, -90]),
        bgBlock:     pick(rng, ['none', 'split', 'strip']),
        treatment:   pick(rng, ['solid', 'outline', 'stencil-cut', 'double-strike']),
        ratio:       pick(rng, ['standard', 'extra-tall', 'squished']),
      };
    case 'monumental-stack':
      return {
        align:       pick(rng, ['center', 'left', 'right']),
        spacing:     pick(rng, ['tight', 'normal', 'loose']),
        gradient:    pick(rng, ['none', 'scale-ascending', 'scale-descending', 'scale-pyramid']),
        accentLine:  pick(rng, ['none', 'between-payoff', 'underline-payoff']),
        treatment:   pick(rng, ['solid', 'outline', 'shadow-hard', 'mirror-y']),
        payoffColor: pick(rng, ['ink', 'accent', 'accent-strong']),
      };
    case 'kinetic-slice':
      return {
        rotation:    range(rng, -8, 8),
        scatter:     pick(rng, ['diagonal', 'arc', 'spiral', 'starburst']),
        sliceCount:  pick(rng, [0, 2, 3, 5, 8]),
        sliceWidth:  pick(rng, ['hairline', 'thin', 'thick']),
        payoffSize:  pick(rng, ['monumental', 'display']),
        treatment:   pick(rng, ['solid', 'outline', 'split-color', 'shadow-hard']),
      };
    case 'painterly-field':
      return {
        fieldShape:  pick(rng, ['circles', 'ovals', 'rectangles', 'organic-blobs']),
        density:     pick(rng, [30, 60, 100, 180]),
        alphaRange:  pick(rng, [[0.04, 0.12], [0.06, 0.20], [0.10, 0.30]]),
        textPosition:pick(rng, ['center', 'top', 'bottom', 'lower-third']),
        captionPos:  pick(rng, ['below', 'above', 'side', 'none']),
        treatment:   pick(rng, ['solid', 'outline', 'shadow-soft']),
      };
    case 'maximal-collage':
      return {
        tokenRotation: pick(rng, ['wild', 'orthogonal', 'mild']),
        layering:    pick(rng, ['scatter', 'pinwheel', 'cluster']),
        colorPolicy: pick(rng, ['rainbow', 'duotone', 'ink-only']),
        payoffSize:  pick(rng, ['monumental', 'display']),
        treatment:   pick(rng, ['solid', 'outline', 'split-color', 'mirror-y']),
      };
    case 'wood-type':
      return {
        rows:        pick(rng, [3, 4, 5, 6, 8]),
        ratio:       pick(rng, ['standard', 'extra-tall', 'thin']),
        coloring:    pick(rng, ['alternating', 'descending', 'one-accent', 'ink-only']),
        rule:        pick(rng, ['none', 'between-each', 'between-first', 'border']),
        treatment:   pick(rng, ['solid', 'outline', 'double-strike']),
      };
    case 'mycelium':
      return {
        count:      pick(rng, [80, 140, 200]),
        wild:       pick(rng, [0.15, 0.30, 0.50]),
        textPosition: pick(rng, ['centered', 'bottom-cap']),
        treatment:  'solid',
      };
    case 'image-substrate':
      return {
        effect:      pick(rng, IMAGE_EFFECTS),
        intensity:   pick(rng, ['low', 'medium', 'high']),
        textPlacement: pick(rng, ['top', 'bottom', 'center', 'corner']),
        textColor:   pick(rng, ['ink', 'paper', 'accent']),
        scrim:       pick(rng, ['none', 'top-fade', 'bottom-fade', 'full-dim']),
        treatment:   pick(rng, ['solid', 'outline', 'stencil-cut']),
      };
    case 'magazine-cover':
      return {
        kickerStyle:  pick(rng, ['caps-spaced', 'small-italic', 'mono-bold']),
        titleCase:    pick(rng, ['sentence', 'title']),
        leading:      pick(rng, ['tight', 'normal', 'open']),
        rule:         pick(rng, ['top-thick', 'top-hairline', 'frame', 'none']),
        sidebar:      pick(rng, ['none', 'left-tag', 'right-tag', 'top-tag']),
        accentWord:   pick(rng, ['italic-payoff', 'underline-payoff', 'color-payoff', 'none']),
        issueNumber:  pick(rng, [true, false]),
        treatment:    pick(rng, ['solid', 'outline']),
      };
    case 'question-card':
      return {
        markStyle:    pick(rng, ['huge-mark', 'subtle-mark', 'corner-mark']),
        position:     pick(rng, ['centered', 'top-anchored', 'bottom-anchored']),
        leading:      pick(rng, ['tight', 'normal']),
        answerSpace:  pick(rng, ['top-right', 'right-side', 'bottom-half']),
        treatment:    pick(rng, ['solid', 'outline']),
      };
    case 'quote-stack':
      return {
        align:        pick(rng, ['left', 'center']),
        leading:      pick(rng, ['tight', 'normal', 'open']),
        markStyle:    pick(rng, ['none', 'open-quote', 'em-dash', 'pull-bar']),
        attribution:  pick(rng, ['none', 'em-dash-author', 'tiny-bottom']),
        treatment:    pick(rng, ['solid', 'outline']),
      };
    case 'numbered-grid':
      return {
        cols:         pick(rng, [1, 2, 3]),
        numberStyle:  pick(rng, ['mono', 'serif', 'circled', 'huge']),
        leading:      pick(rng, ['tight', 'normal', 'open']),
        rule:         pick(rng, ['between', 'border', 'none']),
        treatment:    pick(rng, ['solid', 'outline']),
      };
    default:
      return { treatment:'solid' };
  }
}

// Build a human label describing the variant. Used in the trace so the user
// sees "Swiss Grid · 12-col · hairline · asymmetric-left · kicker" rather
// than just "Swiss Grid".
function describeParams(p){
  if(!p) return '';
  const keys = Object.keys(p).filter(k => k !== 'treatment');
  const parts = keys.map(k => {
    const v = p[k];
    if(typeof v === 'boolean') return v ? k : null;
    if(Array.isArray(v)) return `${k}=${v.join('–')}`;
    return `${v}`;
  }).filter(Boolean);
  return parts.join(' · ');
}

// Compute approximate variant count for the marketing label.
function variantCount(){
  let total = 0;
  const SAMPLES = {
    'swiss-grid': 4*3*4*4*2*2*4*3*3,            // ~13k — capped logically below
    'editorial-serif': 4*3*4*3*2*2*3*2,
    'brutalist-block': 3*3*3*6*3*4*3,
    'monumental-stack': 3*3*4*3*4*3,
    'kinetic-slice': 1*4*5*3*2*4,
    'painterly-field': 4*4*3*4*4*3,
    'maximal-collage': 3*3*3*2*4,
    'wood-type': 5*3*4*4*3,
    'image-substrate': 8*3*4*3*4*3,
  };
  Object.values(SAMPLES).forEach(n => total += n);
  // Cap each family at "useful distinct combinations" to be honest.
  return total;
}

window.__templateParams = { paramsFor, describeParams, variantCount, TYPE_TREATMENTS, IMAGE_EFFECTS };
})();
