import { Component } from '@angular/core';
import { MermaidEditorComponent, FlowchartModel } from 'ngx-mermaid-canvas';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [MermaidEditorComponent],
  template: `
    <div class="app">
      <header class="app-header">
        <h1>Mermaid Visual Editor</h1>
        <span class="subtitle">draw.io-style editor for Mermaid flowcharts</span>
      </header>
      <div class="editor-wrapper">
        <ngx-mermaid-canvas
          [mermaidText]="initialMermaid"
          [showTextEditor]="true"
          [showPreview]="true"
          (mermaidTextChange)="onTextChange($event)"
        />
      </div>
    </div>
  `,
  styleUrl: './app.component.scss',
})
export class AppComponent {
  initialMermaid = `flowchart TD
    A["Start"] --> B{"Is it working?"}
    B -->|"Yes"| C["Great!"]
    B -->|"No"| D["Debug"]
    D --> B
    C --> E(["Done"])
`;

  onTextChange(text: string): void {
    // Consumer can react to changes
  }
}
