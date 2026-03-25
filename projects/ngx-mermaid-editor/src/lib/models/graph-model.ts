export type FlowDirection = 'TD' | 'LR' | 'RL' | 'BT';

export type MermaidShape =
  | 'rectangle'
  | 'rounded'
  | 'diamond'
  | 'circle'
  | 'stadium'
  | 'parallelogram'
  | 'subroutine'
  | 'asymmetric'
  | 'hexagon'
  | 'cylinder'
  | 'trapezoid';

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

export function createEmptyModel(direction: FlowDirection = 'TD'): FlowchartModel {
  return { direction, nodes: new Map(), edges: [] };
}

export function cloneModel(model: FlowchartModel): FlowchartModel {
  return {
    direction: model.direction,
    nodes: new Map(Array.from(model.nodes.entries()).map(([k, v]) => [k, { ...v }])),
    edges: model.edges.map(e => ({ ...e })),
  };
}
