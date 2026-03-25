import { Injectable } from '@angular/core';
import { FlowchartModel, FlowNode, FlowEdge } from '../models/graph-model';
import { MERMAID_SHAPE_SYNTAX } from '../models/shape-map';
import { MERMAID_EDGE_SYNTAX } from '../models/edge-map';

@Injectable({ providedIn: 'root' })
export class MermaidSerializerService {

  serialize(model: FlowchartModel): string {
    const lines: string[] = [`flowchart ${model.direction}`];

    // Node definitions
    for (const node of model.nodes.values()) {
      lines.push(`    ${this.serializeNode(node)}`);
    }

    // Edge definitions
    for (const edge of model.edges) {
      lines.push(`    ${this.serializeEdge(edge, model)}`);
    }

    return lines.join('\n') + '\n';
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
