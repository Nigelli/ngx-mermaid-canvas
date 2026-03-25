import { Component, output, inject } from '@angular/core';
import { GraphStateService } from '../../services/graph-state.service';
import { FlowDirection } from '../../models/graph-model';

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

      <div class="toolbar-group">
        <button class="toolbar-btn" title="Undo" (click)="undoClicked.emit()">↩</button>
        <button class="toolbar-btn" title="Redo" (click)="redoClicked.emit()">↪</button>
        <button class="toolbar-btn" title="Delete Selected" (click)="deleteClicked.emit()">✕ Delete</button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button class="toolbar-btn" title="Auto Layout" (click)="autoLayoutClicked.emit()">⊞ Layout</button>
        <button class="toolbar-btn" title="Fit to Page" (click)="fitClicked.emit()">⊡ Fit</button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
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
    .toolbar-divider {
      width: 1px;
      height: 20px;
      background: #e0e0e0;
      margin: 0 4px;
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

  onDirectionChange(event: Event): void {
    const dir = (event.target as HTMLSelectElement).value as FlowDirection;
    this.state.setDirection(dir);
  }
}
