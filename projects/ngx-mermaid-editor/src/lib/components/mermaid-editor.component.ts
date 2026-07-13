import {
  Component, input, output, effect, inject, OnInit, ViewChild,
  ChangeDetectionStrategy, Injector, runInInjectionContext, AfterViewInit,
  ElementRef, signal,
} from '@angular/core';
import { CanvasComponent } from './canvas/canvas.component';
import { ShapePaletteComponent } from './canvas/shape-palette.component';
import { TextEditorComponent } from './text-editor/text-editor.component';
import { PreviewComponent } from './preview/preview.component';
import { ToolbarComponent } from './toolbar/toolbar.component';
import { GraphStateService } from '../services/graph-state.service';
import { FlowchartModel, FlowDirection, MermaidShape, MermaidEdgeType } from '../models/graph-model';

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
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .editor-root.disabled {
      pointer-events: none;
      user-select: none;
    }
    .editor-root {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      border: 1px solid #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
      font-family: Inter, system-ui, -apple-system, sans-serif;
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
      background: #e0e0e0;
      flex-shrink: 0;
      transition: background 0.15s;
    }
    .split-handle:hover, .split-handle:active {
      background: #b0c4ff;
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
      border-bottom: 1px solid #e0e0e0;
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
    });
  }

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
