import { Injectable } from '@angular/core';
import {
  FlowchartModel, FlowNode, FlowEdge, FlowDirection, FlowSubgraph,
  MermaidShape, MermaidEdgeType, createEmptyModel,
} from '../models/graph-model';

@Injectable({ providedIn: 'root' })
export class MermaidDeserializerService {

  deserialize(text: string): FlowchartModel | null {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'));

    const dirMatch = lines[0]?.match(/^(?:flowchart|graph)\s+(TD|TB|LR|RL|BT)/i);
    if (!dirMatch) return null;

    const direction = (dirMatch[1].toUpperCase() === 'TB' ? 'TD' : dirMatch[1].toUpperCase()) as FlowDirection;
    const model = createEmptyModel(direction);

    let edgeCounter = 0;
    const subgraphStack: FlowSubgraph[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      if (line === 'end') {
        subgraphStack.pop();
        continue;
      }

      const subgraphParsed = this.parseSubgraphLine(line);
      if (subgraphParsed) {
        const parentId = subgraphStack.length > 0 ? subgraphStack[subgraphStack.length - 1].id : undefined;
        const sg: FlowSubgraph = {
          id: subgraphParsed.id,
          label: subgraphParsed.label,
          nodeIds: [],
          parentId,
        };
        model.subgraphs.push(sg);
        subgraphStack.push(sg);
        continue;
      }

      const directionParsed = line.match(/^direction\s+(TD|TB|LR|RL|BT)$/i);
      if (directionParsed && subgraphStack.length > 0) {
        const d = directionParsed[1].toUpperCase() === 'TB' ? 'TD' : directionParsed[1].toUpperCase();
        subgraphStack[subgraphStack.length - 1].direction = d as FlowDirection;
        continue;
      }

      const chainEdges = this.parseChainEdge(line);
      if (chainEdges) {
        for (const edgeParsed of chainEdges) {
          this.ensureNode(model, edgeParsed.sourceId, edgeParsed.sourceLabel, edgeParsed.sourceShape);
          this.ensureNode(model, edgeParsed.targetId, edgeParsed.targetLabel, edgeParsed.targetShape);
          this.trackNodeInSubgraph(subgraphStack, edgeParsed.sourceId);
          this.trackNodeInSubgraph(subgraphStack, edgeParsed.targetId);
          model.edges.push({
            id: `e${edgeCounter++}`,
            sourceId: edgeParsed.sourceId,
            targetId: edgeParsed.targetId,
            label: edgeParsed.label,
            type: edgeParsed.type,
          });
        }
        continue;
      }

      const nodeParsed = this.parseNodeDef(line);
      if (nodeParsed) {
        this.ensureNode(model, nodeParsed.id, nodeParsed.label, nodeParsed.shape);
        this.trackNodeInSubgraph(subgraphStack, nodeParsed.id);
        continue;
      }
    }

    return model;
  }

  private trackNodeInSubgraph(stack: FlowSubgraph[], nodeId: string): void {
    if (stack.length > 0) {
      const current = stack[stack.length - 1];
      if (!current.nodeIds.includes(nodeId)) {
        current.nodeIds.push(nodeId);
      }
    }
  }

  private parseSubgraphLine(text: string): { id: string; label: string } | null {
    const match = text.match(/^subgraph\s+(\w+)\s*(?:\[([^\]]*)\])?\s*$/);
    if (!match) return null;
    const id = match[1];
    let label = match[2]?.trim() ?? id;
    if ((label.startsWith('"') && label.endsWith('"')) ||
        (label.startsWith("'") && label.endsWith("'"))) {
      label = label.slice(1, -1);
    }
    return { id, label };
  }

  private ensureNode(model: FlowchartModel, id: string, label?: string, shape?: MermaidShape): void {
    if (!model.nodes.has(id)) {
      model.nodes.set(id, { id, label: label ?? id, shape: shape ?? 'rectangle' });
    } else if (label && label !== id) {
      const existing = model.nodes.get(id)!;
      existing.label = label;
      if (shape) existing.shape = shape;
    }
  }

  private parseNodeDef(text: string): { id: string; label: string; shape: MermaidShape } | null {
    const match = text.match(/^(\w+)\s*([\[\(\{<>].*)/);
    if (!match) return null;

    const id = match[1];
    const rest = match[2];
    return this.parseShapeAndLabel(id, rest);
  }

  private parseShapeAndLabel(id: string, rest: string): { id: string; label: string; shape: MermaidShape } | null {
    const patterns: Array<{ open: string; close: string; shape: MermaidShape }> = [
      { open: '([', close: '])', shape: 'stadium' },
      { open: '((', close: '))', shape: 'circle' },
      { open: '[[', close: ']]', shape: 'subroutine' },
      { open: '[(', close: ')]', shape: 'cylinder' },
      { open: '{{', close: '}}', shape: 'hexagon' },
      { open: '[/', close: '\\]', shape: 'trapezoid' },
      { open: '[/', close: '/]', shape: 'parallelogram' },
      { open: '(', close: ')', shape: 'rounded' },
      { open: '{', close: '}', shape: 'diamond' },
      { open: '>', close: ']', shape: 'asymmetric' },
      { open: '[', close: ']', shape: 'rectangle' },
    ];

    for (const { open, close, shape } of patterns) {
      if (rest.startsWith(open) && rest.endsWith(close)) {
        let label = rest.slice(open.length, rest.length - close.length).trim();
        if ((label.startsWith('"') && label.endsWith('"')) ||
            (label.startsWith("'") && label.endsWith("'"))) {
          label = label.slice(1, -1);
        }
        label = label.replace(/#quot;/g, '"');
        return { id, label: label || id, shape };
      }
    }

    return null;
  }

  private parseChainEdge(text: string): Array<{
    sourceId: string; sourceLabel?: string; sourceShape?: MermaidShape;
    targetId: string; targetLabel?: string; targetShape?: MermaidShape;
    label?: string; type: MermaidEdgeType;
  }> | null {
    const edgeConnectors: Array<{ regex: RegExp; type: MermaidEdgeType }> = [
      { regex: /-\.->(?:\|([^|]*)\|)?/, type: 'dotted-arrow' },
      { regex: /==>(?:\|([^|]*)\|)?/,   type: 'thick-arrow' },
      { regex: /-->(?:\|([^|]*)\|)?/,    type: 'arrow' },
      { regex: /---(?:\|([^|]*)\|)?/,    type: 'open' },
    ];

    const combinedPattern = /(?:-\.->(?:\|[^|]*\|)?|==>(?:\|[^|]*\|)?|-->(?:\|[^|]*\|)?|---(?:\|[^|]*\|)?)/;
    if (!combinedPattern.test(text)) return null;

    const segments: string[] = [];
    const connectors: Array<{ type: MermaidEdgeType; label?: string }> = [];

    let remaining = text;
    while (remaining.length > 0) {
      let earliest: { index: number; matchLen: number; type: MermaidEdgeType; label?: string } | null = null;

      for (const { regex, type } of edgeConnectors) {
        const m = remaining.match(regex);
        if (m && m.index !== undefined) {
          if (!earliest || m.index < earliest.index) {
            let edgeLabel = m[1]?.trim();
            if (edgeLabel) {
              if ((edgeLabel.startsWith('"') && edgeLabel.endsWith('"')) ||
                  (edgeLabel.startsWith("'") && edgeLabel.endsWith("'"))) {
                edgeLabel = edgeLabel.slice(1, -1);
              }
              edgeLabel = edgeLabel.replace(/#quot;/g, '"');
            }
            earliest = { index: m.index, matchLen: m[0].length, type, label: edgeLabel || undefined };
          }
        }
      }

      if (!earliest) {
        segments.push(remaining.trim());
        break;
      }

      const beforeConnector = remaining.slice(0, earliest.index).trim();
      if (beforeConnector) {
        segments.push(beforeConnector);
      }
      connectors.push({ type: earliest.type, label: earliest.label });
      remaining = remaining.slice(earliest.index + earliest.matchLen);
    }

    if (segments.length < 2 || connectors.length < 1) return null;

    const edges: Array<{
      sourceId: string; sourceLabel?: string; sourceShape?: MermaidShape;
      targetId: string; targetLabel?: string; targetShape?: MermaidShape;
      label?: string; type: MermaidEdgeType;
    }> = [];

    for (let i = 0; i < connectors.length; i++) {
      const src = this.parseInlineNode(segments[i]);
      const tgt = this.parseInlineNode(segments[i + 1]);
      if (!src || !tgt) return null;

      edges.push({
        sourceId: src.id, sourceLabel: src.label, sourceShape: src.shape,
        targetId: tgt.id, targetLabel: tgt.label, targetShape: tgt.shape,
        label: connectors[i].label,
        type: connectors[i].type,
      });
    }

    return edges;
  }

  private parseInlineNode(text: string): { id: string; label?: string; shape?: MermaidShape } | null {
    const idMatch = text.match(/^(\w+)/);
    if (!idMatch) return null;

    const id = idMatch[1];
    const rest = text.slice(id.length).trim();

    if (!rest) return { id };

    const parsed = this.parseShapeAndLabel(id, rest);
    if (parsed) return { id: parsed.id, label: parsed.label, shape: parsed.shape };

    return { id };
  }
}
