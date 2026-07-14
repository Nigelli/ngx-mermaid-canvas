/*
 * Public API Surface of ngx-mermaid-editor
 */

// Main component
export { MermaidEditorComponent } from './lib/components/mermaid-editor.component';

// Models (for consumers who want to inspect/manipulate the IR)
export type {
  FlowchartModel,
  FlowNode,
  FlowEdge,
  FlowSubgraph,
  FlowDirection,
  MermaidShape,
  MermaidEdgeType,
} from './lib/models/graph-model';
export { createEmptyModel, cloneModel } from './lib/models/graph-model';

// Theming
export type { NmcTheme, NmcThemeName, ResolvedNmcTheme } from './lib/models/theme';
export { LIGHT_THEME, DARK_THEME, resolveTheme } from './lib/models/theme';

// Services (for consumers who want standalone serialization)
export { MermaidSerializerService } from './lib/services/mermaid-serializer.service';
export { MermaidDeserializerService } from './lib/services/mermaid-deserializer.service';
export { GraphStateService } from './lib/services/graph-state.service';
export type { CanvasMode } from './lib/services/graph-state.service';
