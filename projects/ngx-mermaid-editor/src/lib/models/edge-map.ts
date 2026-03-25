import { type CellStyle } from '@maxgraph/core';
import { MermaidEdgeType } from './graph-model';

/** Mermaid edge syntax: [connector, arrowSuffix] */
export const MERMAID_EDGE_SYNTAX: Record<MermaidEdgeType, string> = {
  arrow:        '-->',
  open:         '---',
  'dotted-arrow': '-.->',
  'thick-arrow':  '==>',
};

const BASE_EDGE_STYLE: Partial<CellStyle> = {
  strokeColor: '#666666',
  fontColor: '#666666',
  fontSize: 11,
  fontFamily: 'Inter, system-ui, sans-serif',
  endFill: true,
  rounded: true,
};

export const EDGE_TYPE_STYLES: Record<MermaidEdgeType, Partial<CellStyle>> = {
  arrow:          { ...BASE_EDGE_STYLE, endArrow: 'classic' },
  open:           { ...BASE_EDGE_STYLE, endArrow: 'none' },
  'dotted-arrow': { ...BASE_EDGE_STYLE, endArrow: 'classic', dashed: true },
  'thick-arrow':  { ...BASE_EDGE_STYLE, endArrow: 'classic', strokeWidth: 3 },
};

export function getEdgeStyle(type: MermaidEdgeType): Partial<CellStyle> {
  return EDGE_TYPE_STYLES[type];
}

export function styleToEdgeType(style: CellStyle): MermaidEdgeType {
  if (style.dashed) return 'dotted-arrow';
  if ((style.strokeWidth ?? 1) >= 3) return 'thick-arrow';
  // Only treat as 'open' if endArrow is explicitly 'none'.
  // Missing endArrow means the edge inherits from the stylesheet default (which is 'classic' = arrow).
  if (style.endArrow === 'none') return 'open';
  return 'arrow';
}
