import {
  Component, input, output, effect, inject, OnInit, ViewChild,
  ChangeDetectionStrategy, Injector, runInInjectionContext, AfterViewInit,
  ElementRef, signal, computed,
} from '@angular/core';
import { CanvasComponent } from './canvas/canvas.component';
import { ShapePaletteComponent } from './canvas/shape-palette.component';
import { TextEditorComponent } from './text-editor/text-editor.component';
import { PreviewComponent } from './preview/preview.component';
import { ToolbarComponent } from './toolbar/toolbar.component';
import { GraphStateService } from '../services/graph-state.service';
import { FlowchartModel, FlowDirection, MermaidShape, MermaidEdgeType } from '../models/graph-model';
import { NmcTheme, NmcThemeName, resolveTheme, NMC_CSS_VARS } from '../models/theme';

@Component({
  selector: 'ngx-mermaid-canvas',
  standalone: true,
  imports: [
    CanvasComponent,
    ShapePaletteComponent,
    TextEditorComponent,
    PreviewComponent,
    ToolbarComponent,
  ],
  providers: [GraphStateService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="editor-root" [class.disabled]="disabled()">
      @if (!disabled()) {
        <lib-toolbar
          (undoClicked)="canvasRef?.undo()"
          (redoClicked)="canvasRef?.redo()"
          (deleteClicked)="canvasRef?.deleteSelected()"
          (autoLayoutClicked)="canvasRef?.autoLayout()"
          (fitClicked)="canvasRef?.fitToPage()"
          (zoomInClicked)="canvasRef?.zoomIn()"
          (zoomOutClicked)="canvasRef?.zoomOut()"
          (edgeTypeChanged)="canvasRef?.setEdgeType($event)"
        />
      }

      <div class="editor-body">
        <div class="left-pane" [style.flex]="leftFlex()">
          @if (showPalette() && !disabled()) {
            <lib-shape-palette (shapeSelected)="onShapeSelected($event)" />
          }
          <lib-canvas #canvas />
        </div>

        @if ((showTextEditor() || showPreview()) && !disabled()) {
          <div
            class="split-handle"
            (mousedown)="onSplitDragStart($event)"
          ></div>
          <div class="right-pane" [style.flex]="rightFlex()">
            @if (showTextEditor()) {
              <lib-text-editor />
            }
            @if (showPreview()) {
              <lib-preview />
            }
          </div>
        }
      </div>
    </div>
  `,
  host: {
    '[attr.data-theme]': 'resolvedTheme().base',
    // Explicit fields from a custom NmcTheme object override the preset's
    // CSS variables (inline styles win over the :host blocks below).
    // Unset fields are omitted, so the data-theme preset block applies.
    '[style]': 'themeStyles()',
  },
  styles: [`
    :host {
      display: block; width: 100%; height: 100%;
      /* Design tokens (light defaults) — override via the theme input or
         plain CSS: ngx-mermaid-canvas { --nmc-accent: rebeccapurple; } */
      --nmc-accent: #4a90d9;
      --nmc-accent-soft: #f0f4ff;
      --nmc-accent-border: #c0d0f0;
      --nmc-accent-strong: #2a6ab8;
      --nmc-accent-active: #e3edff;
      --nmc-border: #e0e0e0;
      --nmc-border-strong: #cccccc;
      --nmc-surface: #ffffff;
      --nmc-surface-muted: #fafafa;
      --nmc-canvas-bg: #f8f9fa;
      --nmc-canvas-grid: #d0d0d0;
      --nmc-text: #333333;
      --nmc-text-secondary: #666666;
      --nmc-muted: #888888;
      --nmc-danger: #cc3333;
      --nmc-danger-soft: #fff0f0;
      --nmc-danger-border: #e0a0a0;
      --nmc-font: Inter, system-ui, -apple-system, sans-serif;
      --nmc-font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
      --nmc-editor-bg: #1e1e2e;
      --nmc-editor-text: #cdd6f4;
      --nmc-editor-selection: #45475a;
    }
    :host([data-theme="dark"]) {
      --nmc-accent: #89b4fa;
      --nmc-accent-soft: #313244;
      --nmc-accent-border: #45475a;
      --nmc-accent-strong: #b4befe;
      --nmc-accent-active: #2f3a54;
      --nmc-border: #313244;
      --nmc-border-strong: #45475a;
      --nmc-surface: #1e1e2e;
      --nmc-surface-muted: #181825;
      --nmc-canvas-bg: #11111b;
      --nmc-canvas-grid: #313244;
      --nmc-text: #cdd6f4;
      --nmc-text-secondary: #a6adc8;
      --nmc-muted: #9399b2;
      --nmc-danger: #f38ba8;
      --nmc-danger-soft: #3c2431;
      --nmc-danger-border: #8a4a5c;
      --nmc-editor-bg: #181825;
      --nmc-editor-selection: #45475a;
      /* One-off tokens that have hardcoded light fallbacks in child components */
      --nmc-popover-border: #45475a;
      --nmc-popover-border-hover: #585b70;
      --nmc-popover-divider: #313244;
      --nmc-kbd-bg: #313244;
      --nmc-icon: #a6adc8;
      --nmc-split-hover: #45507a;
      --nmc-port-fill: #a6adc8;
      --nmc-port-stroke: #1e1e2e;
      --nmc-rubberband-bg: rgba(137, 180, 250, 0.15);
      --nmc-rubberband-border: rgba(137, 180, 250, 0.6);
      --nmc-error: #f38ba8;
      --nmc-error-bg: #362030;
      --nmc-error-border: #5c2e3d;
    }
    .editor-root.disabled {
      pointer-events: none;
      user-select: none;
    }
    .editor-root {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      border: 1px solid var(--nmc-border, #e0e0e0);
      border-radius: 4px;
      overflow: hidden;
      background: var(--nmc-surface, #ffffff);
      color: var(--nmc-text, #333333);
      font-family: var(--nmc-font, Inter, system-ui, -apple-system, sans-serif);
    }
    .editor-body {
      display: flex;
      flex: 1;
      overflow: hidden;
    }
    .left-pane {
      display: flex;
      min-width: 200px;
      overflow: hidden;
      position: relative;
    }
    .split-handle {
      width: 5px;
      cursor: col-resize;
      background: var(--nmc-border, #e0e0e0);
      flex-shrink: 0;
      transition: background 0.15s;
    }
    .split-handle:hover, .split-handle:active {
      background: var(--nmc-split-hover, #b0c4ff);
    }
    .right-pane {
      display: flex;
      flex-direction: column;
      min-width: 200px;
      overflow: hidden;
    }
    .right-pane > * {
      flex: 1;
      min-height: 0;
    }
    .right-pane > *:not(:last-child) {
      border-bottom: 1px solid var(--nmc-border, #e0e0e0);
    }
  `],
})
export class MermaidEditorComponent implements OnInit, AfterViewInit {
  @ViewChild('canvas') canvasRef?: CanvasComponent;

  // Inputs
  mermaidText = input<string>('');
  direction = input<FlowDirection>('TD');
  showTextEditor = input<boolean>(true);
  showPreview = input<boolean>(true);
  showPalette = input<boolean>(true);
  disabled = input<boolean>(false);
  /** 'light' | 'dark' preset name, or a (partial) NmcTheme object */
  theme = input<NmcThemeName | NmcTheme>('light');

  /** Fully-resolved active theme */
  protected readonly resolvedTheme = computed(() => resolveTheme(this.theme()));

  // Outputs
  mermaidTextChange = output<string>();
  modelChange = output<FlowchartModel>();

  // Split pane state (flex values)
  leftFlex = signal('3');
  rightFlex = signal('2');

  private state = inject(GraphStateService);
  private injector = inject(Injector);
  private elRef = inject(ElementRef);
  private lastExternalText = '';

  ngOnInit(): void {
    const initial = this.mermaidText();
    this.lastExternalText = initial;
    if (initial) {
      this.state.initFromText(initial);
    }
    this.state.disabled.set(this.disabled());
    this.state.theme.set(this.resolvedTheme());

    runInInjectionContext(this.injector, () => {
      effect(() => {
        const text = this.mermaidText();
        if (text !== this.lastExternalText) {
          this.lastExternalText = text;
          this.state.initFromText(text || '');
        }
      });
      effect(() => {
        this.state.disabled.set(this.disabled());
      });
      effect(() => {
        this.state.theme.set(this.resolvedTheme());
      });
    });
  }

  /**
   * Inline `--nmc-*` custom properties for the host, built only from fields
   * explicitly set on a custom NmcTheme object. Preset (string) themes and
   * unset fields contribute nothing, so the `:host` / `data-theme` CSS blocks
   * apply. Inline styles win, so a custom object can override any token.
   */
  protected readonly themeStyles = computed<Record<string, string>>(() => {
    const theme = this.theme();
    if (typeof theme === 'string') return {};
    const styles: Record<string, string> = {};
    for (const [field, cssVar] of Object.entries(NMC_CSS_VARS)) {
      const value = (theme as NmcTheme)[field as keyof NmcTheme];
      if (value !== undefined && cssVar) {
        styles[cssVar] = value as string;
      }
    }
    return styles;
  });

  ngAfterViewInit(): void {
    runInInjectionContext(this.injector, () => {
      effect(() => {
        const text = this.state.mermaidText();
        this.mermaidTextChange.emit(text);
      });

      effect(() => {
        const model = this.state.model();
        this.modelChange.emit(model);
      });
    });
  }

  onShapeSelected(shape: MermaidShape): void {
    this.canvasRef?.addNodeAtCenter(shape);
  }

  onSplitDragStart(event: MouseEvent): void {
    event.preventDefault();
    const body = this.elRef.nativeElement.querySelector('.editor-body') as HTMLElement;
    if (!body) return;

    const totalWidth = body.clientWidth;
    const onMove = (e: MouseEvent) => {
      const rect = body.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const leftPct = Math.max(15, Math.min(85, (x / totalWidth) * 100));
      const rightPct = 100 - leftPct;
      this.leftFlex.set(`${leftPct}`);
      this.rightFlex.set(`${rightPct}`);
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }
}
