import { type CellStyle } from '@maxgraph/core';
import { MermaidShape } from './graph-model';
import { LIGHT_THEME, ResolvedNmcTheme } from './theme';

/** Mermaid shape syntax wrappers: [open, close] */
export const MERMAID_SHAPE_SYNTAX: Record<MermaidShape, [string, string]> = {
  rectangle:     ['[', ']'],
  rounded:       ['(', ')'],
  diamond:       ['{', '}'],
  circle:        ['((', '))'],
  stadium:       ['([', '])'],
  parallelogram: ['[/', '/]'],
  subroutine:    ['[[', ']]'],
  asymmetric:    ['>', ']'],
  hexagon:       ['{{', '}}'],
  cylinder:      ['[(', ')]'],
  trapezoid:     ['[/', '\\]'],
};

/** maxGraph CellStyle overrides per Mermaid shape */
export const SHAPE_TO_STYLE: Record<MermaidShape, Partial<CellStyle>> = {
  rectangle:     { shape: 'rectangle' },
  rounded:       { shape: 'rectangle', rounded: true, arcSize: 20 },
  diamond:       { shape: 'rhombus' },
  circle:        { shape: 'ellipse' },
  stadium:       { shape: 'rectangle', rounded: true, arcSize: 50 },
  parallelogram: { shape: 'parallelogram' },
  subroutine:    { shape: 'rectangle', strokeWidth: 2 },
  asymmetric:    { shape: 'rectangle' },
  hexagon:       { shape: 'hexagon' },
  cylinder:      { shape: 'cylinder' },
  trapezoid:     { shape: 'trapezoid' },
};

/** Base vertex style with colors/fonts drawn from the active theme */
function getBaseStyle(theme: ResolvedNmcTheme): Partial<CellStyle> {
  return {
    fillColor: theme.nodeFill,
    strokeColor: theme.nodeStroke,
    fontColor: theme.nodeFontColor,
    fontSize: 13,
    fontFamily: theme.font,
    whiteSpace: 'wrap',
    overflow: 'hidden',
    autoSize: false,
  };
}

export function getVertexStyle(shape: MermaidShape, theme: ResolvedNmcTheme = LIGHT_THEME): Partial<CellStyle> {
  return { ...getBaseStyle(theme), ...SHAPE_TO_STYLE[shape] };
}

/** Given a maxGraph CellStyle, determine the MermaidShape */
export function styleToShape(style: CellStyle): MermaidShape {
  if (style.shape === 'rhombus') return 'diamond';
  if (style.shape === 'ellipse') return 'circle';
  if (style.shape === 'parallelogram') return 'parallelogram';
  if (style.shape === 'hexagon') return 'hexagon';
  if (style.shape === 'cylinder') return 'cylinder';
  if (style.shape === 'trapezoid') return 'trapezoid';
  if (style.rounded && (style.arcSize ?? 0) >= 50) return 'stadium';
  if (style.rounded) return 'rounded';
  if ((style.strokeWidth ?? 1) > 1 && style.shape === 'rectangle') return 'subroutine';
  return 'rectangle';
}

/** Default sizes per shape */
export function getDefaultSize(shape: MermaidShape): { width: number; height: number } {
  switch (shape) {
    case 'diamond':   return { width: 100, height: 80 };
    case 'circle':    return { width: 70, height: 70 };
    case 'hexagon':   return { width: 120, height: 60 };
    case 'cylinder':  return { width: 100, height: 70 };
    case 'trapezoid': return { width: 140, height: 50 };
    default:          return { width: 140, height: 50 };
  }
}
