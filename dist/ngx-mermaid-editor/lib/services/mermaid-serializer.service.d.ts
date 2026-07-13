import { FlowchartModel } from '../models/graph-model';
import * as i0 from "@angular/core";
export declare class MermaidSerializerService {
    serialize(model: FlowchartModel): string;
    private serializeSubgraph;
    private serializeNode;
    private serializeEdge;
    private escapeLabel;
    static ɵfac: i0.ɵɵFactoryDeclaration<MermaidSerializerService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<MermaidSerializerService>;
}
