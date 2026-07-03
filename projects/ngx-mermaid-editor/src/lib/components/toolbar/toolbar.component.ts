import { Component, output, inject } from '@angular/core';
import { GraphStateService, CanvasMode } from '../../services/graph-state.service';
import { FlowDirection, MermaidEdgeType } from '../../models/graph-model';

@Component({
  selector: 'lib-toolbar',
  standalone: true,
  template: `
    <div class="toolbar">
      <div class="toolbar-group">
        <label class="toolbar-label">Direction</label>
        <select
          class="toolbar-select"
          [value]="state.model().direction"
          (change)="onDirectionChange($event)"
        >
          <option value="TD">Top → Down</option>
          <option value="LR">Left → Right</option>
          <option value="RL">Right → Left</option>
          <option value="BT">Bottom → Top</option>
        </select>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group mode-group">
        <button
          class="toolbar-btn mode-btn"
          [class.active]="state.canvasMode() === 'select'"
          title="Select mode (V) — click to select, drag to move. Drag from node edges to connect."
          (click)="setMode('select')"
        >⊹ Select <kbd>V</kbd></button>
        <button
          class="toolbar-btn mode-btn"
          [class.active]="state.canvasMode() === 'pan'"
          title="Pan mode (H) — or hold Space to pan temporarily"
          (click)="setMode('pan')"
        >✥ Pan <kbd>H</kbd></button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button class="toolbar-btn" title="Undo (Ctrl+Z)" (click)="undoClicked.emit()">↩</button>
        <button class="toolbar-btn" title="Redo (Ctrl+Y)" (click)="redoClicked.emit()">↪</button>
      </div>

      @if (state.hasSelection()) {
        <div class="toolbar-divider"></div>

        <div class="toolbar-group">
          <button class="toolbar-btn danger" title="Delete (Del)" (click)="deleteClicked.emit()">✕ Delete</button>
        </div>
      }

      @if (state.hasSelectedEdges()) {
        <div class="toolbar-divider"></div>

        <div class="toolbar-group">
          <label class="toolbar-label">Edge</label>
          <select
            class="toolbar-select"
            [value]="state.selectedEdgeType() ?? 'arrow'"
            (change)="onEdgeTypeChange($event)"
          >
            <option value="arrow">→ Solid</option>
            <option value="dotted-arrow">⇢ Dashed</option>
            <option value="thick-arrow">⇒ Thick</option>
            <option value="open">— Open</option>
          </select>
        </div>
      }

      <div class="toolbar-spacer"></div>

      <div class="toolbar-group">
        <button class="toolbar-btn" title="Auto Layout" (click)="autoLayoutClicked.emit()">⊞ Layout</button>
        <button class="toolbar-btn" title="Fit to Page" (click)="fitClicked.emit()">⊡ Fit</button>
        <button class="toolbar-btn" title="Zoom In" (click)="zoomInClicked.emit()">+</button>
        <button class="toolbar-btn" title="Zoom Out" (click)="zoomOutClicked.emit()">−</button>
      </div>
    </div>
  `,
  styles: [`
    .toolbar {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 6px 12px;
      background: #fff;
      border-bottom: 1px solid #e0e0e0;
      flex-shrink: 0;
    }
    .toolbar-group {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .toolbar-label {
      font-size: 11px;
      color: #666;
      margin-right: 4px;
    }
    .toolbar-select {
      font-size: 12px;
      padding: 3px 6px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background: #fff;
    }
    .toolbar-btn {
      padding: 4px 10px;
      font-size: 12px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background: #fff;
      cursor: pointer;
      transition: background 0.15s;
    }
    .toolbar-btn:hover {
      background: #f0f4ff;
    }
    .toolbar-btn.danger:hover {
      background: #fff0f0;
      border-color: #e0a0a0;
      color: #c33;
    }
    .toolbar-spacer {
      flex: 1;
    }
    .toolbar-divider {
      width: 1px;
      height: 20px;
      background: #e0e0e0;
      margin: 0 4px;
    }
    .mode-btn.active {
      background: #e3edff;
      border-color: #4a90d9;
      color: #2a6ab8;
    }
    kbd {
      display: inline-block;
      font-size: 10px;
      font-family: inherit;
      padding: 1px 4px;
      margin-left: 4px;
      border: 1px solid #ccc;
      border-radius: 3px;
      background: #f5f5f5;
      color: #666;
      line-height: 1;
    }
  `],
})
export class ToolbarComponent {
  state = inject(GraphStateService);

  undoClicked = output<void>();
  redoClicked = output<void>();
  deleteClicked = output<void>();
  autoLayoutClicked = output<void>();
  fitClicked = output<void>();
  zoomInClicked = output<void>();
  zoomOutClicked = output<void>();
  edgeTypeChanged = output<MermaidEdgeType>();

  setMode(mode: CanvasMode): void {
    this.state.canvasMode.set(mode);
  }

  onDirectionChange(event: Event): void {
    const dir = (event.target as HTMLSelectElement).value as FlowDirection;
    this.state.setDirection(dir);
  }

  onEdgeTypeChange(event: Event): void {
    const type = (event.target as HTMLSelectElement).value as MermaidEdgeType;
    this.edgeTypeChanged.emit(type);
  }
}
