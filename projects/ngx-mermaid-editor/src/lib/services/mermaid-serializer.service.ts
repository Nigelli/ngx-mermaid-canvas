import { Injectable } from '@angular/core';
import { FlowchartModel, FlowNode, FlowEdge, FlowSubgraph } from '../models/graph-model';
import { MERMAID_SHAPE_SYNTAX } from '../models/shape-map';
import { MERMAID_EDGE_SYNTAX } from '../models/edge-map';

@Injectable({ providedIn: 'root' })
export class MermaidSerializerService {

  serialize(model: FlowchartModel): string {
    const lines: string[] = [`flowchart ${model.direction}`];
    const nodesInSubgraphs = new Set<string>();

    for (const sg of model.subgraphs) {
      for (const nid of sg.nodeIds) {
        nodesInSubgraphs.add(nid);
      }
    }

    const topLevelSubgraphs = model.subgraphs.filter(sg => !sg.parentId);
    for (const sg of topLevelSubgraphs) {
      this.serializeSubgraph(sg, model, lines, 1);
    }

    for (const node of model.nodes.values()) {
      if (!nodesInSubgraphs.has(node.id)) {
        lines.push(`    ${this.serializeNode(node)}`);
      }
    }

    for (const edge of model.edges) {
      lines.push(`    ${this.serializeEdge(edge, model)}`);
    }

    return lines.join('\n') + '\n';
  }

  private serializeSubgraph(sg: FlowSubgraph, model: FlowchartModel, lines: string[], depth: number): void {
    const indent = '    '.repeat(depth);
    const labelPart = sg.label !== sg.id ? `[${sg.label}]` : '';
    lines.push(`${indent}subgraph ${sg.id}${labelPart}`);

    if (sg.direction) {
      lines.push(`${indent}    direction ${sg.direction}`);
    }

    const children = model.subgraphs.filter(s => s.parentId === sg.id);
    for (const child of children) {
      this.serializeSubgraph(child, model, lines, depth + 1);
    }

    for (const nodeId of sg.nodeIds) {
      const node = model.nodes.get(nodeId);
      if (node) {
        const isInChildSubgraph = children.some(c => c.nodeIds.includes(nodeId));
        if (!isInChildSubgraph) {
          lines.push(`${indent}    ${this.serializeNode(node)}`);
        }
      }
    }

    lines.push(`${indent}end`);
  }

  private serializeNode(node: FlowNode): string {
    const [open, close] = MERMAID_SHAPE_SYNTAX[node.shape];
    const label = this.escapeLabel(node.label);
    return `${node.id}${open}"${label}"${close}`;
  }

  private serializeEdge(edge: FlowEdge, model: FlowchartModel): string {
    const connector = MERMAID_EDGE_SYNTAX[edge.type];
    const src = edge.sourceId;
    const tgt = edge.targetId;
    if (edge.label) {
      return `${src} ${connector}|"${this.escapeLabel(edge.label)}"| ${tgt}`;
    }
    return `${src} ${connector} ${tgt}`;
  }

  private escapeLabel(label: string): string {
    return label.replace(/"/g, '#quot;');
  }
}
