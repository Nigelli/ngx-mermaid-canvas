import { FlowchartModel } from '../models/graph-model';
import * as i0 from "@angular/core";
/**
 * Parses a subset of Mermaid flowchart syntax into the IR.
 * Handles: direction, node definitions (all shapes), edges (all types), labels.
 */
export declare class MermaidDeserializerService {
    deserialize(text: string): FlowchartModel | null;
    private ensureNode;
    /** Parse a node definition like: A["text"], B("text"), C{text}, etc. */
    private parseNodeDef;
    private parseShapeAndLabel;
    /** Parse an edge line like: A -->|"text"| B or A --> B */
    private parseEdge;
    /** Parse a node reference that may be just an ID or ID with shape: A, A["text"], A{text}, etc. */
    private parseInlineNode;
    static ɵfac: i0.ɵɵFactoryDeclaration<MermaidDeserializerService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<MermaidDeserializerService>;
}
