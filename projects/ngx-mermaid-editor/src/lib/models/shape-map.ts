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
  // 'parallelogram', 'subroutine' and 'asymmetric' are custom shapes
  // registered by the canvas component (mirroring 'trapezoid'); a distinct
  // style key keeps each shape recoverable after canvas edits instead of
  // collapsing to 'rectangle'.
  parallelogram: { shape: 'parallelogram' },
  subroutine:    { shape: 'subroutine' },
  asymmetric:    { shape: 'asymmetric' },
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
  if (style.shape === 'subroutine') return 'subroutine';
  if (style.shape === 'hexagon') return 'hexagon';
  if (style.shape === 'cylinder') return 'cylinder';
  if (style.shape === 'trapezoid') return 'trapezoid';
  if (style.shape === 'asymmetric') return 'asymmetric';
  if (style.rounded && (style.arcSize ?? 0) >= 50) return 'stadium';
  if (style.rounded) return 'rounded';
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
