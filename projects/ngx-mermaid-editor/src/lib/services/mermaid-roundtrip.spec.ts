import { type CellStyle } from '@maxgraph/core';
import { MermaidSerializerService } from './mermaid-serializer.service';
import { MermaidDeserializerService } from './mermaid-deserializer.service';
import {
  FlowchartModel, FlowNode, FlowEdge, FlowSubgraph, createEmptyModel,
} from '../models/graph-model';
import { getVertexStyle, styleToShape } from '../models/shape-map';

/**
 * Round-trip properties between MermaidSerializerService and
 * MermaidDeserializerService:
 *
 * 1. Text fixpoint: for text already in the serializer's canonical format,
 *    serialize(deserialize(text)) === text.
 * 2. Model equivalence: deserialize(serialize(model)) preserves direction,
 *    nodes (id/label/shape), edges (endpoints/type/label) and subgraph
 *    structure. Edge ids and node coordinates are intentionally lossy:
 *    the serializer never emits them, and the deserializer regenerates
 *    edge ids as e0, e1, ...
 */
describe('Mermaid round-trip (serialize <-> deserialize)', () => {
  let serializer: MermaidSerializerService;
  let deserializer: MermaidDeserializerService;

  beforeEach(() => {
    serializer = new MermaidSerializerService();
    deserializer = new MermaidDeserializerService();
  });

  function buildModel(opts: {
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

  /** Strip fields that are round-trip lossy by design (edge id, node x/y/size). */
  function fingerprint(m: FlowchartModel) {
    return {
      direction: m.direction,
      nodes: Array.from(m.nodes.values())
        .map(n => ({ id: n.id, label: n.label, shape: n.shape }))
        .sort((a, b) => a.id.localeCompare(b.id)),
      edges: m.edges.map(e => ({
        sourceId: e.sourceId, targetId: e.targetId, type: e.type, label: e.label,
      })),
      subgraphs: m.subgraphs.map(s => ({
        id: s.id, label: s.label, nodeIds: [...s.nodeIds].sort(),
        direction: s.direction, parentId: s.parentId,
      })),
    };
  }

  function expectModelRoundTrip(model: FlowchartModel): void {
    const text = serializer.serialize(model);
    const back = deserializer.deserialize(text);
    expect(back).withContext(`deserialize failed for:\n${text}`).not.toBeNull();
    expect(fingerprint(back!)).toEqual(fingerprint(model));
    // And the text itself must be a fixpoint from here on.
    expect(serializer.serialize(back!)).toBe(text);
  }

  it('round-trips a simple two-node flow', () => {
    expectModelRoundTrip(buildModel({
      direction: 'LR',
      nodes: [
        { id: 'A', label: 'Start', shape: 'stadium' },
        { id: 'B', label: 'End', shape: 'stadium' },
      ],
      edges: [{ id: 'x1', sourceId: 'A', targetId: 'B', type: 'arrow' }],
    }));
  });

  it('round-trips every node shape', () => {
    const shapes: FlowNode['shape'][] = [
      'rectangle', 'rounded', 'diamond', 'circle', 'stadium', 'parallelogram',
      'subroutine', 'asymmetric', 'hexagon', 'cylinder', 'trapezoid',
    ];
    expectModelRoundTrip(buildModel({
      nodes: shapes.map((shape, i) => ({ id: `N${i}`, label: `Shape ${i}`, shape })),
    }));
  });

  it('round-trips every edge type with and without labels', () => {
    expectModelRoundTrip(buildModel({
      nodes: [
        { id: 'A', label: 'a', shape: 'rectangle' },
        { id: 'B', label: 'b', shape: 'rectangle' },
        { id: 'C', label: 'c', shape: 'rectangle' },
        { id: 'D', label: 'd', shape: 'rectangle' },
        { id: 'E', label: 'e', shape: 'rectangle' },
      ],
      edges: [
        { id: '1', sourceId: 'A', targetId: 'B', type: 'arrow' },
        { id: '2', sourceId: 'B', targetId: 'C', type: 'open' },
        { id: '3', sourceId: 'C', targetId: 'D', type: 'dotted-arrow', label: 'maybe' },
        { id: '4', sourceId: 'D', targetId: 'E', type: 'thick-arrow', label: 'yes!' },
        { id: '5', sourceId: 'A', targetId: 'E', type: 'open', label: 'skip' },
      ],
    }));
  });

  it('round-trips labels containing double quotes via #quot; escaping', () => {
    expectModelRoundTrip(buildModel({
      nodes: [{ id: 'A', label: 'He said "go"', shape: 'rectangle' },
              { id: 'B', label: 'b', shape: 'rectangle' }],
      edges: [{ id: '1', sourceId: 'A', targetId: 'B', type: 'arrow', label: 'the "word"' }],
    }));
  });

  it('round-trips subgraphs including nesting and per-subgraph direction', () => {
    expectModelRoundTrip(buildModel({
      direction: 'TD',
      nodes: [
        { id: 'A', label: 'a', shape: 'rectangle' },
        { id: 'B', label: 'b', shape: 'diamond' },
        { id: 'C', label: 'c', shape: 'rounded' },
        { id: 'D', label: 'd', shape: 'rectangle' },
      ],
      edges: [
        { id: '1', sourceId: 'A', targetId: 'B', type: 'arrow' },
        { id: '2', sourceId: 'B', targetId: 'D', type: 'dotted-arrow', label: 'out' },
      ],
      // Convention (matching the deserializer): a node belongs only to its
      // innermost subgraph; parent nodeIds do not repeat child-subgraph nodes.
      subgraphs: [
        { id: 'outer', label: 'Outer Group', nodeIds: ['A'] },
        { id: 'inner', label: 'inner', nodeIds: ['B'], parentId: 'outer', direction: 'LR' },
      ],
    }));
  });

  it('reaches a text fixpoint for a canonical document with subgraphs', () => {
    const text =
      'flowchart LR\n' +
      '    subgraph sg1[Group A]\n' +
      '        direction TD\n' +
      '        A["Start"]\n' +
      '        B{"Choice"}\n' +
      '    end\n' +
      '    C(["Done"])\n' +
      '    A --> B\n' +
      '    B -->|"yes"| C\n' +
      '    B -.->|"no"| A\n';
    const once = serializer.serialize(deserializer.deserialize(text)!);
    expect(once).toBe(text);
    // Idempotent thereafter.
    expect(serializer.serialize(deserializer.deserialize(once)!)).toBe(once);
  });

  it('stabilizes non-canonical input after one round-trip', () => {
    // Unquoted labels, chained edge, legacy "graph" keyword and TB direction.
    const text = 'graph TB\n  A[Start] --> B{Choice} -->|ok| C(Done)\n';
    const once = serializer.serialize(deserializer.deserialize(text)!);
    const twice = serializer.serialize(deserializer.deserialize(once)!);
    expect(twice).toBe(once);
    expect(once.startsWith('flowchart TD\n')).toBeTrue();
  });

  it('round-trips edge labels containing a pipe character', () => {
    expectModelRoundTrip(buildModel({
      nodes: [{ id: 'A', label: 'a', shape: 'rectangle' },
              { id: 'B', label: 'b', shape: 'rectangle' }],
      edges: [{ id: '1', sourceId: 'A', targetId: 'B', type: 'arrow', label: 'a|b' }],
    }));
  });

  it('round-trips labels containing edge-connector text', () => {
    expectModelRoundTrip(buildModel({
      nodes: [{ id: 'A', label: 'go --> stop', shape: 'rectangle' },
              { id: 'B', label: 'b ==> c', shape: 'rounded' }],
      edges: [{ id: '1', sourceId: 'A', targetId: 'B', type: 'arrow', label: 'x --> y | z' }],
    }));
  });

  it('keeps an asymmetric node asymmetric through a canvas style round-trip', () => {
    // Simulates a canvas edit: the node's maxGraph style is re-read via
    // styleToShape (as extractAndPushModel does) and must not collapse
    // `>label]` to a plain rectangle when re-serialized.
    const recovered = styleToShape(getVertexStyle('asymmetric') as CellStyle);
    expect(recovered).toBe('asymmetric');

    const text = serializer.serialize(buildModel({
      nodes: [{ id: 'A', label: 'Flag', shape: recovered }],
    }));
    expect(text).toContain('A>"Flag"]');
    expect(deserializer.deserialize(text)!.nodes.get('A')!.shape).toBe('asymmetric');
  });

  it('canvas style round-trip preserves every shape (styleToShape ∘ getVertexStyle)', () => {
    const shapes: FlowNode['shape'][] = [
      'rectangle', 'rounded', 'diamond', 'circle', 'stadium', 'parallelogram',
      'subroutine', 'asymmetric', 'hexagon', 'cylinder', 'trapezoid',
    ];
    for (const shape of shapes) {
      expect(styleToShape(getVertexStyle(shape) as CellStyle))
        .withContext(shape).toBe(shape);
    }
  });

  it('round-trips node ids containing hyphens and dots', () => {
    expectModelRoundTrip(buildModel({
      nodes: [
        { id: 'first-step', label: 'First', shape: 'rectangle' },
        { id: 'api.v2', label: 'API', shape: 'hexagon' },
      ],
      edges: [{ id: '1', sourceId: 'first-step', targetId: 'api.v2', type: 'arrow' }],
    }));
  });

  it('round-trips a subgraph whose id/title contains spaces', () => {
    expectModelRoundTrip(buildModel({
      nodes: [
        { id: 'A', label: 'a', shape: 'rectangle' },
        { id: 'B', label: 'b', shape: 'rectangle' },
      ],
      edges: [{ id: '1', sourceId: 'A', targetId: 'B', type: 'arrow' }],
      subgraphs: [{ id: 'My Title', label: 'My Title', nodeIds: ['A'] }],
    }));
  });

  it('stabilizes edge length variants and inline labels after one round-trip', () => {
    const text =
      'flowchart TD\n' +
      '  A ---> B\n' +
      '  B -..-> C\n' +
      '  C ====> D\n' +
      '  D ---- E\n' +
      '  A -- hop --> E\n';
    const model = deserializer.deserialize(text)!;
    expect(model.edges.map(e => e.type)).toEqual(
      ['arrow', 'dotted-arrow', 'thick-arrow', 'open', 'arrow']);
    expect(model.edges[4].label).toBe('hop');
    const once = serializer.serialize(model);
    expect(serializer.serialize(deserializer.deserialize(once)!)).toBe(once);
  });
});
