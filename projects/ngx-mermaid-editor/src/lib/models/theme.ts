/** Built-in theme preset names */
export type NmcThemeName = 'light' | 'dark';

/**
 * Overridable palette for the editor.
 *
 * Pass a partial object to the `theme` input to customize individual values —
 * unspecified fields fall back to the preset named by `base` (default 'light').
 *
 * Chrome colors (accent/border/surface/canvasBg/text/muted/fonts) are also
 * exposed as `--nmc-*` CSS custom properties and can alternatively be
 * overridden via plain CSS on the `ngx-mermaid-canvas` element.
 */
export interface NmcTheme {
  /** Preset that supplies any unspecified values (default 'light') */
  base?: NmcThemeName;

  /** Accent color used for selection, hover, and active states */
  accent?: string;
  /** Border/divider color for panels and chrome */
  border?: string;
  /** Panel/menu/button background */
  surface?: string;
  /** Canvas background color */
  canvasBg?: string;
  /** Primary text color */
  text?: string;
  /** Secondary/label text color */
  muted?: string;

  /** Node (vertex) fill color on the canvas */
  nodeFill?: string;
  /** Node (vertex) stroke color on the canvas */
  nodeStroke?: string;
  /** Node (vertex) label color on the canvas */
  nodeFontColor?: string;
  /** Edge stroke color on the canvas */
  edgeStroke?: string;
  /** Edge label color on the canvas */
  edgeFontColor?: string;

  /** UI + canvas label font family */
  font?: string;
  /** Monospace font family (Mermaid source editor) */
  fontMono?: string;

  /** Mermaid theme name for the preview panel (e.g. 'default', 'dark', 'forest') */
  mermaidTheme?: string;
}

/** A theme with every field populated (output of {@link resolveTheme}) */
export type ResolvedNmcTheme = Required<NmcTheme>;

/** Default light preset — matches the library's original appearance */
export const LIGHT_THEME: ResolvedNmcTheme = {
  base: 'light',
  accent: '#4a90d9',
  border: '#e0e0e0',
  surface: '#ffffff',
  canvasBg: '#f8f9fa',
  text: '#333333',
  muted: '#888888',
  nodeFill: '#ffffff',
  nodeStroke: '#333333',
  nodeFontColor: '#333333',
  edgeStroke: '#666666',
  edgeFontColor: '#666666',
  font: 'Inter, system-ui, -apple-system, sans-serif',
  fontMono: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  mermaidTheme: 'default',
};

/** Built-in dark preset */
export const DARK_THEME: ResolvedNmcTheme = {
  base: 'dark',
  accent: '#89b4fa',
  border: '#313244',
  surface: '#1e1e2e',
  canvasBg: '#11111b',
  text: '#cdd6f4',
  muted: '#9399b2',
  nodeFill: '#313244',
  nodeStroke: '#a6adc8',
  nodeFontColor: '#cdd6f4',
  edgeStroke: '#9399b2',
  edgeFontColor: '#9399b2',
  font: 'Inter, system-ui, -apple-system, sans-serif',
  fontMono: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
  mermaidTheme: 'dark',
};

/**
 * Resolve a theme input into a fully-populated theme.
 * A preset name returns that preset; a partial object is merged onto the
 * preset named by its `base` field (default 'light').
 */
export function resolveTheme(theme: NmcThemeName | NmcTheme): ResolvedNmcTheme {
  if (typeof theme === 'string') {
    return theme === 'dark' ? DARK_THEME : LIGHT_THEME;
  }
  const base = theme.base === 'dark' ? DARK_THEME : LIGHT_THEME;
  const resolved: ResolvedNmcTheme = { ...base };
  for (const [key, value] of Object.entries(theme)) {
    if (value !== undefined) {
      (resolved as any)[key] = value;
    }
  }
  return resolved;
}
