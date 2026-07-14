import { Component, signal } from '@angular/core';
import { MermaidEditorComponent, FlowchartModel, NmcThemeName } from 'ngx-mermaid-canvas';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MermaidEditorComponent],
  template: `
    <div class="app" [class.dark]="theme() === 'dark'">
      <header class="app-header">
        <h1>Mermaid Visual Editor</h1>
        <span class="subtitle">draw.io-style editor for Mermaid flowcharts</span>
        <span class="spacer"></span>
        <button class="theme-toggle" (click)="toggleTheme()">
          {{ theme() === 'dark' ? '☀ Light' : '☾ Dark' }}
        </button>
      </header>
      <div class="editor-wrapper">
        <ngx-mermaid-canvas
          [mermaidText]="initialMermaid"
          [showTextEditor]="true"
          [showPreview]="true"
          [theme]="theme()"
          (mermaidTextChange)="onTextChange($event)"
        />
      </div>
    </div>
  `,
  styleUrl: './app.component.scss',
})
export class AppComponent {
  theme = signal<NmcThemeName>('light');

  initialMermaid = `flowchart TD
    A["Start"] --> B{"Is it working?"}
    B -->|"Yes"| C["Great!"]
    B -->|"No"| D["Debug"]
    D --> B
    C --> E(["Done"])
`;

  toggleTheme(): void {
    this.theme.update(t => (t === 'dark' ? 'light' : 'dark'));
  }

  onTextChange(text: string): void {
    // Consumer can react to changes
  }
}
