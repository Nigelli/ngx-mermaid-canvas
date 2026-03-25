import {
  Component, ElementRef, ViewChild, AfterViewInit, OnDestroy,
  inject, effect, output, NgZone, Injector, runInInjectionContext,
} from '@angular/core';
import {
  Graph, InternalEvent, UndoManager, RubberBandHandler, KeyHandler, Cell, CellStyle,
  ConnectionConstraint, Outline, type EventObject, Point,
} from '@maxgraph/core';
import { GraphStateService } from '../../services/graph-state.service';
import { LayoutService } from '../../services/layout.service';
import { FlowchartModel, FlowNode, FlowEdge, MermaidShape, MermaidEdgeType, cloneModel } from '../../models/graph-model';
import { getVertexStyle, styleToShape, getDefaultSize } from '../../models/shape-map';
import { getEdgeStyle, styleToEdgeType } from '../../models/edge-map';

@Component({
  selector: 'lib-canvas',
  standalone: true,
  template: `
    <div #graphContainer class="graph-container" (contextmenu)="onContextMenu($event)"></div>
    <div #minimapContainer class="minimap"></div>
    @if (contextMenu) {
      <div class="context-menu" [style.left.px]="contextMenu.x" [style.top.px]="contextMenu.y">
        @if (contextMenu.cell) {
          <button class="ctx-item" (mousedown)="editLabel()">Edit Label</button>
          @if (contextMenu.isEdge) {
            <div class="ctx-divider"></div>
            <button class="ctx-item" (mousedown)="setEdgeType('arrow')">→ Solid Arrow</button>
            <button class="ctx-item" (mousedown)="setEdgeType('dotted-arrow')">⇢ Dashed Arrow</button>
            <button class="ctx-item" (mousedown)="setEdgeType('thick-arrow')">⇒ Thick Arrow</button>
            <button class="ctx-item" (mousedown)="setEdgeType('open')">— No Arrow</button>
          }
          <div class="ctx-divider"></div>
          <button class="ctx-item danger" (mousedown)="deleteSelected()">Delete</button>
        } @else {
          <button class="ctx-item" (mousedown)="addNodeAt(contextMenu.graphX, contextMenu.graphY, 'rectangle')">Add Process</button>
          <button class="ctx-item" (mousedown)="addNodeAt(contextMenu.graphX, contextMenu.graphY, 'diamond')">Add Decision</button>
          <button class="ctx-item" (mousedown)="addNodeAt(contextMenu.graphX, contextMenu.graphY, 'rounded')">Add Start/End</button>
          <div class="ctx-divider"></div>
          <button class="ctx-item" (mousedown)="pasteAtContext()">Paste</button>
        }
      </div>
    }
  `,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    :host { position: relative; }
    .graph-container {
      width: 100%;
      height: 100%;
      overflow: auto;
      cursor: default;
      position: relative;
      background-color: #f8f9fa;
      background-image: radial-gradient(circle, #d0d0d0 1px, transparent 1px);
      background-size: 20px 20px;
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
  @ViewChild('minimapContainer', { static: true }) minimapRef!: ElementRef<HTMLDivElement>;

  private graph!: Graph;
  private undoManager!: UndoManager;
  private suppressEvents = false;
  contextMenu: { x: number; y: number; cell: Cell | null; isEdge: boolean; graphX: number; graphY: number } | null = null;
  private documentListeners: Array<() => void> = [];

  private state = inject(GraphStateService);
  private layoutService = inject(LayoutService);
  private zone = inject(NgZone);
  private injector = inject(Injector);

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
    });
  }

  private initGraph(): void {
    const container = this.containerRef.nativeElement;

    // Suppress browser context menu — we handle it ourselves via onContextMenu()
    container.addEventListener('contextmenu', (e) => e.preventDefault());

    // Close context menu on any left-click anywhere
    const closeContextMenu = (e: MouseEvent) => {
      if (this.contextMenu) {
        const target = e.target as HTMLElement;
        if (target.closest('.context-menu')) return;
        this.zone.run(() => this.contextMenu = null);
      }
    };
    document.addEventListener('mousedown', closeContextMenu);
    this.documentListeners.push(
      () => document.removeEventListener('mousedown', closeContextMenu),
    );

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

    // Snap to grid
    g.getPlugin<any>('SelectionHandler')?.setMoveEnabled(true);

    // Enable rubberband selection
    new RubberBandHandler(g);

    // Keyboard shortcuts
    const keyHandler = new KeyHandler(g);

    // Delete/Backspace to remove
    keyHandler.bindKey(46, () => g.isEnabled() && g.removeCells());
    keyHandler.bindKey(8, () => g.isEnabled() && g.removeCells());

    // Ctrl+Z undo, Ctrl+Y redo
    keyHandler.bindControlKey(90, () => this.undo());  // Ctrl+Z
    keyHandler.bindControlKey(89, () => this.redo());  // Ctrl+Y

    // Ctrl+A select all
    keyHandler.bindControlKey(65, () => {
      g.selectAll();
    });

    // Ctrl+Shift+Z redo (alternative)
    keyHandler.bindControlShiftKey(90, () => this.redo());

    // Setup undo manager
    this.undoManager = new UndoManager();
    const listener = (_sender: any, evt: EventObject) => {
      this.undoManager.undoableEditHappened(evt.getProperty('edit'));
    };
    g.getDataModel().addListener(InternalEvent.UNDO, listener);
    g.getView().addListener(InternalEvent.UNDO, listener);

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

    // Double-click handling: empty canvas = add node, edge = edit label
    g.addListener(InternalEvent.DOUBLE_CLICK, (_sender: any, evt: EventObject) => {
      const cell = evt.getProperty('cell');
      if (!cell) {
        // Clicked on empty canvas — add a rectangle at click position
        const mouseEvt = evt.getProperty('event') as MouseEvent;
        const pt = g.getPointForEvent(mouseEvt);
        this.zone.run(() => this.addNode('rectangle', pt.x - 70, pt.y - 25));
        evt.consume();
      } else if (cell.isEdge()) {
        // Force start editing on edge — default handler may not trigger for edges
        g.startEditingAtCell(cell);
        evt.consume();
      }
      // Vertices: fall through to default CellEditorHandler
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
  }

  /** Extract current graph state into IR and push to state service */
  private extractAndPushModel(): void {
    const model = this.graph.getDataModel();
    const parent = this.graph.getDefaultParent();
    const newModel: FlowchartModel = {
      direction: this.state.model().direction,
      nodes: new Map(),
      edges: [],
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

    if (cell) {
      this.graph.setSelectionCell(cell);
    }

    this.contextMenu = {
      x, y,
      cell: cell ?? null,
      isEdge: cell?.isEdge() ?? false,
      graphX: pt.x - 70,
      graphY: pt.y - 25,
    };
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

  pasteAtContext(): void {
    // Simple paste: duplicate selected cells at context menu position
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

  ngOnDestroy(): void {
    this.documentListeners.forEach(fn => fn());
    this.graph?.destroy();
  }
}
