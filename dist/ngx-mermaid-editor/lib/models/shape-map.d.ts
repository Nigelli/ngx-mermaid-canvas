import { type CellStyle } from '@maxgraph/core';
import { MermaidShape } from './graph-model';
/** Mermaid shape syntax wrappers: [open, close] */
export declare const MERMAID_SHAPE_SYNTAX: Record<MermaidShape, [string, string]>;
/** maxGraph CellStyle overrides per Mermaid shape */
export declare const SHAPE_TO_STYLE: Record<MermaidShape, Partial<CellStyle>>;
export declare function getVertexStyle(shape: MermaidShape): Partial<CellStyle>;
/** Given a maxGraph CellStyle, determine the MermaidShape */
export declare function styleToShape(style: CellStyle): MermaidShape;
/** Default sizes per shape */
export declare function getDefaultSize(shape: MermaidShape): {
    width: number;
    height: number;
};
