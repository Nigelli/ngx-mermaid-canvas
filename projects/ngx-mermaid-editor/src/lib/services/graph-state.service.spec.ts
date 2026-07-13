import { TestBed } from '@angular/core/testing';
import { GraphStateService } from './graph-state.service';
import { createEmptyModel } from '../models/graph-model';

describe('GraphStateService', () => {
  let service: GraphStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      // GraphStateService is @Injectable() without providedIn: 'root',
      // so it must be provided explicitly.
      providers: [GraphStateService],
    });
    service = TestBed.inject(GraphStateService);
  });

  it('starts with an empty model and default mermaid text', () => {
    expect(service.model().nodes.size).toBe(0);
    expect(service.mermaidText()).toBe('flowchart TD\n');
    expect(service.changeSource()).toBe('none');
    expect(service.textVersion()).toBe(0);
    expect(service.hasSelection()).toBeFalse();
  });

  describe('generateNodeId', () => {
    it('generates sequential alpha ids A, B, C, ...', () => {
      expect(service.generateNodeId()).toBe('A');
      expect(service.generateNodeId()).toBe('B');
      expect(service.generateNodeId()).toBe('C');
    });

    it('rolls over to AA after Z', () => {
      for (let i = 0; i < 26; i++) service.generateNodeId();
      expect(service.generateNodeId()).toBe('AA');
      expect(service.generateNodeId()).toBe('AB');
    });
  });

  describe('initFromText', () => {
    it('parses text, applies layout and re-serializes', () => {
      service.initFromText('flowchart LR\n    A[Start] --> B[End]\n');
      const model = service.model();
      expect(model.direction).toBe('LR');
      expect(model.nodes.size).toBe(2);
      // Layout must have assigned coordinates.
      expect(model.nodes.get('A')!.x).toBeDefined();
      expect(model.nodes.get('A')!.y).toBeDefined();
      expect(service.mermaidText()).toContain('flowchart LR');
      expect(service.mermaidText()).toContain('A --> B');
    });

    it('continues node id generation after existing alpha ids', () => {
      service.initFromText('flowchart TD\n    A --> C\n');
      // Highest existing alpha id is C, so the next generated id is D.
      expect(service.generateNodeId()).toBe('D');
    });

    it('resets state for empty text', () => {
      service.initFromText('flowchart TD\n    A --> B\n');
      service.initFromText('');
      expect(service.model().nodes.size).toBe(0);
      expect(service.mermaidText()).toBe('');
      expect(service.generateNodeId()).toBe('A');
    });

    it('ignores unparseable text', () => {
      service.initFromText('flowchart TD\n    A --> B\n');
      const before = service.model();
      service.initFromText('not a flowchart at all');
      expect(service.model()).toBe(before);
    });
  });

  describe('updateFromText', () => {
    it('updates the model, keeps the raw text and bumps textVersion', () => {
      const text = 'flowchart TD\n    A --> B\n';
      service.updateFromText(text);
      expect(service.model().nodes.size).toBe(2);
      expect(service.mermaidText()).toBe(text);
      expect(service.textVersion()).toBe(1);
      expect(service.changeSource()).toBe('text');
      service.updateFromText('flowchart TD\n    A --> B --> C\n');
      expect(service.textVersion()).toBe(2);
      expect(service.model().nodes.size).toBe(3);
    });

    it('does nothing for invalid text', () => {
      service.updateFromText('garbage');
      expect(service.model().nodes.size).toBe(0);
      expect(service.textVersion()).toBe(0);
      expect(service.mermaidText()).toBe('flowchart TD\n');
    });

    it('resets changeSource to none on the microtask queue', async () => {
      service.updateFromText('flowchart TD\n    A --> B\n');
      expect(service.changeSource()).toBe('text');
      await Promise.resolve();
      expect(service.changeSource()).toBe('none');
    });
  });

  describe('updateFromCanvas', () => {
    it('serializes the given model into mermaidText without bumping textVersion', () => {
      const m = createEmptyModel('LR');
      m.nodes.set('A', { id: 'A', label: 'Hello', shape: 'rounded' });
      service.updateFromCanvas(m);
      expect(service.model()).toBe(m);
      expect(service.mermaidText()).toBe('flowchart LR\n    A("Hello")\n');
      expect(service.textVersion()).toBe(0);
      expect(service.changeSource()).toBe('canvas');
    });
  });

  describe('setDirection', () => {
    it('changes direction, re-layouts and re-serializes', () => {
      service.updateFromText('flowchart TD\n    A --> B\n');
      service.setDirection('LR');
      expect(service.model().direction).toBe('LR');
      expect(service.mermaidText().startsWith('flowchart LR\n')).toBeTrue();
      // Nodes survive the direction change.
      expect(service.model().nodes.size).toBe(2);
    });
  });
});
