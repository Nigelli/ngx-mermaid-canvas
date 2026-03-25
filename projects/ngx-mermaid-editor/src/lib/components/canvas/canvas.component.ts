import {
  Component, ElementRef, ViewChild, AfterViewInit, OnDestroy,
  inject, effect, output, NgZone, Injector, runInInjectionContext,
} from '@angular/core';
import {
  Graph, InternalEvent, UndoManager, RubberBandHandler, KeyHandler, Cell, CellStyle,
  DragSource, type EventObject, Geometry,
} from '@maxgraph/core';
import { GraphStateService } from '../../services/graph-state.service';
import { LayoutService } from '../../services/layout.service';
import { FlowchartModel, FlowNode, FlowEdge, MermaidShape, cloneModel } from '../../models/graph-model';
import { getVertexStyle, styleToShape, getDefaultSize } from '../../models/shape-map';
import { getEdgeStyle, styleToEdgeType } from '../../models/edge-map';

@Component({
  selector: 'lib-canvas',
  standalone: true,
  template: `<div #graphContainer class="graph-container"></div>`,
  styles: [`
    :host { display: block; width: 100%; height: 100%; }
    .graph-container {
      width: 100%;
      height: 100%;
      overflow: auto;
      background: #f8f9fa;
      cursor: default;
      position: relative;
    }
  `],
})
export class CanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('graphContainer', { static: true }) containerRef!: ElementRef<HTMLDivElement>;

  private graph!: Graph;
  private undoManager!: UndoManager;
  private suppressEvents = false;

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

    // Disable built-in context menu
    InternalEvent.disableContextMenu(container);

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

    // Enable keyboard shortcuts (Delete/Backspace to remove selected cells)
    const keyHandler = new KeyHandler(g);
    keyHandler.bindKey(46, () => { // Delete key
      if (g.isEnabled()) {
        g.removeCells();
      }
    });
    keyHandler.bindKey(8, () => { // Backspace key
      if (g.isEnabled()) {
        g.removeCells();
      }
    });

    // Setup undo manager
    this.undoManager = new UndoManager();
    const listener = (_sender: any, evt: EventObject) => {
      this.undoManager.undoableEditHappened(evt.getProperty('edit'));
    };
    g.getDataModel().addListener(InternalEvent.UNDO, listener);
    g.getView().addListener(InternalEvent.UNDO, listener);

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
    const label = id;
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

  deleteSelected(): void {
    if (this.graph.isEnabled()) {
      this.graph.removeCells();
    }
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
    this.graph.zoomActual();
  }

  ngOnDestroy(): void {
    this.graph?.destroy();
  }
}
