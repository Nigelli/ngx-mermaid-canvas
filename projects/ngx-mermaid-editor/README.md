# ngx-mermaid-canvas

[![npm version](https://img.shields.io/npm/v/ngx-mermaid-canvas.svg)](https://www.npmjs.com/package/ngx-mermaid-canvas)
[![Live demo](https://img.shields.io/badge/demo-live-2ea44f.svg)](https://nigelli.github.io/ngx-mermaid-canvas/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/Nigelli/ngx-mermaid-canvas/blob/main/LICENSE)

**▶ [Try the live demo](https://nigelli.github.io/ngx-mermaid-canvas/)** — the editor running in your browser.

> **Early-stage project** — this library is under active development and is not yet production-ready. APIs may change without notice. Contributions, ideas, and bug reports are very welcome, but please be aware that responses and reviews may be slow. If you're happy to experiment and help shape the direction, pull up a chair!

A visual flowchart editor for Angular that outputs [Mermaid](https://mermaid.js.org/) syntax. Drag, drop, and connect nodes on a canvas — get valid Mermaid code out the other side.

## Features

- Visual drag-and-drop flowchart canvas (powered by [maxGraph](https://github.com/maxGraph/maxGraph))
- Bidirectional sync — edit visually or write Mermaid text directly
- Live Mermaid preview panel
- Subgraphs, 11 node shapes, and 4 edge types
- Edge labels
- Select / pan interaction modes with alignment guides
- Auto-layout (via [dagre](https://github.com/dagrejs/dagre))
- Undo/redo, copy/paste, keyboard shortcuts
- Shape palette, context menus, minimap
- Configurable panels — show/hide text editor, preview, and palette independently
- Light/dark presets plus fully customizable theming — every token overridable via a `theme` object or `--nmc-*` CSS variables ([Theming](#theming))

## Installation

```bash
npm install ngx-mermaid-canvas
```

### Peer dependencies

```bash
npm install @angular/common @angular/core @maxgraph/core mermaid
```

## Usage

```typescript
import { MermaidEditorComponent } from 'ngx-mermaid-canvas';

@Component({
  imports: [MermaidEditorComponent],
  template: `
    <ngx-mermaid-canvas
      [mermaidText]="code"
      (mermaidTextChange)="onCodeChange($event)"
    />
  `,
  styles: `:host { display: block; height: 600px; }`,
})
export class MyComponent {
  code = 'graph TD\n  A[Start] --> B[End]';

  onCodeChange(mermaid: string) {
    console.log(mermaid);
  }
}
```

## API

### Inputs

| Input            | Type                      | Default   | Description                          |
| ---------------- | ------------------------- | --------- | ------------------------------------ |
| `mermaidText`    | `string`                  | `''`      | Initial Mermaid flowchart syntax     |
| `direction`      | `FlowDirection`           | `'TD'`    | Graph direction: `TD`, `LR`, `RL`, `BT` |
| `showTextEditor` | `boolean`                 | `true`    | Show the Mermaid text editor panel   |
| `showPreview`    | `boolean`                 | `true`    | Show the live Mermaid preview panel  |
| `showPalette`    | `boolean`                 | `true`    | Show the shape palette sidebar       |
| `theme`          | `NmcThemeName \| NmcTheme` | `'light'` | `'light'`, `'dark'`, or a custom palette — see [Theming](#theming) |

### Outputs

| Output              | Type             | Description                              |
| ------------------- | ---------------- | ---------------------------------------- |
| `mermaidTextChange` | `string`         | Emits updated Mermaid syntax on changes  |
| `modelChange`       | `FlowchartModel` | Emits the internal graph model on changes |

### Exported types

```typescript
import type {
  FlowchartModel, FlowNode, FlowEdge, FlowSubgraph,
  FlowDirection, MermaidShape, MermaidEdgeType,
  NmcTheme, NmcThemeName, ResolvedNmcTheme,
} from 'ngx-mermaid-canvas';

import { createEmptyModel, cloneModel, LIGHT_THEME, DARK_THEME, resolveTheme } from 'ngx-mermaid-canvas';
```

## Theming

**The `theme` input is the primary, recommended way to theme the editor.** It
covers everything — chrome, canvas nodes/edges, and the Mermaid preview — and a
custom `NmcTheme` object can override every token (see [Custom themes](#custom-themes)).
CSS custom properties are also exposed as an escape hatch for global re-skinning
(see [CSS variables](#overriding-the-chrome-with-css-variables)), with one
caveat noted there.

### Light / dark presets

```html
<ngx-mermaid-canvas theme="dark" />
```

The `theme` input switches everything at once: chrome colors, canvas
node/edge colors (existing cells recolor live), and the Mermaid preview theme.
The default is `'light'`, which matches the library's original appearance.

### Overriding the chrome with CSS variables

All chrome colors and fonts are also exposed as `--nmc-*` CSS custom properties.
Because the preset defaults are declared on the component's `:host` (which
Angular emulates as an attribute selector), a plain element-selector rule is
**out-specified by the preset** and won't apply. Add `!important` so your
override wins in both light and dark:

```css
ngx-mermaid-canvas {
  --nmc-accent: rebeccapurple !important;
  --nmc-border: #d8cfe8 !important;
  --nmc-canvas-bg: #faf8ff !important;
}
```

No `::ng-deep` or `ViewEncapsulation` change is needed — custom properties
inherit through emulated encapsulation; the `!important` is only there to beat
the preset's specificity. For per-instance theming without `!important`, prefer
the `theme` input, whose values are applied inline and always win.

Common tokens:

| Token               | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `--nmc-accent`      | Selection, hover, and active states      |
| `--nmc-border`      | Panel borders and dividers               |
| `--nmc-surface`     | Panel/menu/button backgrounds            |
| `--nmc-surface-muted` | Panel headers (source/preview titles)  |
| `--nmc-canvas-bg`   | Canvas background                        |
| `--nmc-canvas-grid` | Canvas grid dots                         |
| `--nmc-text`        | Primary text                             |
| `--nmc-muted`       | Secondary/label text                     |
| `--nmc-danger`      | Destructive actions                      |
| `--nmc-font`        | UI font family                           |
| `--nmc-font-mono`   | Mermaid source editor font family        |
| `--nmc-editor-bg`   | Mermaid source editor background         |

The complete set is the [`NmcTheme`](#custom-themes) field list — every field
maps to a variable by the same rule: **camelCase field → `--nmc-` + kebab-case**
(e.g. `accentSoft` → `--nmc-accent-soft`, `editorText` → `--nmc-editor-text`).

CSS variables cannot reach the canvas cells (they are SVG styled by maxGraph
at render time) — use the `theme` input for node/edge colors.

### Custom themes

Pass a partial `NmcTheme` object to override individual values. Unspecified
fields fall back to the preset named by `base` (default `'light'`). **Every
chrome token is exposed as a field**, so a custom object alone can theme the
whole editor — nothing needs to fall back to raw CSS. Each field maps to the
matching `--nmc-*` variable (e.g. `surfaceMuted` → `--nmc-surface-muted`); the
canvas `node*`/`edge*` colors and `mermaidTheme` drive the SVG surfaces that
CSS can't reach.

```typescript
import { NmcTheme } from 'ngx-mermaid-canvas';

corporate: NmcTheme = {
  base: 'dark',            // start from the dark preset
  accent: '#e8a33d',
  surface: '#1b1b22',
  surfaceMuted: '#141419', // panel headers ("Mermaid Source" / "Preview")
  editorBg: '#0f0f14',     // source editor background
  nodeFill: '#2b2b33',
  nodeStroke: '#e8a33d',
  edgeStroke: '#b8b8c8',
  mermaidTheme: 'base',    // 'base' matches the preview to the palette above;
                          // or a Mermaid theme name: default, dark, forest, neutral
};
```

> **Matching the live preview to your palette:** set `mermaidTheme: 'base'`.
> The preview then derives Mermaid `themeVariables` (node fill/border/text,
> line color, background, fonts) from the `node*`/`edge*`/`surface`/`font`
> fields, so the rendered diagram matches the canvas. Any other name
> (`'default'`, `'dark'`, `'forest'`, `'neutral'`) uses that built-in Mermaid
> theme as-is and ignores the palette.

See the `NmcTheme` interface for the full field list (accent family, surfaces,
borders, text, danger, source editor, popovers, ports, rubberband, errors,
fonts, and canvas node/edge colors).

```html
<ngx-mermaid-canvas [theme]="corporate" />
```

**Precedence** (highest first) for a given token:

1. `--nmc-*` in your CSS with `!important`
2. a field on the `theme` object (applied inline on the host)
3. the active preset default (`base`, declared on `:host`)
4. a plain `--nmc-*` CSS rule *without* `!important` — **out-specified by the
   preset, so it does not apply** (see [CSS variables](#overriding-the-chrome-with-css-variables))

In practice: use the `theme` object/input for per-instance theming (no
`!important` needed), and reserve CSS variables for global overrides where you
add `!important`.

The presets and resolver are also exported:

```typescript
import { LIGHT_THEME, DARK_THEME, resolveTheme } from 'ngx-mermaid-canvas';
```

### Standalone services

The serializer and deserializer are also exported if you need Mermaid conversion without the visual editor:

```typescript
import {
  MermaidSerializerService,
  MermaidDeserializerService,
} from 'ngx-mermaid-canvas';
```

## License

[MIT](https://github.com/Nigelli/ngx-mermaid-canvas/blob/main/LICENSE)
