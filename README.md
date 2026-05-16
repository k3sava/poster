# poster

Type a phrase. Get two world-class typographic posters — each composed by a different art director, deterministically.

Same input → same output. Every decision is traced. Every decision is editable.

## How it works

1. **Parse** the phrase. Reuses FORM's `parse.js`: detects payoff word, contrast pairs, imperative verbs, time markers, tone (question / exclaim / statement), break scores.
2. **Pick two archetypes** (Rationalist, Expressive, Punk, Literary, Radical, Classic). Seeded by the phrase — same phrase always yields the same pair.
3. Each archetype picks a **template**, **grid**, **palette** (inherited from a real designer in `shared/knowledge/designers.json`), **fonts**, **case**, **background treatment**.
4. The renderer paints. Every decision is shown in the trace panel underneath each poster.
5. **Customize** lets you override any decision — template, background, case, palette rotation — and re-renders live.

## Files

- `index.html` — UI shell.
- `shared/parse.js` — phrase parser (from FORM).
- `shared/seed.js` — `xfnv1a` hash + `mulberry32` RNG. Deterministic.
- `shared/director.js` — archetype/template/palette/font/case decisions.
- `shared/render.js` — eight template renderers on Canvas 2D.
- `shared/style.css` — pixart-aligned chrome, light/dark/editorial/brutalist themes.
- `shared/knowledge/designers.json` — designer DNA (palettes, scale rules, kill lists).

## Templates (v0.1)

- Swiss Grid · Editorial Serif · Brutalist Block · Monumental Stack · Kinetic Slice · Painterly Field · Maximal Collage · Wood Type

## Roadmap

- Add pixart effects as **image-substrate** posters: drop an image, the parser still drives type, but the canvas runs (e.g.) halftone or ink-wash underneath.
- Add wordart letter-level effects (glitch, slice, dither) as **type treatments** swappable from Customize.
- Add Mycelium organic-growth poster from FORM.
- Article ingestion: paste a long-form text, extractive summarizer picks the headline phrase, kicker, and pull quote.
- Real fonts loaded from Google Fonts on demand; designer-specific faces (Akzidenz, Bodoni) via Adobe / fontsource where licensable.
- PDF export with crop marks for print.

MIT. By [Kesava](https://iamkesava.com).
