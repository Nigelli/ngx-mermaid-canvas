import * as i0 from '@angular/core';
import { Injectable, signal, computed, inject, NgZone, Injector, ChangeDetectorRef, runInInjectionContext, effect, ViewChild, Component, output, ChangeDetectionStrategy, input, ElementRef } from '@angular/core';
import { ShapeRegistry, HexagonShape, Point, Graph, RubberBandHandler, KeyHandler, UndoManager, InternalEvent, ConnectionConstraint, Outline } from '@maxgraph/core';
import dagre from '@dagrejs/dagre';
import { DomSanitizer } from '@angular/platform-browser';

function createEmptyModel(direction = 'TD') {
    return { direction, nodes: new Map(), edges: [] };
}
function cloneModel(model) {
    return {
        direction: model.direction,
        nodes: new Map(Array.from(model.nodes.entries()).map(([k, v]) => [k, { ...v }])),
        edges: model.edges.map(e => ({ ...e })),
    };
}

/** Mermaid shape syntax wrappers: [open, close] */
const MERMAID_SHAPE_SYNTAX = {
    rectangle: ['[', ']'],
    rounded: ['(', ')'],
    diamond: ['{', '}'],
    circle: ['((', '))'],
    stadium: ['([', '])'],
    parallelogram: ['[/', '/]'],
    subroutine: ['[[', ']]'],
    asymmetric: ['>', ']'],
    hexagon: ['{{', '}}'],
    cylinder: ['[(', ')]'],
    trapezoid: ['[/', '\\]'],
};
/** maxGraph CellStyle overrides per Mermaid shape */
const SHAPE_TO_STYLE = {
    rectangle: { shape: 'rectangle' },
    rounded: { shape: 'rectangle', rounded: true, arcSize: 20 },
    diamond: { shape: 'rhombus' },
    circle: { shape: 'ellipse' },
    stadium: { shape: 'rectangle', rounded: true, arcSize: 50 },
    parallelogram: { shape: 'parallelogram' },
    subroutine: { shape: 'rectangle', strokeWidth: 2 },
    asymmetric: { shape: 'rectangle' },
    hexagon: { shape: 'hexagon' },
    cylinder: { shape: 'cylinder' },
    trapezoid: { shape: 'trapezoid' },
};
const BASE_STYLE = {
    fillColor: '#ffffff',
    strokeColor: '#333333',
    fontColor: '#333333',
    fontSize: 13,
    fontFamily: 'Inter, system-ui, sans-serif',
    whiteSpace: 'wrap',
    overflow: 'hidden',
    autoSize: false,
};
function getVertexStyle(shape) {
    return { ...BASE_STYLE, ...SHAPE_TO_STYLE[shape] };
}
/** Given a maxGraph CellStyle, determine the MermaidShape */
function styleToShape(style) {
    if (style.shape === 'rhombus')
        return 'diamond';
    if (style.shape === 'ellipse')
        return 'circle';
    if (style.shape === 'parallelogram')
        return 'parallelogram';
    if (style.shape === 'hexagon')
        return 'hexagon';
    if (style.shape === 'cylinder')
        return 'cylinder';
    if (style.shape === 'trapezoid')
        return 'trapezoid';
    if (style.rounded && (style.arcSize ?? 0) >= 50)
        return 'stadium';
    if (style.rounded)
        return 'rounded';
    if ((style.strokeWidth ?? 1) > 1 && style.shape === 'rectangle')
        return 'subroutine';
    return 'rectangle';
}
/** Default sizes per shape */
function getDefaultSize(shape) {
    switch (shape) {
        case 'diamond': return { width: 100, height: 80 };
        case 'circle': return { width: 70, height: 70 };
        case 'hexagon': return { width: 120, height: 60 };
        case 'cylinder': return { width: 100, height: 70 };
        case 'trapezoid': return { width: 140, height: 50 };
        default: return { width: 140, height: 50 };
    }
}

/** Mermaid edge syntax: [connector, arrowSuffix] */
const MERMAID_EDGE_SYNTAX = {
    arrow: '-->',
    open: '---',
    'dotted-arrow': '-.->',
    'thick-arrow': '==>',
};
const BASE_EDGE_STYLE = {
    strokeColor: '#666666',
    fontColor: '#666666',
    fontSize: 11,
    fontFamily: 'Inter, system-ui, sans-serif',
    endFill: true,
    rounded: true,
};
const EDGE_TYPE_STYLES = {
    arrow: { ...BASE_EDGE_STYLE, endArrow: 'classic' },
    open: { ...BASE_EDGE_STYLE, endArrow: 'none' },
    'dotted-arrow': { ...BASE_EDGE_STYLE, endArrow: 'classic', dashed: true },
    'thick-arrow': { ...BASE_EDGE_STYLE, endArrow: 'classic', strokeWidth: 3 },
};
function getEdgeStyle(type) {
    return EDGE_TYPE_STYLES[type];
}
function styleToEdgeType(style) {
    if (style.dashed)
        return 'dotted-arrow';
    if ((style.strokeWidth ?? 1) >= 3)
        return 'thick-arrow';
    // Only treat as 'open' if endArrow is explicitly 'none'.
    // Missing endArrow means the edge inherits from the stylesheet default (which is 'classic' = arrow).
    if (style.endArrow === 'none')
        return 'open';
    return 'arrow';
}

class MermaidSerializerService {
    serialize(model) {
        const lines = [`flowchart ${model.direction}`];
        // Node definitions
        for (const node of model.nodes.values()) {
            lines.push(`    ${this.serializeNode(node)}`);
        }
        // Edge definitions
        for (const edge of model.edges) {
            lines.push(`    ${this.serializeEdge(edge, model)}`);
        }
        return lines.join('\n') + '\n';
    }
    serializeNode(node) {
        const [open, close] = MERMAID_SHAPE_SYNTAX[node.shape];
        const label = this.escapeLabel(node.label);
        return `${node.id}${open}"${label}"${close}`;
    }
    serializeEdge(edge, model) {
        const connector = MERMAID_EDGE_SYNTAX[edge.type];
        const src = edge.sourceId;
        const tgt = edge.targetId;
        if (edge.label) {
            return `${src} ${connector}|"${this.escapeLabel(edge.label)}"| ${tgt}`;
        }
        return `${src} ${connector} ${tgt}`;
    }
    escapeLabel(label) {
        return label.replace(/"/g, '#quot;');
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: MermaidSerializerService, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: MermaidSerializerService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: MermaidSerializerService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }] });

/**
 * Parses a subset of Mermaid flowchart syntax into the IR.
 * Handles: direction, node definitions (all shapes), edges (all types), labels.
 */
class MermaidDeserializerService {
    deserialize(text) {
        const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'));
        // First line must be the direction
        const dirMatch = lines[0]?.match(/^(?:flowchart|graph)\s+(TD|TB|LR|RL|BT)/i);
        if (!dirMatch)
            return null;
        const direction = (dirMatch[1].toUpperCase() === 'TB' ? 'TD' : dirMatch[1].toUpperCase());
        const model = createEmptyModel(direction);
        let edgeCounter = 0;
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            // Try to parse as edge (must check before standalone node)
            const edgeParsed = this.parseEdge(line);
            if (edgeParsed) {
                // Ensure source and target nodes exist
                this.ensureNode(model, edgeParsed.sourceId, edgeParsed.sourceLabel, edgeParsed.sourceShape);
                this.ensureNode(model, edgeParsed.targetId, edgeParsed.targetLabel, edgeParsed.targetShape);
                model.edges.push({
                    id: `e${edgeCounter++}`,
                    sourceId: edgeParsed.sourceId,
                    targetId: edgeParsed.targetId,
                    label: edgeParsed.label,
                    type: edgeParsed.type,
                });
                continue;
            }
            // Try to parse as standalone node definition
            const nodeParsed = this.parseNodeDef(line);
            if (nodeParsed) {
                this.ensureNode(model, nodeParsed.id, nodeParsed.label, nodeParsed.shape);
                continue;
            }
        }
        return model;
    }
    ensureNode(model, id, label, shape) {
        if (!model.nodes.has(id)) {
            model.nodes.set(id, { id, label: label ?? id, shape: shape ?? 'rectangle' });
        }
        else if (label && label !== id) {
            // Update label/shape if a definition provides more detail
            const existing = model.nodes.get(id);
            existing.label = label;
            if (shape)
                existing.shape = shape;
        }
    }
    /** Parse a node definition like: A["text"], B("text"), C{text}, etc. */
    parseNodeDef(text) {
        // Match node ID followed by shape brackets
        const match = text.match(/^(\w+)\s*([\[\(\{<>].*)/);
        if (!match)
            return null;
        const id = match[1];
        const rest = match[2];
        return this.parseShapeAndLabel(id, rest);
    }
    parseShapeAndLabel(id, rest) {
        // Order matters: check multi-char delimiters first
        const patterns = [
            { open: '([', close: '])', shape: 'stadium' },
            { open: '((', close: '))', shape: 'circle' },
            { open: '[[', close: ']]', shape: 'subroutine' },
            { open: '[(', close: ')]', shape: 'cylinder' },
            { open: '{{', close: '}}', shape: 'hexagon' },
            { open: '[/', close: '\\]', shape: 'trapezoid' },
            { open: '[/', close: '/]', shape: 'parallelogram' },
            { open: '(', close: ')', shape: 'rounded' },
            { open: '{', close: '}', shape: 'diamond' },
            { open: '>', close: ']', shape: 'asymmetric' },
            { open: '[', close: ']', shape: 'rectangle' },
        ];
        for (const { open, close, shape } of patterns) {
            if (rest.startsWith(open) && rest.endsWith(close)) {
                let label = rest.slice(open.length, rest.length - close.length).trim();
                // Strip quotes
                if ((label.startsWith('"') && label.endsWith('"')) ||
                    (label.startsWith("'") && label.endsWith("'"))) {
                    label = label.slice(1, -1);
                }
                label = label.replace(/#quot;/g, '"');
                return { id, label: label || id, shape };
            }
        }
        return null;
    }
    /** Parse an edge line like: A -->|"text"| B or A --> B */
    parseEdge(text) {
        // Regex to find the edge connector in the middle
        const edgeConnectors = [
            { pattern: /\s-\.->(?:\|([^|]*)\|)?\s/, type: 'dotted-arrow' },
            { pattern: /\s==>(?:\|([^|]*)\|)?\s/, type: 'thick-arrow' },
            { pattern: /\s-->(?:\|([^|]*)\|)?\s/, type: 'arrow' },
            { pattern: /\s---(?:\|([^|]*)\|)?\s/, type: 'open' },
        ];
        for (const { pattern, type } of edgeConnectors) {
            const match = text.match(pattern);
            if (match) {
                const idx = match.index;
                const srcPart = text.slice(0, idx).trim();
                const tgtPart = text.slice(idx + match[0].length).trim();
                let edgeLabel = match[1]?.trim();
                if (edgeLabel) {
                    // Strip quotes from edge label
                    if ((edgeLabel.startsWith('"') && edgeLabel.endsWith('"')) ||
                        (edgeLabel.startsWith("'") && edgeLabel.endsWith("'"))) {
                        edgeLabel = edgeLabel.slice(1, -1);
                    }
                    edgeLabel = edgeLabel.replace(/#quot;/g, '"');
                }
                const src = this.parseInlineNode(srcPart);
                const tgt = this.parseInlineNode(tgtPart);
                if (!src || !tgt)
                    return null;
                return {
                    sourceId: src.id, sourceLabel: src.label, sourceShape: src.shape,
                    targetId: tgt.id, targetLabel: tgt.label, targetShape: tgt.shape,
                    label: edgeLabel || undefined,
                    type,
                };
            }
        }
        return null;
    }
    /** Parse a node reference that may be just an ID or ID with shape: A, A["text"], A{text}, etc. */
    parseInlineNode(text) {
        const idMatch = text.match(/^(\w+)/);
        if (!idMatch)
            return null;
        const id = idMatch[1];
        const rest = text.slice(id.length).trim();
        if (!rest)
            return { id };
        const parsed = this.parseShapeAndLabel(id, rest);
        if (parsed)
            return { id: parsed.id, label: parsed.label, shape: parsed.shape };
        return { id };
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: MermaidDeserializerService, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: MermaidDeserializerService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: MermaidDeserializerService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }] });

class LayoutService {
    applyLayout(model) {
        const result = cloneModel(model);
        const g = new dagre.graphlib.Graph();
        g.setGraph({
            rankdir: this.directionToRankdir(model.direction),
            nodesep: 60,
            ranksep: 80,
            marginx: 40,
            marginy: 40,
        });
        g.setDefaultEdgeLabel(() => ({}));
        for (const node of result.nodes.values()) {
            const size = getDefaultSize(node.shape);
            // Estimate wider nodes for longer labels
            const estWidth = Math.max(size.width, node.label.length * 9 + 30);
            g.setNode(node.id, { width: estWidth, height: size.height });
        }
        for (const edge of result.edges) {
            g.setEdge(edge.sourceId, edge.targetId);
        }
        dagre.layout(g);
        for (const node of result.nodes.values()) {
            const dagreNode = g.node(node.id);
            if (dagreNode) {
                node.x = dagreNode.x - dagreNode.width / 2;
                node.y = dagreNode.y - dagreNode.height / 2;
                node.width = dagreNode.width;
                node.height = dagreNode.height;
            }
        }
        return result;
    }
    directionToRankdir(dir) {
        switch (dir) {
            case 'TD': return 'TB';
            case 'LR': return 'LR';
            case 'RL': return 'RL';
            case 'BT': return 'BT';
        }
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: LayoutService, deps: [], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: LayoutService, providedIn: 'root' });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: LayoutService, decorators: [{
            type: Injectable,
            args: [{ providedIn: 'root' }]
        }] });

class GraphStateService {
    serializer;
    deserializer;
    layout;
    model = signal(createEmptyModel());
    mermaidText = signal('flowchart TD\n');
    changeSource = signal('none');
    /**
     * Monotonically increasing version that bumps on every text-originated change.
     * The canvas effect watches this instead of changeSource (which resets too fast).
     */
    textVersion = signal(0);
    /** Selection state — updated by canvas component */
    selectionCount = signal(0);
    hasSelectedVertices = signal(false);
    hasSelectedEdges = signal(false);
    selectedEdgeType = signal(null);
    hasSelection = computed(() => this.selectionCount() > 0);
    /** Current interaction mode */
    canvasMode = signal('select');
    /** When true, all interaction is disabled */
    disabled = signal(false);
    nodeCounter = 0;
    constructor(serializer, deserializer, layout) {
        this.serializer = serializer;
        this.deserializer = deserializer;
        this.layout = layout;
    }
    /** Called when the visual canvas changes the model */
    updateFromCanvas(model) {
        this.changeSource.set('canvas');
        this.model.set(model);
        this.mermaidText.set(this.serializer.serialize(model));
        queueMicrotask(() => this.changeSource.set('none'));
    }
    /** Called when the text editor content changes */
    updateFromText(text) {
        const parsed = this.deserializer.deserialize(text);
        if (!parsed)
            return;
        this.changeSource.set('text');
        const laid = this.layout.applyLayout(parsed);
        this.model.set(laid);
        this.mermaidText.set(text);
        // Bump version so the canvas effect knows to sync
        this.textVersion.update(v => v + 1);
        queueMicrotask(() => this.changeSource.set('none'));
    }
    /** Set initial state from input binding */
    initFromText(text) {
        if (!text || !text.trim()) {
            this.model.set(createEmptyModel());
            this.mermaidText.set('');
            this.nodeCounter = 0;
            return;
        }
        const parsed = this.deserializer.deserialize(text);
        if (!parsed)
            return;
        const laid = this.layout.applyLayout(parsed);
        this.model.set(laid);
        this.mermaidText.set(this.serializer.serialize(laid));
        for (const id of laid.nodes.keys()) {
            this.trackNodeId(id);
        }
    }
    setDirection(dir) {
        const current = cloneModel(this.model());
        current.direction = dir;
        const laid = this.layout.applyLayout(current);
        this.changeSource.set('canvas');
        this.model.set(laid);
        this.mermaidText.set(this.serializer.serialize(laid));
        queueMicrotask(() => this.changeSource.set('none'));
    }
    generateNodeId() {
        const id = this.toAlphaId(this.nodeCounter++);
        return id;
    }
    trackNodeId(id) {
        // If the ID is a simple alpha ID, update counter
        const num = this.fromAlphaId(id);
        if (num !== null && num >= this.nodeCounter) {
            this.nodeCounter = num + 1;
        }
    }
    /** Convert number to A, B, ..., Z, AA, AB, ... */
    toAlphaId(n) {
        let result = '';
        let num = n;
        do {
            result = String.fromCharCode(65 + (num % 26)) + result;
            num = Math.floor(num / 26) - 1;
        } while (num >= 0);
        return result;
    }
    fromAlphaId(id) {
        if (!/^[A-Z]+$/.test(id))
            return null;
        let result = 0;
        for (let i = 0; i < id.length; i++) {
            result = result * 26 + (id.charCodeAt(i) - 64);
        }
        return result - 1;
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: GraphStateService, deps: [{ token: MermaidSerializerService }, { token: MermaidDeserializerService }, { token: LayoutService }], target: i0.ɵɵFactoryTarget.Injectable });
    static ɵprov = i0.ɵɵngDeclareInjectable({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: GraphStateService });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: GraphStateService, decorators: [{
            type: Injectable
        }], ctorParameters: () => [{ type: MermaidSerializerService }, { type: MermaidDeserializerService }, { type: LayoutService }] });

class CanvasComponent {
    containerRef;
    portOverlayRef;
    minimapRef;
    graph;
    undoManager;
    suppressEvents = false;
    contextMenu = null;
    radialMenu = null;
    radialMenuItems = [
        { shape: 'rectangle', label: 'Process' },
        { shape: 'rounded', label: 'Start/End' },
        { shape: 'diamond', label: 'Decision' },
        { shape: 'circle', label: 'Event' },
        { shape: 'stadium', label: 'Terminal' },
        { shape: 'hexagon', label: 'Prepare' },
        { shape: 'cylinder', label: 'Database' },
        { shape: 'trapezoid', label: 'Manual' },
    ];
    clipboardCells = [];
    documentListeners = [];
    // Port hover indicator
    hoveredCell = null;
    // Rubberband (drag-to-select) handler reference
    rubberband;
    wheelTimeout = null;
    // Pan state (mode pan, spacebar pan, or middle-click pan)
    isPanning = false;
    panStartX = 0;
    panStartY = 0;
    panStartTranslateX = 0;
    panStartTranslateY = 0;
    isSpaceHeld = false;
    isMiddleMousePan = false;
    state = inject(GraphStateService);
    layoutService = inject(LayoutService);
    zone = inject(NgZone);
    injector = inject(Injector);
    cdr = inject(ChangeDetectorRef);
    ngAfterViewInit() {
        this.zone.runOutsideAngular(() => this.initGraph());
        // Watch for model changes from text editor.
        // We track textVersion (a monotonic counter) so the effect fires reliably
        // even after changeSource resets to 'none'.
        runInInjectionContext(this.injector, () => {
            let lastTextVersion = this.state.textVersion();
            effect(() => {
                const version = this.state.textVersion();
                const model = this.state.model();
                if (version !== lastTextVersion) {
                    lastTextVersion = version;
                    this.zone.runOutsideAngular(() => this.syncFromModel(model));
                }
            });
            // React to mode changes
            effect(() => {
                const mode = this.state.canvasMode();
                this.zone.runOutsideAngular(() => this.applyMode(mode));
            });
            // React to disabled state
            effect(() => {
                const disabled = this.state.disabled();
                this.zone.runOutsideAngular(() => {
                    this.graph.setEnabled(!disabled);
                    if (disabled) {
                        this.containerRef.nativeElement.style.cursor = 'default';
                    }
                });
            });
        });
    }
    initGraph() {
        const container = this.containerRef.nativeElement;
        // Suppress browser context menu — we handle it ourselves via onContextMenu()
        container.addEventListener('contextmenu', (e) => e.preventDefault());
        // Close context menu on any click outside it.
        // Two listeners work together:
        // 1) Capture-phase on the container — fires for canvas clicks before maxGraph
        //    can stopPropagation(). The context menu is a sibling of the container,
        //    so menu clicks never reach this listener — no filtering needed.
        // 2) Capture-phase on document — catches clicks outside the component entirely
        //    (toolbar, text editor, preview). Must check target isn't inside the menu.
        const dismissMenus = () => {
            if (this.contextMenu || this.radialMenu) {
                this.contextMenu = null;
                this.radialMenu = null;
                this.cdr.detectChanges();
            }
        };
        container.addEventListener('mousedown', dismissMenus, true);
        const dismissIfOutsideMenu = (e) => {
            const target = e.target;
            if (this.contextMenu && !target.closest('.context-menu')) {
                this.contextMenu = null;
                this.cdr.detectChanges();
            }
            if (this.radialMenu && !target.closest('.radial-menu')) {
                this.radialMenu = null;
                this.cdr.detectChanges();
            }
        };
        document.addEventListener('mousedown', dismissIfOutsideMenu, true);
        this.documentListeners.push(() => document.removeEventListener('mousedown', dismissIfOutsideMenu, true));
        // Register custom trapezoid shape
        if (!ShapeRegistry.get('trapezoid')) {
            class TrapezoidShape extends HexagonShape {
                redrawPath(c, x, y, w, h) {
                    this.addPoints(c, [
                        new Point(0.15 * w, 0),
                        new Point(0.85 * w, 0),
                        new Point(w, h),
                        new Point(0, h),
                    ], this.isRounded, this.getBaseArcSize(), true);
                }
            }
            ShapeRegistry.add('trapezoid', TrapezoidShape);
        }
        this.graph = new Graph(container);
        const g = this.graph;
        // Enable features
        g.setGridEnabled(true);
        g.setGridSize(10);
        g.setPanning(true);
        g.setConnectable(true);
        g.setAllowDanglingEdges(false);
        g.setCellsEditable(true);
        g.setHtmlLabels(true);
        // Snap to grid and enable alignment guides
        const selectionHandler = g.getPlugin('SelectionHandler');
        selectionHandler?.setMoveEnabled(true);
        if (selectionHandler) {
            selectionHandler.guidesEnabled = true;
        }
        // Enable rubberband selection
        this.rubberband = new RubberBandHandler(g);
        // Keyboard shortcuts
        const keyHandler = new KeyHandler(g);
        // Delete/Backspace to remove
        keyHandler.bindKey(46, () => g.isEnabled() && g.removeCells());
        keyHandler.bindKey(8, () => g.isEnabled() && g.removeCells());
        // Global fallback: catch Backspace/Delete even when container isn't focused
        const onDeleteKey = (e) => {
            if ((e.key === 'Backspace' || e.key === 'Delete') && g.isEnabled() && !g.isEditing()) {
                const tag = e.target?.tagName;
                if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable)
                    return;
                const selected = g.getSelectionCells();
                if (selected.length > 0) {
                    e.preventDefault();
                    g.removeCells();
                }
            }
        };
        document.addEventListener('keydown', onDeleteKey);
        this.documentListeners.push(() => document.removeEventListener('keydown', onDeleteKey));
        // Ctrl+Z undo, Ctrl+Y redo
        keyHandler.bindControlKey(90, () => this.undo()); // Ctrl+Z
        keyHandler.bindControlKey(89, () => this.redo()); // Ctrl+Y
        // Ctrl+A select all
        keyHandler.bindControlKey(65, () => {
            g.selectAll();
        });
        // Ctrl+Shift+Z redo (alternative)
        keyHandler.bindControlShiftKey(90, () => this.redo());
        // Ctrl/Cmd+C copy, Ctrl/Cmd+V paste
        keyHandler.bindControlKey(67, () => this.copyCells()); // C
        keyHandler.bindControlKey(86, () => this.zone.run(() => this.pasteCells())); // V
        // Mode shortcuts: V=select, H=pan
        keyHandler.bindKey(86, () => this.zone.run(() => this.state.canvasMode.set('select'))); // V
        keyHandler.bindKey(72, () => this.zone.run(() => this.state.canvasMode.set('pan'))); // H
        // Override isControlDown to also recognize Cmd (metaKey) on Mac
        keyHandler.isControlDown = (evt) => evt.ctrlKey || evt.metaKey;
        // Setup undo manager
        this.undoManager = new UndoManager();
        const listener = (_sender, evt) => {
            this.undoManager.undoableEditHappened(evt.getProperty('edit'));
        };
        g.getDataModel().addListener(InternalEvent.UNDO, listener);
        g.getView().addListener(InternalEvent.UNDO, listener);
        // Clear port indicators when cells are being moved
        g.addListener(InternalEvent.MOVE_CELLS, () => {
            this.hoveredCell = null;
            this.portOverlayRef.nativeElement.innerHTML = '';
        });
        // Track selection changes for contextual toolbar
        g.getSelectionModel().addListener(InternalEvent.CHANGE, () => {
            this.zone.run(() => this.updateSelectionState());
        });
        // Listen for model changes and propagate to state
        g.getDataModel().addListener(InternalEvent.CHANGE, () => {
            if (!this.suppressEvents && this.state.changeSource() !== 'text') {
                this.zone.run(() => this.extractAndPushModel());
            }
        });
        // Override getLabel to return cell value
        g.convertValueToString = (cell) => {
            return cell.getValue() ?? '';
        };
        // Handle label editing
        const origLabelChanged = g.cellLabelChanged.bind(g);
        g.cellLabelChanged = (cell, newValue, autoSize) => {
            origLabelChanged(cell, newValue, autoSize);
            if (!this.suppressEvents) {
                this.zone.run(() => this.extractAndPushModel());
            }
        };
        // Double-click handling: empty canvas = show radial shape menu, edge = edit label
        g.addListener(InternalEvent.DOUBLE_CLICK, (_sender, evt) => {
            const cell = evt.getProperty('cell');
            if (!cell) {
                const mouseEvt = evt.getProperty('event');
                const rect = container.getBoundingClientRect();
                const pt = g.getPointForEvent(mouseEvt);
                this.zone.run(() => {
                    this.radialMenu = {
                        x: mouseEvt.clientX - rect.left,
                        y: mouseEvt.clientY - rect.top,
                        graphX: pt.x,
                        graphY: pt.y,
                    };
                    this.cdr.detectChanges();
                });
                evt.consume();
            }
            else if (cell.isEdge()) {
                g.startEditingAtCell(cell);
                evt.consume();
            }
        });
        // Define connection points on vertices (N, S, E, W)
        g.getAllConnectionConstraints = (terminal) => {
            if (terminal?.cell?.isVertex()) {
                return [
                    new ConnectionConstraint(new Point(0.5, 0), true), // top center
                    new ConnectionConstraint(new Point(1, 0.5), true), // right center
                    new ConnectionConstraint(new Point(0.5, 1), true), // bottom center
                    new ConnectionConstraint(new Point(0, 0.5), true), // left center
                ];
            }
            return [];
        };
        // Configure the connection handler:
        // - Only trigger connections from the border region (not center/text area)
        // - Show crosshair cursor when connection is possible
        const connectionHandler = g.getPlugin('ConnectionHandler');
        if (connectionHandler) {
            connectionHandler.connectImage = null;
            connectionHandler.livePreview = true;
            connectionHandler.cursor = 'crosshair';
            connectionHandler.outlineConnect = true;
            // Override: only start a connection when the mouse is near the cell border
            const origIsStartEvent = connectionHandler.isStartEvent.bind(connectionHandler);
            connectionHandler.isStartEvent = (me) => {
                if (!origIsStartEvent(me))
                    return false;
                // If we have a constraint point, we're on the border — allow it
                if (connectionHandler.constraintHandler?.currentConstraint)
                    return true;
                // Otherwise check if mouse is near the edge of the cell
                const state = connectionHandler.previous;
                if (!state)
                    return false;
                const x = me.getGraphX();
                const y = me.getGraphY();
                const border = 12 / g.getView().getScale();
                const nearLeft = x - state.x < border;
                const nearRight = state.x + state.width - x < border;
                const nearTop = y - state.y < border;
                const nearBottom = state.y + state.height - y < border;
                return nearLeft || nearRight || nearTop || nearBottom;
            };
        }
        // Set default edge style
        const defaultEdgeStyle = g.getStylesheet().getDefaultEdgeStyle();
        defaultEdgeStyle.endArrow = 'classic';
        defaultEdgeStyle.strokeColor = '#666666';
        defaultEdgeStyle.fontColor = '#666666';
        defaultEdgeStyle.fontSize = 11;
        defaultEdgeStyle.rounded = true;
        defaultEdgeStyle.endFill = true;
        // If state already has a model with nodes, sync it
        const initial = this.state.model();
        if (initial.nodes.size > 0) {
            this.syncFromModel(initial);
        }
        // Initialize minimap
        new Outline(g, this.minimapRef.nativeElement);
        // Accept shape drops from the palette
        container.addEventListener('dragover', (e) => {
            if (e.dataTransfer?.types.includes('application/shape')) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            }
        });
        container.addEventListener('drop', (e) => {
            const shape = e.dataTransfer?.getData('application/shape');
            if (!shape)
                return;
            e.preventDefault();
            const pt = g.getPointForEvent(e);
            const size = getDefaultSize(shape);
            this.zone.run(() => this.addNode(shape, pt.x - size.width / 2, pt.y - size.height / 2));
        });
        // Setup pan and connect mode mouse handlers
        this.setupModeHandlers(container);
    }
    /** Extract current graph state into IR and push to state service */
    extractAndPushModel() {
        const parent = this.graph.getDefaultParent();
        const newModel = {
            direction: this.state.model().direction,
            nodes: new Map(),
            edges: [],
        };
        const childCount = parent.getChildCount();
        let edgeCounter = 0;
        for (let i = 0; i < childCount; i++) {
            const cell = parent.getChildAt(i);
            if (!cell)
                continue;
            if (cell.isVertex()) {
                const geo = cell.getGeometry();
                const style = cell.getStyle();
                const node = {
                    id: cell.getId() ?? `node_${i}`,
                    label: cell.getValue() ?? cell.getId() ?? `node_${i}`,
                    shape: styleToShape(style),
                    x: geo?.x ?? 0,
                    y: geo?.y ?? 0,
                    width: geo?.width ?? 140,
                    height: geo?.height ?? 50,
                };
                newModel.nodes.set(node.id, node);
            }
            else if (cell.isEdge()) {
                const src = cell.getTerminal(true);
                const tgt = cell.getTerminal(false);
                if (src && tgt) {
                    const style = cell.getStyle();
                    const edge = {
                        id: `e${edgeCounter++}`,
                        sourceId: src.getId() ?? '',
                        targetId: tgt.getId() ?? '',
                        label: cell.getValue() || undefined,
                        type: styleToEdgeType(style),
                    };
                    newModel.edges.push(edge);
                }
            }
        }
        this.state.updateFromCanvas(newModel);
    }
    /** Sync maxGraph cells from the IR model (called when text editor changes) */
    syncFromModel(model) {
        this.suppressEvents = true;
        const g = this.graph;
        const parent = g.getDefaultParent();
        // Fully clear the graph by removing all children from the default parent
        const children = parent.getChildren();
        if (children) {
            // Clone array since we're modifying during iteration
            for (const child of [...children]) {
                g.getDataModel().remove(child);
            }
        }
        g.refresh();
        // Now insert fresh cells
        g.getDataModel().beginUpdate();
        try {
            const cellMap = new Map();
            for (const node of model.nodes.values()) {
                const style = getVertexStyle(node.shape);
                const size = getDefaultSize(node.shape);
                const v = g.insertVertex(parent, node.id, node.label, node.x ?? 0, node.y ?? 0, node.width ?? size.width, node.height ?? size.height, style);
                cellMap.set(node.id, v);
            }
            for (const edge of model.edges) {
                const src = cellMap.get(edge.sourceId);
                const tgt = cellMap.get(edge.targetId);
                if (src && tgt) {
                    const style = getEdgeStyle(edge.type);
                    g.insertEdge(parent, edge.id, edge.label ?? '', src, tgt, style);
                }
            }
        }
        finally {
            g.getDataModel().endUpdate();
        }
        this.suppressEvents = false;
    }
    /** Add a node at the given position with the given shape */
    addNode(shape, x, y) {
        const id = this.state.generateNodeId();
        const label = this.defaultLabel(shape, id);
        const size = getDefaultSize(shape);
        const style = getVertexStyle(shape);
        this.graph.batchUpdate(() => {
            this.graph.insertVertex(this.graph.getDefaultParent(), id, label, x, y, size.width, size.height, style);
        });
        // extractAndPushModel will be triggered by the model change listener
    }
    /** Add a node at the center of the visible area */
    addNodeAtCenter(shape) {
        const container = this.containerRef.nativeElement;
        const translate = this.graph.getView().getTranslate();
        const scale = this.graph.getView().getScale();
        const x = (container.clientWidth / 2 - translate.x * scale) / scale - 70;
        const y = (container.clientHeight / 2 - translate.y * scale) / scale - 25;
        this.addNode(shape, x, y);
    }
    onContextMenu(event) {
        event.preventDefault();
        const container = this.containerRef.nativeElement;
        const rect = container.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        // Find cell under cursor
        const pt = this.graph.getPointForEvent(event);
        const cell = this.graph.getCellAt(event.offsetX, event.offsetY);
        if (cell && !this.graph.getSelectionCells().includes(cell)) {
            // Only change selection if the right-clicked cell isn't already selected
            // (preserves multiselect when right-clicking within a selection)
            this.graph.setSelectionCell(cell);
        }
        // Snapshot the selection at context menu open time
        const selectedCells = this.graph.getSelectionCells();
        this.contextMenu = {
            x, y,
            cell: cell ?? null,
            isEdge: cell?.isEdge() ?? false,
            graphX: pt.x - 70,
            graphY: pt.y - 25,
            selectedCells,
        };
    }
    getRadialPosition(index) {
        const total = this.radialMenuItems.length;
        const radius = 80;
        const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
        const x = Math.cos(angle) * radius - 22;
        const y = Math.sin(angle) * radius - 22;
        return `translate(${x}px, ${y}px)`;
    }
    addFromRadial(shape) {
        if (!this.radialMenu)
            return;
        const size = getDefaultSize(shape);
        this.addNode(shape, this.radialMenu.graphX - size.width / 2, this.radialMenu.graphY - size.height / 2);
        this.radialMenu = null;
    }
    closeContextMenu() {
        this.contextMenu = null;
    }
    editLabel() {
        const cell = this.graph.getSelectionCell();
        this.contextMenu = null;
        if (cell) {
            // Delay so the context menu DOM is removed before the editor opens
            setTimeout(() => this.graph.startEditingAtCell(cell), 50);
        }
    }
    addNodeAt(x, y, shape) {
        this.addNode(shape, x, y);
        this.contextMenu = null;
    }
    /** Copy cells from context menu — uses the selection snapshot taken when the menu opened */
    copyFromContext() {
        const cells = this.contextMenu?.selectedCells ?? [];
        if (cells.length > 0) {
            this.clipboardCells = this.graph.cloneCells(cells);
        }
        this.contextMenu = null;
    }
    /** Copy currently selected cells (for keyboard shortcut) */
    copyCells() {
        const cells = this.graph.getSelectionCells();
        if (cells.length > 0) {
            this.clipboardCells = this.graph.cloneCells(cells);
        }
    }
    /** Paste clipboard cells at an offset from their original position */
    pasteCells(offsetX = 20, offsetY = 20) {
        if (this.clipboardCells.length === 0)
            return;
        const g = this.graph;
        const clones = g.cloneCells(this.clipboardCells);
        g.getDataModel().beginUpdate();
        try {
            for (const cell of clones) {
                const geo = cell.getGeometry();
                if (geo) {
                    geo.x += offsetX;
                    geo.y += offsetY;
                }
                g.addCell(cell);
            }
        }
        finally {
            g.getDataModel().endUpdate();
        }
        g.setSelectionCells(clones);
    }
    /** Paste at the position where the context menu was opened */
    pasteAtContext() {
        if (this.clipboardCells.length === 0)
            return;
        const firstGeo = this.clipboardCells[0]?.getGeometry();
        const offsetX = this.contextMenu ? this.contextMenu.graphX - (firstGeo?.x ?? 0) : 20;
        const offsetY = this.contextMenu ? this.contextMenu.graphY - (firstGeo?.y ?? 0) : 20;
        this.pasteCells(offsetX, offsetY);
        this.contextMenu = null;
    }
    updateSelectionState() {
        const cells = this.graph.getSelectionCells();
        const vertices = cells.filter(c => c.isVertex());
        const edges = cells.filter(c => c.isEdge());
        this.state.selectionCount.set(cells.length);
        this.state.hasSelectedVertices.set(vertices.length > 0);
        this.state.hasSelectedEdges.set(edges.length > 0);
        // If exactly one edge type is selected, show it in the dropdown
        if (edges.length > 0) {
            const types = edges.map(e => styleToEdgeType(e.getStyle()));
            const allSame = types.every(t => t === types[0]);
            this.state.selectedEdgeType.set(allSame ? types[0] : null);
        }
        else {
            this.state.selectedEdgeType.set(null);
        }
    }
    deleteSelected() {
        if (this.graph.isEnabled()) {
            this.graph.removeCells();
        }
    }
    /** Apply an edge type to all selected edges */
    setEdgeType(type) {
        const cells = this.graph.getSelectionCells().filter(c => c.isEdge());
        if (cells.length === 0)
            return;
        const style = getEdgeStyle(type);
        this.graph.batchUpdate(() => {
            for (const cell of cells) {
                this.graph.setCellStyle(style, [cell]);
            }
        });
    }
    undo() {
        this.undoManager.undo();
    }
    redo() {
        this.undoManager.redo();
    }
    autoLayout() {
        const current = this.state.model();
        const laid = this.layoutService.applyLayout(current);
        this.syncFromModel(laid);
        this.state.updateFromCanvas(laid);
    }
    zoomIn() {
        this.graph.zoomIn();
    }
    zoomOut() {
        this.graph.zoomOut();
    }
    fitToPage() {
        const g = this.graph;
        const bounds = g.getGraphBounds();
        if (bounds.width === 0 || bounds.height === 0) {
            g.zoomActual();
            return;
        }
        const container = this.containerRef.nativeElement;
        const cw = container.clientWidth;
        const ch = container.clientHeight;
        const padding = 40;
        const scaleX = (cw - padding * 2) / bounds.width;
        const scaleY = (ch - padding * 2) / bounds.height;
        const scale = Math.min(scaleX, scaleY, 1); // Don't zoom beyond 100%
        g.getView().scaleAndTranslate(scale, -bounds.x / scale + padding / scale + (cw / scale - bounds.width) / 2, -bounds.y / scale + padding / scale + (ch / scale - bounds.height) / 2);
    }
    defaultLabel(shape, id) {
        const labels = {
            rectangle: 'Process',
            rounded: 'Step',
            diamond: 'Decision',
            circle: 'Event',
            stadium: 'Terminal',
            parallelogram: 'I/O',
            subroutine: 'Subroutine',
            asymmetric: 'Flag',
            hexagon: 'Prepare',
            cylinder: 'Database',
            trapezoid: 'Manual',
        };
        return `${labels[shape]} ${id}`;
    }
    applyMode(mode) {
        const g = this.graph;
        if (!g)
            return;
        const container = this.containerRef.nativeElement;
        switch (mode) {
            case 'pan':
                g.setConnectable(false);
                g.setCellsSelectable(false);
                g.setCellsMovable(false);
                container.style.cursor = 'grab';
                break;
            default: // 'select'
                g.setConnectable(true);
                g.setCellsSelectable(true);
                g.setCellsMovable(true);
                container.style.cursor = 'default';
                break;
        }
    }
    setupModeHandlers(container) {
        const onMouseDown = (e) => {
            // Middle-click pan (works in any mode)
            if (e.button === 1) {
                this.rubberband.setEnabled(false);
                this.startPan(e, container);
                this.isMiddleMousePan = true;
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            if (e.button !== 0)
                return;
            // Spacebar temporary pan (works in any mode)
            if (this.isSpaceHeld) {
                this.startPan(e, container);
                e.stopPropagation();
                e.preventDefault();
                return;
            }
            const mode = this.state.canvasMode();
            if (mode === 'pan') {
                this.startPan(e, container);
                e.stopPropagation();
                e.preventDefault();
            }
        };
        const onMouseMove = (e) => {
            if (this.isPanning) {
                const dx = e.clientX - this.panStartX;
                const dy = e.clientY - this.panStartY;
                const scale = this.graph.getView().getScale();
                this.graph.getView().setTranslate(this.panStartTranslateX + dx / scale, this.panStartTranslateY + dy / scale);
                e.preventDefault();
                return;
            }
            // Show port dots on hover
            if (this.state.canvasMode() === 'select' && !this.graph.isEditing()) {
                this.updatePortHover(e);
            }
        };
        const onMouseUp = (_e) => {
            if (this.isPanning) {
                this.isPanning = false;
                if (this.isMiddleMousePan) {
                    this.isMiddleMousePan = false;
                    this.rubberband.setEnabled(true);
                }
                const currentMode = this.state.canvasMode();
                if (this.isSpaceHeld) {
                    container.style.cursor = 'grab';
                }
                else if (currentMode === 'pan') {
                    container.style.cursor = 'grab';
                }
                else {
                    container.style.cursor = 'default';
                }
                return;
            }
        };
        // Wheel: Ctrl/Cmd + wheel = zoom, plain wheel = pan
        // Disable rubberband during wheel to prevent selection highlight
        const onWheel = (e) => {
            e.preventDefault();
            this.rubberband.setEnabled(false);
            clearTimeout(this.wheelTimeout);
            this.wheelTimeout = setTimeout(() => this.rubberband.setEnabled(true), 150);
            if (e.ctrlKey || e.metaKey) {
                const rect = container.getBoundingClientRect();
                const offsetX = e.clientX - rect.left;
                const offsetY = e.clientY - rect.top;
                this.zoomAtPoint(e.deltaY < 0, offsetX, offsetY);
            }
            else {
                const view = this.graph.getView();
                const scale = view.getScale();
                const translate = view.getTranslate();
                view.setTranslate(translate.x - e.deltaX / scale, translate.y - e.deltaY / scale);
            }
        };
        // Spacebar pan
        const onKeyDown = (e) => {
            if (e.code === 'Space' && !this.isSpaceHeld && !this.graph.isEditing()) {
                this.isSpaceHeld = true;
                container.style.cursor = 'grab';
                e.preventDefault();
            }
        };
        const onKeyUp = (e) => {
            if (e.code === 'Space') {
                e.preventDefault();
                this.isSpaceHeld = false;
                if (!this.isPanning) {
                    const mode = this.state.canvasMode();
                    container.style.cursor = mode === 'pan' ? 'grab' : 'default';
                }
            }
        };
        container.addEventListener('mousedown', onMouseDown, true);
        container.addEventListener('wheel', onWheel, { passive: false });
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('keydown', onKeyDown);
        document.addEventListener('keyup', onKeyUp);
        this.documentListeners.push(() => document.removeEventListener('mousemove', onMouseMove), () => document.removeEventListener('mouseup', onMouseUp), () => document.removeEventListener('keydown', onKeyDown), () => document.removeEventListener('keyup', onKeyUp));
    }
    startPan(e, container) {
        this.isPanning = true;
        this.panStartX = e.clientX;
        this.panStartY = e.clientY;
        const translate = this.graph.getView().getTranslate();
        this.panStartTranslateX = translate.x;
        this.panStartTranslateY = translate.y;
        container.style.cursor = 'grabbing';
    }
    zoomAtPoint(zoomIn, offsetX, offsetY) {
        const g = this.graph;
        const view = g.getView();
        const scale = view.getScale();
        const factor = zoomIn ? 1.15 : 1 / 1.15;
        const newScale = scale * factor;
        const translate = view.getTranslate();
        const dx = offsetX / scale - offsetX / newScale;
        const dy = offsetY / scale - offsetY / newScale;
        view.scaleAndTranslate(newScale, translate.x - dx, translate.y - dy);
    }
    // --- Port hover indicators (visual only, no click handling) ---
    updatePortHover(e) {
        const container = this.containerRef.nativeElement;
        const rect = container.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        // If we already have a hovered cell, keep showing its ports until
        // the mouse actually leaves its bounding box
        if (this.hoveredCell) {
            if (this.isInsideCellBounds(this.hoveredCell, mouseX, mouseY)) {
                return;
            }
            // Mouse left the cell bounds — clear and check for new target
            this.hoveredCell = null;
            this.portOverlayRef.nativeElement.innerHTML = '';
        }
        const cell = this.graph.getCellAt(mouseX, mouseY);
        const hoverTarget = cell?.isVertex() ? cell : null;
        if (hoverTarget) {
            this.hoveredCell = hoverTarget;
            this.renderPorts(hoverTarget);
        }
    }
    isInsideCellBounds(cell, screenX, screenY) {
        const state = this.graph.getView().getState(cell);
        if (!state)
            return false;
        const padding = 8;
        return screenX >= state.x - padding && screenX <= state.x + state.width + padding &&
            screenY >= state.y - padding && screenY <= state.y + state.height + padding;
    }
    renderPorts(cell) {
        const svg = this.portOverlayRef.nativeElement;
        svg.innerHTML = '';
        if (!cell)
            return;
        const state = this.graph.getView().getState(cell);
        if (!state)
            return;
        const constraints = [
            { px: 0.5, py: 0 },
            { px: 1, py: 0.5 },
            { px: 0.5, py: 1 },
            { px: 0, py: 0.5 },
        ];
        for (const c of constraints) {
            const x = state.x + state.width * c.px;
            const y = state.y + state.height * c.py;
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', String(x));
            circle.setAttribute('cy', String(y));
            circle.setAttribute('r', '5');
            circle.setAttribute('fill', '#555');
            circle.setAttribute('stroke', '#fff');
            circle.setAttribute('stroke-width', '1.5');
            circle.setAttribute('opacity', '0.8');
            svg.appendChild(circle);
        }
    }
    ngOnDestroy() {
        this.documentListeners.forEach(fn => fn());
        this.graph?.destroy();
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: CanvasComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "19.2.20", type: CanvasComponent, isStandalone: true, selector: "lib-canvas", viewQueries: [{ propertyName: "containerRef", first: true, predicate: ["graphContainer"], descendants: true, static: true }, { propertyName: "portOverlayRef", first: true, predicate: ["portOverlay"], descendants: true, static: true }, { propertyName: "minimapRef", first: true, predicate: ["minimapContainer"], descendants: true, static: true }], ngImport: i0, template: `
    <div #graphContainer class="graph-container" (contextmenu)="onContextMenu($event)"></div>
    <svg #portOverlay class="port-overlay"></svg>
    <div #minimapContainer class="minimap"></div>
    @if (radialMenu) {
      <div class="radial-menu" [style.left.px]="radialMenu.x" [style.top.px]="radialMenu.y">
        @for (item of radialMenuItems; track item.shape; let i = $index) {
          <button
            class="radial-item"
            [style.transform]="getRadialPosition(i)"
            [title]="item.label"
            (mousedown)="addFromRadial(item.shape); $event.stopPropagation()"
          >
            <svg viewBox="0 0 32 24" class="radial-icon">
              @switch (item.shape) {
                @case ('rectangle') { <rect x="2" y="2" width="28" height="20" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/> }
                @case ('rounded') { <rect x="2" y="2" width="28" height="20" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/> }
                @case ('diamond') { <polygon points="16,1 31,12 16,23 1,12" fill="none" stroke="currentColor" stroke-width="1.5"/> }
                @case ('circle') { <ellipse cx="16" cy="12" rx="12" ry="10" fill="none" stroke="currentColor" stroke-width="1.5"/> }
                @case ('stadium') { <rect x="2" y="2" width="28" height="20" rx="10" fill="none" stroke="currentColor" stroke-width="1.5"/> }
                @case ('hexagon') { <polygon points="8,1 24,1 31,12 24,23 8,23 1,12" fill="none" stroke="currentColor" stroke-width="1.5"/> }
                @case ('cylinder') { <path d="M6,6 Q16,2 26,6 L26,18 Q16,22 6,18 Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6,6 Q16,10 26,6" fill="none" stroke="currentColor" stroke-width="1"/> }
                @case ('trapezoid') { <polygon points="6,2 26,2 30,22 2,22" fill="none" stroke="currentColor" stroke-width="1.5"/> }
              }
            </svg>
            <span class="radial-label">{{ item.label }}</span>
          </button>
        }
      </div>
    }
    @if (contextMenu) {
      <div class="context-menu" [style.left.px]="contextMenu.x" [style.top.px]="contextMenu.y">
        @if (contextMenu.cell) {
          <button class="ctx-item" (mousedown)="editLabel()">Edit Label</button>
          @if (contextMenu.isEdge) {
            <div class="ctx-divider"></div>
            <button class="ctx-item" (mousedown)="setEdgeType('arrow'); closeContextMenu()">→ Solid Arrow</button>
            <button class="ctx-item" (mousedown)="setEdgeType('dotted-arrow'); closeContextMenu()">⇢ Dashed Arrow</button>
            <button class="ctx-item" (mousedown)="setEdgeType('thick-arrow'); closeContextMenu()">⇒ Thick Arrow</button>
            <button class="ctx-item" (mousedown)="setEdgeType('open'); closeContextMenu()">— No Arrow</button>
          }
          <div class="ctx-divider"></div>
          <button class="ctx-item" (mousedown)="copyFromContext()">Copy</button>
          <button class="ctx-item danger" (mousedown)="deleteSelected(); closeContextMenu()">Delete</button>
        } @else {
          <button class="ctx-item" (mousedown)="addNodeAt(contextMenu.graphX, contextMenu.graphY, 'rectangle')">Add Process</button>
          <button class="ctx-item" (mousedown)="addNodeAt(contextMenu.graphX, contextMenu.graphY, 'diamond')">Add Decision</button>
          <button class="ctx-item" (mousedown)="addNodeAt(contextMenu.graphX, contextMenu.graphY, 'rounded')">Add Start/End</button>
          @if (clipboardCells.length > 0) {
            <div class="ctx-divider"></div>
            <button class="ctx-item" (mousedown)="pasteAtContext()">Paste</button>
          }
        }
      </div>
    }
  `, isInline: true, styles: [":host{display:block;width:100%;height:100%;position:relative;-webkit-user-select:none;user-select:none}.graph-container{width:100%;height:100%;overflow:hidden;cursor:default;position:relative;background-color:#f8f9fa;background-image:radial-gradient(circle,#d0d0d0 1px,transparent 1px);background-size:20px 20px;-webkit-user-select:none;user-select:none}.port-overlay{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;overflow:visible}:host ::ng-deep .mxCellEditor{background:#fff!important;border:2px solid #4a90d9!important;border-radius:3px;padding:2px 4px!important;font-family:Inter,system-ui,sans-serif;font-size:13px;outline:none;box-shadow:0 2px 8px #00000026;overflow:visible!important}:host ::ng-deep .mxRubberband{position:absolute;background:#4a90d91f;border:1.5px solid rgba(74,144,217,.6);border-radius:2px;pointer-events:none}.minimap{position:absolute;bottom:8px;right:8px;width:150px;height:110px;border:1px solid #ccc;border-radius:4px;background:#fff;opacity:.85;overflow:hidden;z-index:10}.radial-menu{position:absolute;z-index:1000;width:0;height:0}.radial-item{position:absolute;width:44px;height:44px;border-radius:8px;border:1px solid #d0d0d0;background:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;box-shadow:0 2px 6px #0000001f;transition:background .12s;color:#444;padding:2px}.radial-item:hover{background:#f0f4ff;border-color:#999}.radial-icon{width:20px;height:14px}.radial-label{font-size:7px;line-height:1;color:#666;white-space:nowrap}.context-menu{position:absolute;z-index:1000;background:#fff;border:1px solid #d0d0d0;border-radius:6px;box-shadow:0 4px 12px #00000026;padding:4px 0;min-width:160px}.ctx-item{display:block;width:100%;padding:6px 14px;font-size:12px;text-align:left;border:none;background:none;cursor:pointer;color:#333}.ctx-item:hover{background:#f0f4ff}.ctx-item.danger{color:#c33}.ctx-item.danger:hover{background:#fff0f0}.ctx-divider{height:1px;background:#e8e8e8;margin:4px 0}\n"] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: CanvasComponent, decorators: [{
            type: Component,
            args: [{ selector: 'lib-canvas', standalone: true, template: `
    <div #graphContainer class="graph-container" (contextmenu)="onContextMenu($event)"></div>
    <svg #portOverlay class="port-overlay"></svg>
    <div #minimapContainer class="minimap"></div>
    @if (radialMenu) {
      <div class="radial-menu" [style.left.px]="radialMenu.x" [style.top.px]="radialMenu.y">
        @for (item of radialMenuItems; track item.shape; let i = $index) {
          <button
            class="radial-item"
            [style.transform]="getRadialPosition(i)"
            [title]="item.label"
            (mousedown)="addFromRadial(item.shape); $event.stopPropagation()"
          >
            <svg viewBox="0 0 32 24" class="radial-icon">
              @switch (item.shape) {
                @case ('rectangle') { <rect x="2" y="2" width="28" height="20" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/> }
                @case ('rounded') { <rect x="2" y="2" width="28" height="20" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/> }
                @case ('diamond') { <polygon points="16,1 31,12 16,23 1,12" fill="none" stroke="currentColor" stroke-width="1.5"/> }
                @case ('circle') { <ellipse cx="16" cy="12" rx="12" ry="10" fill="none" stroke="currentColor" stroke-width="1.5"/> }
                @case ('stadium') { <rect x="2" y="2" width="28" height="20" rx="10" fill="none" stroke="currentColor" stroke-width="1.5"/> }
                @case ('hexagon') { <polygon points="8,1 24,1 31,12 24,23 8,23 1,12" fill="none" stroke="currentColor" stroke-width="1.5"/> }
                @case ('cylinder') { <path d="M6,6 Q16,2 26,6 L26,18 Q16,22 6,18 Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6,6 Q16,10 26,6" fill="none" stroke="currentColor" stroke-width="1"/> }
                @case ('trapezoid') { <polygon points="6,2 26,2 30,22 2,22" fill="none" stroke="currentColor" stroke-width="1.5"/> }
              }
            </svg>
            <span class="radial-label">{{ item.label }}</span>
          </button>
        }
      </div>
    }
    @if (contextMenu) {
      <div class="context-menu" [style.left.px]="contextMenu.x" [style.top.px]="contextMenu.y">
        @if (contextMenu.cell) {
          <button class="ctx-item" (mousedown)="editLabel()">Edit Label</button>
          @if (contextMenu.isEdge) {
            <div class="ctx-divider"></div>
            <button class="ctx-item" (mousedown)="setEdgeType('arrow'); closeContextMenu()">→ Solid Arrow</button>
            <button class="ctx-item" (mousedown)="setEdgeType('dotted-arrow'); closeContextMenu()">⇢ Dashed Arrow</button>
            <button class="ctx-item" (mousedown)="setEdgeType('thick-arrow'); closeContextMenu()">⇒ Thick Arrow</button>
            <button class="ctx-item" (mousedown)="setEdgeType('open'); closeContextMenu()">— No Arrow</button>
          }
          <div class="ctx-divider"></div>
          <button class="ctx-item" (mousedown)="copyFromContext()">Copy</button>
          <button class="ctx-item danger" (mousedown)="deleteSelected(); closeContextMenu()">Delete</button>
        } @else {
          <button class="ctx-item" (mousedown)="addNodeAt(contextMenu.graphX, contextMenu.graphY, 'rectangle')">Add Process</button>
          <button class="ctx-item" (mousedown)="addNodeAt(contextMenu.graphX, contextMenu.graphY, 'diamond')">Add Decision</button>
          <button class="ctx-item" (mousedown)="addNodeAt(contextMenu.graphX, contextMenu.graphY, 'rounded')">Add Start/End</button>
          @if (clipboardCells.length > 0) {
            <div class="ctx-divider"></div>
            <button class="ctx-item" (mousedown)="pasteAtContext()">Paste</button>
          }
        }
      </div>
    }
  `, styles: [":host{display:block;width:100%;height:100%;position:relative;-webkit-user-select:none;user-select:none}.graph-container{width:100%;height:100%;overflow:hidden;cursor:default;position:relative;background-color:#f8f9fa;background-image:radial-gradient(circle,#d0d0d0 1px,transparent 1px);background-size:20px 20px;-webkit-user-select:none;user-select:none}.port-overlay{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:5;overflow:visible}:host ::ng-deep .mxCellEditor{background:#fff!important;border:2px solid #4a90d9!important;border-radius:3px;padding:2px 4px!important;font-family:Inter,system-ui,sans-serif;font-size:13px;outline:none;box-shadow:0 2px 8px #00000026;overflow:visible!important}:host ::ng-deep .mxRubberband{position:absolute;background:#4a90d91f;border:1.5px solid rgba(74,144,217,.6);border-radius:2px;pointer-events:none}.minimap{position:absolute;bottom:8px;right:8px;width:150px;height:110px;border:1px solid #ccc;border-radius:4px;background:#fff;opacity:.85;overflow:hidden;z-index:10}.radial-menu{position:absolute;z-index:1000;width:0;height:0}.radial-item{position:absolute;width:44px;height:44px;border-radius:8px;border:1px solid #d0d0d0;background:#fff;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;box-shadow:0 2px 6px #0000001f;transition:background .12s;color:#444;padding:2px}.radial-item:hover{background:#f0f4ff;border-color:#999}.radial-icon{width:20px;height:14px}.radial-label{font-size:7px;line-height:1;color:#666;white-space:nowrap}.context-menu{position:absolute;z-index:1000;background:#fff;border:1px solid #d0d0d0;border-radius:6px;box-shadow:0 4px 12px #00000026;padding:4px 0;min-width:160px}.ctx-item{display:block;width:100%;padding:6px 14px;font-size:12px;text-align:left;border:none;background:none;cursor:pointer;color:#333}.ctx-item:hover{background:#f0f4ff}.ctx-item.danger{color:#c33}.ctx-item.danger:hover{background:#fff0f0}.ctx-divider{height:1px;background:#e8e8e8;margin:4px 0}\n"] }]
        }], propDecorators: { containerRef: [{
                type: ViewChild,
                args: ['graphContainer', { static: true }]
            }], portOverlayRef: [{
                type: ViewChild,
                args: ['portOverlay', { static: true }]
            }], minimapRef: [{
                type: ViewChild,
                args: ['minimapContainer', { static: true }]
            }] } });

class ShapePaletteComponent {
    shapeSelected = output();
    onDragStart(event, shape) {
        event.dataTransfer?.setData('application/shape', shape);
        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'copy';
        }
    }
    shapes = [
        { shape: 'rectangle', label: 'Process' },
        { shape: 'rounded', label: 'Start/End' },
        { shape: 'diamond', label: 'Decision' },
        { shape: 'circle', label: 'Event' },
        { shape: 'stadium', label: 'Terminal' },
        { shape: 'hexagon', label: 'Prepare' },
        { shape: 'cylinder', label: 'Database' },
        { shape: 'trapezoid', label: 'Manual' },
    ];
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: ShapePaletteComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "19.2.20", type: ShapePaletteComponent, isStandalone: true, selector: "lib-shape-palette", outputs: { shapeSelected: "shapeSelected" }, ngImport: i0, template: `
    <div class="palette">
      <div class="palette-title">Shapes</div>
      @for (opt of shapes; track opt.shape) {
        <button
          class="palette-item"
          [title]="opt.label"
          draggable="true"
          (dragstart)="onDragStart($event, opt.shape)"
          (click)="shapeSelected.emit(opt.shape)"
        >
          <svg viewBox="0 0 40 30" class="shape-icon">
            @switch (opt.shape) {
              @case ('rectangle') {
                <rect x="4" y="4" width="32" height="22" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
              }
              @case ('rounded') {
                <rect x="4" y="4" width="32" height="22" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
              }
              @case ('diamond') {
                <polygon points="20,2 38,15 20,28 2,15" fill="none" stroke="currentColor" stroke-width="1.5"/>
              }
              @case ('circle') {
                <ellipse cx="20" cy="15" rx="14" ry="12" fill="none" stroke="currentColor" stroke-width="1.5"/>
              }
              @case ('stadium') {
                <rect x="4" y="4" width="32" height="22" rx="11" fill="none" stroke="currentColor" stroke-width="1.5"/>
              }
              @case ('hexagon') {
                <polygon points="10,2 30,2 38,15 30,28 10,28 2,15" fill="none" stroke="currentColor" stroke-width="1.5"/>
              }
              @case ('cylinder') {
                <path d="M8,8 Q20,2 32,8 L32,22 Q20,28 8,22 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
                <path d="M8,8 Q20,14 32,8" fill="none" stroke="currentColor" stroke-width="1"/>
              }
              @case ('trapezoid') {
                <polygon points="8,4 32,4 38,26 2,26" fill="none" stroke="currentColor" stroke-width="1.5"/>
              }
            }
          </svg>
          <span class="palette-label">{{ opt.label }}</span>
        </button>
      }
    </div>
  `, isInline: true, styles: [".palette{display:flex;flex-direction:column;gap:2px;padding:8px;background:#fff;border-right:1px solid #e0e0e0;width:80px;min-width:80px;overflow-y:auto}.palette-title{font-size:10px;font-weight:600;text-transform:uppercase;color:#888;padding:4px 0;letter-spacing:.5px}.palette-item{display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 4px;border:1px solid transparent;border-radius:4px;background:none;cursor:pointer;color:#555;transition:all .15s}.palette-item:hover{background:#f0f4ff;border-color:#c0d0f0;color:#333}.shape-icon{width:36px;height:28px}.palette-label{font-size:9px;line-height:1}\n"] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: ShapePaletteComponent, decorators: [{
            type: Component,
            args: [{ selector: 'lib-shape-palette', standalone: true, template: `
    <div class="palette">
      <div class="palette-title">Shapes</div>
      @for (opt of shapes; track opt.shape) {
        <button
          class="palette-item"
          [title]="opt.label"
          draggable="true"
          (dragstart)="onDragStart($event, opt.shape)"
          (click)="shapeSelected.emit(opt.shape)"
        >
          <svg viewBox="0 0 40 30" class="shape-icon">
            @switch (opt.shape) {
              @case ('rectangle') {
                <rect x="4" y="4" width="32" height="22" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
              }
              @case ('rounded') {
                <rect x="4" y="4" width="32" height="22" rx="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
              }
              @case ('diamond') {
                <polygon points="20,2 38,15 20,28 2,15" fill="none" stroke="currentColor" stroke-width="1.5"/>
              }
              @case ('circle') {
                <ellipse cx="20" cy="15" rx="14" ry="12" fill="none" stroke="currentColor" stroke-width="1.5"/>
              }
              @case ('stadium') {
                <rect x="4" y="4" width="32" height="22" rx="11" fill="none" stroke="currentColor" stroke-width="1.5"/>
              }
              @case ('hexagon') {
                <polygon points="10,2 30,2 38,15 30,28 10,28 2,15" fill="none" stroke="currentColor" stroke-width="1.5"/>
              }
              @case ('cylinder') {
                <path d="M8,8 Q20,2 32,8 L32,22 Q20,28 8,22 Z" fill="none" stroke="currentColor" stroke-width="1.5"/>
                <path d="M8,8 Q20,14 32,8" fill="none" stroke="currentColor" stroke-width="1"/>
              }
              @case ('trapezoid') {
                <polygon points="8,4 32,4 38,26 2,26" fill="none" stroke="currentColor" stroke-width="1.5"/>
              }
            }
          </svg>
          <span class="palette-label">{{ opt.label }}</span>
        </button>
      }
    </div>
  `, styles: [".palette{display:flex;flex-direction:column;gap:2px;padding:8px;background:#fff;border-right:1px solid #e0e0e0;width:80px;min-width:80px;overflow-y:auto}.palette-title{font-size:10px;font-weight:600;text-transform:uppercase;color:#888;padding:4px 0;letter-spacing:.5px}.palette-item{display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 4px;border:1px solid transparent;border-radius:4px;background:none;cursor:pointer;color:#555;transition:all .15s}.palette-item:hover{background:#f0f4ff;border-color:#c0d0f0;color:#333}.shape-icon{width:36px;height:28px}.palette-label{font-size:9px;line-height:1}\n"] }]
        }] });

class TextEditorComponent {
    editorRef;
    state = inject(GraphStateService);
    copyLabel = signal('Copy');
    injector = inject(Injector);
    debounceTimer = null;
    suppressUpdate = false;
    ngAfterViewInit() {
        runInInjectionContext(this.injector, () => {
            effect(() => {
                const text = this.state.mermaidText();
                const source = this.state.changeSource();
                if (source !== 'text') {
                    this.suppressUpdate = true;
                    this.editorRef.nativeElement.value = text;
                    this.suppressUpdate = false;
                }
            });
        });
    }
    onInput(event) {
        if (this.suppressUpdate)
            return;
        const text = event.target.value;
        if (this.debounceTimer)
            clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(() => {
            this.state.updateFromText(text);
        }, 500);
    }
    async copyToClipboard() {
        try {
            await navigator.clipboard.writeText(this.state.mermaidText());
            this.copyLabel.set('Copied!');
            setTimeout(() => this.copyLabel.set('Copy'), 1500);
        }
        catch {
            // Fallback for non-secure contexts
            this.editorRef.nativeElement.select();
            document.execCommand('copy');
            this.copyLabel.set('Copied!');
            setTimeout(() => this.copyLabel.set('Copy'), 1500);
        }
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: TextEditorComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "14.0.0", version: "19.2.20", type: TextEditorComponent, isStandalone: true, selector: "lib-text-editor", viewQueries: [{ propertyName: "editorRef", first: true, predicate: ["editorEl"], descendants: true, static: true }], ngImport: i0, template: `
    <div class="text-editor-container">
      <div class="text-editor-header">
        <span>Mermaid Source</span>
        <button class="copy-btn" (click)="copyToClipboard()" [title]="copyLabel()">
          {{ copyLabel() }}
        </button>
      </div>
      <textarea
        #editorEl
        class="text-editor"
        [value]="state.mermaidText()"
        (input)="onInput($event)"
        spellcheck="false"
      ></textarea>
    </div>
  `, isInline: true, styles: [":host{display:block;height:100%}.text-editor-container{display:flex;flex-direction:column;height:100%}.text-editor-header{display:flex;align-items:center;justify-content:space-between;font-size:10px;font-weight:600;text-transform:uppercase;color:#888;padding:6px 10px;background:#fafafa;border-bottom:1px solid #e0e0e0;letter-spacing:.5px}.copy-btn{font-size:10px;padding:2px 8px;border:1px solid #ccc;border-radius:3px;background:#fff;cursor:pointer;color:#666;text-transform:none;letter-spacing:0;transition:all .15s}.copy-btn:hover{background:#f0f4ff;border-color:#aac}.text-editor{flex:1;font-family:JetBrains Mono,Fira Code,Consolas,monospace;font-size:13px;line-height:1.5;padding:12px;border:none;outline:none;resize:none;background:#1e1e2e;color:#cdd6f4;tab-size:4}.text-editor::selection{background:#45475a}\n"] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: TextEditorComponent, decorators: [{
            type: Component,
            args: [{ selector: 'lib-text-editor', standalone: true, template: `
    <div class="text-editor-container">
      <div class="text-editor-header">
        <span>Mermaid Source</span>
        <button class="copy-btn" (click)="copyToClipboard()" [title]="copyLabel()">
          {{ copyLabel() }}
        </button>
      </div>
      <textarea
        #editorEl
        class="text-editor"
        [value]="state.mermaidText()"
        (input)="onInput($event)"
        spellcheck="false"
      ></textarea>
    </div>
  `, styles: [":host{display:block;height:100%}.text-editor-container{display:flex;flex-direction:column;height:100%}.text-editor-header{display:flex;align-items:center;justify-content:space-between;font-size:10px;font-weight:600;text-transform:uppercase;color:#888;padding:6px 10px;background:#fafafa;border-bottom:1px solid #e0e0e0;letter-spacing:.5px}.copy-btn{font-size:10px;padding:2px 8px;border:1px solid #ccc;border-radius:3px;background:#fff;cursor:pointer;color:#666;text-transform:none;letter-spacing:0;transition:all .15s}.copy-btn:hover{background:#f0f4ff;border-color:#aac}.text-editor{flex:1;font-family:JetBrains Mono,Fira Code,Consolas,monospace;font-size:13px;line-height:1.5;padding:12px;border:none;outline:none;resize:none;background:#1e1e2e;color:#cdd6f4;tab-size:4}.text-editor::selection{background:#45475a}\n"] }]
        }], propDecorators: { editorRef: [{
                type: ViewChild,
                args: ['editorEl', { static: true }]
            }] } });

class PreviewComponent {
    previewRef;
    error = null;
    state = inject(GraphStateService);
    sanitizer = inject(DomSanitizer);
    injector = inject(Injector);
    mermaidModule = null;
    renderTimer = null;
    initialized = false;
    async ngAfterViewInit() {
        this.mermaidModule = await import('mermaid');
        this.mermaidModule.default.initialize({
            startOnLoad: false,
            theme: 'default',
            securityLevel: 'strict',
        });
        this.initialized = true;
        runInInjectionContext(this.injector, () => {
            effect(() => {
                const text = this.state.mermaidText();
                this.scheduleRender(text);
            });
        });
    }
    scheduleRender(text) {
        if (this.renderTimer)
            clearTimeout(this.renderTimer);
        this.renderTimer = setTimeout(() => this.renderMermaid(text), 300);
    }
    async renderMermaid(text) {
        if (!this.initialized || !text.trim()) {
            this.previewRef.nativeElement.textContent = '';
            this.error = null;
            return;
        }
        try {
            const id = `mermaid-preview-${Date.now()}`;
            const { svg } = await this.mermaidModule.default.render(id, text);
            // Mermaid runs with securityLevel:'strict' which sanitizes its own output.
            // Angular's HTML sanitizer strips SVG elements, so we use the trusted
            // Mermaid output via bypassSecurityTrustHtml for SVG rendering.
            const trusted = this.sanitizer.bypassSecurityTrustHtml(svg);
            this.previewRef.nativeElement.textContent = '';
            const wrapper = document.createElement('div');
            // Extract the string from the SafeHtml for DOM insertion
            wrapper.innerHTML = svg;
            this.previewRef.nativeElement.appendChild(wrapper);
            this.error = null;
        }
        catch (e) {
            this.error = e?.message ?? 'Render error';
        }
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: PreviewComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "19.2.20", type: PreviewComponent, isStandalone: true, selector: "lib-preview", viewQueries: [{ propertyName: "previewRef", first: true, predicate: ["previewEl"], descendants: true, static: true }], ngImport: i0, template: `
    <div class="preview-container">
      <div class="preview-header">Preview</div>
      <div #previewEl class="preview-content"></div>
      @if (error) {
        <div class="preview-error">{{ error }}</div>
      }
    </div>
  `, isInline: true, styles: [":host{display:block;height:100%}.preview-container{display:flex;flex-direction:column;height:100%;background:#fff}.preview-header{font-size:10px;font-weight:600;text-transform:uppercase;color:#888;padding:6px 10px;background:#fafafa;border-bottom:1px solid #e0e0e0;letter-spacing:.5px}.preview-content{flex:1;padding:16px;overflow:auto;display:flex;align-items:center;justify-content:center}.preview-content :first-child{max-width:100%;height:auto}.preview-error{padding:8px 12px;font-size:11px;color:#d32f2f;background:#fff3f3;border-top:1px solid #ffcdd2}\n"], changeDetection: i0.ChangeDetectionStrategy.OnPush });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: PreviewComponent, decorators: [{
            type: Component,
            args: [{ selector: 'lib-preview', standalone: true, changeDetection: ChangeDetectionStrategy.OnPush, template: `
    <div class="preview-container">
      <div class="preview-header">Preview</div>
      <div #previewEl class="preview-content"></div>
      @if (error) {
        <div class="preview-error">{{ error }}</div>
      }
    </div>
  `, styles: [":host{display:block;height:100%}.preview-container{display:flex;flex-direction:column;height:100%;background:#fff}.preview-header{font-size:10px;font-weight:600;text-transform:uppercase;color:#888;padding:6px 10px;background:#fafafa;border-bottom:1px solid #e0e0e0;letter-spacing:.5px}.preview-content{flex:1;padding:16px;overflow:auto;display:flex;align-items:center;justify-content:center}.preview-content :first-child{max-width:100%;height:auto}.preview-error{padding:8px 12px;font-size:11px;color:#d32f2f;background:#fff3f3;border-top:1px solid #ffcdd2}\n"] }]
        }], propDecorators: { previewRef: [{
                type: ViewChild,
                args: ['previewEl', { static: true }]
            }] } });

class ToolbarComponent {
    state = inject(GraphStateService);
    undoClicked = output();
    redoClicked = output();
    deleteClicked = output();
    autoLayoutClicked = output();
    fitClicked = output();
    zoomInClicked = output();
    zoomOutClicked = output();
    edgeTypeChanged = output();
    setMode(mode) {
        this.state.canvasMode.set(mode);
    }
    onDirectionChange(event) {
        const dir = event.target.value;
        this.state.setDirection(dir);
    }
    onEdgeTypeChange(event) {
        const type = event.target.value;
        this.edgeTypeChanged.emit(type);
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: ToolbarComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "19.2.20", type: ToolbarComponent, isStandalone: true, selector: "lib-toolbar", outputs: { undoClicked: "undoClicked", redoClicked: "redoClicked", deleteClicked: "deleteClicked", autoLayoutClicked: "autoLayoutClicked", fitClicked: "fitClicked", zoomInClicked: "zoomInClicked", zoomOutClicked: "zoomOutClicked", edgeTypeChanged: "edgeTypeChanged" }, ngImport: i0, template: `
    <div class="toolbar">
      <div class="toolbar-group">
        <label class="toolbar-label">Direction</label>
        <select
          class="toolbar-select"
          [value]="state.model().direction"
          (change)="onDirectionChange($event)"
        >
          <option value="TD">Top → Down</option>
          <option value="LR">Left → Right</option>
          <option value="RL">Right → Left</option>
          <option value="BT">Bottom → Top</option>
        </select>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group mode-group">
        <button
          class="toolbar-btn mode-btn"
          [class.active]="state.canvasMode() === 'select'"
          title="Select mode (V) — click to select, drag to move. Drag from node edges to connect."
          (click)="setMode('select')"
        >⊹ Select <kbd>V</kbd></button>
        <button
          class="toolbar-btn mode-btn"
          [class.active]="state.canvasMode() === 'pan'"
          title="Pan mode (H) — or hold Space to pan temporarily"
          (click)="setMode('pan')"
        >✥ Pan <kbd>H</kbd></button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button class="toolbar-btn" title="Undo (Ctrl+Z)" (click)="undoClicked.emit()">↩</button>
        <button class="toolbar-btn" title="Redo (Ctrl+Y)" (click)="redoClicked.emit()">↪</button>
      </div>

      @if (state.hasSelection()) {
        <div class="toolbar-divider"></div>

        <div class="toolbar-group">
          <button class="toolbar-btn danger" title="Delete (Del)" (click)="deleteClicked.emit()">✕ Delete</button>
        </div>
      }

@if (state.hasSelectedEdges()) {
        <div class="toolbar-divider"></div>

        <div class="toolbar-group">
          <label class="toolbar-label">Edge</label>
          <select
            class="toolbar-select"
            [value]="state.selectedEdgeType() ?? 'arrow'"
            (change)="onEdgeTypeChange($event)"
          >
            <option value="arrow">→ Solid</option>
            <option value="dotted-arrow">⇢ Dashed</option>
            <option value="thick-arrow">⇒ Thick</option>
            <option value="open">— Open</option>
          </select>
        </div>
      }

      <div class="toolbar-spacer"></div>

      <div class="toolbar-group">
        <button class="toolbar-btn" title="Auto Layout" (click)="autoLayoutClicked.emit()">⊞ Layout</button>
        <button class="toolbar-btn" title="Fit to Page" (click)="fitClicked.emit()">⊡ Fit</button>
        <button class="toolbar-btn" title="Zoom In" (click)="zoomInClicked.emit()">+</button>
        <button class="toolbar-btn" title="Zoom Out" (click)="zoomOutClicked.emit()">−</button>
      </div>
    </div>
  `, isInline: true, styles: [".toolbar{display:flex;align-items:center;gap:4px;padding:6px 12px;background:#fff;border-bottom:1px solid #e0e0e0;flex-shrink:0}.toolbar-group{display:flex;align-items:center;gap:4px}.toolbar-label{font-size:11px;color:#666;margin-right:4px}.toolbar-select{font-size:12px;padding:3px 6px;border:1px solid #ccc;border-radius:4px;background:#fff}.toolbar-btn{padding:4px 10px;font-size:12px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;transition:background .15s}.toolbar-btn:hover{background:#f0f4ff}.toolbar-btn.danger:hover{background:#fff0f0;border-color:#e0a0a0;color:#c33}.toolbar-spacer{flex:1}.toolbar-divider{width:1px;height:20px;background:#e0e0e0;margin:0 4px}.mode-btn.active{background:#e3edff;border-color:#4a90d9;color:#2a6ab8}kbd{display:inline-block;font-size:10px;font-family:inherit;padding:1px 4px;margin-left:4px;border:1px solid #ccc;border-radius:3px;background:#f5f5f5;color:#666;line-height:1}\n"] });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: ToolbarComponent, decorators: [{
            type: Component,
            args: [{ selector: 'lib-toolbar', standalone: true, template: `
    <div class="toolbar">
      <div class="toolbar-group">
        <label class="toolbar-label">Direction</label>
        <select
          class="toolbar-select"
          [value]="state.model().direction"
          (change)="onDirectionChange($event)"
        >
          <option value="TD">Top → Down</option>
          <option value="LR">Left → Right</option>
          <option value="RL">Right → Left</option>
          <option value="BT">Bottom → Top</option>
        </select>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group mode-group">
        <button
          class="toolbar-btn mode-btn"
          [class.active]="state.canvasMode() === 'select'"
          title="Select mode (V) — click to select, drag to move. Drag from node edges to connect."
          (click)="setMode('select')"
        >⊹ Select <kbd>V</kbd></button>
        <button
          class="toolbar-btn mode-btn"
          [class.active]="state.canvasMode() === 'pan'"
          title="Pan mode (H) — or hold Space to pan temporarily"
          (click)="setMode('pan')"
        >✥ Pan <kbd>H</kbd></button>
      </div>

      <div class="toolbar-divider"></div>

      <div class="toolbar-group">
        <button class="toolbar-btn" title="Undo (Ctrl+Z)" (click)="undoClicked.emit()">↩</button>
        <button class="toolbar-btn" title="Redo (Ctrl+Y)" (click)="redoClicked.emit()">↪</button>
      </div>

      @if (state.hasSelection()) {
        <div class="toolbar-divider"></div>

        <div class="toolbar-group">
          <button class="toolbar-btn danger" title="Delete (Del)" (click)="deleteClicked.emit()">✕ Delete</button>
        </div>
      }

@if (state.hasSelectedEdges()) {
        <div class="toolbar-divider"></div>

        <div class="toolbar-group">
          <label class="toolbar-label">Edge</label>
          <select
            class="toolbar-select"
            [value]="state.selectedEdgeType() ?? 'arrow'"
            (change)="onEdgeTypeChange($event)"
          >
            <option value="arrow">→ Solid</option>
            <option value="dotted-arrow">⇢ Dashed</option>
            <option value="thick-arrow">⇒ Thick</option>
            <option value="open">— Open</option>
          </select>
        </div>
      }

      <div class="toolbar-spacer"></div>

      <div class="toolbar-group">
        <button class="toolbar-btn" title="Auto Layout" (click)="autoLayoutClicked.emit()">⊞ Layout</button>
        <button class="toolbar-btn" title="Fit to Page" (click)="fitClicked.emit()">⊡ Fit</button>
        <button class="toolbar-btn" title="Zoom In" (click)="zoomInClicked.emit()">+</button>
        <button class="toolbar-btn" title="Zoom Out" (click)="zoomOutClicked.emit()">−</button>
      </div>
    </div>
  `, styles: [".toolbar{display:flex;align-items:center;gap:4px;padding:6px 12px;background:#fff;border-bottom:1px solid #e0e0e0;flex-shrink:0}.toolbar-group{display:flex;align-items:center;gap:4px}.toolbar-label{font-size:11px;color:#666;margin-right:4px}.toolbar-select{font-size:12px;padding:3px 6px;border:1px solid #ccc;border-radius:4px;background:#fff}.toolbar-btn{padding:4px 10px;font-size:12px;border:1px solid #ccc;border-radius:4px;background:#fff;cursor:pointer;transition:background .15s}.toolbar-btn:hover{background:#f0f4ff}.toolbar-btn.danger:hover{background:#fff0f0;border-color:#e0a0a0;color:#c33}.toolbar-spacer{flex:1}.toolbar-divider{width:1px;height:20px;background:#e0e0e0;margin:0 4px}.mode-btn.active{background:#e3edff;border-color:#4a90d9;color:#2a6ab8}kbd{display:inline-block;font-size:10px;font-family:inherit;padding:1px 4px;margin-left:4px;border:1px solid #ccc;border-radius:3px;background:#f5f5f5;color:#666;line-height:1}\n"] }]
        }] });

class MermaidEditorComponent {
    canvasRef;
    // Inputs
    mermaidText = input('');
    direction = input('TD');
    showTextEditor = input(true);
    showPreview = input(true);
    showPalette = input(true);
    disabled = input(false);
    // Outputs
    mermaidTextChange = output();
    modelChange = output();
    // Split pane state (flex values)
    leftFlex = signal('3');
    rightFlex = signal('2');
    state = inject(GraphStateService);
    injector = inject(Injector);
    elRef = inject(ElementRef);
    lastExternalText = '';
    ngOnInit() {
        const initial = this.mermaidText();
        this.lastExternalText = initial;
        if (initial) {
            this.state.initFromText(initial);
        }
        this.state.disabled.set(this.disabled());
        runInInjectionContext(this.injector, () => {
            effect(() => {
                const text = this.mermaidText();
                if (text !== this.lastExternalText) {
                    this.lastExternalText = text;
                    this.state.initFromText(text || '');
                }
            });
            effect(() => {
                this.state.disabled.set(this.disabled());
            });
        });
    }
    ngAfterViewInit() {
        runInInjectionContext(this.injector, () => {
            effect(() => {
                const text = this.state.mermaidText();
                this.mermaidTextChange.emit(text);
            });
            effect(() => {
                const model = this.state.model();
                this.modelChange.emit(model);
            });
        });
    }
    onShapeSelected(shape) {
        this.canvasRef?.addNodeAtCenter(shape);
    }
    onSplitDragStart(event) {
        event.preventDefault();
        const body = this.elRef.nativeElement.querySelector('.editor-body');
        if (!body)
            return;
        const totalWidth = body.clientWidth;
        const onMove = (e) => {
            const rect = body.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const leftPct = Math.max(15, Math.min(85, (x / totalWidth) * 100));
            const rightPct = 100 - leftPct;
            this.leftFlex.set(`${leftPct}`);
            this.rightFlex.set(`${rightPct}`);
        };
        const onUp = () => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
    }
    static ɵfac = i0.ɵɵngDeclareFactory({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: MermaidEditorComponent, deps: [], target: i0.ɵɵFactoryTarget.Component });
    static ɵcmp = i0.ɵɵngDeclareComponent({ minVersion: "17.0.0", version: "19.2.20", type: MermaidEditorComponent, isStandalone: true, selector: "ngx-mermaid-editor", inputs: { mermaidText: { classPropertyName: "mermaidText", publicName: "mermaidText", isSignal: true, isRequired: false, transformFunction: null }, direction: { classPropertyName: "direction", publicName: "direction", isSignal: true, isRequired: false, transformFunction: null }, showTextEditor: { classPropertyName: "showTextEditor", publicName: "showTextEditor", isSignal: true, isRequired: false, transformFunction: null }, showPreview: { classPropertyName: "showPreview", publicName: "showPreview", isSignal: true, isRequired: false, transformFunction: null }, showPalette: { classPropertyName: "showPalette", publicName: "showPalette", isSignal: true, isRequired: false, transformFunction: null }, disabled: { classPropertyName: "disabled", publicName: "disabled", isSignal: true, isRequired: false, transformFunction: null } }, outputs: { mermaidTextChange: "mermaidTextChange", modelChange: "modelChange" }, providers: [GraphStateService], viewQueries: [{ propertyName: "canvasRef", first: true, predicate: ["canvas"], descendants: true }], ngImport: i0, template: `
    <div class="editor-root" [class.disabled]="disabled()">
      @if (!disabled()) {
        <lib-toolbar
          (undoClicked)="canvasRef?.undo()"
          (redoClicked)="canvasRef?.redo()"
          (deleteClicked)="canvasRef?.deleteSelected()"
          (autoLayoutClicked)="canvasRef?.autoLayout()"
          (fitClicked)="canvasRef?.fitToPage()"
          (zoomInClicked)="canvasRef?.zoomIn()"
          (zoomOutClicked)="canvasRef?.zoomOut()"
          (edgeTypeChanged)="canvasRef?.setEdgeType($event)"
        />
      }

      <div class="editor-body">
        <div class="left-pane" [style.flex]="leftFlex()">
          @if (showPalette() && !disabled()) {
            <lib-shape-palette (shapeSelected)="onShapeSelected($event)" />
          }
          <lib-canvas #canvas />
        </div>

        @if ((showTextEditor() || showPreview()) && !disabled()) {
          <div
            class="split-handle"
            (mousedown)="onSplitDragStart($event)"
          ></div>
          <div class="right-pane" [style.flex]="rightFlex()">
            @if (showTextEditor()) {
              <lib-text-editor />
            }
            @if (showPreview()) {
              <lib-preview />
            }
          </div>
        }
      </div>
    </div>
  `, isInline: true, styles: [":host{display:block;width:100%;height:100%}.editor-root.disabled{pointer-events:none;-webkit-user-select:none;user-select:none}.editor-root{display:flex;flex-direction:column;width:100%;height:100%;border:1px solid #e0e0e0;border-radius:4px;overflow:hidden;font-family:Inter,system-ui,-apple-system,sans-serif}.editor-body{display:flex;flex:1;overflow:hidden}.left-pane{display:flex;min-width:200px;overflow:hidden;position:relative}.split-handle{width:5px;cursor:col-resize;background:#e0e0e0;flex-shrink:0;transition:background .15s}.split-handle:hover,.split-handle:active{background:#b0c4ff}.right-pane{display:flex;flex-direction:column;min-width:200px;overflow:hidden}.right-pane>*{flex:1;min-height:0}.right-pane>*:not(:last-child){border-bottom:1px solid #e0e0e0}\n"], dependencies: [{ kind: "component", type: CanvasComponent, selector: "lib-canvas" }, { kind: "component", type: ShapePaletteComponent, selector: "lib-shape-palette", outputs: ["shapeSelected"] }, { kind: "component", type: TextEditorComponent, selector: "lib-text-editor" }, { kind: "component", type: PreviewComponent, selector: "lib-preview" }, { kind: "component", type: ToolbarComponent, selector: "lib-toolbar", outputs: ["undoClicked", "redoClicked", "deleteClicked", "autoLayoutClicked", "fitClicked", "zoomInClicked", "zoomOutClicked", "edgeTypeChanged"] }], changeDetection: i0.ChangeDetectionStrategy.OnPush });
}
i0.ɵɵngDeclareClassMetadata({ minVersion: "12.0.0", version: "19.2.20", ngImport: i0, type: MermaidEditorComponent, decorators: [{
            type: Component,
            args: [{ selector: 'ngx-mermaid-editor', standalone: true, imports: [
                        CanvasComponent,
                        ShapePaletteComponent,
                        TextEditorComponent,
                        PreviewComponent,
                        ToolbarComponent,
                    ], providers: [GraphStateService], changeDetection: ChangeDetectionStrategy.OnPush, template: `
    <div class="editor-root" [class.disabled]="disabled()">
      @if (!disabled()) {
        <lib-toolbar
          (undoClicked)="canvasRef?.undo()"
          (redoClicked)="canvasRef?.redo()"
          (deleteClicked)="canvasRef?.deleteSelected()"
          (autoLayoutClicked)="canvasRef?.autoLayout()"
          (fitClicked)="canvasRef?.fitToPage()"
          (zoomInClicked)="canvasRef?.zoomIn()"
          (zoomOutClicked)="canvasRef?.zoomOut()"
          (edgeTypeChanged)="canvasRef?.setEdgeType($event)"
        />
      }

      <div class="editor-body">
        <div class="left-pane" [style.flex]="leftFlex()">
          @if (showPalette() && !disabled()) {
            <lib-shape-palette (shapeSelected)="onShapeSelected($event)" />
          }
          <lib-canvas #canvas />
        </div>

        @if ((showTextEditor() || showPreview()) && !disabled()) {
          <div
            class="split-handle"
            (mousedown)="onSplitDragStart($event)"
          ></div>
          <div class="right-pane" [style.flex]="rightFlex()">
            @if (showTextEditor()) {
              <lib-text-editor />
            }
            @if (showPreview()) {
              <lib-preview />
            }
          </div>
        }
      </div>
    </div>
  `, styles: [":host{display:block;width:100%;height:100%}.editor-root.disabled{pointer-events:none;-webkit-user-select:none;user-select:none}.editor-root{display:flex;flex-direction:column;width:100%;height:100%;border:1px solid #e0e0e0;border-radius:4px;overflow:hidden;font-family:Inter,system-ui,-apple-system,sans-serif}.editor-body{display:flex;flex:1;overflow:hidden}.left-pane{display:flex;min-width:200px;overflow:hidden;position:relative}.split-handle{width:5px;cursor:col-resize;background:#e0e0e0;flex-shrink:0;transition:background .15s}.split-handle:hover,.split-handle:active{background:#b0c4ff}.right-pane{display:flex;flex-direction:column;min-width:200px;overflow:hidden}.right-pane>*{flex:1;min-height:0}.right-pane>*:not(:last-child){border-bottom:1px solid #e0e0e0}\n"] }]
        }], propDecorators: { canvasRef: [{
                type: ViewChild,
                args: ['canvas']
            }] } });

/*
 * Public API Surface of ngx-mermaid-editor
 */
// Main component

/**
 * Generated bundle index. Do not edit.
 */

export { GraphStateService, MermaidDeserializerService, MermaidEditorComponent, MermaidSerializerService, cloneModel, createEmptyModel };
//# sourceMappingURL=ngx-mermaid-editor.mjs.map
