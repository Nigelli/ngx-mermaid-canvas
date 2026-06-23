import { WritableSignal } from '@angular/core';
import { FlowchartModel, FlowDirection, MermaidEdgeType } from '../models/graph-model';
import { MermaidSerializerService } from './mermaid-serializer.service';
import { MermaidDeserializerService } from './mermaid-deserializer.service';
import { LayoutService } from './layout.service';
import * as i0 from "@angular/core";
export type ChangeSource = 'canvas' | 'text' | 'none';
export declare class GraphStateService {
    private serializer;
    private deserializer;
    private layout;
    readonly model: WritableSignal<FlowchartModel>;
    readonly mermaidText: WritableSignal<string>;
    readonly changeSource: WritableSignal<ChangeSource>;
    /**
     * Monotonically increasing version that bumps on every text-originated change.
     * The canvas effect watches this instead of changeSource (which resets too fast).
     */
    readonly textVersion: WritableSignal<number>;
    /** Selection state — updated by canvas component */
    readonly selectionCount: WritableSignal<number>;
    readonly hasSelectedVertices: WritableSignal<boolean>;
    readonly hasSelectedEdges: WritableSignal<boolean>;
    readonly selectedEdgeType: WritableSignal<MermaidEdgeType | null>;
    readonly hasSelection: import("@angular/core").Signal<boolean>;
    private nodeCounter;
    constructor(serializer: MermaidSerializerService, deserializer: MermaidDeserializerService, layout: LayoutService);
    /** Called when the visual canvas changes the model */
    updateFromCanvas(model: FlowchartModel): void;
    /** Called when the text editor content changes */
    updateFromText(text: string): void;
    /** Set initial state from input binding */
    initFromText(text: string): void;
    setDirection(dir: FlowDirection): void;
    generateNodeId(): string;
    private trackNodeId;
    /** Convert number to A, B, ..., Z, AA, AB, ... */
    private toAlphaId;
    private fromAlphaId;
    static ɵfac: i0.ɵɵFactoryDeclaration<GraphStateService, never>;
    static ɵprov: i0.ɵɵInjectableDeclaration<GraphStateService>;
}
