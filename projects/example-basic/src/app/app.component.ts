import { Component, computed, signal } from '@angular/core';
import { MermaidEditorComponent, FlowchartModel, NmcTheme, NmcThemeName } from 'ngx-mermaid-canvas';

type DemoMode = 'light' | 'dark' | 'hotrod';

/**
 * Example custom theme — "hot rod red with gold trim".
 * Demonstrates fully re-skinning the editor from the `[theme]` input alone
 * (a partial NmcTheme layered on the `dark` preset). Every surface — chrome,
 * canvas nodes/edges, and the live preview (via `mermaidTheme: 'base'`) — is
 * driven by these values; nothing relies on the built-in presets or extra CSS.
 */
const HOT_ROD: NmcTheme = {
  base: 'dark',
  // Primary chrome
  accent: '#f5c518',       // gold — selection / hover / active
  accentSoft: '#5c0d0d',   // hover backgrounds
  accentBorder: '#d4af37',
  accentStrong: '#ffd94a',
  accentActive: '#6e0f0f',
  border: '#d4af37',       // gold trim
  borderStrong: '#f5c518',
  surface: '#7a0f0f',      // deep hot-rod red panels
  surfaceMuted: '#5c0d0d', // panel headers ("Mermaid Source" / "Preview")
  canvasBg: '#4a0808',     // darker red canvas
  canvasGrid: '#6e1414',
  text: '#ffe9a8',         // pale gold text
  textSecondary: '#e6c24d',
  muted: '#e6c24d',        // gold labels
  // Source (Mermaid text) editor
  editorBg: '#3a0606',     // deep red source box
  editorText: '#ffe9a8',
  editorSelection: '#7a1a1a',
  // Popovers / misc chrome
  popoverBorder: '#d4af37',
  popoverBorderHover: '#f5c518',
  popoverDivider: '#6e1414',
  kbdBg: '#5c0d0d',
  icon: '#f5c518',
  splitHover: '#f5c518',
  portFill: '#f5c518',
  portStroke: '#3a0606',
  // Canvas cells
  nodeFill: '#c1121f',     // hot-rod red nodes
  nodeStroke: '#f5c518',   // gold node trim
  nodeFontColor: '#fff4d6',// near-white gold labels
  edgeStroke: '#f5c518',   // gold edges
  edgeFontColor: '#f5c518',
  // Preview panel — 'base' derives Mermaid colors from the palette above
  mermaidTheme: 'base',
};

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MermaidEditorComponent],
  template: `
    <div class="app" [class.dark]="mode() !== 'light'">
      <header class="app-header">
        <h1>Mermaid Visual Editor</h1>
        <span class="subtitle">draw.io-style editor for Mermaid flowcharts</span>
        <span class="spacer"></span>
        <button class="theme-toggle" [class.active]="mode() === 'light'" (click)="mode.set('light')">☀ Light</button>
        <button class="theme-toggle" [class.active]="mode() === 'dark'" (click)="mode.set('dark')">☾ Dark</button>
        <button class="theme-toggle" [class.active]="mode() === 'hotrod'" (click)="mode.set('hotrod')">🔥 Hot Rod</button>
      </header>
      <div class="editor-wrapper">
        <ngx-mermaid-canvas
          [mermaidText]="initialMermaid"
          [showTextEditor]="true"
          [showPreview]="true"
          [theme]="theme()"
          (mermaidTextChange)="onTextChange($event)"
        />
      </div>
    </div>
  `,
  styleUrl: './app.component.scss',
})
export class AppComponent {
  mode = signal<DemoMode>('light');

  /** Map the demo mode to what we pass into the library's [theme] input. */
  theme = computed<NmcThemeName | NmcTheme>(() => {
    const m = this.mode();
    return m === 'hotrod' ? HOT_ROD : m;
  });

  initialMermaid = `flowchart TD
    A["Start"] --> B{"Is it working?"}
    B -->|"Yes"| C["Great!"]
    B -->|"No"| D["Debug"]
    D --> B
    C --> E(["Done"])
`;

  onTextChange(text: string): void {
    // Consumer can react to changes
  }
}
