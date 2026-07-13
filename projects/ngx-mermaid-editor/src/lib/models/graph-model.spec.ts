import { createEmptyModel, cloneModel, FlowchartModel } from './graph-model';

describe('graph-model helpers', () => {

  describe('createEmptyModel', () => {
    it('defaults to TD direction with empty collections', () => {
      const m = createEmptyModel();
      expect(m.direction).toBe('TD');
      expect(m.nodes.size).toBe(0);
      expect(m.edges).toEqual([]);
      expect(m.subgraphs).toEqual([]);
    });

    it('accepts an explicit direction', () => {
      expect(createEmptyModel('LR').direction).toBe('LR');
      expect(createEmptyModel('BT').direction).toBe('BT');
    });

    it('returns independent instances', () => {
      const a = createEmptyModel();
      const b = createEmptyModel();
      a.nodes.set('X', { id: 'X', label: 'x', shape: 'rectangle' });
      a.edges.push({ id: 'e0', sourceId: 'X', targetId: 'X', type: 'arrow' });
      a.subgraphs.push({ id: 'sg', label: 'sg', nodeIds: [] });
      expect(b.nodes.size).toBe(0);
      expect(b.edges.length).toBe(0);
      expect(b.subgraphs.length).toBe(0);
    });
  });

  describe('cloneModel', () => {
    function sample(): FlowchartModel {
      const m = createEmptyModel('LR');
      m.nodes.set('A', { id: 'A', label: 'a', shape: 'diamond', x: 10, y: 20, width: 100, height: 80 });
      m.nodes.set('B', { id: 'B', label: 'b', shape: 'rectangle' });
      m.edges.push({ id: 'e0', sourceId: 'A', targetId: 'B', type: 'arrow', label: 'go' });
      m.subgraphs.push({ id: 'sg1', label: 'Group', nodeIds: ['A', 'B'], direction: 'TD' });
      return m;
    }

    it('produces a structurally equal copy', () => {
      const original = sample();
      const clone = cloneModel(original);
      expect(clone.direction).toBe('LR');
      expect(Array.from(clone.nodes.entries())).toEqual(Array.from(original.nodes.entries()));
      expect(clone.edges).toEqual(original.edges);
      expect(clone.subgraphs).toEqual(original.subgraphs);
      expect(clone).not.toBe(original);
      expect(clone.nodes).not.toBe(original.nodes);
    });

    it('deep-clones nodes: mutating a cloned node does not affect the original', () => {
      const original = sample();
      const clone = cloneModel(original);
      clone.nodes.get('A')!.label = 'changed';
      clone.nodes.get('A')!.x = 999;
      clone.nodes.set('C', { id: 'C', label: 'c', shape: 'circle' });
      expect(original.nodes.get('A')!.label).toBe('a');
      expect(original.nodes.get('A')!.x).toBe(10);
      expect(original.nodes.has('C')).toBeFalse();
    });

    it('deep-clones edges: mutating a cloned edge does not affect the original', () => {
      const original = sample();
      const clone = cloneModel(original);
      clone.edges[0].label = 'changed';
      clone.edges.push({ id: 'e1', sourceId: 'B', targetId: 'A', type: 'open' });
      expect(original.edges[0].label).toBe('go');
      expect(original.edges.length).toBe(1);
    });

    it('deep-clones subgraphs including nodeIds arrays', () => {
      const original = sample();
      const clone = cloneModel(original);
      clone.subgraphs[0].label = 'changed';
      clone.subgraphs[0].nodeIds.push('Z');
      clone.subgraphs.push({ id: 'sg2', label: 'sg2', nodeIds: [] });
      expect(original.subgraphs[0].label).toBe('Group');
      expect(original.subgraphs[0].nodeIds).toEqual(['A', 'B']);
      expect(original.subgraphs.length).toBe(1);
    });
  });
});
