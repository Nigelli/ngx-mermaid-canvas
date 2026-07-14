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

    it('defaults to TD for a header with no direction', () => {
      expect(service.deserialize('flowchart')!.direction).toBe('TD');
      expect(service.deserialize('graph')!.direction).toBe('TD');
      expect(service.deserialize('flowchart;')!.direction).toBe('TD');
    });

    it('skips a leading YAML front-matter block before the header', () => {
      const m = service.deserialize(
        '---\ntitle: My Diagram\nconfig:\n  theme: dark\n---\nflowchart LR\n    A --> B')!;
      expect(m).not.toBeNull();
      expect(m.direction).toBe('LR');
      expect(m.nodes.size).toBe(2);
    });

    it('drops %% comments and %%{init}%% directives before the header', () => {
      const m = service.deserialize(
        '%% a leading comment\n%%{init: {"theme": "forest"}}%%\nflowchart TD\n    A --> B')!;
      expect(m).not.toBeNull();
      expect(m.direction).toBe('TD');
      expect(m.nodes.size).toBe(2);
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

    it('creates a default rectangle node from a bare-id declaration', () => {
      const m = service.deserialize('flowchart TD\n    A')!;
      expect(m.nodes.get('A')).toEqual({ id: 'A', label: 'A', shape: 'rectangle' });
    });

    it('does not let a bare-id line downgrade an already-defined node', () => {
      const m = service.deserialize('flowchart TD\n    A{"Decide"}\n    A')!;
      expect(m.nodes.get('A')).toEqual({ id: 'A', label: 'Decide', shape: 'diamond' });
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

    it('preserves a quoted node label containing an edge connector', () => {
      const m = service.deserialize('flowchart TD\n    A["go --> stop"]')!;
      expect(m.nodes.size).toBe(1);
      expect(m.nodes.get('A')!.label).toBe('go --> stop');
      expect(m.edges.length).toBe(0);
    });

    it('still parses a real edge whose inline source label contains "-->"', () => {
      const m = service.deserialize('flowchart TD\n    A["go --> stop"] --> B')!;
      expect(m.nodes.get('A')!.label).toBe('go --> stop');
      expect(m.edges.length).toBe(1);
      expect(m.edges[0]).toEqual(
        jasmine.objectContaining({ sourceId: 'A', targetId: 'B', type: 'arrow' }));
    });

    it('preserves a quoted edge label containing a pipe character', () => {
      const m = service.deserialize('flowchart TD\n    A -->|"a|b"| B')!;
      expect(m.edges.length).toBe(1);
      expect(m.edges[0].label).toBe('a|b');
      expect(m.edges[0].targetId).toBe('B');
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

    it('parses a quoted subgraph title', () => {
      const m = service.deserialize(
        'flowchart TD\n    subgraph "My Title"\n        A --> B\n    end\n    C')!;
      expect(m.subgraphs.length).toBe(1);
      expect(m.subgraphs[0].id).toBe('My Title');
      expect(m.subgraphs[0].label).toBe('My Title');
      expect(m.subgraphs[0].nodeIds).toEqual(['A', 'B']);
      expect(m.nodes.size).toBe(3);
    });

    it('parses an unquoted subgraph title containing spaces', () => {
      const m = service.deserialize(
        'flowchart TD\n    subgraph My Fancy Group\n        A\n    end\n    B')!;
      expect(m.subgraphs.length).toBe(1);
      expect(m.subgraphs[0].label).toBe('My Fancy Group');
      expect(m.subgraphs[0].nodeIds).toEqual(['A']);
    });

    it('does not let a spaced-title subgraph leak nodes or pop a parent scope', () => {
      const m = service.deserialize(
        'flowchart TD\n' +
        '    subgraph outer\n' +
        '        subgraph Inner Group\n' +
        '            A\n' +
        '        end\n' +
        '        B\n' +
        '    end\n')!;
      const outer = m.subgraphs.find(s => s.id === 'outer')!;
      const inner = m.subgraphs.find(s => s.label === 'Inner Group')!;
      expect(inner.parentId).toBe('outer');
      expect(inner.nodeIds).toEqual(['A']);
      expect(outer.nodeIds).toEqual(['B']);
    });
  });

  describe('edge length variants', () => {
    it('normalizes longer solid arrows (--->, ---->) to arrow', () => {
      const m = service.deserialize('flowchart TD\n    A ---> B\n    B ----> C')!;
      expect(m.edges.map(e => [e.sourceId, e.targetId, e.type])).toEqual([
        ['A', 'B', 'arrow'],
        ['B', 'C', 'arrow'],
      ]);
      expect(m.nodes.size).toBe(3);
    });

    it('normalizes longer thick arrows (===>, ====>) to thick-arrow', () => {
      const m = service.deserialize('flowchart TD\n    A ===> B\n    B ====> C')!;
      expect(m.edges.map(e => e.type)).toEqual(['thick-arrow', 'thick-arrow']);
    });

    it('normalizes longer dotted arrows (-..->, -...->) to dotted-arrow', () => {
      const m = service.deserialize('flowchart TD\n    A -..-> B\n    B -...-> C')!;
      expect(m.edges.map(e => e.type)).toEqual(['dotted-arrow', 'dotted-arrow']);
    });

    it('normalizes longer open links (----, -----) to open', () => {
      const m = service.deserialize('flowchart TD\n    A ---- B\n    B ----- C')!;
      expect(m.edges.map(e => e.type)).toEqual(['open', 'open']);
    });

    it('parses pipe labels on length variants', () => {
      const m = service.deserialize(
        'flowchart TD\n    A --->|go| B\n    B ====>|fast| C\n    C ----|flat| D')!;
      expect(m.edges.map(e => [e.type, e.label])).toEqual([
        ['arrow', 'go'],
        ['thick-arrow', 'fast'],
        ['open', 'flat'],
      ]);
    });

    it('parses length variants in chained edges', () => {
      const m = service.deserialize('flowchart TD\n    A ---> B ==> C -..-> D')!;
      expect(m.edges.map(e => [e.sourceId, e.targetId, e.type])).toEqual([
        ['A', 'B', 'arrow'],
        ['B', 'C', 'thick-arrow'],
        ['C', 'D', 'dotted-arrow'],
      ]);
    });
  });

  describe('inline edge labels', () => {
    it('parses A -- text --> B as an arrow with the label', () => {
      const m = service.deserialize('flowchart TD\n    A -- text --> B')!;
      expect(m.edges.length).toBe(1);
      expect(m.edges[0]).toEqual(jasmine.objectContaining(
        { sourceId: 'A', targetId: 'B', type: 'arrow', label: 'text' }));
    });

    it('parses A -. text .-> B as a dotted arrow with the label', () => {
      const m = service.deserialize('flowchart TD\n    A -. text .-> B')!;
      expect(m.edges.length).toBe(1);
      expect(m.edges[0]).toEqual(jasmine.objectContaining(
        { sourceId: 'A', targetId: 'B', type: 'dotted-arrow', label: 'text' }));
    });

    it('parses A == text ==> B as a thick arrow with the label', () => {
      const m = service.deserialize('flowchart TD\n    A == text ==> B')!;
      expect(m.edges.length).toBe(1);
      expect(m.edges[0]).toEqual(jasmine.objectContaining(
        { sourceId: 'A', targetId: 'B', type: 'thick-arrow', label: 'text' }));
    });

    it('parses inline labels written without surrounding spaces', () => {
      const m = service.deserialize('flowchart TD\n    A--go-->B')!;
      expect(m.edges[0]).toEqual(jasmine.objectContaining(
        { sourceId: 'A', targetId: 'B', type: 'arrow', label: 'go' }));
    });

    it('keeps quoted inline labels with edge-connector text intact', () => {
      const m = service.deserialize('flowchart TD\n    A -- "x --> y" --> B')!;
      expect(m.edges.length).toBe(1);
      expect(m.edges[0].label).toBe('x --> y');
      expect(m.edges[0].targetId).toBe('B');
    });

    it('unescapes #quot; in inline labels', () => {
      const m = service.deserialize('flowchart TD\n    A -- say #quot;hi#quot; --> B')!;
      expect(m.edges[0].label).toBe('say "hi"');
    });

    it('parses inline node definitions around an inline-labeled edge', () => {
      const m = service.deserialize('flowchart TD\n    A[Start] -- go --> B{Choice?}')!;
      expect(m.nodes.get('A')).toEqual({ id: 'A', label: 'Start', shape: 'rectangle' });
      expect(m.nodes.get('B')).toEqual({ id: 'B', label: 'Choice?', shape: 'diamond' });
      expect(m.edges[0].label).toBe('go');
    });
  });

  describe('& node lists', () => {
    it('expands A & B --> C & D into the cross-product of edges', () => {
      const m = service.deserialize('flowchart TD\n    A & B --> C & D')!;
      expect(m.nodes.size).toBe(4);
      expect(m.edges.map(e => [e.sourceId, e.targetId])).toEqual([
        ['A', 'C'], ['A', 'D'], ['B', 'C'], ['B', 'D'],
      ]);
      expect(m.edges.every(e => e.type === 'arrow')).toBeTrue();
      expect(m.edges.map(e => e.id)).toEqual(['e0', 'e1', 'e2', 'e3']);
    });

    it('applies the edge label and type to every expanded edge', () => {
      const m = service.deserialize('flowchart TD\n    A & B -.->|both| C')!;
      expect(m.edges.map(e => [e.sourceId, e.targetId, e.type, e.label])).toEqual([
        ['A', 'C', 'dotted-arrow', 'both'],
        ['B', 'C', 'dotted-arrow', 'both'],
      ]);
    });

    it('parses inline node definitions inside a node list', () => {
      const m = service.deserialize('flowchart TD\n    A[Start] & B(Other) --> C')!;
      expect(m.nodes.get('A')).toEqual({ id: 'A', label: 'Start', shape: 'rectangle' });
      expect(m.nodes.get('B')).toEqual({ id: 'B', label: 'Other', shape: 'rounded' });
      expect(m.edges.length).toBe(2);
    });

    it('does not split on & inside a quoted node label', () => {
      const m = service.deserialize('flowchart TD\n    A["a & b"] --> C')!;
      expect(m.nodes.size).toBe(2);
      expect(m.nodes.get('A')!.label).toBe('a & b');
      expect(m.edges.length).toBe(1);
    });
  });

  describe('lenient node ids', () => {
    it('allows hyphens and dots in edge endpoint ids', () => {
      const m = service.deserialize('flowchart TD\n    first-step --> v1.2')!;
      expect(m.nodes.get('first-step')).toBeDefined();
      expect(m.nodes.get('v1.2')).toBeDefined();
      expect(m.edges[0]).toEqual(jasmine.objectContaining(
        { sourceId: 'first-step', targetId: 'v1.2', type: 'arrow' }));
    });

    it('allows hyphens and dots in node definitions and bare declarations', () => {
      const m = service.deserialize(
        'flowchart TD\n    my-node[Label]\n    api.v2{"Check"}\n    plain-id')!;
      expect(m.nodes.get('my-node')).toEqual(
        { id: 'my-node', label: 'Label', shape: 'rectangle' });
      expect(m.nodes.get('api.v2')).toEqual(
        { id: 'api.v2', label: 'Check', shape: 'diamond' });
      expect(m.nodes.get('plain-id')).toEqual(
        { id: 'plain-id', label: 'plain-id', shape: 'rectangle' });
    });

    it('keeps hyphenated ids distinct from edge connectors', () => {
      const m = service.deserialize('flowchart TD\n    a-b-->c-d')!;
      expect(m.edges[0]).toEqual(jasmine.objectContaining(
        { sourceId: 'a-b', targetId: 'c-d', type: 'arrow' }));
      expect(m.nodes.size).toBe(2);
    });
  });
});
