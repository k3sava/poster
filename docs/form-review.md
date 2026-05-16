# FORM — full review

Read pass over `~/projects/form/` on 2026-05-16. FORM is the typography lab poster originated from — a single-file browser app, vanilla JS, Canvas 2D, no build step. Each "philosophy" lives in its own folder and shares `shared/*.js`. This review documents what FORM does so poster can stand on its shoulders rather than rediscover them.

## File map

```
form/
  index.html           — shared chrome (splash, top/control/drawer bars, recording overlay)
  swiss/index.html     — philosophy = swiss
  brutalist/index.html — philosophy = brutalist
  editorial/index.html — philosophy = editorial
  kinetic/index.html   — philosophy = kinetic
  painterly/index.html — philosophy = painterly
  mycelium/index.html  — philosophy = mycelium
  blend/index.html     — combinator (samples from designer DNA)
  shared/
    app.js              624 lines — recording, theme, save, drawer wiring
    layout.js           248 lines — phrase-aware line-break DP, block justification
    parse.js            410 lines — intent detection (REUSED IN POSTER)
    style.css           172 lines — chrome
    theme-tokens.css     76 lines — theme variables
    knowledge/
      designers.json    — Vignelli, Crouwel, Scher, Sagmeister, Joyce, Burrill, +
    philosophies/
      swiss.js          — GRID renderer
      editorial.js      — serif, justified columns
      brutalist.js      — wall-to-wall blocks
      kinetic.js        — diagonal/scattered, motion
      painterly.js      — color field + serif overlay
      mycelium.js       — living tendrils growing from letter edges (animated)
      blend.js          — combinator: picks designer DNA and mixes
```

## Key ideas worth keeping

### 1. The parser (`shared/parse.js`)
Heuristic-first, NLP-second. Runs immediately with stop-words + syllable counts; loads `compromise.js` lazily for POS tags. The shape of the tree:

```
tree = {
  raw, beats: [ { text, words, tokens:[{ w, intentScale, intentRole, isStop, syllables }] } ],
  pattern, tone, payoff, caps
}
```

Each token carries `intentScale` (1.0 default, up to 2.4 for monumental) and `intentRole` (`antonym-payoff`, `time-payoff`, `imperative`, `question`, `payoff`, `antonym-setup`, `setup-cohesion`, `sub-emphasis`, `null`). The Paula Scher "prima ballerina" rule is encoded: only one token can sit at the top tier. The three-tier snap (display / sub / body / whisper) is encoded too. Every philosophy reads this tree and trusts it.

**Carried into poster verbatim.**

### 2. The phrase-aware line-break DP (`shared/layout.js`)
A dynamic-programming line-break algorithm that scores break points using `breakScoreBefore`: 85+ at conjunctions, 80+ at action verbs and auxiliaries, 72 at articles, 68 at prepositions, 10 inside a phrase. Plus a `skippedBreakPenalty` so a final line that runs past a high-scoring break point pays for it. Justification is per-block, not per-line — the line-break is solved at the meta-line level.

**Not yet carried into poster** — current poster does line-break per template ad-hoc. The DP layout is the obvious next milestone for the templates that take more than one line (Editorial Serif's drop-cap variant, Maximal Collage's cluster variant). 

### 3. Designer DNA (`shared/knowledge/designers.json`)
9 entries: Vignelli, Crouwel, Scher, Sagmeister, Joyce, Burrill (+ more in the file). Each carries `signature_face`, `scale_rule`, `break_rule`, `composition_shape`, `palette`, `kill_list`, `example` (real poster + year + source URL), `assignable_to_modes` (which philosophies a designer's DNA can colonise). 

The `blend` philosophy samples from this and synthesizes new posters by mixing entries.

**Carried into poster verbatim.** Director archetypes' `palette_pref` references designer IDs.

### 4. The Mycelium effect (`philosophies/mycelium.js`)
The most experimental. Renders the phrase as a luminance bitmap; finds the letter edges; seeds N branches along those edges; grows tendrils that follow the luminance field, using simplex-noise drift for organic wobble. In FORM it's animated with a 15-second perfect-loop cycle: grow → hold → unwind. In poster v0.3 it's static (240 growth iterations, no unwind).

Key insight from FORM: the tendrils are not just decorative — they grow *out of the letter* (luminance-following), so the letters remain visible-but-overgrown. The phrase reads through the field.

**Ported in `shared/mycelium.js`.** Simplified: dropped the cycle animation, kept the seed-from-edge + luminance-following growth + simplex noise drift.

### 5. Recording (`shared/app.js`)
FORM has MediaRecorder-based MP4/WebM export with a deterministic 24fps virtual clock so offline export matches live playback exactly. The `CYCLE_MS = 15000` constant is observed by every animated philosophy.

**Not yet in poster.** Static PNG only. Animated export is a follow-up if posters ever go time-based.

## What poster does that FORM doesn't

| Capability | FORM | poster |
|---|---|---|
| Phrase parsing | ✓ | ✓ (reused) |
| Designer DNA | partial (Blend mode only) | first-class (every template inherits a designer's palette) |
| Deterministic output | no (each load randomises) | ✓ (seeded by phrase) |
| Two variants side-by-side | no | ✓ |
| Process trace shown | no | ✓ |
| Customize panel | partial (drawer with controls) | ✓ (every decision overrideable) |
| Article ingestion | no | ✓ |
| Image substrate | no | ✓ |
| Template parameter spaces | no | ✓ |
| Wordart-style type treatments | no | ✓ |

## What FORM has that poster should grow into

1. **The phrase-aware DP line-break** — currently a TODO. Worth porting.
2. **Animated philosophies** — Mycelium especially. Once posters carry the CYCLE_MS clock, the same generator can ship a 15-second video as a second output.
3. **The 'blend' synthesizer** — picks two designers and merges their break rules and palettes. poster's director archetypes are doing this implicitly; making it explicit would let users say "Scher × Burrill" as an archetype.
4. **More designers in the DNA** — Beuys, Tomato, Jianping He, Niklaus Troxler, Karel Martens, Cassandre. The file is open and the schema is stable.

## Carry-list (decisions ratified for poster from FORM)

- Parser owns intent — templates read, never re-detect.
- Stop-words and content-words are not equal — emphasis flows to content.
- "Prima ballerina" rule — exactly one token at the top tier.
- Three-tier snap — display / sub / body / whisper.
- Designer DNA is the colour authority — palettes are not arbitrary, they trace to a person who lived.
- The renderer is dumb — it takes a spec and paints. All decisions live above it.
- Vanilla JS, no build step. The whole thing should be inspectable in the browser.
