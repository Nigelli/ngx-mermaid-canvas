import { type CellStyle } from '@maxgraph/core';
import { MermaidEdgeType } from './graph-model';
import { LIGHT_THEME, ResolvedNmcTheme } from './theme';

/** Mermaid edge syntax: [connector, arrowSuffix] */
export const MERMAID_EDGE_SYNTAX: Record<MermaidEdgeType, string> = {
  arrow:        '-->',
  open:         '---',
  'dotted-arrow': '-.->',
  'thick-arrow':  '==>',
};

/** Base edge style with colors/fonts drawn from the active theme */
function getBaseEdgeStyle(theme: ResolvedNmcTheme): Partial<CellStyle> {
  return {
    strokeColor: theme.edgeStroke,
    fontColor: theme.edgeFontColor,
    fontSize: 11,
    fontFamily: theme.font,
    endFill: true,
    rounded: true,
  };
}

/** Structural (theme-independent) style overrides per edge type */
export const EDGE_TYPE_STYLES: Record<MermaidEdgeType, Partial<CellStyle>> = {
  arrow:          { endArrow: 'classic' },
  open:           { endArrow: 'none' },
  'dotted-arrow': { endArrow: 'classic', dashed: true },
  'thick-arrow':  { endArrow: 'classic', strokeWidth: 3 },
};

export function getEdgeStyle(type: MermaidEdgeType, theme: ResolvedNmcTheme = LIGHT_THEME): Partial<CellStyle> {
  return { ...getBaseEdgeStyle(theme), ...EDGE_TYPE_STYLES[type] };
}

export function styleToEdgeType(style: CellStyle): MermaidEdgeType {
  if (style.dashed) return 'dotted-arrow';
  if ((style.strokeWidth ?? 1) >= 3) return 'thick-arrow';
  // Only treat as 'open' if endArrow is explicitly 'none'.
  // Missing endArrow means the edge inherits from the stylesheet default (which is 'classic' = arrow).
  if (style.endArrow === 'none') return 'open';
  return 'arrow';
}
