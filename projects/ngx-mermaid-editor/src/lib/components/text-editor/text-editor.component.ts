import {
  Component, inject, effect, ElementRef, ViewChild,
  AfterViewInit, NgZone, Injector, runInInjectionContext,
} from '@angular/core';
import { GraphStateService } from '../../services/graph-state.service';

@Component({
  selector: 'lib-text-editor',
  standalone: true,
  template: `
    <div class="text-editor-container">
      <div class="text-editor-header">Mermaid Source</div>
      <textarea
        #editorEl
        class="text-editor"
        [value]="state.mermaidText()"
        (input)="onInput($event)"
        spellcheck="false"
      ></textarea>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .text-editor-container {
      display: flex;
      flex-direction: column;
      height: 100%;
    }
    .text-editor-header {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      color: #888;
      padding: 6px 10px;
      background: #fafafa;
      border-bottom: 1px solid #e0e0e0;
      letter-spacing: 0.5px;
    }
    .text-editor {
      flex: 1;
      font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 13px;
      line-height: 1.5;
      padding: 12px;
      border: none;
      outline: none;
      resize: none;
      background: #1e1e2e;
      color: #cdd6f4;
      tab-size: 4;
    }
    .text-editor::selection {
      background: #45475a;
    }
  `],
})
export class TextEditorComponent implements AfterViewInit {
  @ViewChild('editorEl', { static: true }) editorRef!: ElementRef<HTMLTextAreaElement>;

  state = inject(GraphStateService);
  private injector = inject(Injector);
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private suppressUpdate = false;

  ngAfterViewInit(): void {
    runInInjectionContext(this.injector, () => {
      effect(() => {
        const text = this.state.mermaidText();
        const source = this.state.changeSource();
        if (source !== 'text') {
          this.suppressUpdate = true;
          this.editorRef.nativeElement.value = text;
          this.suppressUpdate = false;
        }
      });
    });
  }

  onInput(event: Event): void {
    if (this.suppressUpdate) return;

    const text = (event.target as HTMLTextAreaElement).value;

    if (this.debounceTimer) clearTimeout(this.debounceTimer);
    this.debounceTimer = setTimeout(() => {
      this.state.updateFromText(text);
    }, 500);
  }
}
