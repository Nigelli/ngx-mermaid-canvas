import { Component, output } from '@angular/core';
import { MermaidShape } from '../../models/graph-model';

@Component({
  selector: 'lib-shape-palette',
  standalone: true,
  template: `
    <div class="palette">
      <div class="palette-title">Shapes</div>
      @for (opt of shapes; track opt.shape) {
        <button
          class="palette-item"
          [title]="opt.label"
          (click)="shapeSelected.emit(opt.shape)"
        >
          <svg viewBox="0 0 40 30" class="shape-icon">
            @switch (opt.shape) {
              @case ('rectangle') {
                <rect x="4" y="4" width="32" height="22" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
              }
              @case ('rounded') {
                <rect x="4" y="4" width="32" height="22" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
              }
              @case ('diamond') {
                <polygon points="20,2 38,15 20,28 2,15" fill="none" stroke="currentColor" stroke-width="1.5"/>
              }
              @case ('circle') {
                <ellipse cx="20" cy="15" rx="14" ry="12" fill="none" stroke="currentColor" stroke-width="1.5"/>
              }
              @case ('stadium') {
                <rect x="4" y="4" width="32" height="22" rx="11" fill="none" stroke="currentColor" stroke-width="1.5"/>
              }
              @case ('hexagon') {
                <polygon points="10,2 30,2 38,15 30,28 10,28 2,15" fill="none" stroke="currentColor" stroke-width="1.5"/>
              }
              @case ('cylinder') {
                <path d="M8,8 Q20,2 32,8 L32,22 Q20,28 8,22 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
                <path d="M8,8 Q20,14 32,8" fill="none" stroke="currentColor" stroke-width="1"/>
              }
              @case ('trapezoid') {
                <polygon points="8,4 32,4 38,26 2,26" fill="none" stroke="currentColor" stroke-width="1.5"/>
              }
            }
          </svg>
          <span class="palette-label">{{ opt.label }}</span>
        </button>
      }
    </div>
  `,
  styles: [`
    .palette {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 8px;
      background: #fff;
      border-right: 1px solid #e0e0e0;
      width: 80px;
      min-width: 80px;
      overflow-y: auto;
    }
    .palette-title {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      color: #888;
      padding: 4px 0;
      letter-spacing: 0.5px;
    }
    .palette-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 5px 4px;
      border: 1px solid transparent;
      border-radius: 4px;
      background: none;
      cursor: pointer;
      color: #555;
      transition: all 0.15s;
    }
    .palette-item:hover {
      background: #f0f4ff;
      border-color: #c0d0f0;
      color: #333;
    }
    .shape-icon {
      width: 36px;
      height: 28px;
    }
    .palette-label {
      font-size: 9px;
      line-height: 1;
    }
  `],
})
export class ShapePaletteComponent {
  shapeSelected = output<MermaidShape>();

  shapes: Array<{ shape: MermaidShape; label: string }> = [
    { shape: 'rectangle', label: 'Process' },
    { shape: 'rounded', label: 'Start/End' },
    { shape: 'diamond', label: 'Decision' },
    { shape: 'circle', label: 'Event' },
    { shape: 'stadium', label: 'Terminal' },
    { shape: 'hexagon', label: 'Prepare' },
    { shape: 'cylinder', label: 'Database' },
    { shape: 'trapezoid', label: 'Manual' },
  ];
}
