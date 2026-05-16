// shared/conceit.js — the layer above templates.
// A "conceit" is a structural design idea the system commits to before the
// template renders. Templates trust the conceit and lean into it: if the
// conceit is `antonyms-fight`, every template should place the two antonym
// tokens at maximum positional + scale distance. If `question-leaves-space`,
// every template should reserve a quadrant of negative space.
//
// Two directors looking at the same parse tree pick TWO DIFFERENT conceits
// when more than one is valid — that's where the diptych's intellectual
// distance lives.
'use strict';

(function(){
  const { rngFor, pick, chance } = window.__seed;

  const CONCEITS = {
    'antonyms-fight':         'Place the two antonym tokens at maximum scale and positional opposition.',
    'question-leaves-space':  'Reserve a large negative-space quadrant. The question is the answer.',
    'list-gets-numbered':     'Number each item. The repetition is the message.',
    'verb-implies-motion':    'Skew or scatter the verb token. The verb is alive.',
    'time-marker-clock':      'Place the time word where a clock hand would point.',
    'imperative-monument':    'The imperative verb is monumental. Everything else genuflects.',
    'monosyllable-thunder':   'One word, the full canvas. Nothing else.',
    'parallel-stack':         'Equal-cadence lines, equal weight. The pattern IS the idea.',
    'whisper-then-shout':     'Setup at body size; payoff at display. The volume jump carries the meaning.',
    'name-then-claim':        'Proper noun small at top; claim huge below.',
    'no-conceit':             'No structural idea claimed; render straight.',
  };

  // Look at the parse tree, return a list of *candidate* conceits in priority order.
  // The director picks one; the second director picks a DIFFERENT one when possible.
  function candidatesFor(tree){
    const out = [];
    const beats = tree.beats || [];
    const allTokens = beats.flatMap(b => b.tokens || []);
    const roles = allTokens.map(t => t.intentRole).filter(Boolean);
    const wordCount = allTokens.length;

    if(roles.some(r => r === 'antonym-payoff') && roles.some(r => r === 'antonym-setup'))
      out.push('antonyms-fight');
    if(tree.tone === 'question')
      out.push('question-leaves-space');
    if(tree.pattern === 'list')
      out.push('list-gets-numbered');
    if(roles.includes('imperative'))
      out.push('imperative-monument');
    if(roles.includes('time-payoff'))
      out.push('time-marker-clock');
    if(wordCount === 1)
      out.push('monosyllable-thunder');
    if(/^parallel/.test(tree.pattern))
      out.push('parallel-stack');
    if(allTokens.some(t => t.intentRole === 'antonym-setup' || t.intentRole === 'setup-cohesion'))
      out.push('whisper-then-shout');
    // proper noun at start, claim after
    const startsProperNoun = allTokens[0] && /^[A-Z][a-z]+/.test(allTokens[0].w);
    if(startsProperNoun && wordCount > 2)
      out.push('name-then-claim');
    // verb at start (imperative was the strong signal; a non-leading verb is weaker).
    // Restrict to clear -ing / -ed / -ing endings so "is" / "has" don't trigger.
    const hasVerb = allTokens.some(t => {
      const w = (t.w||'').toLowerCase();
      if(t.isStop) return false;
      if(w.length < 5) return false;
      return /ing$|ed$/.test(w);
    });
    if(hasVerb && !out.includes('imperative-monument'))
      out.push('verb-implies-motion');
    out.push('no-conceit');
    return out;
  }

  // Pick two distinct conceits when the candidate list has 2+. Deterministic.
  function pickPair(tree, phrase){
    const cands = candidatesFor(tree);
    const rng = rngFor(phrase, 'conceit-pair');
    if(cands.length === 0) return ['no-conceit', 'no-conceit'];
    if(cands.length === 1) return [cands[0], cands[0]];
    // First director takes the top candidate.
    const a = cands[0];
    // Second director takes a different one — prefers the most distant idea.
    // We use stream order so it's deterministic. Skip 'no-conceit' if any
    // other distinct candidate exists.
    const otherCands = cands.filter(c => c !== a);
    const meaningful = otherCands.filter(c => c !== 'no-conceit');
    const b = (meaningful.length ? pick(rng, meaningful) : otherCands[0]) || 'no-conceit';
    return [a, b];
  }

  function describe(id){ return CONCEITS[id] || id; }

  window.__conceit = { CONCEITS, candidatesFor, pickPair, describe };
})();
