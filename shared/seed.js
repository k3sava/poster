// shared/seed.js — deterministic seeded RNG.
// xfnv1a hashes phrase → 32-bit seed. mulberry32 generates a stream.
// Two "directors" share the phrase seed but diverge by stream offset.
'use strict';

(function(){
  function xfnv1a(str){
    let h = 2166136261 >>> 0;
    for(let i=0;i<str.length;i++){
      h = Math.imul(h ^ str.charCodeAt(i), 16777619);
    }
    return ()=>{ h = Math.imul(h ^ (h>>>16), 2246822507);
                 h = Math.imul(h ^ (h>>>13), 3266489909);
                 return (h ^= h>>>16) >>> 0; };
  }
  function mulberry32(seed){
    let t = seed >>> 0;
    return function(){
      t = (t + 0x6D2B79F5) | 0;
      let r = Math.imul(t ^ (t>>>15), 1 | t);
      r = (r + Math.imul(r ^ (r>>>7), 61 | r)) ^ r;
      return ((r ^ (r>>>14)) >>> 0) / 4294967296;
    };
  }
  function seedFrom(phrase, salt){
    const gen = xfnv1a((phrase||'') + '|' + (salt||''));
    return gen();
  }
  function rngFor(phrase, salt){
    return mulberry32(seedFrom(phrase, salt));
  }
  function pick(rng, arr){ return arr[Math.floor(rng()*arr.length)]; }
  function range(rng, a, b){ return a + rng()*(b-a); }
  function chance(rng, p){ return rng() < p; }

  window.__seed = { xfnv1a, mulberry32, seedFrom, rngFor, pick, range, chance };
})();
