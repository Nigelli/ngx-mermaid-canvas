export type FlowDirection = 'TD' | 'LR' | 'RL' | 'BT';
export type MermaidShape = 'rectangle' | 'rounded' | 'diamond' | 'circle' | 'stadium' | 'parallelogram' | 'subroutine' | 'asymmetric' | 'hexagon' | 'cylinder' | 'trapezoid';
export type MermaidEdgeType = 'arrow' | 'open' | 'dotted-arrow' | 'thick-arrow';
export interface FlowNode {
    id: string;
    label: string;
    shape: MermaidShape;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
}
export interface FlowEdge {
    id: string;
    sourceId: string;
    targetId: string;
    label?: string;
    type: MermaidEdgeType;
}
export interface FlowchartModel {
    direction: FlowDirection;
    nodes: Map<string, FlowNode>;
    edges: FlowEdge[];
}
export declare function createEmptyModel(direction?: FlowDirection): FlowchartModel;
export declare function cloneModel(model: FlowchartModel): FlowchartModel;
