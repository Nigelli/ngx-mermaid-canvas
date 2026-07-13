import { FlowchartModel } from '../models/graph-model';
import * as i0 from "@angular/core";
export declare class MermaidDeserializerService {
    deserialize(text: string): FlowchartModel | null;
    private trackNodeInSubgraph;
    private parseSubgraphLine;
    private ensureNode;
    private parseNodeDef;
    private parseShapeAndLabel;
    private parseChainEdge;
    private parseInlineNode;
    static ɵfac: i0.ɵɵFactoryDeclaration<MermaidDeserializerService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<MermaidDeserializerService>;
}
