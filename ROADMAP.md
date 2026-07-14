# ngx-mermaid-canvas — Roadmap

A feature roadmap toward a more complete visual Mermaid **flowchart** builder.

The editor has three coordinated surfaces, and a feature is only "done" when it
works across all of them:

- **Canvas** — visual editing (`components/canvas/`, `models/shape-map.ts`, `models/edge-map.ts`)
- **Text round-trip** — `services/mermaid-serializer.service.ts` ↔ `services/mermaid-deserializer.service.ts` over the IR in `models/graph-model.ts`
- **Preview** — real Mermaid render (`components/preview/preview.component.ts`, `mermaid ^11.13`)

Because the Preview uses real Mermaid, it already renders everything below — the
cost centers are the **Canvas** and the **serializer/deserializer**.

> **Scope note:** silent data-loss and parse-failure *bugs* (asymmetric shape
> loss, dropped edge variants, headerless/front-matter parse failures, `&` node
> lists, ID leniency) are tracked and fixed separately as correctness work, not
> here. This document covers **new capabilities** only.

**Legend:** Surfaces — **C** Canvas · **S** Serializer · **D** Deserializer · **P** Preview (usually free). Effort — **S / M / L**.

---

## Current state at a glance

| Area | Supported today | On this roadmap |
|---|---|---|
| **Node shapes** | 11 in the model, all round-trip through text | 3 not yet in the palette; proper visuals for parallelogram/subroutine; classic double-circle & alt shapes; Mermaid v11 `@{ shape }` (~30 shapes) |
| **Edge types** | 4: `-->`, `---`, `-.->`, `==>`, with labels | bidirectional, circle/cross arrowheads, invisible links, per-type richness |
| **Structure** | direction; nested subgraphs **in text**; edge labels | subgraphs on the **canvas**; lossless preservation of unrecognized statements |
| **Styling** | editor-level themes only | `style`/`classDef`/`class`/`linkStyle`, per-node colors, labels, interactions, a11y |

---

## Tier 1 — Palette & fidelity quick wins

Small, high-value UI/rendering work. The model and text round-trip already exist;
this is about exposing it on the canvas.

| # | Item | Surfaces | Effort | Notes |
|---|---|---|---|---|
| 1.1 | Add the 3 unexposed shapes (parallelogram, subroutine, asymmetric) to the palette, radial menu, and context menu with SVG icons | C | S | Model + both text directions already work; pure UI wiring |
| 1.2 | Proper visuals for `parallelogram` (register a custom maxGraph shape like `trapezoid`) and `subroutine` (double side-bars instead of a strokeWidth heuristic) | C | S | Makes reverse shape-detection robust too |

## Tier 2 — High-value flowchart features

The most-used Mermaid capabilities that require model changes.

| # | Item | Surfaces | Effort | Notes |
|---|---|---|---|---|
| 2.1 | **New edge types** — bidirectional (`<-->`, `<-.->`, `<==>`), circle/cross arrowheads (`--o`, `--x`, `o--o`, `x--x`), invisible (`~~~`), dotted-open (`-.-`), thick-open (`===`) | C+S+D | M | Model as `line: solid\|dotted\|thick\|invisible` + `startArrow`/`endArrow: none\|arrow\|circle\|cross` on `FlowEdge` rather than growing the flat enum. maxGraph natively has `startArrow`/`oval`/`cross` markers, so canvas cost is low. Also removes the current `<-->` parse corruption |
| 2.2 | **Missing classic shapes** — double-circle `(((x)))`, trapezoid-alt `[\x/]`, parallelogram-alt `[\x\]` | C+S+D | S–M | Completes Mermaid's classic set; mind the deserializer delimiter-ordering |
| 2.3 | **Lossless statement preservation** — keep unrecognized lines (`%%` comments, `classDef`, `click`, front-matter, directives) as opaque pass-through in the model and re-emit on serialize | S+D (model) | M | Turns the editor from **destructive** to **safe** on any real file; de-risks every later feature. Strong candidate to do *first* in this tier |
| 2.4 | **Node/edge styling** — `style`, `classDef` + `class`/`:::`, `linkStyle`; per-node fill/stroke/color; a small canvas style-inspector | C+S+D | L | Most-requested visual feature. Must coexist with the theme system (`applyThemeToCells` re-derives styles from shape/type — needs to preserve user overrides) |
| 2.5 | **Subgraphs on the canvas** — render as maxGraph group/container cells; drag nodes in/out to edit membership; create/rename/delete; honor nesting + per-subgraph direction in auto-layout | C (+layout) | L | Biggest structural gap: full text support exists but subgraphs are invisible in the primary editing surface |

## Tier 3 — Richer authoring

| # | Item | Surfaces | Effort | Notes |
|---|---|---|---|---|
| 3.1 | Multiline / `<br/>` / markdown-string labels — render line breaks on canvas; convert `<br/>` ↔ newline; support `` "`markdown`" `` labels | C+S+D | M | Common in real diagrams; today the canvas shows literal `<br/>` |
| 3.2 | Mermaid v11.3+ `@{ shape: … }` expanded syntax (~30 shapes) — parse/emit `@{}` node metadata; add canvas shapes incrementally (unsupported ones render as labeled rectangles with fidelity preserved in the model) | C+S+D | L | Preview already renders these; design `FlowNode.shape` to carry named shapes beyond the bracket set |
| 3.3 | Interactions — `click nodeId href "…"` / callbacks; model fields + a "link" field in node editing | C+S+D+P | M | Preview needs `securityLevel: 'loose'` for links to work — make it an opt-in editor input |
| 3.4 | Accessibility — `accTitle:` / `accDescr:` parse/emit + a titles panel | S+D (+C) | S | Cheap once statement preservation (2.3) exists |
| 3.5 | Animated / curved edges — `@{ animate, curve }` attributes + a toggle | C+S+D | S–M | Preview renders animation natively |

## Tier 4 — Beyond flowchart (major, separately-scoped efforts)

Each is effectively a new editor mode: its own IR, serializer/deserializer,
canvas cell vocabulary, and palette. Preview is the only shared surface that
works for free. Suggested order by demand and structural reuse:

1. **State diagram** (`stateDiagram-v2`) — L. Closest to flowchart (nodes/edges/nesting); most canvas infra reuses.
2. **ER diagram** — L. Entity boxes with attribute rows; crow's-foot markers overlap with 2.1's arrowhead work.
3. **Class diagram** — L. Compartment shapes + relationship arrows.
4. **Sequence diagram** — XL. Fundamentally different canvas model (lifelines/ordering, not free placement).
5. **Gantt / pie / others** — XL. Likely form-based editors rather than a freeform canvas.

---

## Suggested sequencing

1. **Tier 1** — cheap palette/fidelity wins, ship alongside the correctness fixes.
2. **2.3 Lossless statement preservation** — do this early; it makes every later feature safe to ship incrementally.
3. **2.1 Edge types → 2.2 Shapes → 2.4 Styling → 2.5 Canvas subgraphs.**
4. **Tier 3** as capacity allows.
5. **Tier 4** only once flowchart support feels complete.
