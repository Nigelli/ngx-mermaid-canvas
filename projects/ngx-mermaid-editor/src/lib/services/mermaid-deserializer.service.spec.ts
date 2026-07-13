import { MermaidDeserializerService } from './mermaid-deserializer.service';
import { MermaidShape } from '../models/graph-model';

describe('MermaidDeserializerService', () => {
  let service: MermaidDeserializerService;

  beforeEach(() => {
    service = new MermaidDeserializerService();
  });

  describe('header / direction', () => {
    it('returns null for empty input', () => {
      expect(service.deserialize('')).toBeNull();
      expect(service.deserialize('   \n  \n')).toBeNull();
    });

    it('returns null when the first line is not a flowchart header', () => {
      expect(service.deserialize('sequenceDiagram\n  A->>B: hi')).toBeNull();
      expect(service.deserialize('hello world')).toBeNull();
      expect(service.deserialize('flowchart XX')).toBeNull();
    });

    it('parses each direction from the header', () => {
      expect(service.deserialize('flowchart TD')!.direction).toBe('TD');
      expect(service.deserialize('flowchart LR')!.direction).toBe('LR');
      expect(service.deserialize('flowchart RL')!.direction).toBe('RL');
      expect(service.deserialize('flowchart BT')!.direction).toBe('BT');
    });

    it('normalizes TB to TD and accepts the legacy "graph" keyword', () => {
      expect(service.deserialize('flowchart TB')!.direction).toBe('TD');
      expect(service.deserialize('graph LR')!.direction).toBe('LR');
      expect(service.deserialize('graph tb')!.direction).toBe('TD');
    });

    it('returns an empty model for a header-only document', () => {
      const m = service.deserialize('flowchart TD')!;
      expect(m.nodes.size).toBe(0);
      expect(m.edges).toEqual([]);
      expect(m.subgraphs).toEqual([]);
    });
  });

  describe('node definitions and shapes', () => {
    const cases: Array<[string, MermaidShape]> = [
      ['A["Label"]',      'rectangle'],
      ['A("Label")',      'rounded'],
      ['A{"Label"}',      'diamond'],
      ['A(("Label"))',    'circle'],
      ['A(["Label"])',    'stadium'],
      ['A[/"Label"/]',    'parallelogram'],
      ['A[["Label"]]',    'subroutine'],
      ['A>"Label"]',      'asymmetric'],
      ['A{{"Label"}}',    'hexagon'],
      ['A[("Label")]',    'cylinder'],
      ['A[/"Label"\\]',   'trapezoid'],
    ];

    for (const [line, shape] of cases) {
      it(`parses ${line} as a ${shape} node`, () => {
        const m = service.deserialize(`flowchart TD\n    ${line}`)!;
        const n = m.nodes.get('A')!;
        expect(n).toBeDefined();
        expect(n.shape).toBe(shape);
        expect(n.label).toBe('Label');
      });
    }

    it('parses unquoted and single-quoted labels', () => {
      const m1 = service.deserialize("flowchart TD\n    A[Plain text]")!;
      expect(m1.nodes.get('A')!.label).toBe('Plain text');
      const m2 = service.deserialize("flowchart TD\n    A['Single']")!;
      expect(m2.nodes.get('A')!.label).toBe('Single');
    });

    it('unescapes #quot; back to double quotes', () => {
      const m = service.deserialize('flowchart TD\n    A["say #quot;hi#quot;"]')!;
      expect(m.nodes.get('A')!.label).toBe('say "hi"');
    });

    it('falls back to the id when the label is empty', () => {
      const m = service.deserialize('flowchart TD\n    A[""]')!;
      expect(m.nodes.get('A')!.label).toBe('A');
    });

    // NOTE: possible bug — valid Mermaid allows declaring a node as a bare id on its
    // own line (e.g. "A"), but parseNodeDef requires a shape bracket, so such lines
    // are silently dropped and the node never enters the model.
    it('currently ignores bare-id node declarations (documents current behavior)', () => {
      const m = service.deserialize('flowchart TD\n    A')!;
      expect(m.nodes.size).toBe(0);
    });

    it('skips comment lines and unrecognized statements', () => {
      const m = service.deserialize(
        'flowchart TD\n%% a comment\n    classDef foo fill:#f00\n    A["ok"]')!;
      expect(m.nodes.size).toBe(1);
      expect(m.nodes.get('A')!.label).toBe('ok');
    });
  });

  describe('edges', () => {
    it('parses all four edge types', () => {
      const m = service.deserialize(
        'flowchart TD\n    A --> B\n    B --- C\n    C -.-> D\n    D ==> E')!;
      expect(m.edges.map(e => e.type)).toEqual(
        ['arrow', 'open', 'dotted-arrow', 'thick-arrow']);
      expect(m.nodes.size).toBe(5);
    });

    it('creates implicit rectangle nodes for bare edge endpoints', () => {
      const m = service.deserialize('flowchart TD\n    A --> B')!;
      expect(m.nodes.get('A')).toEqual({ id: 'A', label: 'A', shape: 'rectangle' });
      expect(m.nodes.get('B')).toEqual({ id: 'B', label: 'B', shape: 'rectangle' });
      expect(m.edges.length).toBe(1);
      expect(m.edges[0].sourceId).toBe('A');
      expect(m.edges[0].targetId).toBe('B');
      expect(m.edges[0].label).toBeUndefined();
    });

    it('parses quoted and unquoted edge labels', () => {
      const m1 = service.deserialize('flowchart TD\n    A -->|"yes"| B')!;
      expect(m1.edges[0].label).toBe('yes');
      const m2 = service.deserialize('flowchart TD\n    A -->|no| B')!;
      expect(m2.edges[0].label).toBe('no');
    });

    it('parses edge labels on every edge type', () => {
      const m = service.deserialize(
        'flowchart TD\n    A -->|a| B\n    B ---|b| C\n    C -.->|c| D\n    D ==>|d| E')!;
      expect(m.edges.map(e => e.label)).toEqual(['a', 'b', 'c', 'd']);
    });

    it('parses inline node definitions on edge endpoints', () => {
      const m = service.deserialize('flowchart TD\n    A[Start] --> B{Choice?}')!;
      expect(m.nodes.get('A')).toEqual({ id: 'A', label: 'Start', shape: 'rectangle' });
      expect(m.nodes.get('B')).toEqual({ id: 'B', label: 'Choice?', shape: 'diamond' });
    });

    it('parses chained edges into one edge per hop', () => {
      const m = service.deserialize('flowchart TD\n    A --> B --> C -.-> D')!;
      expect(m.edges.length).toBe(3);
      expect(m.edges.map(e => [e.sourceId, e.targetId, e.type])).toEqual([
        ['A', 'B', 'arrow'],
        ['B', 'C', 'arrow'],
        ['C', 'D', 'dotted-arrow'],
      ]);
    });

    it('assigns sequential edge ids', () => {
      const m = service.deserialize('flowchart TD\n    A --> B\n    B --> C')!;
      expect(m.edges.map(e => e.id)).toEqual(['e0', 'e1']);
    });

    it('upgrades an implicit node when a later definition provides shape/label', () => {
      const m = service.deserialize('flowchart TD\n    A --> B\n    B{"Decide"}')!;
      expect(m.nodes.get('B')).toEqual({ id: 'B', label: 'Decide', shape: 'diamond' });
    });

    // NOTE: possible bug — a node whose LABEL contains an edge connector (e.g. "-->")
    // is misparsed as an edge because parseChainEdge runs before parseNodeDef and does
    // not respect quoted strings. `A["go --> stop"]` yields nodes A and "stop" plus a
    // spurious edge, and the label text is lost.
    it('currently misparses a node label containing "-->" as an edge (documents current behavior)', () => {
      const m = service.deserialize('flowchart TD\n    A["go --> stop"]')!;
      expect(m.nodes.get('A')!.label).toBe('A');       // label lost
      expect(m.nodes.has('stop')).toBeTrue();          // spurious node
      expect(m.edges.length).toBe(1);                  // spurious edge
      expect(m.edges[0]).toEqual(jasmine.objectContaining({ sourceId: 'A', targetId: 'stop' }));
    });
  });

  describe('subgraphs', () => {
    it('parses a subgraph with an explicit label and collects its nodes', () => {
      const m = service.deserialize(
        'flowchart TD\n    subgraph sg1[Group A]\n        A["a"]\n        B["b"]\n    end\n    C["c"]')!;
      expect(m.subgraphs.length).toBe(1);
      const sg = m.subgraphs[0];
      expect(sg.id).toBe('sg1');
      expect(sg.label).toBe('Group A');
      expect(sg.nodeIds).toEqual(['A', 'B']);
      expect(sg.parentId).toBeUndefined();
      expect(m.nodes.size).toBe(3);
    });

    it('defaults the subgraph label to its id and strips quoted labels', () => {
      const m1 = service.deserialize('flowchart TD\n    subgraph sg1\n    end')!;
      expect(m1.subgraphs[0].label).toBe('sg1');
      const m2 = service.deserialize('flowchart TD\n    subgraph sg1["Quoted"]\n    end')!;
      expect(m2.subgraphs[0].label).toBe('Quoted');
    });

    it('parses a direction statement inside a subgraph (normalizing TB)', () => {
      const m = service.deserialize(
        'flowchart TD\n    subgraph sg1\n        direction TB\n        A\n    end')!;
      expect(m.subgraphs[0].direction).toBe('TD');
    });

    it('tracks nesting via parentId and assigns nodes to the innermost subgraph', () => {
      const m = service.deserialize(
        'flowchart TD\n' +
        '    subgraph outer[Outer]\n' +
        '        A["a"]\n' +
        '        subgraph inner\n' +
        '            B["b"]\n' +
        '        end\n' +
        '    end\n')!;
      const outer = m.subgraphs.find(s => s.id === 'outer')!;
      const inner = m.subgraphs.find(s => s.id === 'inner')!;
      expect(inner.parentId).toBe('outer');
      expect(outer.parentId).toBeUndefined();
      expect(outer.nodeIds).toEqual(['A']);
      expect(inner.nodeIds).toEqual(['B']);
    });

    it('associates edge endpoints declared inside a subgraph with that subgraph', () => {
      const m = service.deserialize(
        'flowchart TD\n    subgraph sg1\n        A --> B\n    end')!;
      expect(m.subgraphs[0].nodeIds).toEqual(['A', 'B']);
      expect(m.edges.length).toBe(1);
    });

    it('does not duplicate node ids within a subgraph', () => {
      const m = service.deserialize(
        'flowchart TD\n    subgraph sg1\n        A --> B\n        A --> C\n    end')!;
      expect(m.subgraphs[0].nodeIds).toEqual(['A', 'B', 'C']);
    });
  });
});
