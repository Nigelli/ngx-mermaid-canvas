import { GraphStateService } from '../../services/graph-state.service';
import { MermaidEdgeType } from '../../models/graph-model';
import * as i0 from "@angular/core";
export declare class ToolbarComponent {
    state: GraphStateService;
    undoClicked: import("@angular/core").OutputEmitterRef<void>;
    redoClicked: import("@angular/core").OutputEmitterRef<void>;
    deleteClicked: import("@angular/core").OutputEmitterRef<void>;
    autoLayoutClicked: import("@angular/core").OutputEmitterRef<void>;
    fitClicked: import("@angular/core").OutputEmitterRef<void>;
    zoomInClicked: import("@angular/core").OutputEmitterRef<void>;
    zoomOutClicked: import("@angular/core").OutputEmitterRef<void>;
    edgeTypeChanged: import("@angular/core").OutputEmitterRef<MermaidEdgeType>;
    onDirectionChange(event: Event): void;
    onEdgeTypeChange(event: Event): void;
    static ɵfac: i0.ɵɵFactoryDeclaration<ToolbarComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<ToolbarComponent, "lib-toolbar", never, {}, { "undoClicked": "undoClicked"; "redoClicked": "redoClicked"; "deleteClicked": "deleteClicked"; "autoLayoutClicked": "autoLayoutClicked"; "fitClicked": "fitClicked"; "zoomInClicked": "zoomInClicked"; "zoomOutClicked": "zoomOutClicked"; "edgeTypeChanged": "edgeTypeChanged"; }, never, never, true, never>;
}
