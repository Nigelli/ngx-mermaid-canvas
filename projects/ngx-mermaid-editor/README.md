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

There are two rendering surfaces, themed by two complementary mechanisms:

- **DOM chrome** (toolbar, palette, panels, menus) — styled with `--nmc-*` CSS
  custom properties you can override from plain CSS.
- **Diagram** (canvas nodes/edges rendered by maxGraph, plus the Mermaid
  preview) — driven by the `theme` input.

### Light / dark presets

```html
<ngx-mermaid-canvas theme="dark" />
```

The `theme` input switches everything at once: chrome CSS variables, canvas
node/edge colors (existing cells recolor live), and the Mermaid preview theme.
The default is `'light'`, which matches the library's original appearance.

### Overriding the chrome with CSS variables

All chrome colors and fonts are exposed as CSS custom properties, so you can
re-skin the UI without touching the `theme` input:

```css
ngx-mermaid-canvas {
  --nmc-accent: rebeccapurple;
  --nmc-border: #d8cfe8;
  --nmc-canvas-bg: #faf8ff;
}
```

Main tokens (see the source of `MermaidEditorComponent` for the full list):

| Token               | Purpose                                  |
| ------------------- | ---------------------------------------- |
| `--nmc-accent`      | Selection, hover, and active states      |
| `--nmc-border`      | Panel borders and dividers               |
| `--nmc-surface`     | Panel/menu/button backgrounds            |
| `--nmc-canvas-bg`   | Canvas background                        |
| `--nmc-canvas-grid` | Canvas grid dots                         |
| `--nmc-text`        | Primary text                             |
| `--nmc-muted`       | Secondary/label text                     |
| `--nmc-danger`      | Destructive actions                      |
| `--nmc-font`        | UI font family                           |
| `--nmc-font-mono`   | Mermaid source editor font family        |
| `--nmc-editor-bg`   | Mermaid source editor background         |

CSS variables cannot reach the canvas cells (they are SVG styled by maxGraph
at render time) — use the `theme` input for node/edge colors.

### Custom themes

Pass a partial `NmcTheme` object to override individual values. Unspecified
fields fall back to the preset named by `base` (default `'light'`):

```typescript
import { NmcTheme } from 'ngx-mermaid-canvas';

corporate: NmcTheme = {
  base: 'dark',            // start from the dark preset
  accent: '#e8a33d',
  nodeFill: '#2b2b33',
  nodeStroke: '#e8a33d',
  edgeStroke: '#b8b8c8',
  mermaidTheme: 'dark',    // any Mermaid theme name: default, dark, forest, neutral
};
```

```html
<ngx-mermaid-canvas [theme]="corporate" />
```

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
