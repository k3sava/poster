// shared/director.js — turns (phrase, seed offset) into a complete poster spec.
// Two directors run on the same phrase with different salts → two different posters.
// Every choice is logged into `trace` so the user can see how the poster was built
// and override any decision via the Customize panel.
'use strict';

(function(){
const { rngFor, pick, range, chance } = window.__seed;
const PARSE = () => window.__parse;

// Designer DNA, loaded lazily.
let DESIGNERS = null;
async function loadDesigners(){
  if(DESIGNERS) return DESIGNERS;
  const r = await fetch('shared/knowledge/designers.json');
  DESIGNERS = (await r.json()).designers;
  window.__designersCache = DESIGNERS;
  return DESIGNERS;
}

// Composition templates. Each declares which director-archetypes can pick it.
// The renderer (render.js) implements the actual draw for each template id.
const TEMPLATES = [
  { id:'swiss-grid',     name:'Swiss Grid',          archetypes:['rationalist','minimal']         , weight:1.0 },
  { id:'editorial-serif',name:'Editorial Serif',     archetypes:['literary','classic']            , weight:1.0 },
  { id:'brutalist-block',name:'Brutalist Block',     archetypes:['punk','radical']                , weight:1.0 },
  { id:'monumental-stack',name:'Monumental Stack',   archetypes:['scher','burrill','rationalist'] , weight:1.1 },
  { id:'kinetic-slice',  name:'Kinetic Slice',       archetypes:['punk','radical','expressive']   , weight:0.9 },
  { id:'painterly-field',name:'Painterly Field',     archetypes:['expressive','literary']         , weight:0.85 },
  { id:'maximal-collage',name:'Maximal Collage',     archetypes:['expressive','punk']             , weight:0.8 },
  { id:'wood-type',      name:'Wood Type',           archetypes:['burrill','classic','radical']   , weight:0.95 },
  { id:'image-substrate',name:'Image Substrate',     archetypes:['expressive','literary','classic'], weight:0.75 },
  { id:'mycelium',       name:'Mycelium',            archetypes:['expressive','literary','radical'], weight:0.65 },
  { id:'magazine-cover', name:'Magazine Cover',      archetypes:['literary','classic','sagmeisterian','vignellian'], weight:1.1 },
  { id:'question-card',  name:'Question Card',       archetypes:['expressive','sagmeisterian','munarian'], weight:1.0 },
  { id:'quote-stack',    name:'Quote Stack',         archetypes:['literary','vignellian','classic','sagmeisterian'], weight:1.0 },
  { id:'numbered-grid',  name:'Numbered Grid',       archetypes:['rationalist','vignellian','munarian'], weight:0.9 },
];

// Director archetypes — two-of-N rotation per phrase.
// Salt seeds the rotation so the SAME phrase always yields the SAME pair.
const ARCHETYPES = [
  { id:'rationalist', label:'Rationalist',  pref_templates:['swiss-grid','monumental-stack','editorial-serif'],
    pref_caps:'sentence', tone:'cool',
    palette_pref:['vignelli','crouwel'] },
  { id:'expressive',  label:'Expressive',   pref_templates:['painterly-field','kinetic-slice','maximal-collage'],
    pref_caps:'mixed', tone:'warm',
    palette_pref:['sagmeister','scher'] },
  { id:'punk',        label:'Punk',         pref_templates:['brutalist-block','kinetic-slice','wood-type'],
    pref_caps:'all', tone:'aggressive',
    palette_pref:['joyce','scher'] },
  { id:'literary',    label:'Literary',     pref_templates:['editorial-serif','painterly-field','monumental-stack'],
    pref_caps:'sentence', tone:'measured',
    palette_pref:['sagmeister','vignelli'] },
  { id:'radical',     label:'Radical',      pref_templates:['brutalist-block','maximal-collage','wood-type'],
    pref_caps:'all', tone:'aggressive',
    palette_pref:['burrill','joyce'] },
  { id:'classic',     label:'Classic',      pref_templates:['monumental-stack','editorial-serif','wood-type'],
    pref_caps:'title', tone:'measured',
    palette_pref:['burrill','vignelli'] },
];

// Pick TWO different archetypes via score-and-reason against the parsed tree.
function pickArchetypePair(phrase){
  // Parse once.
  const ingested = window.__article.ingest(phrase);
  const text = ingested.kind === 'article' ? ingested.headline : phrase;
  const tree = PARSE().basic(text);
  tree.raw = phrase;
  tree.ingested = ingested;
  const picked = window.__archetypes.pickPair(tree, phrase);
  return [
    Object.assign({}, picked[0].archetype, { _hire_reason: picked[0].reason, _score: picked[0].score }),
    Object.assign({}, picked[1].archetype, { _hire_reason: picked[1].reason, _score: picked[1].score }),
  ];
}

function pickPalette(rng, designers, archetype){
  // Prefer designers tagged for this archetype's mode preferences; fall back
  // to designers matching the archetype's id directly; final fallback = full
  // pool. This way the 26 designers in the DNA are all reachable.
  const modeMap = {
    rationalist: ['GRID','EDITORIAL'],
    expressive:  ['PAINTERLY','EDITORIAL','KINETIC'],
    punk:        ['BRUTALIST','GRID'],
    literary:    ['EDITORIAL','PAINTERLY'],
    radical:     ['BRUTALIST','KINETIC'],
    classic:     ['GRID','EDITORIAL'],
  };
  const modes = modeMap[archetype.id] || [];
  const tagged = designers.filter(d =>
    Array.isArray(d.assignable_to_modes) && d.assignable_to_modes.some(m => modes.includes(m))
  );
  const explicit = archetype.palette_pref
    .map(id => designers.find(d => d.id === id))
    .filter(Boolean);
  const pool = tagged.length ? tagged : (explicit.length ? explicit : designers);
  // 70% draw from tagged pool, 30% wild card from the full set for variety.
  const candidate = chance(rng, 0.30) ? pick(rng, designers) : pick(rng, pool);
  return {
    colors: candidate.palette.slice(),
    inheritedFrom: candidate.id,
    inheritedName: candidate.name,
  };
}

function pickTemplate(rng, archetype, excludeIds){
  // Weighted draw from preferred templates first.
  const exclude = new Set(excludeIds || []);
  const prefSet = new Set(archetype.pref_templates);
  let preferred = TEMPLATES.filter(t => prefSet.has(t.id) && !exclude.has(t.id));
  let pool = preferred.length ? preferred : TEMPLATES.filter(t => !exclude.has(t.id));
  if(!pool.length) pool = TEMPLATES;
  const total = pool.reduce((s,t)=>s+t.weight,0);
  let r = rng()*total;
  for(const t of pool){ r -= t.weight; if(r <= 0) return t; }
  return pool[pool.length-1];
}

function pickGrid(rng, template){
  switch(template.id){
    case 'swiss-grid':       return { cols:12, rows:16, gutter:24 };
    case 'editorial-serif':  return { cols:1,  rows:8,  gutter:32 };
    case 'brutalist-block':  return { cols:6,  rows:8,  gutter:0  };
    case 'monumental-stack': return { cols:1,  rows:6,  gutter:0  };
    case 'kinetic-slice':    return { cols:8,  rows:8,  gutter:4  };
    case 'painterly-field':  return { cols:1,  rows:1,  gutter:0  };
    case 'maximal-collage':  return { cols:8,  rows:10, gutter:6  };
    case 'wood-type':        return { cols:1,  rows:5,  gutter:8  };
    default:                 return { cols:8,  rows:10, gutter:12 };
  }
}

function pickFonts(rng, archetype, template){
  // Each template suggests a tonal axis; archetype refines weight.
  const SERIF = '"EB Garamond", Georgia, serif';
  const SANS  = '"Helvetica Neue", "Arial Black", Helvetica, sans-serif';
  const MONO  = '"JetBrains Mono", ui-monospace, monospace';
  const DISPLAY = '"Archivo Black", "Helvetica Neue", Helvetica, sans-serif';

  if(template.id === 'editorial-serif' || archetype.id === 'literary')
    return { display:SERIF, body:SERIF, weight:700 };
  if(template.id === 'brutalist-block' || archetype.id === 'punk')
    return { display:MONO, body:MONO, weight:700 };
  if(template.id === 'wood-type' || archetype.id === 'radical')
    return { display:DISPLAY, body:SANS, weight:900 };
  if(template.id === 'painterly-field' || archetype.id === 'expressive')
    return { display:SANS, body:SERIF, weight:800 };
  return { display:SANS, body:SANS, weight:900 };
}

// Build a complete poster spec for ONE director.
async function composeOne(phrase, archetype, label, conceit){
  const designers = await loadDesigners();
  const rng = rngFor(phrase, 'director:'+archetype.id);
  const trace = [];

  // 0. Article ingestion. If the input is long-form, extract a headline,
  //    kicker, and pull-quote; the headline becomes what the parser sees.
  const ingested = window.__article.ingest(phrase);
  const composeText = ingested.kind === 'article' ? ingested.headline : phrase;
  if(ingested.kind === 'article'){
    trace.push({ step:'ingest', value: `article → "${ingested.headline}"`,
                 reason: `Long-form input. Extracted headline ${ingested.kicker ? '+ kicker "'+ingested.kicker+'"' : ''}${ingested.pullQuote ? ' + pull quote' : ''}.` });
  }

  trace.push({ step:'director', value: archetype.label,
               reason: archetype._hire_reason
                 ? `${archetype._hire_reason} (score ${Math.round(archetype._score)}). Doctrine: "${archetype.doctrine}"`
                 : `Doctrine: "${archetype.doctrine}"` });

  // 0.5. Conceit — the structural idea this director commits to.
  if(conceit){
    trace.push({ step:'conceit', value: conceit,
                 reason: window.__conceit.describe(conceit) });
  }

  // 1. Parse phrase via form's parser (intent / break scores / payoff).
  const tree = PARSE().basic(composeText);
  tree.ingested = ingested;
  const payoffBeat = tree.beats[tree.payoff];
  const payoffTokens = (payoffBeat?.tokens || []).filter(t => !t.isStop);
  const payoffWord = payoffTokens.length
    ? payoffTokens.reduce((a,b)=> b.intentScale > a.intentScale ? b : a, payoffTokens[0]).w
    : (payoffBeat?.words?.[0] || phrase);
  trace.push({ step:'parse', value:`tone=${tree.tone}, pattern=${tree.pattern}, payoff="${payoffWord}"`,
               reason:`Parser scored "${payoffWord}" as the focal token (intent role: ${
                 (payoffBeat?.tokens||[]).find(t=>t.w===payoffWord)?.intentRole || 'payoff'}).` });

  // 2. Template — content-aware routing first, archetype preference second.
  const wordCount = (tree.beats||[]).flatMap(b=>b.tokens||[]).length;
  const isQuestion = tree.tone === 'question';
  const hasNumerals = /\d{2,}/.test(tree.raw||'') && (tree.raw||'').match(/\d+/g).length >= 2;
  const isLong = wordCount > 7;
  const baseExcl = archetype._excludeTemplates || [];

  let template;
  let reason;
  // Route by content. These overrides only fire if the archetype's pref list
  // is compatible OR if no other template can serve the content well.
  if(hasNumerals && !baseExcl.includes('numbered-grid')){
    template = TEMPLATES.find(t => t.id === 'numbered-grid');
    reason = `The phrase contains numbers (${(tree.raw||'').match(/\d+/g).join(', ')}). Numbered Grid carries that.`;
  } else if(isQuestion && !baseExcl.includes('question-card')){
    template = TEMPLATES.find(t => t.id === 'question-card');
    reason = `The phrase ends in '?'. Question Card commits to that.`;
  } else if(isLong){
    // Long → prefer editorial templates regardless of archetype.
    const longPrefs = ['magazine-cover','quote-stack','editorial-serif'];
    const matchArchetype = archetype.pref_templates.filter(id => longPrefs.includes(id));
    const candidate = matchArchetype.length ? matchArchetype : longPrefs;
    const pick0 = candidate[Math.floor(rng() * candidate.length)];
    template = TEMPLATES.find(t => t.id === pick0) || TEMPLATES.find(t => t.id === 'magazine-cover');
    reason = `${wordCount} words. ${archetype.label} pivots to ${template.name} (long-text friendly).`;
  } else {
    const longExcl = isLong ? ['wood-type','brutalist-block'] : [];
    template = pickTemplate(rng, archetype, [...baseExcl, ...longExcl]);
    reason = `${archetype.label} prefers ${archetype.pref_templates.join(', ')}; this phrase landed on ${template.name}.`;
  }
  trace.push({ step:'template', value: template.name, reason });

  // 2b. Variant parameters (turns each template into a parameter space).
  const params = window.__templateParams.paramsFor(template.id, rng);
  trace.push({ step:'variant', value: window.__templateParams.describeParams(params),
               reason: `Sampled coordinates inside the ${template.name} parameter space.` });

  // 3. Grid.
  const grid = pickGrid(rng, template);
  trace.push({ step:'grid', value:`${grid.cols}×${grid.rows}, gutter ${grid.gutter}`,
               reason:`Standard grid for ${template.name}.` });

  // 4. Palette via designer DNA.
  const palette = pickPalette(rng, designers, archetype);
  trace.push({ step:'palette', value: palette.colors.join(' · '),
               reason:`Inherited from ${palette.inheritedName} — fits the ${archetype.label} register.` });

  // 5. Fonts.
  const fonts = pickFonts(rng, archetype, template);
  trace.push({ step:'fonts', value: fonts.display.split(',')[0].replace(/"/g,''),
               reason:`${template.name} + ${archetype.label} tone → ${fonts.weight}-weight display.` });

  // 6. Case.
  const caps = chance(rng, 0.7) ? archetype.pref_caps : tree.caps;
  trace.push({ step:'caps', value:caps, reason:`Director default: ${archetype.pref_caps}.` });

  // 7. Rotation / off-axis decisions.
  const rotation = (template.id === 'kinetic-slice' || (archetype.id==='expressive' && chance(rng,0.5)))
    ? range(rng, -6, 6) : 0;
  if(rotation) trace.push({ step:'rotation', value: rotation.toFixed(1)+'°',
                            reason:`${template.name} permits off-axis composition.` });

  // 8. Background treatment.
  const bgTreatments = ['solid','split','noise','grain','grid-ghost'];
  const bg = (template.id === 'painterly-field') ? pick(rng, ['noise','grain'])
            : (template.id === 'brutalist-block') ? pick(rng, ['solid','split'])
            : pick(rng, bgTreatments);
  trace.push({ step:'background', value: bg, reason:`Surface treatment for ${template.name}.` });

  // 9. Per-token type treatment (wordart-inspired).
  const treatment = params.treatment || 'solid';
  trace.push({ step:'treatment', value: treatment,
               reason:'Letter-level effect layered on top of placed type.' });

  return {
    label,
    archetype,
    template,
    grid,
    palette,
    fonts,
    caps,
    rotation,
    bg,
    tree,
    params,
    treatment,
    conceit,
    ingested,
    payoffWord,
    trace,
  };
}

async function composePair(phrase){
  const [aArch, bArch] = pickArchetypePair(phrase);
  // Run the conceit selector once on the parsed tree so both directors share
  // the candidate space but pick different conceits.
  const probeTree = (window.__article.ingest(phrase).kind === 'article')
    ? PARSE().basic(window.__article.ingest(phrase).headline)
    : PARSE().basic(phrase);
  const [conA, conB] = window.__conceit.pickPair(probeTree, phrase);
  const a = await composeOne(phrase, aArch, 'A', conA);
  // B must not pick the same template even if content-routing would prefer to.
  const bArchExcluded = Object.assign({}, bArch, { _excludeTemplates: [a.template.id] });
  let b = await composeOne(phrase, bArchExcluded, 'B', conB);
  // Hard diversity: A and B must differ on template, palette source, and treatment.
  const enforceDiversity = (a, b, bArch, phrase) => {
    let changed = false;
    if(b.template.id === a.template.id){
      const reroll = rngFor(phrase,'director:'+bArch.id+':regrid');
      const alt = pickTemplate(reroll, bArch, [a.template.id]);
      b.template = alt;
      b.grid = pickGrid(reroll, alt);
      b.params = window.__templateParams.paramsFor(alt.id, reroll);
      b.treatment = b.params.treatment || 'solid';
      b.trace.push({ step:'diversity', value:'template → '+alt.name,
        reason:`A already took ${a.template.name}. B must show a different shape.` });
      b.trace.push({ step:'variant', value: window.__templateParams.describeParams(b.params),
        reason: `Re-sampled coordinates for ${alt.name} after diversity reroll.` });
      changed = true;
    }
    if(b.palette.inheritedFrom === a.palette.inheritedFrom){
      // Pull a different designer from b's archetype's pref pool.
      const designers = window.__designersCache || [];
      const alt = designers.find(d =>
        d.id !== a.palette.inheritedFrom &&
        (bArch.palette_pref.includes(d.id) ||
         (Array.isArray(d.assignable_to_modes) && d.assignable_to_modes.length))
      );
      if(alt){
        b.palette = { colors: alt.palette.slice(), inheritedFrom: alt.id, inheritedName: alt.name };
        b.trace.push({ step:'diversity', value:'palette → '+alt.name,
          reason:`A already used ${a.palette.inheritedName}'s palette. B inherits ${alt.name}.` });
      }
    }
    if(b.treatment === a.treatment){
      const trts = ['outline','double-strike','shadow-soft','split-color','halftone-fill','stencil-cut','mirror-y'];
      const alt = trts.find(t => t !== a.treatment);
      if(alt){
        b.treatment = alt;
        b.trace.push({ step:'diversity', value:'treatment → '+alt, reason:`Distinct from A's ${a.treatment}.` });
      }
    }
    if(b.conceit === a.conceit && b.conceit !== 'no-conceit'){
      // already handled by conceit.pickPair, but guard anyway
      b.trace.push({ step:'diversity', value:'conceit unchanged', reason:'Both directors landed the same conceit.' });
    }
    return changed;
  };
  enforceDiversity(a, b, bArch, phrase);
  return { a, b, archetypes: [aArch, bArch] };
}

window.__director = {
  composePair,
  composeOne,
  TEMPLATES,
  ARCHETYPES,
  loadDesigners,
};
})();
