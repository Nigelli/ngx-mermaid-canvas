import {
  Component, inject, effect, ElementRef, ViewChild,
  AfterViewInit, NgZone, ChangeDetectionStrategy, SecurityContext,
  Injector, runInInjectionContext,
} from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { GraphStateService } from '../../services/graph-state.service';

@Component({
  selector: 'lib-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="preview-container">
      <div class="preview-header">Preview</div>
      <div #previewEl class="preview-content"></div>
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
      background: #fff;
    }
    .preview-header {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      color: #888;
      padding: 6px 10px;
      background: #fafafa;
      border-bottom: 1px solid #e0e0e0;
      letter-spacing: 0.5px;
    }
    .preview-content {
      flex: 1;
      padding: 16px;
      overflow: auto;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .preview-content :first-child {
      max-width: 100%;
      height: auto;
    }
    .preview-error {
      padding: 8px 12px;
      font-size: 11px;
      color: #d32f2f;
      background: #fff3f3;
      border-top: 1px solid #ffcdd2;
    }
  `],
})
export class PreviewComponent implements AfterViewInit {
  @ViewChild('previewEl', { static: true }) previewRef!: ElementRef<HTMLDivElement>;

  error: string | null = null;

  private state = inject(GraphStateService);
  private sanitizer = inject(DomSanitizer);
  private injector = inject(Injector);
  private mermaidModule: any = null;
  private renderTimer: ReturnType<typeof setTimeout> | null = null;
  private initialized = false;

  async ngAfterViewInit(): Promise<void> {
    this.mermaidModule = await import('mermaid');
    this.mermaidModule.default.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'strict',
    });
    this.initialized = true;

    runInInjectionContext(this.injector, () => {
      effect(() => {
        const text = this.state.mermaidText();
        this.scheduleRender(text);
      });
    });
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
      // Mermaid runs with securityLevel:'strict' which sanitizes its own output.
      // Angular's HTML sanitizer strips SVG elements, so we use the trusted
      // Mermaid output via bypassSecurityTrustHtml for SVG rendering.
      const trusted = this.sanitizer.bypassSecurityTrustHtml(svg);
      this.previewRef.nativeElement.textContent = '';
      const wrapper = document.createElement('div');
      // Extract the string from the SafeHtml for DOM insertion
      wrapper.innerHTML = svg;
      this.previewRef.nativeElement.appendChild(wrapper);
      this.error = null;
    } catch (e: any) {
      this.error = e?.message ?? 'Render error';
    }
  }
}
