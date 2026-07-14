/** Built-in theme preset names */
export type NmcThemeName = 'light' | 'dark';

/**
 * Fully overridable palette for the editor.
 *
 * Pass a partial object to the `theme` input to customize individual values —
 * unspecified fields fall back to the preset named by `base` (default 'light').
 *
 * Every field below maps to a `--nmc-*` CSS custom property (except the canvas
 * node/edge colors, `mermaidTheme`, and `base`) and can alternatively be
 * overridden via plain CSS on the `ngx-mermaid-canvas` element. With every
 * token exposed here, a custom object alone can theme 100% of the chrome —
 * nothing needs to fall back to raw CSS.
 */
export interface NmcTheme {
  /** Preset that supplies any unspecified values (default 'light') */
  base?: NmcThemeName;

  // --- Accent (selection / hover / active states) ---
  /** Accent color — primary interactive highlight (`--nmc-accent`) */
  accent?: string;
  /** Soft accent — hover backgrounds (`--nmc-accent-soft`) */
  accentSoft?: string;
  /** Accent border — hovered control borders (`--nmc-accent-border`) */
  accentBorder?: string;
  /** Strong accent — active text/icons (`--nmc-accent-strong`) */
  accentStrong?: string;
  /** Active accent — active/pressed backgrounds (`--nmc-accent-active`) */
  accentActive?: string;

  // --- Surfaces & borders ---
  /** Border/divider color for panels and chrome (`--nmc-border`) */
  border?: string;
  /** Stronger border — control outlines (`--nmc-border-strong`) */
  borderStrong?: string;
  /** Panel/menu/button background (`--nmc-surface`) */
  surface?: string;
  /** Muted surface — panel headers, toolbars (`--nmc-surface-muted`) */
  surfaceMuted?: string;
  /** Canvas background color (`--nmc-canvas-bg`) */
  canvasBg?: string;
  /** Canvas dot-grid color (`--nmc-canvas-grid`) */
  canvasGrid?: string;

  // --- Text ---
  /** Primary text color (`--nmc-text`) */
  text?: string;
  /** Secondary text — buttons, hints (`--nmc-text-secondary`) */
  textSecondary?: string;
  /** Muted/label text color (`--nmc-muted`) */
  muted?: string;

  // --- Danger (delete actions) ---
  /** Danger text/icon color (`--nmc-danger`) */
  danger?: string;
  /** Danger soft background — hover (`--nmc-danger-soft`) */
  dangerSoft?: string;
  /** Danger border (`--nmc-danger-border`) */
  dangerBorder?: string;

  // --- Source (Mermaid text) editor ---
  /** Source editor background (`--nmc-editor-bg`) */
  editorBg?: string;
  /** Source editor text color (`--nmc-editor-text`) */
  editorText?: string;
  /** Source editor selection highlight (`--nmc-editor-selection`) */
  editorSelection?: string;

  // --- Popovers (context / radial menus) ---
  /** Popover border (`--nmc-popover-border`) */
  popoverBorder?: string;
  /** Popover border on hover (`--nmc-popover-border-hover`) */
  popoverBorderHover?: string;
  /** Popover divider line (`--nmc-popover-divider`) */
  popoverDivider?: string;

  // --- Misc chrome ---
  /** Keyboard-hint (`<kbd>`) background (`--nmc-kbd-bg`) */
  kbdBg?: string;
  /** Icon/glyph color in menus (`--nmc-icon`) */
  icon?: string;
  /** Split-handle hover color (`--nmc-split-hover`) */
  splitHover?: string;
  /** Connection-port dot fill (`--nmc-port-fill`) */
  portFill?: string;
  /** Connection-port dot stroke (`--nmc-port-stroke`) */
  portStroke?: string;
  /** Rubberband (drag-select) fill (`--nmc-rubberband-bg`) */
  rubberbandBg?: string;
  /** Rubberband (drag-select) border (`--nmc-rubberband-border`) */
  rubberbandBorder?: string;

  // --- Preview error banner ---
  /** Preview error text (`--nmc-error`) */
  error?: string;
  /** Preview error background (`--nmc-error-bg`) */
  errorBg?: string;
  /** Preview error border (`--nmc-error-border`) */
  errorBorder?: string;

  // --- Canvas cell colors (applied to maxGraph nodes/edges, not CSS) ---
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

  // --- Fonts ---
  /** UI + canvas label font family (`--nmc-font`) */
  font?: string;
  /** Monospace font family for the source editor (`--nmc-font-mono`) */
  fontMono?: string;

  // --- Preview ---
  /** Mermaid theme name for the preview panel (e.g. 'default', 'dark', 'forest') */
  mermaidTheme?: string;
}

/** A theme with every field populated (output of {@link resolveTheme}) */
export type ResolvedNmcTheme = Required<NmcTheme>;

/**
 * Maps each themeable `NmcTheme` field to its `--nmc-*` CSS custom property.
 * Fields absent here (base, node/edge colors, mermaidTheme) are not CSS-driven.
 * Consumed by the host style bindings on {@link MermaidEditorComponent}.
 */
export const NMC_CSS_VARS: Partial<Record<keyof NmcTheme, string>> = {
  accent: '--nmc-accent',
  accentSoft: '--nmc-accent-soft',
  accentBorder: '--nmc-accent-border',
  accentStrong: '--nmc-accent-strong',
  accentActive: '--nmc-accent-active',
  border: '--nmc-border',
  borderStrong: '--nmc-border-strong',
  surface: '--nmc-surface',
  surfaceMuted: '--nmc-surface-muted',
  canvasBg: '--nmc-canvas-bg',
  canvasGrid: '--nmc-canvas-grid',
  text: '--nmc-text',
  textSecondary: '--nmc-text-secondary',
  muted: '--nmc-muted',
  danger: '--nmc-danger',
  dangerSoft: '--nmc-danger-soft',
  dangerBorder: '--nmc-danger-border',
  editorBg: '--nmc-editor-bg',
  editorText: '--nmc-editor-text',
  editorSelection: '--nmc-editor-selection',
  popoverBorder: '--nmc-popover-border',
  popoverBorderHover: '--nmc-popover-border-hover',
  popoverDivider: '--nmc-popover-divider',
  kbdBg: '--nmc-kbd-bg',
  icon: '--nmc-icon',
  splitHover: '--nmc-split-hover',
  portFill: '--nmc-port-fill',
  portStroke: '--nmc-port-stroke',
  rubberbandBg: '--nmc-rubberband-bg',
  rubberbandBorder: '--nmc-rubberband-border',
  error: '--nmc-error',
  errorBg: '--nmc-error-bg',
  errorBorder: '--nmc-error-border',
  font: '--nmc-font',
  fontMono: '--nmc-font-mono',
};

const FONT = 'Inter, system-ui, -apple-system, sans-serif';
const FONT_MONO = "'JetBrains Mono', 'Fira Code', 'Consolas', monospace";

/** Default light preset — matches the library's original appearance */
export const LIGHT_THEME: ResolvedNmcTheme = {
  base: 'light',
  accent: '#4a90d9',
  accentSoft: '#f0f4ff',
  accentBorder: '#c0d0f0',
  accentStrong: '#2a6ab8',
  accentActive: '#e3edff',
  border: '#e0e0e0',
  borderStrong: '#cccccc',
  surface: '#ffffff',
  surfaceMuted: '#fafafa',
  canvasBg: '#f8f9fa',
  canvasGrid: '#d0d0d0',
  text: '#333333',
  textSecondary: '#666666',
  muted: '#888888',
  danger: '#cc3333',
  dangerSoft: '#fff0f0',
  dangerBorder: '#e0a0a0',
  editorBg: '#1e1e2e',
  editorText: '#cdd6f4',
  editorSelection: '#45475a',
  popoverBorder: '#d0d0d0',
  popoverBorderHover: '#999999',
  popoverDivider: '#e8e8e8',
  kbdBg: '#f5f5f5',
  icon: '#555555',
  splitHover: '#b0c4ff',
  portFill: '#555555',
  portStroke: '#ffffff',
  rubberbandBg: 'rgba(74, 144, 217, 0.12)',
  rubberbandBorder: 'rgba(74, 144, 217, 0.6)',
  error: '#d32f2f',
  errorBg: '#fff3f3',
  errorBorder: '#ffcdd2',
  nodeFill: '#ffffff',
  nodeStroke: '#333333',
  nodeFontColor: '#333333',
  edgeStroke: '#666666',
  edgeFontColor: '#666666',
  font: FONT,
  fontMono: FONT_MONO,
  mermaidTheme: 'default',
};

/** Built-in dark preset */
export const DARK_THEME: ResolvedNmcTheme = {
  base: 'dark',
  accent: '#89b4fa',
  accentSoft: '#313244',
  accentBorder: '#45475a',
  accentStrong: '#b4befe',
  accentActive: '#2f3a54',
  border: '#313244',
  borderStrong: '#45475a',
  surface: '#1e1e2e',
  surfaceMuted: '#181825',
  canvasBg: '#11111b',
  canvasGrid: '#313244',
  text: '#cdd6f4',
  textSecondary: '#a6adc8',
  muted: '#9399b2',
  danger: '#f38ba8',
  dangerSoft: '#3c2431',
  dangerBorder: '#8a4a5c',
  editorBg: '#181825',
  editorText: '#cdd6f4',
  editorSelection: '#45475a',
  popoverBorder: '#45475a',
  popoverBorderHover: '#585b70',
  popoverDivider: '#313244',
  kbdBg: '#313244',
  icon: '#a6adc8',
  splitHover: '#45507a',
  portFill: '#a6adc8',
  portStroke: '#1e1e2e',
  rubberbandBg: 'rgba(137, 180, 250, 0.15)',
  rubberbandBorder: 'rgba(137, 180, 250, 0.6)',
  error: '#f38ba8',
  errorBg: '#362030',
  errorBorder: '#5c2e3d',
  nodeFill: '#313244',
  nodeStroke: '#a6adc8',
  nodeFontColor: '#cdd6f4',
  edgeStroke: '#9399b2',
  edgeFontColor: '#9399b2',
  font: FONT,
  fontMono: FONT_MONO,
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
