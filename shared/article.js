// shared/article.js — long-form ingestion.
// If the input is more than ~25 words, treat it as an article. Extract a
// title (shortest sentence with a payoff token), a kicker (1-3 word noun
// phrase before/at title), and a pull quote (highest-emphasis sentence).
// The extracted title flows into the same parser; kicker + pull quote
// hang off the spec as optional decoration that templates can draw.

'use strict';

(function(){
  function splitSentences(text){
    return text.split(/(?<=[.!?])\s+(?=[A-Z"'])/).map(s => s.trim()).filter(Boolean);
  }
  function wordCount(s){ return s.split(/\s+/).filter(Boolean).length; }

  // Cheap scoring: payoff tokens (long, non-stop, capitalized proper nouns),
  // brevity, position (first/last sentences often weighty).
  function scoreSentence(s, idx, total, STOPWORDS){
    const words = s.split(/\s+/).filter(Boolean);
    const wc = words.length;
    if(wc < 3 || wc > 25) return -Infinity;
    const content = words.filter(w => !STOPWORDS.has(w.toLowerCase().replace(/[^a-z0-9]/g,'')));
    const longestContent = content.reduce((a,b)=> a.length > b.length ? a : b, '');
    const proper = words.filter(w => /^[A-Z][a-z]{2,}/.test(w)).length;
    const positional = (idx === 0 || idx === total-1) ? 4 : 0;
    return longestContent.length * 1.6 + proper * 2 + positional - Math.abs(wc - 9) * 0.4;
  }

  function ingest(text){
    const STOPWORDS = (window.__parse && window.__parse.STOPWORDS) || new Set();
    const trimmed = (text || '').trim();
    if(wordCount(trimmed) < 25){
      return { kind: 'phrase', headline: trimmed, kicker: null, pullQuote: null };
    }
    const sentences = splitSentences(trimmed);
    if(sentences.length === 1){
      return { kind: 'phrase', headline: trimmed.slice(0, 120), kicker: null, pullQuote: null };
    }
    const scored = sentences.map((s,i) => ({ s, i, score: scoreSentence(s, i, sentences.length, STOPWORDS) }));
    scored.sort((a,b) => b.score - a.score);

    // Headline: shortest of top-3 scored sentences (poster-able).
    const top3 = scored.slice(0, 3).sort((a,b) => wordCount(a.s) - wordCount(b.s));
    const headline = top3[0].s.replace(/\.$/, '');

    // Kicker: a 1-3-word noun-ish phrase pulled from the first sentence if
    // distinct from headline; otherwise the first 3 words of the article.
    const first = sentences[0];
    let kicker = null;
    const cap = first.match(/\b[A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2}\b/);
    if(cap && first !== headline) kicker = cap[0];
    else kicker = trimmed.split(/\s+/).slice(0,3).join(' ');

    // Pull quote: highest-scoring sentence that isn't the headline.
    const pull = scored.find(x => x.s !== top3[0].s);
    const pullQuote = pull ? pull.s.replace(/\.$/, '') : null;

    return { kind: 'article', headline, kicker, pullQuote };
  }

  window.__article = { ingest };
})();
