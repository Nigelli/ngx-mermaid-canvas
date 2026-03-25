import {
  Component, input, output, effect, inject, OnInit, ViewChild,
  ChangeDetectionStrategy, Injector, runInInjectionContext, AfterViewInit,
} from '@angular/core';
import { CanvasComponent } from './canvas/canvas.component';
import { ShapePaletteComponent } from './canvas/shape-palette.component';
import { TextEditorComponent } from './text-editor/text-editor.component';
import { PreviewComponent } from './preview/preview.component';
import { ToolbarComponent } from './toolbar/toolbar.component';
import { GraphStateService } from '../services/graph-state.service';
import { FlowchartModel, FlowDirection, MermaidShape } from '../models/graph-model';

@Component({
  selector: 'ngx-mermaid-editor',
  standalone: true,
  imports: [
    CanvasComponent,
    ShapePaletteComponent,
    TextEditorComponent,
    PreviewComponent,
    ToolbarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="editor-root">
      <lib-toolbar
        (undoClicked)="canvasRef?.undo()"
        (redoClicked)="canvasRef?.redo()"
        (deleteClicked)="canvasRef?.deleteSelected()"
        (autoLayoutClicked)="canvasRef?.autoLayout()"
        (fitClicked)="canvasRef?.fitToPage()"
        (zoomInClicked)="canvasRef?.zoomIn()"
        (zoomOutClicked)="canvasRef?.zoomOut()"
      />

      <div class="editor-body">
        <div class="left-pane">
          @if (showPalette()) {
            <lib-shape-palette (shapeSelected)="onShapeSelected($event)" />
          }
          <lib-canvas #canvas />
        </div>

        @if (showTextEditor() || showPreview()) {
          <div class="right-pane">
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
      flex: 3;
      min-width: 0;
      overflow: hidden;
      position: relative;
    }
    .right-pane {
      display: flex;
      flex-direction: column;
      flex: 2;
      min-width: 0;
      border-left: 1px solid #e0e0e0;
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

  // Outputs
  mermaidTextChange = output<string>();
  modelChange = output<FlowchartModel>();

  private state = inject(GraphStateService);
  private injector = inject(Injector);

  ngOnInit(): void {
    const initial = this.mermaidText();
    if (initial) {
      this.state.initFromText(initial);
    }
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
}
