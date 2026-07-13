import { MermaidSerializerService } from './mermaid-serializer.service';
import { MermaidDeserializerService } from './mermaid-deserializer.service';
import {
  FlowchartModel, FlowNode, FlowEdge, FlowSubgraph, createEmptyModel,
} from '../models/graph-model';

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

  // NOTE: possible bug — edge labels containing a pipe character cannot round-trip:
  // the serializer emits A -->|"a|b"| B but the deserializer's connector regex uses
  // [^|]* for the label, so the label is truncated and the remainder corrupts the
  // target segment. This test documents the lossy behavior.
  it('currently corrupts edge labels containing "|" (documents current behavior)', () => {
    const model = buildModel({
      nodes: [{ id: 'A', label: 'a', shape: 'rectangle' },
              { id: 'B', label: 'b', shape: 'rectangle' }],
      edges: [{ id: '1', sourceId: 'A', targetId: 'B', type: 'arrow', label: 'a|b' }],
    });
    const back = deserializer.deserialize(serializer.serialize(model))!;
    expect(back.edges[0].label).not.toBe('a|b');
  });
});
