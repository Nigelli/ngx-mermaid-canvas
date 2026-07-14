# ngx-mermaid-canvas

[![npm version](https://img.shields.io/npm/v/ngx-mermaid-canvas.svg)](https://www.npmjs.com/package/ngx-mermaid-canvas)
[![Live demo](https://img.shields.io/badge/demo-live-2ea44f.svg)](https://nigelli.github.io/ngx-mermaid-canvas/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**▶ [Try the live demo](https://nigelli.github.io/ngx-mermaid-canvas/)** — the editor running in your browser.

> **Early-stage project** — this library is under active development and is not yet production-ready. APIs may change without notice. Contributions, ideas, and bug reports are very welcome, but please be aware that responses and reviews may be slow. If you're looking for a battle-tested solution, this isn't it yet — but if you're happy to experiment and help shape the direction, pull up a chair!

A visual flowchart editor for Angular that outputs [Mermaid](https://mermaid.js.org/) syntax. Drag, drop, and connect nodes on a canvas — get valid Mermaid code out the other side.

<!-- TODO: Add screenshot or GIF here -->

## Features

- Visual drag-and-drop flowchart canvas (powered by [maxGraph](https://github.com/maxGraph/maxGraph))
- Bidirectional sync — edit visually or write Mermaid text directly
- Live Mermaid preview panel
- 11 node shapes: rectangle, rounded, diamond, circle, stadium, parallelogram, subroutine, asymmetric, hexagon, cylinder, trapezoid
- 4 edge types: solid arrow, dashed arrow, thick arrow, open (no arrow)
- Edge labels
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

| Input            | Type            | Default | Description                          |
| ---------------- | --------------- | ------- | ------------------------------------ |
| `mermaidText`    | `string`        | `''`    | Initial Mermaid flowchart syntax     |
| `direction`      | `FlowDirection` | `'TD'`  | Graph direction: `TD`, `LR`, `RL`, `BT` |
| `showTextEditor` | `boolean`       | `true`  | Show the Mermaid text editor panel   |
| `showPreview`    | `boolean`       | `true`  | Show the live Mermaid preview panel  |
| `showPalette`    | `boolean`       | `true`  | Show the shape palette sidebar       |

### Outputs

| Output              | Type             | Description                              |
| ------------------- | ---------------- | ---------------------------------------- |
| `mermaidTextChange`  | `string`         | Emits updated Mermaid syntax on changes  |
| `modelChange`        | `FlowchartModel` | Emits the internal graph model on changes |

### Exported types

```typescript
import type {
  FlowchartModel, FlowNode, FlowEdge, FlowSubgraph,
  FlowDirection, MermaidShape, MermaidEdgeType,
} from 'ngx-mermaid-canvas';

import { createEmptyModel, cloneModel } from 'ngx-mermaid-canvas';
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

[MIT](LICENSE)
