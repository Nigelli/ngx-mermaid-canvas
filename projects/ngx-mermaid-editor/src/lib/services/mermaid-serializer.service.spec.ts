import { MermaidSerializerService } from './mermaid-serializer.service';
import {
  FlowchartModel, FlowNode, FlowEdge, FlowSubgraph,
  MermaidShape, MermaidEdgeType, createEmptyModel,
} from '../models/graph-model';

function node(id: string, label: string, shape: MermaidShape = 'rectangle'): FlowNode {
  return { id, label, shape };
}

function edge(id: string, sourceId: string, targetId: string,
              type: MermaidEdgeType = 'arrow', label?: string): FlowEdge {
  return { id, sourceId, targetId, type, label };
}

function modelWith(opts: {
  direction?: FlowchartModel['direction'];
  nodes?: FlowNode[];
  edges?: FlowEdge[];
  subgraphs?: FlowSubgraph[];
}): FlowchartModel {
  const m = createEmptyModel(opts.direction ?? 'TD');
  for (const n of opts.nodes ?? []) m.nodes.set(n.id, n);
  m.edges.push(...(opts.edges ?? []));
  m.subgraphs.push(...(opts.subgraphs ?? []));
  return m;
}

describe('MermaidSerializerService', () => {
  let service: MermaidSerializerService;

  beforeEach(() => {
    service = new MermaidSerializerService();
  });

  it('serializes an empty model as a bare flowchart header', () => {
    expect(service.serialize(createEmptyModel())).toBe('flowchart TD\n');
  });

  it('emits the model direction in the header', () => {
    expect(service.serialize(createEmptyModel('LR'))).toBe('flowchart LR\n');
    expect(service.serialize(createEmptyModel('RL'))).toBe('flowchart RL\n');
    expect(service.serialize(createEmptyModel('BT'))).toBe('flowchart BT\n');
  });

  describe('node shapes', () => {
    const cases: Array<[MermaidShape, string]> = [
      ['rectangle',     'A["Label"]'],
      ['rounded',       'A("Label")'],
      ['diamond',       'A{"Label"}'],
      ['circle',        'A(("Label"))'],
      ['stadium',       'A(["Label"])'],
      ['parallelogram', 'A[/"Label"/]'],
      ['subroutine',    'A[["Label"]]'],
      ['asymmetric',    'A>"Label"]'],
      ['hexagon',       'A{{"Label"}}'],
      ['cylinder',      'A[("Label")]'],
      ['trapezoid',     'A[/"Label"\\]'],
    ];

    for (const [shape, expected] of cases) {
      it(`serializes a ${shape} node as ${expected}`, () => {
        const m = modelWith({ nodes: [node('A', 'Label', shape)] });
        expect(service.serialize(m)).toBe(`flowchart TD\n    ${expected}\n`);
      });
    }
  });

  describe('edges', () => {
    const cases: Array<[MermaidEdgeType, string]> = [
      ['arrow',        'A --> B'],
      ['open',         'A --- B'],
      ['dotted-arrow', 'A -.-> B'],
      ['thick-arrow',  'A ==> B'],
    ];

    for (const [type, expected] of cases) {
      it(`serializes a ${type} edge as "${expected}"`, () => {
        const m = modelWith({
          nodes: [node('A', 'A'), node('B', 'B')],
          edges: [edge('e0', 'A', 'B', type)],
        });
        const out = service.serialize(m);
        expect(out).toContain(`    ${expected}\n`);
      });
    }

    it('serializes an edge label inside quoted pipes', () => {
      const m = modelWith({
        nodes: [node('A', 'A'), node('B', 'B')],
        edges: [edge('e0', 'A', 'B', 'arrow', 'yes')],
      });
      expect(service.serialize(m)).toContain('A -->|"yes"| B');
    });

    it('emits edges after nodes', () => {
      const m = modelWith({
        nodes: [node('A', 'Start'), node('B', 'End')],
        edges: [edge('e0', 'A', 'B')],
      });
      expect(service.serialize(m)).toBe(
        'flowchart TD\n    A["Start"]\n    B["End"]\n    A --> B\n');
    });
  });

  describe('label escaping', () => {
    it('escapes double quotes in node labels as #quot;', () => {
      const m = modelWith({ nodes: [node('A', 'say "hi"')] });
      expect(service.serialize(m)).toContain('A["say #quot;hi#quot;"]');
    });

    it('escapes double quotes in edge labels as #quot;', () => {
      const m = modelWith({
        nodes: [node('A', 'A'), node('B', 'B')],
        edges: [edge('e0', 'A', 'B', 'arrow', '"maybe"')],
      });
      expect(service.serialize(m)).toContain('A -->|"#quot;maybe#quot;"| B');
    });
  });

  describe('subgraphs', () => {
    it('serializes a subgraph with a label distinct from its id', () => {
      const m = modelWith({
        nodes: [node('A', 'a')],
        subgraphs: [{ id: 'sg1', label: 'Group A', nodeIds: ['A'] }],
      });
      expect(service.serialize(m)).toBe(
        'flowchart TD\n    subgraph sg1[Group A]\n        A["a"]\n    end\n');
    });

    it('omits the label bracket when the label equals the id', () => {
      const m = modelWith({
        nodes: [node('A', 'a')],
        subgraphs: [{ id: 'sg1', label: 'sg1', nodeIds: ['A'] }],
      });
      const out = service.serialize(m);
      expect(out).toContain('    subgraph sg1\n');
      expect(out).not.toContain('sg1[');
    });

    it('emits a direction line inside the subgraph when set', () => {
      const m = modelWith({
        nodes: [node('A', 'a')],
        subgraphs: [{ id: 'sg1', label: 'sg1', nodeIds: ['A'], direction: 'LR' }],
      });
      expect(service.serialize(m)).toBe(
        'flowchart TD\n    subgraph sg1\n        direction LR\n        A["a"]\n    end\n');
    });

    it('does not repeat subgraph nodes at the top level', () => {
      const m = modelWith({
        nodes: [node('A', 'a'), node('B', 'b')],
        subgraphs: [{ id: 'sg1', label: 'sg1', nodeIds: ['A'] }],
      });
      const out = service.serialize(m);
      // A appears exactly once (inside the subgraph); B stays top-level.
      expect(out.match(/A\["a"\]/g)!.length).toBe(1);
      expect(out).toContain('\n    B["b"]\n');
    });

    it('nests child subgraphs and keeps their nodes out of the parent body', () => {
      const m = modelWith({
        nodes: [node('A', 'a'), node('C', 'c')],
        subgraphs: [
          { id: 'outer', label: 'Outer', nodeIds: ['A', 'C'] },
          { id: 'inner', label: 'inner', nodeIds: ['C'], parentId: 'outer' },
        ],
      });
      expect(service.serialize(m)).toBe(
        'flowchart TD\n' +
        '    subgraph outer[Outer]\n' +
        '        subgraph inner\n' +
        '            C["c"]\n' +
        '        end\n' +
        '        A["a"]\n' +
        '    end\n');
    });
  });
});
