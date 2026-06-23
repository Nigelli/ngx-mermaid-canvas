import { type CellStyle } from '@maxgraph/core';
import { MermaidEdgeType } from './graph-model';
/** Mermaid edge syntax: [connector, arrowSuffix] */
export declare const MERMAID_EDGE_SYNTAX: Record<MermaidEdgeType, string>;
export declare const EDGE_TYPE_STYLES: Record<MermaidEdgeType, Partial<CellStyle>>;
export declare function getEdgeStyle(type: MermaidEdgeType): Partial<CellStyle>;
export declare function styleToEdgeType(style: CellStyle): MermaidEdgeType;
