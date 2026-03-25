import { Injectable, signal, WritableSignal } from '@angular/core';
import { FlowchartModel, FlowDirection, createEmptyModel, FlowNode, FlowEdge, MermaidShape, cloneModel } from '../models/graph-model';
import { MermaidSerializerService } from './mermaid-serializer.service';
import { MermaidDeserializerService } from './mermaid-deserializer.service';
import { LayoutService } from './layout.service';

export type ChangeSource = 'canvas' | 'text' | 'none';

@Injectable({ providedIn: 'root' })
export class GraphStateService {

  readonly model: WritableSignal<FlowchartModel> = signal(createEmptyModel());
  readonly mermaidText: WritableSignal<string> = signal('flowchart TD\n');
  readonly changeSource: WritableSignal<ChangeSource> = signal('none');

  /**
   * Monotonically increasing version that bumps on every text-originated change.
   * The canvas effect watches this instead of changeSource (which resets too fast).
   */
  readonly textVersion: WritableSignal<number> = signal(0);

  private nodeCounter = 0;

  constructor(
    private serializer: MermaidSerializerService,
    private deserializer: MermaidDeserializerService,
    private layout: LayoutService,
  ) {}

  /** Called when the visual canvas changes the model */
  updateFromCanvas(model: FlowchartModel): void {
    this.changeSource.set('canvas');
    this.model.set(model);
    this.mermaidText.set(this.serializer.serialize(model));
    queueMicrotask(() => this.changeSource.set('none'));
  }

  /** Called when the text editor content changes */
  updateFromText(text: string): void {
    const parsed = this.deserializer.deserialize(text);
    if (!parsed) return;

    this.changeSource.set('text');
    const laid = this.layout.applyLayout(parsed);
    this.model.set(laid);
    this.mermaidText.set(text);
    // Bump version so the canvas effect knows to sync
    this.textVersion.update(v => v + 1);
    queueMicrotask(() => this.changeSource.set('none'));
  }

  /** Set initial state from input binding */
  initFromText(text: string): void {
    const parsed = this.deserializer.deserialize(text);
    if (!parsed) return;

    const laid = this.layout.applyLayout(parsed);
    this.model.set(laid);
    this.mermaidText.set(this.serializer.serialize(laid));
    for (const id of laid.nodes.keys()) {
      this.trackNodeId(id);
    }
  }

  setDirection(dir: FlowDirection): void {
    const current = cloneModel(this.model());
    current.direction = dir;
    const laid = this.layout.applyLayout(current);
    this.changeSource.set('canvas');
    this.model.set(laid);
    this.mermaidText.set(this.serializer.serialize(laid));
    queueMicrotask(() => this.changeSource.set('none'));
  }

  generateNodeId(): string {
    const id = this.toAlphaId(this.nodeCounter++);
    return id;
  }

  private trackNodeId(id: string): void {
    // If the ID is a simple alpha ID, update counter
    const num = this.fromAlphaId(id);
    if (num !== null && num >= this.nodeCounter) {
      this.nodeCounter = num + 1;
    }
  }

  /** Convert number to A, B, ..., Z, AA, AB, ... */
  private toAlphaId(n: number): string {
    let result = '';
    let num = n;
    do {
      result = String.fromCharCode(65 + (num % 26)) + result;
      num = Math.floor(num / 26) - 1;
    } while (num >= 0);
    return result;
  }

  private fromAlphaId(id: string): number | null {
    if (!/^[A-Z]+$/.test(id)) return null;
    let result = 0;
    for (let i = 0; i < id.length; i++) {
      result = result * 26 + (id.charCodeAt(i) - 64);
    }
    return result - 1;
  }
}
