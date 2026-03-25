import { Injectable } from '@angular/core';
import {
  FlowchartModel, FlowNode, FlowEdge, FlowDirection,
  MermaidShape, MermaidEdgeType, createEmptyModel,
} from '../models/graph-model';

/**
 * Parses a subset of Mermaid flowchart syntax into the IR.
 * Handles: direction, node definitions (all shapes), edges (all types), labels.
 */
@Injectable({ providedIn: 'root' })
export class MermaidDeserializerService {

  deserialize(text: string): FlowchartModel | null {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('%%'));

    // First line must be the direction
    const dirMatch = lines[0]?.match(/^(?:flowchart|graph)\s+(TD|TB|LR|RL|BT)/i);
    if (!dirMatch) return null;

    const direction = (dirMatch[1].toUpperCase() === 'TB' ? 'TD' : dirMatch[1].toUpperCase()) as FlowDirection;
    const model = createEmptyModel(direction);

    let edgeCounter = 0;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      // Try to parse as edge (must check before standalone node)
      const edgeParsed = this.parseEdge(line);
      if (edgeParsed) {
        // Ensure source and target nodes exist
        this.ensureNode(model, edgeParsed.sourceId, edgeParsed.sourceLabel, edgeParsed.sourceShape);
        this.ensureNode(model, edgeParsed.targetId, edgeParsed.targetLabel, edgeParsed.targetShape);
        model.edges.push({
          id: `e${edgeCounter++}`,
          sourceId: edgeParsed.sourceId,
          targetId: edgeParsed.targetId,
          label: edgeParsed.label,
          type: edgeParsed.type,
        });
        continue;
      }

      // Try to parse as standalone node definition
      const nodeParsed = this.parseNodeDef(line);
      if (nodeParsed) {
        this.ensureNode(model, nodeParsed.id, nodeParsed.label, nodeParsed.shape);
        continue;
      }
    }

    return model;
  }

  private ensureNode(model: FlowchartModel, id: string, label?: string, shape?: MermaidShape): void {
    if (!model.nodes.has(id)) {
      model.nodes.set(id, { id, label: label ?? id, shape: shape ?? 'rectangle' });
    } else if (label && label !== id) {
      // Update label/shape if a definition provides more detail
      const existing = model.nodes.get(id)!;
      existing.label = label;
      if (shape) existing.shape = shape;
    }
  }

  /** Parse a node definition like: A["text"], B("text"), C{text}, etc. */
  private parseNodeDef(text: string): { id: string; label: string; shape: MermaidShape } | null {
    // Match node ID followed by shape brackets
    const match = text.match(/^(\w+)\s*([\[\(\{<>].*)/);
    if (!match) return null;

    const id = match[1];
    const rest = match[2];
    return this.parseShapeAndLabel(id, rest);
  }

  private parseShapeAndLabel(id: string, rest: string): { id: string; label: string; shape: MermaidShape } | null {
    // Order matters: check multi-char delimiters first
    const patterns: Array<{ open: string; close: string; shape: MermaidShape }> = [
      { open: '([', close: '])', shape: 'stadium' },
      { open: '((', close: '))', shape: 'circle' },
      { open: '[[', close: ']]', shape: 'subroutine' },
      { open: '[/', close: '/]', shape: 'parallelogram' },
      { open: '(', close: ')', shape: 'rounded' },
      { open: '{', close: '}', shape: 'diamond' },
      { open: '>', close: ']', shape: 'asymmetric' },
      { open: '[', close: ']', shape: 'rectangle' },
    ];

    for (const { open, close, shape } of patterns) {
      if (rest.startsWith(open) && rest.endsWith(close)) {
        let label = rest.slice(open.length, rest.length - close.length).trim();
        // Strip quotes
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

  /** Parse an edge line like: A -->|"text"| B or A --> B */
  private parseEdge(text: string): {
    sourceId: string; sourceLabel?: string; sourceShape?: MermaidShape;
    targetId: string; targetLabel?: string; targetShape?: MermaidShape;
    label?: string; type: MermaidEdgeType;
  } | null {
    // Regex to find the edge connector in the middle
    const edgeConnectors: Array<{ pattern: RegExp; type: MermaidEdgeType }> = [
      { pattern: /\s-\.->(?:\|([^|]*)\|)?\s/, type: 'dotted-arrow' },
      { pattern: /\s==>(?:\|([^|]*)\|)?\s/,   type: 'thick-arrow' },
      { pattern: /\s-->(?:\|([^|]*)\|)?\s/,    type: 'arrow' },
      { pattern: /\s---(?:\|([^|]*)\|)?\s/,    type: 'open' },
    ];

    for (const { pattern, type } of edgeConnectors) {
      const match = text.match(pattern);
      if (match) {
        const idx = match.index!;
        const srcPart = text.slice(0, idx).trim();
        const tgtPart = text.slice(idx + match[0].length).trim();
        let edgeLabel = match[1]?.trim();
        if (edgeLabel) {
          // Strip quotes from edge label
          if ((edgeLabel.startsWith('"') && edgeLabel.endsWith('"')) ||
              (edgeLabel.startsWith("'") && edgeLabel.endsWith("'"))) {
            edgeLabel = edgeLabel.slice(1, -1);
          }
          edgeLabel = edgeLabel.replace(/#quot;/g, '"');
        }

        const src = this.parseInlineNode(srcPart);
        const tgt = this.parseInlineNode(tgtPart);
        if (!src || !tgt) return null;

        return {
          sourceId: src.id, sourceLabel: src.label, sourceShape: src.shape,
          targetId: tgt.id, targetLabel: tgt.label, targetShape: tgt.shape,
          label: edgeLabel || undefined,
          type,
        };
      }
    }

    return null;
  }

  /** Parse a node reference that may be just an ID or ID with shape: A, A["text"], A{text}, etc. */
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
