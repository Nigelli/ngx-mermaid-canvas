import { ElementRef, AfterViewInit } from '@angular/core';
import { GraphStateService } from '../../services/graph-state.service';
import * as i0 from "@angular/core";
export declare class TextEditorComponent implements AfterViewInit {
    editorRef: ElementRef<HTMLTextAreaElement>;
    state: GraphStateService;
    copyLabel: import("@angular/core").WritableSignal<string>;
    private injector;
    private debounceTimer;
    private suppressUpdate;
    ngAfterViewInit(): void;
    onInput(event: Event): void;
    copyToClipboard(): Promise<void>;
    static ɵfac: i0.ɵɵFactoryDeclaration<TextEditorComponent, never>;
    static ɵcmp: i0.ɵɵComponentDeclaration<TextEditorComponent, "lib-text-editor", never, {}, {}, never, never, true, never>;
}
