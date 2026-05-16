// shared/archetypes.js — 12 named directors with explicit reasoning.
// Each archetype has:
//   - id, label, doctrine (one-sentence operating belief)
//   - pref_templates, pref_conceits, pref_treatments
//   - evaluate(tree) → { score, reason } — scores how well this phrase fits
//     this director's worldview. Top two distinct scorers get the gig per phrase.
//
// The reason string is surfaced in the trace so the user sees WHY this director
// took the job. No more "picked from preferred set" hand-waving.
'use strict';

(function(){
  const A = [
    {
      id:'rationalist', label:'The Rationalist',
      doctrine:'Form follows the grid. The grid follows the meaning.',
      pref_templates:['swiss-grid','monumental-stack','editorial-serif'],
      pref_conceits:['parallel-stack','whisper-then-shout','no-conceit'],
      pref_treatments:['solid','outline'],
      palette_pref:['vignelli','crouwel','muller-brockmann'],
      caps:'sentence',
      evaluate(tree){
        const t = (tree.beats||[]).flatMap(b=>b.tokens||[]);
        const wc = t.length;
        let score = 30;
        if(tree.pattern && tree.pattern.startsWith('parallel')) score += 35;
        if(wc <= 5) score += 15;
        if(tree.tone === 'statement' || tree.tone === 'fragment') score += 10;
        if(tree.tone === 'exclaim') score -= 15;
        return { score, reason: tree.pattern && tree.pattern.startsWith('parallel')
          ? 'Parallel cadence wants a grid.'
          : 'Short, declarative phrase — the grid is the argument.' };
      }
    },
    {
      id:'expressive', label:'The Expressivist',
      doctrine:'Type is feeling first, reading second.',
      pref_templates:['painterly-field','kinetic-slice','maximal-collage','mycelium'],
      pref_conceits:['verb-implies-motion','question-leaves-space','no-conceit'],
      pref_treatments:['shadow-soft','split-color','mirror-y'],
      palette_pref:['sagmeister','scher','fili','amado'],
      caps:'mixed',
      evaluate(tree){
        let score = 20;
        const t = (tree.beats||[]).flatMap(b=>b.tokens||[]);
        if(tree.tone === 'exclaim') score += 30;
        if(t.some(x=>x.intentRole === 'imperative')) score += 18;
        if(/[?!]/.test(tree.raw || '')) score += 10;
        if(tree.pattern && tree.pattern.startsWith('parallel')) score -= 15;
        return { score, reason: tree.tone === 'exclaim'
          ? 'Exclamation wants emotion, not order.'
          : 'There is feeling under the literal meaning.' };
      }
    },
    {
      id:'punk', label:'The Punk',
      doctrine:'Hierarchy is the establishment. Flatten it.',
      pref_templates:['brutalist-block','kinetic-slice','wood-type'],
      pref_conceits:['monosyllable-thunder','imperative-monument','no-conceit'],
      pref_treatments:['stencil-cut','double-strike','outline'],
      palette_pref:['joyce','scher','amado','kalman'],
      caps:'all',
      evaluate(tree){
        let score = 20;
        const t = (tree.beats||[]).flatMap(b=>b.tokens||[]);
        if(t.length <= 3) score += 25;
        if(t.some(x=>x.intentRole === 'imperative')) score += 25;
        if(tree.tone === 'exclaim') score += 20;
        if(tree.pattern === 'freeform') score -= 5;
        return { score, reason: tree.tone === 'exclaim' || t.some(x=>x.intentRole==='imperative')
          ? 'The phrase is shouting. It deserves a wall, not a paragraph.'
          : 'Short and dense — the right phrase to wall-paste.' };
      }
    },
    {
      id:'literary', label:'The Literarian',
      doctrine:'A line on a page is a sentence in a book.',
      pref_templates:['editorial-serif','painterly-field','monumental-stack'],
      pref_conceits:['whisper-then-shout','name-then-claim','no-conceit'],
      pref_treatments:['solid','outline'],
      palette_pref:['sagmeister','vignelli','fili','rand'],
      caps:'sentence',
      evaluate(tree){
        const t = (tree.beats||[]).flatMap(b=>b.tokens||[]);
        const wc = t.length;
        let score = 25;
        if(wc >= 4) score += 15;
        if(tree.ingested && tree.ingested.kind === 'article') score += 30;
        if(tree.tone === 'statement') score += 10;
        if(tree.tone === 'exclaim') score -= 20;
        return { score, reason: (tree.ingested && tree.ingested.kind === 'article')
          ? 'Long-form input. This is a quote, not a slogan.'
          : 'A complete thought reads better in a serif column.' };
      }
    },
    {
      id:'radical', label:'The Radical',
      doctrine:'Break the wall the previous director just built.',
      pref_templates:['brutalist-block','maximal-collage','wood-type','kinetic-slice'],
      pref_conceits:['verb-implies-motion','monosyllable-thunder','no-conceit'],
      pref_treatments:['split-color','double-strike','stencil-cut'],
      palette_pref:['burrill','joyce','amado','kalman'],
      caps:'all',
      evaluate(tree){
        let score = 15;
        const t = (tree.beats||[]).flatMap(b=>b.tokens||[]);
        if(t.length <= 4) score += 20;
        if(tree.tone === 'imperative' || tree.tone === 'exclaim') score += 25;
        if(t.some(x=>x.intentRole === 'antonym-payoff')) score += 18;
        return { score, reason: t.some(x=>x.intentRole==='antonym-payoff')
          ? 'Antonyms in the phrase want to fight, not coexist.'
          : 'Short and punchy — fuel for confrontation.' };
      }
    },
    {
      id:'classic', label:'The Classicist',
      doctrine:'Wood type, ink, the bones of a slogan.',
      pref_templates:['monumental-stack','editorial-serif','wood-type'],
      pref_conceits:['whisper-then-shout','imperative-monument','no-conceit'],
      pref_treatments:['solid','outline','double-strike'],
      palette_pref:['burrill','vignelli','rand','muller-brockmann'],
      caps:'title',
      evaluate(tree){
        let score = 25;
        const t = (tree.beats||[]).flatMap(b=>b.tokens||[]);
        if(t.length <= 6) score += 15;
        if(tree.pattern === 'single') score += 12;
        if(tree.tone === 'imperative') score += 10;
        return { score, reason: 'A wood-type wall reads from across the street.' };
      }
    },
    // --- six new ---
    {
      id:'vignellian', label:'The Vignellian',
      doctrine:'Three sizes, four typefaces, no exceptions.',
      pref_templates:['swiss-grid','monumental-stack'],
      pref_conceits:['parallel-stack','no-conceit'],
      pref_treatments:['solid'],
      palette_pref:['vignelli'],
      caps:'sentence',
      evaluate(tree){
        const t = (tree.beats||[]).flatMap(b=>b.tokens||[]);
        let score = 18;
        if(t.length >= 4 && t.length <= 8) score += 25;
        if(tree.pattern && tree.pattern.startsWith('parallel')) score += 25;
        return { score, reason: 'A measured, mid-length phrase. The unigrid was built for this.' };
      }
    },
    {
      id:'scherist', label:'The Scherist',
      doctrine:'Make one word read as a different kind of word.',
      pref_templates:['monumental-stack','wood-type','kinetic-slice'],
      pref_conceits:['whisper-then-shout','antonyms-fight','name-then-claim'],
      pref_treatments:['split-color','double-strike','outline'],
      palette_pref:['scher','joyce','burrill'],
      caps:'all',
      evaluate(tree){
        const t = (tree.beats||[]).flatMap(b=>b.tokens||[]);
        let score = 22;
        if(t.some(x=>x.intentRole && x.intentRole.includes('payoff'))) score += 20;
        if(t.some(x=>x.intentRole === 'antonym-payoff')) score += 22;
        if(tree.tone === 'exclaim') score += 12;
        return { score, reason: t.some(x=>x.intentRole==='antonym-payoff')
          ? 'Contrast pair detected — the payoff should chant.'
          : 'There is a payoff word. Make it a different kind of word.' };
      }
    },
    {
      id:'sagmeisterian', label:'The Sagmeisterian',
      doctrine:'Concept first; typography is the wrapper.',
      pref_templates:['painterly-field','mycelium','image-substrate'],
      pref_conceits:['verb-implies-motion','question-leaves-space','whisper-then-shout'],
      pref_treatments:['shadow-soft','solid','halftone-fill'],
      palette_pref:['sagmeister','fili'],
      caps:'sentence',
      evaluate(tree){
        let score = 18;
        const t = (tree.beats||[]).flatMap(b=>b.tokens||[]);
        if(tree.tone === 'question') score += 25;
        if(t.length >= 5) score += 15;
        if(tree.ingested && tree.ingested.kind === 'article') score += 20;
        return { score, reason: tree.tone === 'question'
          ? 'A question wants room for the reader to answer.'
          : 'The phrase has a thought behind it. Let the surface carry it.' };
      }
    },
    {
      id:'munarian', label:'The Munarian',
      doctrine:'Design is making poetry from constraint.',
      pref_templates:['swiss-grid','monumental-stack','editorial-serif'],
      pref_conceits:['monosyllable-thunder','parallel-stack','no-conceit'],
      pref_treatments:['solid','outline'],
      palette_pref:['vignelli','crouwel','rand'],
      caps:'sentence',
      evaluate(tree){
        const t = (tree.beats||[]).flatMap(b=>b.tokens||[]);
        let score = 22;
        if(t.length === 1) score += 30;
        if(t.length <= 3) score += 15;
        if(tree.tone === 'fragment') score += 10;
        return { score, reason: t.length === 1
          ? 'One word — the cleanest constraint in the room.'
          : 'Few words, room to think.' };
      }
    },
    {
      id:'carsonian', label:'The Carsonian',
      doctrine:'Legibility is overrated. Feel beats read.',
      pref_templates:['maximal-collage','kinetic-slice','painterly-field'],
      pref_conceits:['verb-implies-motion','antonyms-fight','no-conceit'],
      pref_treatments:['split-color','shadow-hard','mirror-y'],
      palette_pref:['scher','sagmeister','amado','kalman'],
      caps:'mixed',
      evaluate(tree){
        let score = 16;
        const t = (tree.beats||[]).flatMap(b=>b.tokens||[]);
        if(tree.tone === 'exclaim' || tree.tone === 'imperative') score += 12;
        if(t.length >= 3 && t.length <= 7) score += 12;
        // Always a credible second option for medium-length phrases — adds variety.
        score += 8;
        return { score, reason: 'A reader who has to fight for it remembers it.' };
      }
    },
    {
      id:'troxlerian', label:'The Troxlerian',
      doctrine:'A poster is a moment of music made still.',
      pref_templates:['kinetic-slice','painterly-field','maximal-collage','mycelium'],
      pref_conceits:['verb-implies-motion','question-leaves-space','no-conceit'],
      pref_treatments:['shadow-soft','split-color','outline'],
      palette_pref:['greiman','sagmeister','fili'],
      caps:'sentence',
      evaluate(tree){
        let score = 20;
        const t = (tree.beats||[]).flatMap(b=>b.tokens||[]);
        if(t.some(x=>/ing$/.test((x.w||'').toLowerCase()))) score += 18;
        if(tree.tone === 'imperative') score += 12;
        if(t.length >= 3) score += 8;
        return { score, reason: 'There is movement in the phrase. Let it move on the page.' };
      }
    },
  ];

  // Pick two highest scorers with hard diversity: their pref_templates must differ.
  function pickPair(tree, phrase){
    const scored = A.map(a => {
      const ev = a.evaluate(tree);
      // Stable per-phrase jitter so ties resolve deterministically.
      const jitter = (window.__seed.rngFor(phrase, 'arch-jitter-' + a.id)() - 0.5) * 6;
      return { a, score: ev.score + jitter, reason: ev.reason };
    }).sort((x,y) => y.score - x.score);

    const first = scored[0];
    // Find a second that doesn't share its full pref_templates set.
    const second = scored.slice(1).find(s => {
      const overlap = s.a.pref_templates.filter(t => first.a.pref_templates.includes(t)).length;
      return overlap < s.a.pref_templates.length; // at least one template differs
    }) || scored[1];

    return [
      { archetype: first.a, score: first.score, reason: first.reason },
      { archetype: second.a, score: second.score, reason: second.reason },
    ];
  }

  window.__archetypes = { ARCHETYPES: A, pickPair };
})();
