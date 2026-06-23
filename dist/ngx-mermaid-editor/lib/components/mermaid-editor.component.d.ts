import { OnInit, AfterViewInit } from '@angular/core';
import { CanvasComponent } from './canvas/canvas.component';
import { FlowchartModel, FlowDirection, MermaidShape } from '../models/graph-model';
import * as i0 from "@angular/core";
export declare class MermaidEditorComponent implements OnInit, AfterViewInit {
    canvasRef?: CanvasComponent;
    mermaidText: import("@angular/core").InputSignal<string>;
    direction: import("@angular/core").InputSignal<FlowDirection>;
    showTextEditor: import("@angular/core").InputSignal<boolean>;
    showPreview: import("@angular/core").InputSignal<boolean>;
    showPalette: import("@angular/core").InputSignal<boolean>;
    mermaidTextChange: import("@angular/core").OutputEmitterRef<string>;
    modelChange: import("@angular/core").OutputEmitterRef<FlowchartModel>;
    leftFlex: import("@angular/core").WritableSignal<string>;
    rightFlex: import("@angular/core").WritableSignal<string>;
    private state;
    private injector;
    private elRef;
    ngOnInit(): void;
    ngAfterViewInit(): void;
    onShapeSelected(shape: MermaidShape): void;
    onSplitDragStart(event: MouseEvent): void;
    static ɵfac: i0.ɵɵFactoryDeclaration<MermaidEditorComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<MermaidEditorComponent, "ngx-mermaid-editor", never, { "mermaidText": { "alias": "mermaidText"; "required": false; "isSignal": true; }; "direction": { "alias": "direction"; "required": false; "isSignal": true; }; "showTextEditor": { "alias": "showTextEditor"; "required": false; "isSignal": true; }; "showPreview": { "alias": "showPreview"; "required": false; "isSignal": true; }; "showPalette": { "alias": "showPalette"; "required": false; "isSignal": true; }; }, { "mermaidTextChange": "mermaidTextChange"; "modelChange": "modelChange"; }, never, never, true, never>;
}
