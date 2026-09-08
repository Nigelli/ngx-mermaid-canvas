import {
  Component, inject, effect, ElementRef, ViewChild,
  AfterViewInit, ChangeDetectionStrategy,
  Injector, runInInjectionContext,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { GraphStateService } from '../../services/graph-state.service';
import { ResolvedNmcTheme } from '../../models/theme';

@Component({
  selector: 'lib-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="preview-container">
      <div class="preview-header">
        <span>Preview</span>
        <div class="preview-controls">
          <button class="pz-btn" title="Zoom in" (click)="zoomBy(1.25)">+</button>
          <button class="pz-btn" title="Zoom out" (click)="zoomBy(0.8)">−</button>
          <button class="pz-btn" title="Fit to view" (click)="fitView()">⊡</button>
        </div>
      </div>
      <div #viewport class="preview-viewport"
        (wheel)="onWheel($event)"
        (mousedown)="onPanStart($event)"
        (mousemove)="onPanMove($event)"
        (mouseup)="onPanEnd()"
        (mouseleave)="onPanEnd()">
        <div #previewEl class="preview-transform-layer"></div>
      </div>
      @if (error) {
        <div class="preview-error">{{ error }}</div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .preview-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--nmc-surface, #fff);
    }
    .preview-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--nmc-muted, #888);
      padding: 4px 10px;
      background: var(--nmc-surface-muted, #fafafa);
      border-bottom: 1px solid var(--nmc-border, #e0e0e0);
      letter-spacing: 0.5px;
      flex-shrink: 0;
    }
    .preview-controls {
      display: flex;
      gap: 2px;
    }
    .pz-btn {
      padding: 1px 7px;
      font-size: 12px;
      border: 1px solid var(--nmc-border-strong, #ccc);
      border-radius: 3px;
      background: var(--nmc-surface, #fff);
      color: var(--nmc-text, inherit);
      cursor: pointer;
      line-height: 1.6;
    }
    .pz-btn:hover { background: var(--nmc-accent-soft, #f0f4ff); }
    .preview-viewport {
      flex: 1;
      overflow: hidden;
      position: relative;
      cursor: grab;
      user-select: none;
    }
    .preview-viewport.panning { cursor: grabbing; }
    .preview-transform-layer {
      position: absolute;
      top: 0;
      left: 0;
      transform-origin: 0 0;
    }
    .preview-transform-layer :first-child {
      display: block;
      max-width: none;
    }
    .preview-error {
      padding: 8px 12px;
      font-size: 11px;
      color: var(--nmc-error, #d32f2f);
      background: var(--nmc-error-bg, #fff3f3);
      border-top: 1px solid var(--nmc-error-border, #ffcdd2);
      flex-shrink: 0;
    }
  `],
})
export class PreviewComponent implements AfterViewInit {
  @ViewChild('previewEl', { static: true }) previewRef!: ElementRef<HTMLDivElement>;
  @ViewChild('viewport', { static: true }) viewportRef!: ElementRef<HTMLDivElement>;

  error: string | null = null;

  private state = inject(GraphStateService);
  private sanitizer = inject(DomSanitizer);
  private injector = inject(Injector);
  private mermaidModule: any = null;
  private renderTimer: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;
  private appliedThemeKey: string | null = null;

  private scale = 1;
  private offsetX = 0;
  private offsetY = 0;
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panOriginX = 0;
  private panOriginY = 0;

  async ngAfterViewInit(): Promise<void> {
    this.mermaidModule = await import('mermaid');
    this.initializeMermaid(this.state.theme());
    this.initialized = true;

    runInInjectionContext(this.injector, () => {
      effect(() => {
        const text = this.state.mermaidText();
        const theme = this.state.theme();
        if (this.themeKey(theme) !== this.appliedThemeKey) {
          this.initializeMermaid(theme);
        }
        this.scheduleRender(text);
      });
    });
  }

  zoomBy(factor: number, originX?: number, originY?: number): void {
    const viewport = this.viewportRef.nativeElement;
    const cx = originX ?? viewport.clientWidth / 2;
    const cy = originY ?? viewport.clientHeight / 2;
    const newScale = Math.min(10, Math.max(0.05, this.scale * factor));
    this.offsetX = cx - (cx - this.offsetX) * (newScale / this.scale);
    this.offsetY = cy - (cy - this.offsetY) * (newScale / this.scale);
    this.scale = newScale;
    this.applyTransform();
  }

  fitView(): void {
    const viewport = this.viewportRef.nativeElement;
    const svg = this.previewRef.nativeElement.querySelector('svg') as SVGSVGElement | null;
    if (!svg) return;

    const svgW = svg.width?.baseVal?.value || svg.viewBox?.baseVal?.width || 200;
    const svgH = svg.height?.baseVal?.value || svg.viewBox?.baseVal?.height || 100;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const padding = 32;

    this.scale = Math.min((vw - padding) / svgW, (vh - padding) / svgH, 2);
    this.offsetX = (vw - svgW * this.scale) / 2;
    this.offsetY = (vh - svgH * this.scale) / 2;
    this.applyTransform();
  }

  onWheel(event: WheelEvent): void {
    event.preventDefault();
    const rect = this.viewportRef.nativeElement.getBoundingClientRect();
    const factor = event.deltaY < 0 ? 1.15 : 1 / 1.15;
    this.zoomBy(factor, event.clientX - rect.left, event.clientY - rect.top);
  }

  onPanStart(event: MouseEvent): void {
    if (event.button !== 0) return;
    this.isPanning = true;
    this.panStartX = event.clientX;
    this.panStartY = event.clientY;
    this.panOriginX = this.offsetX;
    this.panOriginY = this.offsetY;
    this.viewportRef.nativeElement.classList.add('panning');
  }

  onPanMove(event: MouseEvent): void {
    if (!this.isPanning) return;
    this.offsetX = this.panOriginX + (event.clientX - this.panStartX);
    this.offsetY = this.panOriginY + (event.clientY - this.panStartY);
    this.applyTransform();
  }

  onPanEnd(): void {
    this.isPanning = false;
    this.viewportRef.nativeElement.classList.remove('panning');
  }

  private applyTransform(): void {
    this.previewRef.nativeElement.style.transform =
      `translate(${this.offsetX}px, ${this.offsetY}px) scale(${this.scale})`;
  }

  private initializeMermaid(theme: ResolvedNmcTheme): void {
    this.appliedThemeKey = this.themeKey(theme);
    const useBase = theme.mermaidTheme === 'base';
    this.mermaidModule.default.initialize({
      startOnLoad: false,
      theme: theme.mermaidTheme,
      securityLevel: 'strict',
      ...(useBase ? { themeVariables: this.buildThemeVariables(theme) } : {}),
    });
  }

  private buildThemeVariables(t: ResolvedNmcTheme): Record<string, string> {
    return {
      background: t.surface,
      primaryColor: t.nodeFill,
      mainBkg: t.nodeFill,
      primaryBorderColor: t.nodeStroke,
      nodeBorder: t.nodeStroke,
      primaryTextColor: t.nodeFontColor,
      textColor: t.text,
      titleColor: t.text,
      lineColor: t.edgeStroke,
      edgeLabelBackground: t.surface,
      secondaryColor: t.surfaceMuted,
      tertiaryColor: t.surfaceMuted,
      clusterBkg: t.surfaceMuted,
      clusterBorder: t.border,
      fontFamily: t.font,
    };
  }

  private themeKey(t: ResolvedNmcTheme): string {
    return [
      t.mermaidTheme, t.surface, t.surfaceMuted, t.border, t.text,
      t.nodeFill, t.nodeStroke, t.nodeFontColor, t.edgeStroke, t.font,
    ].join('|');
  }

  private scheduleRender(text: string): void {
    if (this.renderTimer) clearTimeout(this.renderTimer);
    this.renderTimer = setTimeout(() => this.renderMermaid(text), 300);
  }

  private async renderMermaid(text: string): Promise<void> {
    if (!this.initialized || !text.trim()) {
      this.previewRef.nativeElement.textContent = '';
      this.error = null;
      return;
    }

    try {
      const id = `mermaid-preview-${Date.now()}`;
      const { svg } = await this.mermaidModule.default.render(id, text);
      this.previewRef.nativeElement.textContent = '';
      const wrapper = document.createElement('div');
      wrapper.innerHTML = svg;
      this.previewRef.nativeElement.appendChild(wrapper);
      this.error = null;
      // Fit after each render so the diagram fills the viewport
      requestAnimationFrame(() => this.fitView());
    } catch (e: any) {
      this.error = e?.message ?? 'Render error';
    }
  }
}
