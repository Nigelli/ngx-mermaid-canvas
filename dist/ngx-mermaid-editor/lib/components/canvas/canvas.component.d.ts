import { ElementRef, AfterViewInit, OnDestroy } from '@angular/core';
import { Cell } from '@maxgraph/core';
import { MermaidShape, MermaidEdgeType } from '../../models/graph-model';
import * as i0 from "@angular/core";
export declare class CanvasComponent implements AfterViewInit, OnDestroy {
    containerRef: ElementRef<HTMLDivElement>;
    minimapRef: ElementRef<HTMLDivElement>;
    private graph;
    private undoManager;
    private suppressEvents;
    contextMenu: {
        x: number;
        y: number;
        cell: Cell | null;
        isEdge: boolean;
        graphX: number;
        graphY: number;
        selectedCells: Cell[];
    } | null;
    clipboardCells: Cell[];
    private documentListeners;
    private state;
    private layoutService;
    private zone;
    private injector;
    private cdr;
    ngAfterViewInit(): void;
    private initGraph;
    /** Extract current graph state into IR and push to state service */
    private extractAndPushModel;
    /** Sync maxGraph cells from the IR model (called when text editor changes) */
    private syncFromModel;
    /** Add a node at the given position with the given shape */
    addNode(shape: MermaidShape, x: number, y: number): void;
    /** Add a node at the center of the visible area */
    addNodeAtCenter(shape: MermaidShape): void;
    onContextMenu(event: MouseEvent): void;
    closeContextMenu(): void;
    editLabel(): void;
    addNodeAt(x: number, y: number, shape: MermaidShape): void;
    /** Copy cells from context menu — uses the selection snapshot taken when the menu opened */
    copyFromContext(): void;
    /** Copy currently selected cells (for keyboard shortcut) */
    copyCells(): void;
    /** Paste clipboard cells at an offset from their original position */
    pasteCells(offsetX?: number, offsetY?: number): void;
    /** Paste at the position where the context menu was opened */
    pasteAtContext(): void;
    private updateSelectionState;
    deleteSelected(): void;
    /** Apply an edge type to all selected edges */
    setEdgeType(type: MermaidEdgeType): void;
    undo(): void;
    redo(): void;
    autoLayout(): void;
    zoomIn(): void;
    zoomOut(): void;
    fitToPage(): void;
    private defaultLabel;
    ngOnDestroy(): void;
    static ɵfac: i0.ɵɵFactoryDeclaration<CanvasComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<CanvasComponent, "lib-canvas", never, {}, {}, never, never, true, never>;
}
