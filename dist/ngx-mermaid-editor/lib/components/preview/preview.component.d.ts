import { ElementRef, AfterViewInit } from '@angular/core';
import * as i0 from "@angular/core";
export declare class PreviewComponent implements AfterViewInit {
    previewRef: ElementRef<HTMLDivElement>;
    error: string | null;
    private state;
    private sanitizer;
    private injector;
    private mermaidModule;
    private renderTimer;
    private initialized;
    ngAfterViewInit(): Promise<void>;
    private scheduleRender;
    private renderMermaid;
    static ɵfac: i0.ɵɵFactoryDeclaration<PreviewComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<PreviewComponent, "lib-preview", never, {}, {}, never, never, true, never>;
}
