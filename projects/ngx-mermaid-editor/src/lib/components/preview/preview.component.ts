import {
  Component, inject, effect, ElementRef, ViewChild,
  AfterViewInit, NgZone, ChangeDetectionStrategy, SecurityContext,
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
      background: var(--nmc-surface, #fff);
    }
    .preview-header {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--nmc-muted, #888);
      padding: 6px 10px;
      background: var(--nmc-surface-muted, #fafafa);
      border-bottom: 1px solid var(--nmc-border, #e0e0e0);
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
      color: var(--nmc-error, #d32f2f);
      background: var(--nmc-error-bg, #fff3f3);
      border-top: 1px solid var(--nmc-error-border, #ffcdd2);
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
  private appliedThemeKey: string | null = null;

  async ngAfterViewInit(): Promise<void> {
    this.mermaidModule = await import('mermaid');
    this.initializeMermaid(this.state.theme());
    this.initialized = true;

    runInInjectionContext(this.injector, () => {
      effect(() => {
        const text = this.state.mermaidText();
        const theme = this.state.theme();
        // Mermaid's theme is fixed at initialize time — re-initialize and
        // re-render when the active theme (name or derived palette) changes.
        if (this.themeKey(theme) !== this.appliedThemeKey) {
          this.initializeMermaid(theme);
        }
        this.scheduleRender(text);
      });
    });
  }

  private initializeMermaid(theme: ResolvedNmcTheme): void {
    this.appliedThemeKey = this.themeKey(theme);
    // A 'base' mermaidTheme means "match the editor palette" — derive Mermaid
    // themeVariables from the resolved theme (themeVariables only apply with
    // the 'base' theme). Any other name is used as-is (default, dark, forest…).
    const useBase = theme.mermaidTheme === 'base';
    this.mermaidModule.default.initialize({
      startOnLoad: false,
      theme: theme.mermaidTheme,
      securityLevel: 'strict',
      ...(useBase ? { themeVariables: this.buildThemeVariables(theme) } : {}),
    });
  }

  /** Map the editor palette onto Mermaid 'base' theme variables. */
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

  /** Distinct key for the palette inputs that affect Mermaid rendering. */
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
