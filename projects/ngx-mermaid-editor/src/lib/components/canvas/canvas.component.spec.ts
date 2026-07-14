import { TestBed, ComponentFixture } from '@angular/core/testing';
import { Cell } from '@maxgraph/core';
import { CanvasComponent } from './canvas.component';
import { GraphStateService } from '../../services/graph-state.service';

/**
 * Selected-vertex vs connector-port interaction (draw.io style):
 * a SELECTED vertex is in resize/move mode — it must not show connector
 * ports nor allow a connector-drag to start; an UNselected vertex keeps
 * the hover-ports + border-drag connect behaviour.
 *
 * These tests boot the real component (and therefore real maxGraph) in
 * ChromeHeadless — no mocking of the graph.
 */
describe('CanvasComponent selected-cell port suppression', () => {
  let fixture: ComponentFixture<CanvasComponent>;
  let component: CanvasComponent;
  let graph: any;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [CanvasComponent],
      // GraphStateService is normally provided by MermaidEditorComponent
      providers: [GraphStateService],
    });
    fixture = TestBed.createComponent(CanvasComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); // ngAfterViewInit -> initGraph
    graph = (component as any).graph;
  });

  afterEach(() => {
    fixture.destroy();
  });

  function addVertex(): Cell {
    component.addNode('rectangle', 40, 40);
    const vertices = graph.getChildVertices(graph.getDefaultParent());
    return vertices[vertices.length - 1];
  }

  function shouldShowPortsFor(cell: Cell | null): boolean {
    return (component as any).shouldShowPortsFor(cell);
  }

  function portOverlay(): SVGElement {
    return (component as any).portOverlayRef.nativeElement;
  }

  it('offers ports on an unselected vertex but not on a selected one', () => {
    const v = addVertex();

    graph.clearSelection();
    expect(shouldShowPortsFor(v)).toBeTrue();

    graph.setSelectionCell(v);
    expect(shouldShowPortsFor(v)).toBeFalse();

    // Deselecting restores connect-on-hover
    graph.clearSelection();
    expect(shouldShowPortsFor(v)).toBeTrue();

    expect(shouldShowPortsFor(null)).toBeFalse();
  });

  it('does not offer ports on edges', () => {
    const a = addVertex();
    const b = addVertex();
    const edge = graph.insertEdge(graph.getDefaultParent(), null, '', a, b);
    expect(shouldShowPortsFor(edge)).toBeFalse();
  });

  it('hides the port dots immediately when the hovered vertex becomes selected', () => {
    const v = addVertex();

    // Simulate the hover state: ports rendered for the vertex under the mouse
    (component as any).hoveredCell = v;
    (component as any).renderPorts(v);
    expect(portOverlay().childNodes.length).toBe(4);

    // Selecting the hovered vertex must clear the dots without a mouse-move
    graph.setSelectionCell(v);
    expect((component as any).hoveredCell).toBeNull();
    expect(portOverlay().childNodes.length).toBe(0);
  });

  it('keeps port dots on a hovered vertex when a DIFFERENT cell is selected', () => {
    const hovered = addVertex();
    const other = addVertex();

    (component as any).hoveredCell = hovered;
    (component as any).renderPorts(hovered);
    expect(portOverlay().childNodes.length).toBe(4);

    graph.setSelectionCell(other);
    expect((component as any).hoveredCell).toBe(hovered);
    expect(portOverlay().childNodes.length).toBe(4);
  });

  it('blocks connector-start on a selected vertex but allows it on the border of an unselected one', () => {
    const v = addVertex();
    const connectionHandler = graph.getPlugin('ConnectionHandler') as any;
    const state = graph.getView().getState(v);
    expect(state).toBeTruthy();

    // Point just inside the vertex border (within the 12px connect band)
    connectionHandler.previous = state;
    connectionHandler.error = null;
    const borderEvent = {
      getGraphX: () => state.x + 2,
      getGraphY: () => state.y + state.height / 2,
    };

    graph.clearSelection();
    expect(connectionHandler.isStartEvent(borderEvent)).toBeTrue();

    graph.setSelectionCell(v);
    expect(connectionHandler.isStartEvent(borderEvent)).toBeFalse();

    graph.clearSelection();
    expect(connectionHandler.isStartEvent(borderEvent)).toBeTrue();
  });
});
