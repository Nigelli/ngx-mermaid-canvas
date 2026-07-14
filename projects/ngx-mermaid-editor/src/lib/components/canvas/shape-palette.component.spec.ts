import { TestBed, ComponentFixture } from '@angular/core/testing';
import { ShapePaletteComponent } from './shape-palette.component';
import { CanvasComponent } from './canvas.component';
import { GraphStateService } from '../../services/graph-state.service';
import { MermaidShape } from '../../models/graph-model';

/** Every MermaidShape a user should be able to pick from the UI */
const ALL_SHAPES: MermaidShape[] = [
  'rectangle', 'rounded', 'diamond', 'circle', 'stadium',
  'hexagon', 'cylinder', 'trapezoid',
  'parallelogram', 'subroutine', 'asymmetric',
];

describe('ShapePaletteComponent', () => {
  let fixture: ComponentFixture<ShapePaletteComponent>;
  let component: ShapePaletteComponent;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ShapePaletteComponent],
    });
    fixture = TestBed.createComponent(ShapePaletteComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('offers every MermaidShape exactly once', () => {
    const listed = component.shapes.map(s => s.shape);
    expect(listed.length).toBe(ALL_SHAPES.length);
    expect(new Set(listed).size).toBe(listed.length);
    for (const shape of ALL_SHAPES) {
      expect(listed).toContain(shape);
    }
  });

  it('renders a button with a non-empty SVG icon for each shape', () => {
    const buttons: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('.palette-item');
    expect(buttons.length).toBe(component.shapes.length);

    component.shapes.forEach((opt, i) => {
      const svg = buttons[i].querySelector('svg.shape-icon');
      expect(svg).withContext(`icon svg for ${opt.shape}`).not.toBeNull();
      // A shape without a matching @case renders an empty <svg> — catch that.
      expect(svg!.children.length)
        .withContext(`icon content for ${opt.shape}`)
        .toBeGreaterThan(0);
    });
  });

  it('emits the correct MermaidShape when a shape is clicked', () => {
    const emitted: MermaidShape[] = [];
    component.shapeSelected.subscribe(s => emitted.push(s));

    const buttons: NodeListOf<HTMLButtonElement> =
      fixture.nativeElement.querySelectorAll('.palette-item');

    for (const shape of ['parallelogram', 'subroutine', 'asymmetric'] as MermaidShape[]) {
      const index = component.shapes.findIndex(s => s.shape === shape);
      expect(index).withContext(`${shape} present in palette`).toBeGreaterThanOrEqual(0);
      buttons[index].click();
    }

    expect(emitted).toEqual(['parallelogram', 'subroutine', 'asymmetric']);
  });

  it('sets the shape as drag data on dragstart', () => {
    const dataTransfer = new DataTransfer();
    const event = new DragEvent('dragstart', { dataTransfer });
    component.onDragStart(event, 'subroutine');
    // Note: effectAllowed is browser-managed outside a real drag session,
    // so only the payload is asserted here.
    expect(dataTransfer.getData('application/shape')).toBe('subroutine');
  });
});

describe('CanvasComponent radial menu', () => {
  it('offers the same shape set as the palette, in the same order', () => {
    TestBed.configureTestingModule({
      imports: [CanvasComponent, ShapePaletteComponent],
      providers: [GraphStateService],
    });
    // No detectChanges(): ngAfterViewInit would boot maxGraph, which the
    // shape-list assertion doesn't need.
    const canvas = TestBed.createComponent(CanvasComponent).componentInstance;
    const palette = TestBed.createComponent(ShapePaletteComponent).componentInstance;

    expect(canvas.radialMenuItems.map(i => i.shape))
      .toEqual(palette.shapes.map(s => s.shape));
    for (const shape of ALL_SHAPES) {
      expect(canvas.radialMenuItems.map(i => i.shape)).toContain(shape);
    }
  });
});
