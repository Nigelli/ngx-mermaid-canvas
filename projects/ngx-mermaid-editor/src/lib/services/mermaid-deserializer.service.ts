import { Injectable } from '@angular/core';
import {
  FlowchartModel, FlowNode, FlowEdge, FlowDirection, FlowSubgraph,
  MermaidShape, MermaidEdgeType, createEmptyModel,
} from '../models/graph-model';

@Injectable({ providedIn: 'root' })
export class MermaidDeserializerService {

  deserialize(text: string): FlowchartModel | null {
    // Skip a leading YAML front-matter block (--- ... ---) before the diagram.
    let source = text;
    const frontMatter = source.match(/^﻿?[ \t]*---[ \t]*\r?\n[\s\S]*?\r?\n[ \t]*---[ \t]*(?:\r?\n|$)/);
    if (frontMatter) source = source.slice(frontMatter[0].length);

    // %% comments and %%{init: ...}%% directives are dropped wherever they
    // appear, including before the header line.
    const lines = source.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'));

    // A header with no direction is valid Mermaid and defaults to TB (-> TD).
    const dirMatch = lines[0]?.match(/^(?:flowchart|graph)(?:\s+(TD|TB|LR|RL|BT))?\s*;?\s*$/i);
    if (!dirMatch) return null;

    const rawDirection = (dirMatch[1] ?? 'TD').toUpperCase();
    const direction = (rawDirection === 'TB' ? 'TD' : rawDirection) as FlowDirection;
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

      // Ids may contain '-' and '.', but only as single separators between
      // word characters — runs like '--' stay reserved for edge connectors.
      const bareId = line.match(/^\w+(?:[-.]\w+)*$/);
      if (bareId) {
        this.ensureNode(model, bareId[0]);
        this.trackNodeInSubgraph(subgraphStack, bareId[0]);
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
    const match = text.match(/^subgraph\s+(.+?)\s*$/);
    if (!match) return null;
    const rest = match[1];

    // Canonical `id[label]` form (the id may contain '-' and '.').
    const idLabel = rest.match(/^(\w+(?:[-.]\w+)*)\s*\[([^\]]*)\]$/);
    if (idLabel) {
      const id = idLabel[1];
      const label = this.stripQuotes(idLabel[2].trim());
      return { id, label: label || id };
    }

    // Bare title: `subgraph sg1`, `subgraph "My Title"`, `subgraph My Title`.
    // The title doubles as the id, matching Mermaid's behavior of keying the
    // subgraph by its text when no explicit id is given.
    const title = this.stripQuotes(rest);
    return { id: title, label: title };
  }

  private stripQuotes(s: string): string {
    if ((s.startsWith('"') && s.endsWith('"')) ||
        (s.startsWith("'") && s.endsWith("'"))) {
      return s.slice(1, -1);
    }
    return s;
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
    const match = text.match(/^(\w+(?:[-.]\w+)*)\s*([\[\(\{<>].*)/);
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
    // Each connector regex accepts Mermaid's length variants (extra '-', '='
    // or '.' characters only change the rendered edge length, never its type)
    // plus the inline-label form (`A -- text --> B`). Group 1 captures a
    // |pipe label|, group 2 an inline label; the 'd' flag exposes group
    // indices so label text can be sliced from the unmasked line.
    //
    // TODO(roadmap): bidirectional (<-->, <-.->, <==>), circle/cross heads
    // (--o, --x, o--o, x--x), invisible (~~~), dotted-open (-.-) and
    // thick-open (===) links need new model fields; they are intentionally
    // NOT coerced onto the four existing edge types (guarded by the
    // lookarounds below so such lines keep their previous behavior).
    const edgeConnectors: Array<{ regex: RegExp; type: MermaidEdgeType }> = [
      { regex: /-\.+->(?:\|([^|]*)\|)?|(?<!-)-\.(?![.\-])((?:[^.]|\.(?!->))+?)\.->/d, type: 'dotted-arrow' },
      { regex: /={2,}>(?:\|([^|]*)\|)?|(?<!=)==(?![=>])([^=]+?)==>/d, type: 'thick-arrow' },
      { regex: /-{2,}>(?:\|([^|]*)\|)?|(?<!-)--(?![\->])((?:[^-]|-(?!->))+?)-->/d, type: 'arrow' },
      { regex: /-{3,}(?![>.\-])(?:\|([^|]*)\|)?/d, type: 'open' },
    ];

    // Connectors and label delimiters are searched on a copy of the line with
    // quoted content blanked out, so "-->" or "|" inside a quoted label is
    // never mistaken for edge syntax. Actual text is sliced from the original.
    const masked = this.maskQuotedContent(text);

    if (!edgeConnectors.some(({ regex }) => regex.test(masked))) return null;

    const segments: string[] = [];
    const connectors: Array<{ type: MermaidEdgeType; label?: string }> = [];

    let remaining = text;
    let remainingMasked = masked;
    while (remaining.length > 0) {
      let earliest: { index: number; matchLen: number; type: MermaidEdgeType; label?: string } | null = null;

      for (const { regex, type } of edgeConnectors) {
        const m = remainingMasked.match(regex);
        if (m && m.index !== undefined) {
          if (!earliest || m.index < earliest.index) {
            let edgeLabel: string | undefined;
            const labelGroup = m[1] !== undefined ? 1 : m[2] !== undefined ? 2 : 0;
            const span = labelGroup > 0 ? m.indices?.[labelGroup] : undefined;
            if (span) {
              // Take the label from the unmasked text at the group's position.
              edgeLabel = remaining.slice(span[0], span[1]).trim();
              if (edgeLabel) {
                if ((edgeLabel.startsWith('"') && edgeLabel.endsWith('"')) ||
                    (edgeLabel.startsWith("'") && edgeLabel.endsWith("'"))) {
                  edgeLabel = edgeLabel.slice(1, -1);
                }
                edgeLabel = edgeLabel.replace(/#quot;/g, '"');
              }
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
      remainingMasked = remainingMasked.slice(earliest.index + earliest.matchLen);
    }

    if (segments.length < 2 || connectors.length < 1) return null;

    // Each segment may be an '&'-separated node list (`A & B --> C & D`);
    // a connector between two lists expands to the cross-product of edges.
    const segmentNodes: Array<Array<{ id: string; label?: string; shape?: MermaidShape }>> = [];
    for (const segment of segments) {
      const nodes = this.parseNodeList(segment);
      if (!nodes) return null;
      segmentNodes.push(nodes);
    }

    const edges: Array<{
      sourceId: string; sourceLabel?: string; sourceShape?: MermaidShape;
      targetId: string; targetLabel?: string; targetShape?: MermaidShape;
      label?: string; type: MermaidEdgeType;
    }> = [];

    for (let i = 0; i < connectors.length; i++) {
      for (const src of segmentNodes[i]) {
        for (const tgt of segmentNodes[i + 1]) {
          edges.push({
            sourceId: src.id, sourceLabel: src.label, sourceShape: src.shape,
            targetId: tgt.id, targetLabel: tgt.label, targetShape: tgt.shape,
            label: connectors[i].label,
            type: connectors[i].type,
          });
        }
      }
    }

    return edges;
  }

  /**
   * Parses an edge-endpoint segment that may be an '&'-separated node list
   * (`A & B[label]`). Splitting only happens at '&' characters outside quoted
   * content and outside shape delimiters, so labels like `A["a & b"]` stay
   * intact. Returns null if any list entry is not a parseable node.
   */
  private parseNodeList(text: string): Array<{ id: string; label?: string; shape?: MermaidShape }> | null {
    const masked = this.maskQuotedContent(text);
    const parts: string[] = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < masked.length; i++) {
      const ch = masked[i];
      if (ch === '[' || ch === '(' || ch === '{') {
        depth++;
      } else if (ch === ']' || ch === ')' || ch === '}') {
        // Clamped so the asymmetric shape's unmatched ']' (opened by '>')
        // cannot drive the depth negative.
        depth = Math.max(0, depth - 1);
      } else if (ch === '&' && depth === 0) {
        parts.push(text.slice(start, i));
        start = i + 1;
      }
    }
    parts.push(text.slice(start));

    const nodes: Array<{ id: string; label?: string; shape?: MermaidShape }> = [];
    for (const part of parts) {
      const parsed = this.parseInlineNode(part.trim());
      if (!parsed) return null;
      nodes.push(parsed);
    }
    return nodes;
  }

  /**
   * Returns a same-length copy of the line with the content of double-quoted
   * spans replaced by '#', so structural scans (edge connectors, |label|
   * delimiters) cannot match inside quoted labels. Single quotes are left
   * alone: they double as apostrophes in unquoted labels.
   */
  private maskQuotedContent(text: string): string {
    let out = '';
    let inQuote = false;
    for (const ch of text) {
      if (ch === '"') {
        inQuote = !inQuote;
        out += ch;
      } else {
        out += inQuote ? '#' : ch;
      }
    }
    return out;
  }

  private parseInlineNode(text: string): { id: string; label?: string; shape?: MermaidShape } | null {
    const idMatch = text.match(/^(\w+(?:[-.]\w+)*)/);
    if (!idMatch) return null;

    const id = idMatch[1];
    const rest = text.slice(id.length).trim();

    if (!rest) return { id };

    const parsed = this.parseShapeAndLabel(id, rest);
    if (parsed) return { id: parsed.id, label: parsed.label, shape: parsed.shape };

    return { id };
  }
}
