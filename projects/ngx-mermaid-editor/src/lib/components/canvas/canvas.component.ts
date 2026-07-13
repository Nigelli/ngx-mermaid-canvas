import {
  Component, ElementRef, ViewChild, AfterViewInit, OnDestroy,
  inject, effect, NgZone, Injector, runInInjectionContext, ChangeDetectorRef,
} from '@angular/core';
import {
  Graph, InternalEvent, UndoManager, RubberBandHandler, KeyHandler, Cell, CellStyle,
  ConnectionConstraint, Outline, type EventObject, Point, HexagonShape, ShapeRegistry,
} from '@maxgraph/core';
import { GraphStateService } from '../../services/graph-state.service';
import { LayoutService } from '../../services/layout.service';
import { FlowchartModel, FlowNode, FlowEdge, MermaidShape, MermaidEdgeType } from '../../models/graph-model';
import { getVertexStyle, styleToShape, getDefaultSize } from '../../models/shape-map';
import { getEdgeStyle, styleToEdgeType } from '../../models/edge-map';

@Component({
  selector: 'lib-canvas',
  standalone: true,
  template: `
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
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; position: relative; user-select: none; }
    .graph-container {
      width: 100%;
      height: 100%;
      overflow: hidden;
      cursor: default;
      position: relative;
      background-color: #f8f9fa;
      background-image: radial-gradient(circle, #d0d0d0 1px, transparent 1px);
      background-size: 20px 20px;
      user-select: none;
    }
    .port-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 5;
      overflow: visible;
    }
    /* maxGraph inline cell editor — make it visible with a clear border */
    :host ::ng-deep .mxCellEditor {
      background: #fff !important;
      border: 2px solid #4a90d9 !important;
      border-radius: 3px;
      padding: 2px 4px !important;
      font-family: Inter, system-ui, sans-serif;
      font-size: 13px;
      outline: none;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      overflow: visible !important;
    }
    /* Rubberband (drag-to-select) rectangle */
    :host ::ng-deep .mxRubberband {
      position: absolute;
      background: rgba(74, 144, 217, 0.12);
      border: 1.5px solid rgba(74, 144, 217, 0.6);
      border-radius: 2px;
      pointer-events: none;
    }
    .minimap {
      position: absolute;
      bottom: 8px;
      right: 8px;
      width: 150px;
      height: 110px;
      border: 1px solid #ccc;
      border-radius: 4px;
      background: #fff;
      opacity: 0.85;
      overflow: hidden;
      z-index: 10;
    }
    .radial-menu {
      position: absolute;
      z-index: 1000;
      width: 0;
      height: 0;
    }
    .radial-item {
      position: absolute;
      width: 44px;
      height: 44px;
      border-radius: 8px;
      border: 1px solid #d0d0d0;
      background: #fff;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1px;
      box-shadow: 0 2px 6px rgba(0,0,0,0.12);
      transition: background 0.12s;
      color: #444;
      padding: 2px;
    }
    .radial-item:hover {
      background: #f0f4ff;
      border-color: #999;
    }
    .radial-icon {
      width: 20px;
      height: 14px;
    }
    .radial-label {
      font-size: 7px;
      line-height: 1;
      color: #666;
      white-space: nowrap;
    }
    .context-menu {
      position: absolute;
      z-index: 1000;
      background: #fff;
      border: 1px solid #d0d0d0;
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 4px 0;
      min-width: 160px;
    }
    .ctx-item {
      display: block;
      width: 100%;
      padding: 6px 14px;
      font-size: 12px;
      text-align: left;
      border: none;
      background: none;
      cursor: pointer;
      color: #333;
    }
    .ctx-item:hover { background: #f0f4ff; }
    .ctx-item.danger { color: #c33; }
    .ctx-item.danger:hover { background: #fff0f0; }
    .ctx-divider {
      height: 1px;
      background: #e8e8e8;
      margin: 4px 0;
    }
  `],
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('graphContainer', { static: true }) containerRef!: ElementRef<HTMLDivElement>;
  @ViewChild('portOverlay', { static: true }) portOverlayRef!: ElementRef<SVGElement>;
  @ViewChild('minimapContainer', { static: true }) minimapRef!: ElementRef<HTMLDivElement>;

  private graph!: Graph;
  private undoManager!: UndoManager;
  private suppressEvents = false;
  contextMenu: { x: number; y: number; cell: Cell | null; isEdge: boolean; graphX: number; graphY: number; selectedCells: Cell[] } | null = null;
  radialMenu: { x: number; y: number; graphX: number; graphY: number } | null = null;

  radialMenuItems: Array<{ shape: MermaidShape; label: string }> = [
    { shape: 'rectangle', label: 'Process' },
    { shape: 'rounded', label: 'Start/End' },
    { shape: 'diamond', label: 'Decision' },
    { shape: 'circle', label: 'Event' },
    { shape: 'stadium', label: 'Terminal' },
    { shape: 'hexagon', label: 'Prepare' },
    { shape: 'cylinder', label: 'Database' },
    { shape: 'trapezoid', label: 'Manual' },
  ];
  clipboardCells: Cell[] = [];
  private documentListeners: Array<() => void> = [];

  // Port hover indicator
  private hoveredCell: Cell | null = null;

  // Rubberband (drag-to-select) handler reference
  private rubberband!: RubberBandHandler;
  private wheelTimeout: any = null;

  // Pan state (mode pan, spacebar pan, or middle-click pan)
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panStartTranslateX = 0;
  private panStartTranslateY = 0;
  private isSpaceHeld = false;
  private isMiddleMousePan = false;


  private state = inject(GraphStateService);
  private layoutService = inject(LayoutService);
  private zone = inject(NgZone);
  private injector = inject(Injector);
  private cdr = inject(ChangeDetectorRef);

  ngAfterViewInit(): void {
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

  private initGraph(): void {
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

    const dismissIfOutsideMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
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
    this.documentListeners.push(
      () => document.removeEventListener('mousedown', dismissIfOutsideMenu, true),
    );

    // Register custom trapezoid shape
    if (!ShapeRegistry.get('trapezoid')) {
      class TrapezoidShape extends HexagonShape {
        override redrawPath(c: any, x: number, y: number, w: number, h: number): void {
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
    const selectionHandler = g.getPlugin<any>('SelectionHandler');
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
    const onDeleteKey = (e: KeyboardEvent) => {
      if ((e.key === 'Backspace' || e.key === 'Delete') && g.isEnabled() && !g.isEditing()) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
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
    keyHandler.bindControlKey(90, () => this.undo());  // Ctrl+Z
    keyHandler.bindControlKey(89, () => this.redo());  // Ctrl+Y

    // Ctrl+A select all
    keyHandler.bindControlKey(65, () => {
      g.selectAll();
    });

    // Ctrl+Shift+Z redo (alternative)
    keyHandler.bindControlShiftKey(90, () => this.redo());

    // Ctrl/Cmd+C copy, Ctrl/Cmd+V paste
    keyHandler.bindControlKey(67, () => this.copyCells());  // C
    keyHandler.bindControlKey(86, () => this.zone.run(() => this.pasteCells()));  // V

    // Mode shortcuts: V=select, H=pan
    keyHandler.bindKey(86, () => this.zone.run(() => this.state.canvasMode.set('select')));  // V
    keyHandler.bindKey(72, () => this.zone.run(() => this.state.canvasMode.set('pan')));     // H

    // Override isControlDown to also recognize Cmd (metaKey) on Mac
    (keyHandler as any).isControlDown = (evt: KeyboardEvent) => evt.ctrlKey || evt.metaKey;

    // Setup undo manager
    this.undoManager = new UndoManager();
    const listener = (_sender: any, evt: EventObject) => {
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
    g.convertValueToString = (cell: Cell) => {
      return cell.getValue() ?? '';
    };

    // Handle label editing
    const origLabelChanged = g.cellLabelChanged.bind(g);
    g.cellLabelChanged = (cell: Cell, newValue: string, autoSize: boolean) => {
      origLabelChanged(cell, newValue, autoSize);
      if (!this.suppressEvents) {
        this.zone.run(() => this.extractAndPushModel());
      }
    };

    // Double-click handling: empty canvas = show radial shape menu, edge = edit label
    g.addListener(InternalEvent.DOUBLE_CLICK, (_sender: any, evt: EventObject) => {
      const cell = evt.getProperty('cell');
      if (!cell) {
        const mouseEvt = evt.getProperty('event') as MouseEvent;
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
      } else if (cell.isEdge()) {
        g.startEditingAtCell(cell);
        evt.consume();
      }
    });

    // Define connection points on vertices (N, S, E, W)
    g.getAllConnectionConstraints = (terminal) => {
      if (terminal?.cell?.isVertex()) {
        return [
          new ConnectionConstraint(new Point(0.5, 0), true),   // top center
          new ConnectionConstraint(new Point(1, 0.5), true),   // right center
          new ConnectionConstraint(new Point(0.5, 1), true),   // bottom center
          new ConnectionConstraint(new Point(0, 0.5), true),   // left center
        ];
      }
      return [];
    };

    // Configure the connection handler:
    // - Only trigger connections from the border region (not center/text area)
    // - Show crosshair cursor when connection is possible
    const connectionHandler = g.getPlugin('ConnectionHandler') as any;
    if (connectionHandler) {
      connectionHandler.connectImage = null;
      connectionHandler.livePreview = true;
      connectionHandler.cursor = 'crosshair';
      connectionHandler.outlineConnect = true;

      // Override: only start a connection when the mouse is near the cell border
      const origIsStartEvent = connectionHandler.isStartEvent.bind(connectionHandler);
      connectionHandler.isStartEvent = (me: any) => {
        if (!origIsStartEvent(me)) return false;
        // If we have a constraint point, we're on the border — allow it
        if (connectionHandler.constraintHandler?.currentConstraint) return true;
        // Otherwise check if mouse is near the edge of the cell
        const state = connectionHandler.previous;
        if (!state) return false;
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
      const shape = e.dataTransfer?.getData('application/shape') as MermaidShape;
      if (!shape) return;
      e.preventDefault();
      const pt = g.getPointForEvent(e);
      const size = getDefaultSize(shape);
      this.zone.run(() => this.addNode(shape, pt.x - size.width / 2, pt.y - size.height / 2));
    });

    // Setup pan and connect mode mouse handlers
    this.setupModeHandlers(container);
  }

  /** Extract current graph state into IR and push to state service */
  private extractAndPushModel(): void {
    const parent = this.graph.getDefaultParent();
    const newModel: FlowchartModel = {
      direction: this.state.model().direction,
      nodes: new Map(),
      edges: [],
      subgraphs: this.state.model().subgraphs ?? [],
    };

    const childCount = parent.getChildCount();
    let edgeCounter = 0;

    for (let i = 0; i < childCount; i++) {
      const cell = parent.getChildAt(i);
      if (!cell) continue;

      if (cell.isVertex()) {
        const geo = cell.getGeometry();
        const style = cell.getStyle() as CellStyle;
        const node: FlowNode = {
          id: cell.getId() ?? `node_${i}`,
          label: cell.getValue() ?? cell.getId() ?? `node_${i}`,
          shape: styleToShape(style),
          x: geo?.x ?? 0,
          y: geo?.y ?? 0,
          width: geo?.width ?? 140,
          height: geo?.height ?? 50,
        };
        newModel.nodes.set(node.id, node);
      } else if (cell.isEdge()) {
        const src = cell.getTerminal(true);
        const tgt = cell.getTerminal(false);
        if (src && tgt) {
          const style = cell.getStyle() as CellStyle;
          const edge: FlowEdge = {
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
  private syncFromModel(model: FlowchartModel): void {
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
      const cellMap = new Map<string, Cell>();

      for (const node of model.nodes.values()) {
        const style = getVertexStyle(node.shape);
        const size = getDefaultSize(node.shape);
        const v = g.insertVertex(
          parent, node.id, node.label,
          node.x ?? 0, node.y ?? 0,
          node.width ?? size.width, node.height ?? size.height,
          style,
        );
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
    } finally {
      g.getDataModel().endUpdate();
    }

    this.suppressEvents = false;
  }

  /** Add a node at the given position with the given shape */
  addNode(shape: MermaidShape, x: number, y: number): void {
    const id = this.state.generateNodeId();
    const label = this.defaultLabel(shape, id);
    const size = getDefaultSize(shape);
    const style = getVertexStyle(shape);

    this.graph.batchUpdate(() => {
      this.graph.insertVertex(
        this.graph.getDefaultParent(), id, label,
        x, y, size.width, size.height, style,
      );
    });
    // extractAndPushModel will be triggered by the model change listener
  }

  /** Add a node at the center of the visible area */
  addNodeAtCenter(shape: MermaidShape): void {
    const container = this.containerRef.nativeElement;
    const translate = this.graph.getView().getTranslate();
    const scale = this.graph.getView().getScale();
    const x = (container.clientWidth / 2 - translate.x * scale) / scale - 70;
    const y = (container.clientHeight / 2 - translate.y * scale) / scale - 25;
    this.addNode(shape, x, y);
  }

  onContextMenu(event: MouseEvent): void {
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

  getRadialPosition(index: number): string {
    const total = this.radialMenuItems.length;
    const radius = 80;
    const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
    const x = Math.cos(angle) * radius - 22;
    const y = Math.sin(angle) * radius - 22;
    return `translate(${x}px, ${y}px)`;
  }

  addFromRadial(shape: MermaidShape): void {
    if (!this.radialMenu) return;
    const size = getDefaultSize(shape);
    this.addNode(shape, this.radialMenu.graphX - size.width / 2, this.radialMenu.graphY - size.height / 2);
    this.radialMenu = null;
  }

  closeContextMenu(): void {
    this.contextMenu = null;
  }

  editLabel(): void {
    const cell = this.graph.getSelectionCell();
    this.contextMenu = null;
    if (cell) {
      // Delay so the context menu DOM is removed before the editor opens
      setTimeout(() => this.graph.startEditingAtCell(cell), 50);
    }
  }

  addNodeAt(x: number, y: number, shape: MermaidShape): void {
    this.addNode(shape, x, y);
    this.contextMenu = null;
  }

  /** Copy cells from context menu — uses the selection snapshot taken when the menu opened */
  copyFromContext(): void {
    const cells = this.contextMenu?.selectedCells ?? [];
    if (cells.length > 0) {
      this.clipboardCells = this.graph.cloneCells(cells);
    }
    this.contextMenu = null;
  }

  /** Copy currently selected cells (for keyboard shortcut) */
  copyCells(): void {
    const cells = this.graph.getSelectionCells();
    if (cells.length > 0) {
      this.clipboardCells = this.graph.cloneCells(cells);
    }
  }

  /** Paste clipboard cells at an offset from their original position */
  pasteCells(offsetX = 20, offsetY = 20): void {
    if (this.clipboardCells.length === 0) return;
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
    } finally {
      g.getDataModel().endUpdate();
    }
    g.setSelectionCells(clones);
  }

  /** Paste at the position where the context menu was opened */
  pasteAtContext(): void {
    if (this.clipboardCells.length === 0) return;
    const firstGeo = this.clipboardCells[0]?.getGeometry();
    const offsetX = this.contextMenu ? this.contextMenu.graphX - (firstGeo?.x ?? 0) : 20;
    const offsetY = this.contextMenu ? this.contextMenu.graphY - (firstGeo?.y ?? 0) : 20;
    this.pasteCells(offsetX, offsetY);
    this.contextMenu = null;
  }

  private updateSelectionState(): void {
    const cells = this.graph.getSelectionCells();
    const vertices = cells.filter(c => c.isVertex());
    const edges = cells.filter(c => c.isEdge());
    this.state.selectionCount.set(cells.length);
    this.state.hasSelectedVertices.set(vertices.length > 0);
    this.state.hasSelectedEdges.set(edges.length > 0);

    // If exactly one edge type is selected, show it in the dropdown
    if (edges.length > 0) {
      const types = edges.map(e => styleToEdgeType(e.getStyle() as CellStyle));
      const allSame = types.every(t => t === types[0]);
      this.state.selectedEdgeType.set(allSame ? types[0] : null);
    } else {
      this.state.selectedEdgeType.set(null);
    }
  }

  deleteSelected(): void {
    if (this.graph.isEnabled()) {
      this.graph.removeCells();
    }
  }

  /** Apply an edge type to all selected edges */
  setEdgeType(type: MermaidEdgeType): void {
    const cells = this.graph.getSelectionCells().filter(c => c.isEdge());
    if (cells.length === 0) return;

    const style = getEdgeStyle(type);
    this.graph.batchUpdate(() => {
      for (const cell of cells) {
        this.graph.setCellStyle(style, [cell]);
      }
    });
  }

  undo(): void {
    this.undoManager.undo();
  }

  redo(): void {
    this.undoManager.redo();
  }

  autoLayout(): void {
    const current = this.state.model();
    const laid = this.layoutService.applyLayout(current);
    this.syncFromModel(laid);
    this.state.updateFromCanvas(laid);
  }

  zoomIn(): void {
    this.graph.zoomIn();
  }

  zoomOut(): void {
    this.graph.zoomOut();
  }

  fitToPage(): void {
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

    g.getView().scaleAndTranslate(
      scale,
      -bounds.x / scale + padding / scale + (cw / scale - bounds.width) / 2,
      -bounds.y / scale + padding / scale + (ch / scale - bounds.height) / 2,
    );
  }

  private defaultLabel(shape: MermaidShape, id: string): string {
    const labels: Record<MermaidShape, string> = {
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

  private applyMode(mode: string): void {
    const g = this.graph;
    if (!g) return;
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

  private setupModeHandlers(container: HTMLDivElement): void {
    const onMouseDown = (e: MouseEvent) => {
      // Middle-click pan (works in any mode)
      if (e.button === 1) {
        this.rubberband.setEnabled(false);
        this.startPan(e, container);
        this.isMiddleMousePan = true;
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.button !== 0) return;

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

    const onMouseMove = (e: MouseEvent) => {
      if (this.isPanning) {
        const dx = e.clientX - this.panStartX;
        const dy = e.clientY - this.panStartY;
        const scale = this.graph.getView().getScale();
        this.graph.getView().setTranslate(
          this.panStartTranslateX + dx / scale,
          this.panStartTranslateY + dy / scale,
        );
        e.preventDefault();
        return;
      }

      // Show port dots on hover
      if (this.state.canvasMode() === 'select' && !this.graph.isEditing()) {
        this.updatePortHover(e);
      }
    };

    const onMouseUp = (_e: MouseEvent) => {
      if (this.isPanning) {
        this.isPanning = false;
        if (this.isMiddleMousePan) {
          this.isMiddleMousePan = false;
          this.rubberband.setEnabled(true);
        }
        const currentMode = this.state.canvasMode();
        if (this.isSpaceHeld) {
          container.style.cursor = 'grab';
        } else if (currentMode === 'pan') {
          container.style.cursor = 'grab';
        } else {
          container.style.cursor = 'default';
        }
        return;
      }
    };

    // Wheel: Ctrl/Cmd + wheel = zoom, plain wheel = pan
    // Disable rubberband during wheel to prevent selection highlight
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();

      this.rubberband.setEnabled(false);
      clearTimeout(this.wheelTimeout);
      this.wheelTimeout = setTimeout(() => this.rubberband.setEnabled(true), 150);

      if (e.ctrlKey || e.metaKey) {
        const rect = container.getBoundingClientRect();
        const offsetX = e.clientX - rect.left;
        const offsetY = e.clientY - rect.top;
        this.zoomAtPoint(e.deltaY < 0, offsetX, offsetY);
      } else {
        const view = this.graph.getView();
        const scale = view.getScale();
        const translate = view.getTranslate();
        view.setTranslate(
          translate.x - e.deltaX / scale,
          translate.y - e.deltaY / scale,
        );
      }
    };

    // Spacebar pan
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !this.isSpaceHeld && !this.graph.isEditing()) {
        this.isSpaceHeld = true;
        container.style.cursor = 'grab';
        e.preventDefault();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
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
    this.documentListeners.push(
      () => document.removeEventListener('mousemove', onMouseMove),
      () => document.removeEventListener('mouseup', onMouseUp),
      () => document.removeEventListener('keydown', onKeyDown),
      () => document.removeEventListener('keyup', onKeyUp),
    );
  }

  private startPan(e: MouseEvent, container: HTMLDivElement): void {
    this.isPanning = true;
    this.panStartX = e.clientX;
    this.panStartY = e.clientY;
    const translate = this.graph.getView().getTranslate();
    this.panStartTranslateX = translate.x;
    this.panStartTranslateY = translate.y;
    container.style.cursor = 'grabbing';
  }

  private zoomAtPoint(zoomIn: boolean, offsetX: number, offsetY: number): void {
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

  private updatePortHover(e: MouseEvent): void {
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

  private isInsideCellBounds(cell: Cell, screenX: number, screenY: number): boolean {
    const state = this.graph.getView().getState(cell);
    if (!state) return false;

    const padding = 8;
    return screenX >= state.x - padding && screenX <= state.x + state.width + padding &&
           screenY >= state.y - padding && screenY <= state.y + state.height + padding;
  }

  private renderPorts(cell: Cell | null): void {
    const svg = this.portOverlayRef.nativeElement;
    svg.innerHTML = '';
    if (!cell) return;

    const state = this.graph.getView().getState(cell);
    if (!state) return;

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


  ngOnDestroy(): void {
    this.documentListeners.forEach(fn => fn());
    this.graph?.destroy();
  }
}
