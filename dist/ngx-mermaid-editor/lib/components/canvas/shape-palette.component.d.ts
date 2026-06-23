import { MermaidShape } from '../../models/graph-model';
import * as i0 from "@angular/core";
export declare class ShapePaletteComponent {
    shapeSelected: import("@angular/core").OutputEmitterRef<MermaidShape>;
    shapes: Array<{
        shape: MermaidShape;
        label: string;
    }>;
    static ɵfac: i0.ɵɵFactoryDeclaration<ShapePaletteComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<ShapePaletteComponent, "lib-shape-palette", never, {}, { "shapeSelected": "shapeSelected"; }, never, never, true, never>;
}
