// shared/layout.js — phrase-aware layout primitives shared across philosophies.
// Each philosophy's render style differs, but the line-break + block-justification
// math is the same. Extracted from swiss.js so editorial / brutalist / kinetic /
// painterly can reach the same depth without rewriting it five times.
'use strict';

(function(){

// Flatten parse tree into a flat word array with intent metadata.
function flattenWords(tree){
  const out = [];
  (tree && tree.beats || []).forEach((beat, bi)=>{
    const tokens = (beat.tokens && beat.tokens.length) ? beat.tokens : (beat.words||[]).map(w=>({w}));
    tokens.forEach((tok, ti)=>{
      const word = (tok.w || '');
      if(!word) return;
      out.push({
        w: word,
        word: word.toLowerCase(),
        chars: word.split(''),
        beatIndex: bi,
        isBeatStart: ti === 0,
        isBeatEnd: ti === tokens.length-1,
        intentScale: tok.intentScale != null ? tok.intentScale : 1.0,
        intentRole:  tok.intentRole  || null,
        isStop: !!tok.isStop,
      });
    });
  });
  return out;
}

// Compute break-quality score AFTER each word.
//   100 = forced (post-punctuation / beat-end)
//    95 = isolate next payoff/imperative/time word
//   80-85 = strong (conjunction, "to", auxiliary)
//   68 = preposition
//   55 = article
//   10 = inside a phrase
function computeBreakAfter(words){
  return words.map((w, i)=>{
    if(i === words.length-1) return 0;
    if(w.isBeatEnd) return 100;
    const next = words[i+1];
    // ONLY forced semantic payoffs (contrast / time / imperative / question)
    // trigger the 95-isolate boost. The heuristic 'payoff' role (longest-word
    // fallback) doesn't — otherwise the DP isolates ANY long noun and the
    // syntactic break points (verb / article) lose. The latter scoring is
    // handled by breakScoreBefore which now recognises verbs + articles.
    if(next.intentRole && ['antonym-payoff','time-payoff','imperative','question'].includes(next.intentRole)) return 95;
    if(window.__parse && window.__parse.breakScoreBefore){
      return window.__parse.breakScoreBefore(next.word, w.word);
    }
    return 10;
  });
}

// Phrase-aware line break (dynamic programming).
// All measurements in caller-defined units (cells / em / pixels — pick one).
function phraseLineBreak(wordWidths, breakAfter, maxLineUnits, interWord){
  const N = wordWidths.length;
  if(!N) return [];
  const memo = new Array(N+1);
  memo[N] = { cost: 0, lines: [] };
  for(let i = N-1; i >= 0; i--){
    let bestCost = Infinity, bestLine = null, bestRest = null;
    let lineW = 0;
    for(let j = i; j < N; j++){
      lineW += (j===i ? 0 : interWord) + wordWidths[j];
      if(lineW > maxLineUnits && j > i) break;
      const isLast = (j === N-1);
      const fillRatio = lineW / maxLineUnits;
      const ragCost = isLast ? 0 : Math.pow(1 - fillRatio, 2) * 12;
      const breakSc = isLast ? 100 : breakAfter[j];
      const breakPenalty = isLast ? 0 : Math.pow(100 - breakSc, 2) * 0.5;
      // Skipped-break penalty: a line that walks past a high-score break point
      // (i.e. groups a setup with its payoff) pays for it. Without this, the DP
      // picks combined "...is now" over isolated "...is | now" because the
      // combined line is the last line and incurs no breakPenalty.
      let skippedBreakPenalty = 0;
      for(let k = i; k < j; k++){
        if(breakAfter[k] >= 90){
          skippedBreakPenalty += Math.pow(breakAfter[k] - 50, 2) * 0.4;
        }
      }
      const restCost = isLast ? 0 : memo[j+1].cost;
      const totalCost = ragCost + breakPenalty + skippedBreakPenalty + restCost;
      if(totalCost < bestCost){
        bestCost = totalCost;
        bestLine = [i, j];
        bestRest = isLast ? [] : memo[j+1].lines;
      }
    }
    if(!bestLine){ bestLine = [i, i]; bestRest = memo[i+1] ? memo[i+1].lines : []; bestCost = Infinity; }
    memo[i] = { cost: bestCost, lines: [bestLine].concat(bestRest) };
  }
  return memo[0].lines.map(([a, b])=>{
    const arr = [];
    for(let k=a;k<=b;k++) arr.push(k);
    return arr;
  });
}

// Block-justification: scale each line uniformly so its width matches the widest.
// "less is" (4.8 units) gets scaled 1.67× to match "more" (8 units).
function blockJustify(lines, wordWidths, interWord, maxBlockScale){
  maxBlockScale = maxBlockScale != null ? maxBlockScale : 3.5;
  const widths = lines.map(idxs=>{
    let w = 0;
    idxs.forEach((wi, i)=>{
      w += wordWidths[wi];
      if(i < idxs.length-1) w += interWord;
    });
    return w;
  });
  const target = Math.max(...widths);
  const scales = widths.map(w => Math.min(maxBlockScale, target / w));
  return { widths, target, scales };
}

// Verify the chosen line breaks meet a minimum break-quality threshold.
function breaksOk(lines, breakAfter, minScore){
  return lines.slice(0, -1).every(line => {
    const lastWi = line[line.length-1];
    return breakAfter[lastWi] >= minScore;
  });
}

// Full pipeline: find the largest base unit (font size, cell size, em) where
// the phrase fits within target W×H with natural break quality, then return
// per-word boxes with x/y/scale already block-justified.
//
// opts:
//   widthOf:  (word, intentScale, unitPx) → pixel width  (caller measures)
//   heightOf: (intentScale, unitPx) → pixel height
//   interWordRatio: gap between words as fraction of unitPx (default 0.6)
//   lineGapRatio:   vertical gap as fraction of unitPx (default 0.35)
//   targetW, targetH: pixel bounds for the layout
//   minUnit / maxUnit: unit-size search range in pixels
//   maxBlockScale: cap on per-line stretch (default 2.4)
//   alignX: 'center' | 'left' (default 'center')
function phraseBoxes(tree, opts){
  const words = flattenWords(tree);
  if(!words.length) return { words:[], lines:[], boxes:[], unit:0, scales:[] };
  const breakAfter = computeBreakAfter(words);
  const interWordRatio = opts.interWordRatio != null ? opts.interWordRatio : 0.6;
  const lineGapRatio   = opts.lineGapRatio   != null ? opts.lineGapRatio   : 0.35;
  const maxBlockScale  = opts.maxBlockScale  != null ? opts.maxBlockScale  : 2.4;
  const minUnit = Math.max(2, opts.minUnit || 4);
  const maxUnit = Math.max(minUnit, opts.maxUnit || 200);

  let chosen = null;
  function tryFit(minBreakScore){
    for(let unit = maxUnit; unit >= minUnit; unit -= Math.max(1, Math.round(unit*0.05))){
      const widths   = words.map(w => opts.widthOf(w, w.intentScale, unit));
      const heights  = words.map(w => opts.heightOf(w.intentScale, unit));
      const interW   = interWordRatio * unit;
      const lineGap  = lineGapRatio * unit;
      const maxLineW = opts.targetW;
      if(widths.some(w => w > maxLineW)) continue;
      const lines = phraseLineBreak(widths, breakAfter, maxLineW, interW);
      const bj = blockJustify(lines, widths, interW, maxBlockScale);
      if(bj.target > maxLineW) continue;
      const lineHeights = lines.map((idxs, li)=>{
        const maxH = Math.max(...idxs.map(wi => heights[wi])) * bj.scales[li];
        return maxH + lineGap;
      });
      const totalH = lineHeights.reduce((s,h)=>s+h, 0);
      if(totalH > opts.targetH) continue;
      if(!breaksOk(lines, breakAfter, minBreakScore)) continue;
      chosen = { unit, lines, widths, heights, interW, lineGap, scales: bj.scales, target: bj.target };
      return true;
    }
    return false;
  }
  tryFit(60) || tryFit(40) || tryFit(20) || tryFit(0);
  if(!chosen){
    const unit = minUnit;
    const widths  = words.map(w => opts.widthOf(w, w.intentScale, unit));
    const heights = words.map(w => opts.heightOf(w.intentScale, unit));
    chosen = { unit, lines:[words.map((_,i)=>i)], widths, heights, interW:interWordRatio*unit, lineGap:lineGapRatio*unit, scales:[1], target: opts.targetW };
  }

  // Place: compute pixel boxes per word, block-justified.
  const { unit, lines, widths, heights, interW, lineGap, scales } = chosen;
  const linePxH = lines.map((idxs, li)=>{
    const maxH = Math.max(...idxs.map(wi => heights[wi])) * scales[li];
    return maxH + lineGap;
  });
  const totalHpx = linePxH.reduce((s,h)=>s+h, 0);
  const cx = opts.cx != null ? opts.cx : (opts.targetW / 2);
  const cy = opts.cy != null ? opts.cy : (opts.targetH / 2);
  const yStart = cy - totalHpx/2 + (opts.yOffset || 0);
  const alignX = opts.alignX || 'center';
  const boxes = [];
  let yCursor = yStart;
  lines.forEach((wordIdxs, li)=>{
    const lineHpx = linePxH[li];
    const ls = scales[li];
    let lineWpx = 0;
    wordIdxs.forEach((wi, i)=>{
      lineWpx += widths[wi] * ls;
      if(i < wordIdxs.length-1) lineWpx += interW * ls;
    });
    let xStart;
    if(alignX === 'left')      xStart = cx - opts.targetW/2;
    else if(alignX === 'right') xStart = cx + opts.targetW/2 - lineWpx;
    else                        xStart = cx - lineWpx/2;
    let cursorX = xStart;
    wordIdxs.forEach((wi, i)=>{
      const word = words[wi];
      const wordWpx = widths[wi] * ls;
      const wordHpx = heights[wi] * ls;
      // bottom-aligned within the line so different scales share a baseline
      const wordYBase = yCursor + lineHpx - lineGap - wordHpx;
      boxes.push({
        word: word.w,
        wordObj: word,
        intentScale: word.intentScale,
        intentRole: word.intentRole,
        beatIndex: word.beatIndex,
        isBeatEnd: word.isBeatEnd,
        lineIndex: li,
        x: cursorX,
        y: wordYBase,
        w: wordWpx,
        h: wordHpx,
        unitPx: unit * word.intentScale * ls,
        lineScale: ls,
        baselineY: wordYBase + wordHpx,
      });
      cursorX += wordWpx + (i < wordIdxs.length-1 ? interW * ls : 0);
    });
    yCursor += lineHpx;
  });
  return { words, lines, boxes, unit, scales, totalHpx };
}

window.__formLayout = {
  flattenWords,
  computeBreakAfter,
  phraseLineBreak,
  blockJustify,
  breaksOk,
  phraseBoxes,
};

})();
