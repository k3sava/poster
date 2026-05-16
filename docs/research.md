# poster — landscape research

Synthesized from prior knowledge of the automated-poster / generative-design space (current as of 2026). The goal of this scan: figure out what poster does that no one else does, and what we can learn from those who already shipped something close.

## Direct competitors (full-stack poster generators)

### Canva Magic Design / Magic Studio
- **Input**: short prompt + style tag (modern, vintage, playful).
- **Output**: N templates instantly, all from a curated bank of human-designed templates with text/image swapped in.
- **Strength**: gigantic template bank, brand kits, accessible to non-designers.
- **Weakness**: outputs are recognizably "Canva." The system picks from existing templates rather than composing. No "show how it was built." Not deterministic — same prompt yields different bank picks across sessions.

### Adobe Express + Adobe Firefly
- **Input**: prompt; optionally an image; optionally a brand kit.
- **Output**: Firefly generates raster art behind type; Adobe Sensei picks type pairings.
- **Strength**: photorealistic image gen; tight integration with full Adobe stack.
- **Weakness**: heavy LLM/diffusion dependency, no transparency, slow, expensive per generation. Type composition is conventional.

### Looka / Tailor Brands / LogoCreator
- **Input**: brand name + tagline.
- **Output**: logos and a few collateral templates.
- **Strength**: focused on brand identity systems, not just one poster.
- **Weakness**: heavy template reuse; the second logo from your brand looks like the first. Closed system.

### Recraft / Ideogram / Krea / Magic Pattern
- **Input**: prompt; sometimes a sketch.
- **Output**: diffusion-rendered poster as a raster.
- **Strength**: striking imagery; Ideogram and Recraft handle in-image text far better than 2023-era models.
- **Weakness**: type still rendered as pixels, not vectors. No layout reasoning. Not editable beyond regenerating. Not deterministic. Not transparent.

### PosterMyWall / VistaCreate / Snappa
- **Input**: occasion + style.
- **Output**: pulled from a template library of 100k+ human-designed posters.
- **Strength**: scale, depth of niche templates (real-estate flyers, fitness promos).
- **Weakness**: discoverability via search, not composition. Outputs are templated to the point of feeling generic.

## Adjacent / inspiration

### GenType (Google Labs)
- Phrase becomes letterforms made of objects (cherries, bricks, smoke).
- Per-letter generative rendering. Beautiful but doesn't generalize to layout.
- **Takeaway**: per-token visual treatments as a first-class axis (we will steal this and call them "type treatments").

### Khroma (color AI)
- Trains on the user's color preferences, generates palettes.
- **Takeaway**: palette is a knob, not just a constant. We use designer DNA palettes — but a future round can train a user preference vector.

### FORM (our own)
- Tight phrase parser. Detects payoff word, contrast pairs, imperatives, time markers.
- Five "philosophies" (Swiss, Editorial, Brutalist, Kinetic, Painterly) + Mycelium experimental.
- **Takeaway**: the parser is load-bearing. Everything downstream assumes the parser flagged the right token.

### WordArt (our own)
- 8 letter-level visual effects: glitch, slice, dither, halftone, mesh, blur, line, type.
- **Takeaway**: a "type treatment" is orthogonal to a "template." Same template + different treatment = a different poster.

### pixart (our own)
- 28 image effects (ASCII, halftone, ink-wash, contour, etc.).
- **Takeaway**: an "image substrate" is orthogonal to a template too. A poster with a halftone'd photo behind is a different category than a typographic poster.

### Bruno Munari, Paula Scher, Stefan Sagmeister
- Each works inside a system but breaks it to make the focal point sing. Munari said: "design is making poetry from constraint."
- **Takeaway**: hundreds of variants is not hundreds of templates. It's a small set of templates × a parameter space. The parameter is where the personality lives.

## Where poster is different

| Axis                       | Canva | Firefly | Recraft | poster |
|----------------------------|:-----:|:-------:|:-------:|:------:|
| Phrase-aware layout        |  no   |   no    |   no    |  yes   |
| Deterministic              |  no   |   no    |   no    |  yes   |
| Process trace shown        |  no   |   no    |   no    |  yes   |
| Editable decision-by-decision | partial | no  |   no    |  yes   |
| Designer DNA palettes      |  no   |   no    |   no    |  yes   |
| Runs entirely client-side  |  no   |   no    |   no    |  yes   |
| 100% vector type           | yes   |   no    |   no    |  yes   |

The wedge: the output is *composed*, not *picked*. Every decision is visible. The user can argue with the system.

## Architecture decisions that follow from the scan

1. **Template ≠ output.** A template is a parameter space (12+ axes per family). Hundreds of variants comes from sampling that space, not from authoring hundreds of files.
2. **Type treatment is orthogonal.** Wordart effects (outline, halftone-fill, stencil, slice, mirror, double-strike) layer on top of a template.
3. **Image substrate is orthogonal.** Pixart effects (halftone, dither, ink-wash, contour, ascii) generate the bottom layer when the input includes an image.
4. **The parser owns intent.** Templates trust the parser's payoff/setup/contrast detection. New templates should *consume* parse tree fields rather than re-detect them.
5. **Article ingestion is a parser extension, not a new pipeline.** Long-form text gets a title (first declarative sentence) + kicker (shortest noun phrase before the title) + pull quote (sentence with highest payoff token), then renders through the same templates.
6. **The customize panel is the differentiator.** Every dropdown is the user calling out a director's bluff. The trace shows why the bluff was made.

## Open questions for next rounds

- Should poster ever call a diffusion model for the image substrate, or stay 100% client-side / generative? (Lean: optional gateway, default off.)
- Do we accept user-uploaded photos as substrate or only generated ones? (Lean: both, with EXIF strip.)
- Print export with bleed/crop marks?
- Brand kit (lock palette + font, vary only template/treatment)?
- Animation export (matches form's recorder)?
