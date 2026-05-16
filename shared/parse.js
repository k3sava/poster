// shared/parse.js — phrase parser for FORM
// Heuristic parser runs immediately. compromise.js loads on demand for
// POS annotation; while it's loading, philosophies have a usable tree.

'use strict';

let nlp=null;
let nlpPromise=null;

function loadNLP(){
  if(nlp)return Promise.resolve(nlp);
  if(nlpPromise)return nlpPromise;
  nlpPromise=new Promise((res,rej)=>{
    const s=document.createElement('script');
    s.src='https://unpkg.com/compromise@14/builds/compromise.js';
    s.onload=()=>{ nlp=window.nlp; res(nlp); };
    s.onerror=()=>rej(new Error('failed to load compromise.js'));
    document.head.appendChild(s);
  });
  return nlpPromise;
}

function countSyllables(word){
  word=word.toLowerCase().replace(/[^a-z]/g,'');
  if(!word)return 0;
  if(word.length<=3)return 1;
  word=word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/,'');
  word=word.replace(/^y/,'');
  const m=word.match(/[aeiouy]{1,2}/g);
  return m?m.length:1;
}

function detectCaps(text){
  const letters=text.replace(/[^a-zA-Z]/g,'');
  if(!letters)return 'mixed';
  const upper=letters.replace(/[^A-Z]/g,'').length;
  if(upper===letters.length)return 'all';
  const words=text.split(/\s+/).filter(w=>/[a-zA-Z]/.test(w));
  if(words.length>0&&words.every(w=>/^[A-Z]/.test(w)))return 'title';
  if(/^[A-Z]/.test(text)&&upper/letters.length<.3)return 'sentence';
  return 'mixed';
}

function detectTone(raw){
  const t=raw.trim();
  if(/\?$/.test(t))return 'question';
  if(/!$/.test(t))return 'exclaim';
  const startsWithVerb=/^(go|do|make|stop|run|find|build|come|see|look|listen|breathe|move|begin|stay|leave|wait|love|fight|seek|wake|rise|fall|push|pull|hold|let|let's|let's|try|think|wonder|imagine|consider|notice|remember|forget|feel|reach|trust|believe)\b/i.test(t);
  if(startsWithVerb)return 'imperative';
  if(/\.$/.test(t))return 'statement';
  return 'fragment';
}

function beatify(text){
  const parts=text.split(/[.,;:!?]\s*/).map(s=>s.trim()).filter(Boolean);
  return parts;
}

// English stop-words (lowercased). Anything in here scores low for content emphasis.
const STOPWORDS=new Set([
  'a','an','the','is','am','are','was','were','be','been','being','will','would','could','should','may','might','must','shall','can',
  'do','does','did','have','has','had','having',
  'of','in','on','at','to','for','from','by','with','about','against','between','into','through','during','before','after','above','below','up','down','out','off','over','under','again','further','then','once',
  'and','or','but','not','no','nor','so','as','if','because','while','until','than','though','although',
  'this','that','these','those','i','you','he','she','it','we','they','me','him','her','us','them','my','your','his','its','our','their','mine','yours','hers','ours','theirs',
  'what','which','who','whom','whose','where','when','why','how','any','some','all','each','every','very','just','too','also',
]);

// Score one word's emphasis on 0..1. Length, stop-word membership, position, and special flags drive it.
function scoreWord(word, indexInBeat, totalInBeat){
  const w=word.replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
  if(!w)return 0;
  if(STOPWORDS.has(w))return 0.12;
  const len=Math.min(1, w.length/8);
  const positional=(indexInBeat===totalInBeat-1)?0.18:0;
  const allCaps=/^[A-Z]{2,}$/.test(word);
  const hasDigit=/\d/.test(word);
  const properNoun=indexInBeat>0 && /^[A-Z]/.test(word);
  const flag=(allCaps||hasDigit||properNoun)?0.25:0;
  return Math.max(0, Math.min(1, 0.32 + len*0.42 + positional + flag));
}

function buildBeat(text){
  const words=text.split(/\s+/).filter(Boolean);
  const syllables=words.reduce((s,w)=>s+countSyllables(w),0);
  const tokens=words.map((w,i)=>({
    w,
    pos:null,
    emphasis: scoreWord(w, i, words.length),
    syllables: countSyllables(w),
    isStop: STOPWORDS.has(w.replace(/[^a-zA-Z0-9]/g,'').toLowerCase()),
  }));
  return {
    text, words, tokens,
    syllables,
    emphasis: 0.5,
  };
}

function detectPattern(beats){
  if(beats.length<=1)return 'single';
  const lens=beats.map(b=>b.words.length);
  const max=Math.max(...lens), min=Math.min(...lens);
  if(max-min<=1)return `parallel-${beats.length}`;
  if(beats.length>=3&&lens.every(l=>l<=3))return 'list';
  return 'freeform';
}

function assignEmphasis(beats, pattern){
  if(beats.length===1){ beats[0].emphasis=0.9; return; }
  beats.forEach((b,i)=>{ b.emphasis=0.4+0.1*i/beats.length; });
  beats[beats.length-1].emphasis=0.95;
  beats.forEach(b=>{
    const allCaps=b.words.filter(w=>/^[A-Z]{2,}$/.test(w));
    if(allCaps.length===b.words.length)return;
    if(allCaps.length>0)b.emphasis=Math.max(b.emphasis, 0.9);
  });
}

function basicParse(text){
  const raw=text;
  const beatTexts=beatify(text);
  const beats=beatTexts.map(buildBeat);
  if(beats.length===0)beats.push(buildBeat(text||''));
  const pattern=detectPattern(beats);
  assignEmphasis(beats,pattern);
  const tone=detectTone(text);
  const caps=detectCaps(text);
  const payoff=beats.reduce((iMax,b,i,arr)=>b.emphasis>arr[iMax].emphasis?i:iMax,0);
  return { raw, beats, pattern, tone, payoff, caps };
}

async function richParse(text){
  await loadNLP();
  const tree=basicParse(text);
  if(!nlp)return tree;
  try{
    const doc=nlp(text);
    const terms=doc.terms().out('array');
    const tags =doc.terms().out('tags');
    tree.beats.forEach(b=>{
      b.tokens=b.tokens.map(t=>{
        const idx=terms.indexOf(t.w);
        if(idx>=0&&tags[idx]){
          const tagSet=Object.keys(tags[idx]);
          t.pos=tagSet[0]||null;
        }
        return t;
      });
    });
  }catch(e){}
  return tree;
}

// Words that typically open a phrase — break BEFORE these is a natural pause.
// Conjunctions, subordinators, prepositions, relative pronouns.
const BREAK_BEFORE=new Set([
  'and','or','but','so','yet','nor',
  'while','because','although','though','if','then','when','where','until','since','unless','whenever','wherever',
  'that','who','whom','whose','which',
  'to','of','in','on','at','for','by','with','from','into','through','after','before','about','against','between','during','above','below','toward','towards','like','as','than',
  'is','was','are','were','be','been','being','will','would','could','should','may','might','must',
  'a','an','the',
]);

// Cheap morphology check: does `w` look like a conjugated action verb?
//   start, starts, started, starting   → yes (stem 'start' in ACTION_VERBS)
//   running → yes (doubled-consonant past-progressive, stem 'run')
// Used in breakScoreBefore to recognise the predicate-starting verb mid-phrase.
function looksLikeActionVerb(w){
  if(ACTION_VERBS.has(w)) return true;
  if(w.length > 2 && w.endsWith('s')   && ACTION_VERBS.has(w.slice(0,-1))) return true;
  if(w.length > 3 && w.endsWith('es')  && ACTION_VERBS.has(w.slice(0,-2))) return true;
  if(w.length > 3 && w.endsWith('ed')  && ACTION_VERBS.has(w.slice(0,-2))) return true;
  if(w.length > 4 && w.endsWith('ing')){
    const stem = w.slice(0,-3);
    if(ACTION_VERBS.has(stem)) return true;
    if(stem.length >= 2 && stem[stem.length-1] === stem[stem.length-2] && ACTION_VERBS.has(stem.slice(0,-1))) return true;
    if(ACTION_VERBS.has(stem + 'e')) return true; // make + ing → making
  }
  return false;
}

// Score the priority of breaking BEFORE a given word. 0..100.
// Higher = more natural pause. Typographers break at phrase boundaries, never inside one.
function breakScoreBefore(word, prev){
  const w = (word||'').replace(/[^a-zA-Z0-9]/g,'').toLowerCase();
  if(!w) return 50;
  // VERY strong: conjunctions (open a new clause)
  if(['and','but','or','so','yet','because','while','although','though','if','that','which','who','whose','whom'].includes(w)) return 85;
  // Strong: "to" before a verb-like word — infinitive opens a verb phrase
  if(w === 'to') return 82;
  // Strong: auxiliary verbs introduce the predicate of a sentence
  if(['is','was','are','were','be','been','being','will','would','could','should','may','might','must','have','has','had','do','does','did'].includes(w)) return 80;
  // Strong: action verbs mid-phrase begin the predicate.
  // "a thousand miles | start | with a step" — break BEFORE the main verb.
  if(looksLikeActionVerb(w)) return 80;
  // Medium-strong: prepositions and relative markers (open a PP)
  if(['of','in','on','at','for','by','with','from','into','through','after','before','about','against','between','during','toward','towards','like','as','than','until','since','unless','because'].includes(w)) return 68;
  // Medium-strong: articles open a noun phrase. Bumped from 55 → 72 so the
  // DP separates "with | a step" rather than letting "with a step" run on.
  // The article at index 0 of the phrase doesn't get this score (it has no
  // "break BEFORE" to compute).
  if(['a','an','the'].includes(w)) return 72;
  // Otherwise default low — discourages breaking inside a phrase
  return 10;
}

// Antonym/contrast pairs. When BOTH appear in a phrase, the typographic
// move is to make them visually fight — both get scale, the latter usually larger (payoff).
// Directionless pairs: if BOTH appear in a phrase, the one appearing LATER is the payoff.
const CONTRAST_PAIRS=[
  ['less','more'],
  ['small','big'], ['little','large'],
  ['old','new'],
  ['cold','hot'], ['warm','cool'],
  ['before','after'], ['past','future'], ['then','now'], ['was','is'], ['were','are'],
  ['light','dark'], ['day','night'],
  ['slow','fast'], ['quick','slow'],
  ['empty','full'],
  ['low','high'], ['short','tall'],
  ['soft','loud'], ['quiet','loud'],
  ['begin','end'], ['start','stop'],
  ['nothing','everything'], ['none','all'], ['some','many'],
  ['near','far'],
  ['weak','strong'],
  ['lose','win'],
  ['hard','easy'],
  ['black','white'],
  ['yes','no'],
];

// Imperatives and action verbs that signal monumental intent.
const ACTION_VERBS=new Set([
  // Original imperative set (kept for first-position monumental scaling)
  'go','do','run','jump','make','build','create','stop','breathe','rise','fall',
  'sing','dance','wake','sleep','dream','fly','dive','rest','move','wait','listen',
  'look','see','find','seek','reach','touch','hold','let','try','begin','end',
  'remember','forget','feel',
  // Expanded for mid-phrase predicate detection in breakScoreBefore.
  // Common verbs that show up in proverbs and headlines.
  'start','plant','walk','climb','grow','change','lead','keep','leave','stay',
  'come','write','read','work','play','fight','love','speak','think','know',
  'want','need','take','give','share','learn','teach','win','lose','open','close',
  'turn','break','fix','choose','believe','trust','wonder','imagine','watch',
  'consider','notice','accept','reject','escape','arrive','depart','enter','exit',
  'sit','stand','walk','rise','dance','draw','paint','design','craft','ship',
  'launch','land','climb','run','swim','breathe','live','die','born',
]);

// Annotate the parse tree with typographic intent. Walks all tokens, sets:
//   token.intentScale  — relative size multiplier (1.0 = base)
//   token.intentRole   — 'payoff' | 'antonym-a' | 'antonym-b' | 'imperative' | 'time' | null
// Mutates the tree in place and also returns it.
function detectIntent(tree){
  if(!tree || !tree.beats) return tree;
  const allTokens=[];
  tree.beats.forEach(b=>{
    if(!b.tokens) b.tokens = b.words.map(w=>({w, emphasis:0.5, isStop:false}));
    b.tokens.forEach(t=>{
      t.intentScale = 1.0;
      t.intentRole = null;
      allTokens.push(t);
    });
  });
  if(!allTokens.length) return tree;
  const lc = allTokens.map(t=>(t.w||'').replace(/[^a-zA-Z]/g,'').toLowerCase());

  // 1. CONTRAST pairs. Both words present in any order → the LATER one is the payoff.
  let contrastHit = false;
  CONTRAST_PAIRS.forEach(([a, b])=>{
    const ia = lc.indexOf(a), ib = lc.indexOf(b);
    if(ia >= 0 && ib >= 0 && ia !== ib){
      contrastHit = true;
      const firstIdx = Math.min(ia, ib);
      const secondIdx = Math.max(ia, ib);
      // Setup word — visible but distinctly smaller than the payoff
      if(allTokens[firstIdx].intentScale < 1.2)allTokens[firstIdx].intentScale = 0.7;
      allTokens[firstIdx].intentRole = allTokens[firstIdx].intentRole || 'antonym-setup';
      // Payoff word — monumental
      allTokens[secondIdx].intentScale = Math.max(allTokens[secondIdx].intentScale, 2.2);
      allTokens[secondIdx].intentRole = 'antonym-payoff';
    }
  });

  // 1.5 SETUP-CLAUSE COHESION. Stop-words between an antonym setup and its
  //     payoff inherit the setup scale. "less is more" must render as
  //     [less is] (whisper) → [more] (display), not "is" suddenly tall in
  //     the middle of the setup clause.
  allTokens.forEach((t, i)=>{
    if(t.intentRole !== 'antonym-setup') return;
    let payoffIdx = -1;
    for(let j=i+1; j<allTokens.length; j++){
      if(allTokens[j].intentRole === 'antonym-payoff'){ payoffIdx = j; break; }
    }
    if(payoffIdx <= i) return;
    for(let j=i+1; j<payoffIdx; j++){
      const tk = allTokens[j];
      if(tk.isStop && tk.intentScale <= 1.1){
        tk.intentScale = 0.7;
        tk.intentRole = tk.intentRole || 'setup-cohesion';
      }
    }
  });

  // 2. IMPERATIVE / ACTION verb at sentence start → monumental.
  if(allTokens[0]){
    const first = lc[0];
    if(ACTION_VERBS.has(first)){
      allTokens[0].intentScale = Math.max(allTokens[0].intentScale, 1.9);
      allTokens[0].intentRole = allTokens[0].intentRole || 'imperative';
    }
  }

  // 3. EXCLAMATION (! anywhere) — final content word gets heavy.
  if(tree.tone === 'exclaim'){
    const lastContent = [...allTokens].reverse().find(t=>!t.isStop);
    if(lastContent){
      lastContent.intentScale = Math.max(lastContent.intentScale, 1.8);
      lastContent.intentRole = lastContent.intentRole || 'payoff';
    }
  }

  // 4. QUESTION — the question word ("why", "what", "how", etc.) gets scale.
  if(tree.tone === 'question'){
    const qWords = new Set(['why','what','how','when','where','who','which','whose']);
    const qIdx = lc.findIndex(w=>qWords.has(w));
    if(qIdx >= 0){
      allTokens[qIdx].intentScale = Math.max(allTokens[qIdx].intentScale, 1.7);
      allTokens[qIdx].intentRole = allTokens[qIdx].intentRole || 'question';
    }
  }

  // 5. TIME markers — "now", "tomorrow", "today", "yesterday", "never", "always".
  // A phrase-final time word is the literal temporal payoff — outranks even antonym contrast.
  const TIME = new Set(['now','today','tomorrow','yesterday','never','always','forever','tonight']);
  lc.forEach((w, i)=>{
    if(TIME.has(w)){
      const isPhraseEnd = (i === allTokens.length-1);
      const scale = isPhraseEnd ? 2.4 : 1.5;
      allTokens[i].intentScale = Math.max(allTokens[i].intentScale, scale);
      // Phrase-final time markers carry the message — promote role to 'time-payoff'.
      allTokens[i].intentRole = isPhraseEnd ? 'time-payoff' : (allTokens[i].intentRole || 'time');
    }
  });

  // 6. PAYOFF fallback — last content word; ties to later occurrence.
  if(!contrastHit && tree.tone !== 'exclaim' && tree.tone !== 'question'){
    let best = -1, bestLen = 0;
    allTokens.forEach((t, i)=>{
      if(t.isStop) return;
      const len = (t.w||'').length;
      // Prefer later occurrence on equal length — typographer reads to the end and lands there.
      if(len >= bestLen){ bestLen = len; best = i; }
    });
    if(best >= 0 && allTokens[best].intentScale === 1.0){
      allTokens[best].intentScale = 1.45;
      allTokens[best].intentRole = 'payoff';
    }
  }

  // 7. PRIMA BALLERINA — only ONE word gets the max scale. If multiple were elevated
  //    (e.g. antonym-payoff AND time marker AND imperative), demote all but the highest-scale.
  //    Paula Scher rule: exactly one focal element.
  let topIdx = -1, topScale = 0;
  allTokens.forEach((t, i)=>{
    if(t.intentScale > topScale){ topScale = t.intentScale; topIdx = i; }
  });
  if(topIdx >= 0 && topScale > 1.3){
    allTokens.forEach((t, i)=>{
      if(i === topIdx) return;
      if(t.intentScale >= 1.3){
        // Demote to "sub" tier (body for content words, smaller for stop-words).
        t.intentScale = 1.15;
        if(t.intentRole) t.intentRole = t.intentRole.replace(/payoff|imperative|question/, 'sub-emphasis');
      }
    });
  }

  // 8. THREE-TIER snap. Cluster intentScale into display/sub/body/whisper buckets.
  //    Real typographers use 3 sizes max. Smashing's rule.
  allTokens.forEach(t=>{
    const s = t.intentScale;
    if(s >= 1.6) t.intentScale = 2.0;        // display
    else if(s >= 1.2) t.intentScale = 1.25;  // sub
    else if(s >= 0.85) t.intentScale = 1.0;  // body
    else t.intentScale = 0.7;                // whisper (setup / antonym-a)
  });

  return tree;
}

// Re-wrap basicParse to detect intent.
const _basicParse = basicParse;
basicParse = function(text){
  const tree = _basicParse(text);
  return detectIntent(tree);
};

window.__parse={
  basic: basicParse,
  rich: richParse,
  load: loadNLP,
  breakScoreBefore,
  detectIntent,
  CONTRAST_PAIRS,
  ACTION_VERBS,
  STOPWORDS,
  BREAK_BEFORE,
};
