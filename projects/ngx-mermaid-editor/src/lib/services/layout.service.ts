import { Injectable } from '@angular/core';
import dagre from '@dagrejs/dagre';
import { FlowchartModel, FlowDirection, cloneModel } from '../models/graph-model';
import { getDefaultSize } from '../models/shape-map';

@Injectable({ providedIn: 'root' })
export class LayoutService {

  applyLayout(model: FlowchartModel): FlowchartModel {
    const result = cloneModel(model);
    const g = new dagre.graphlib.Graph();

    g.setGraph({
      rankdir: this.directionToRankdir(model.direction),
      nodesep: 60,
      ranksep: 80,
      marginx: 40,
      marginy: 40,
    });
    g.setDefaultEdgeLabel(() => ({}));

    for (const node of result.nodes.values()) {
      const size = getDefaultSize(node.shape);
      // Estimate wider nodes for longer labels
      const estWidth = Math.max(size.width, node.label.length * 9 + 30);
      g.setNode(node.id, { width: estWidth, height: size.height });
    }

    for (const edge of result.edges) {
      g.setEdge(edge.sourceId, edge.targetId);
    }

    dagre.layout(g);

    for (const node of result.nodes.values()) {
      const dagreNode = g.node(node.id);
      if (dagreNode) {
        node.x = dagreNode.x - dagreNode.width / 2;
        node.y = dagreNode.y - dagreNode.height / 2;
        node.width = dagreNode.width;
        node.height = dagreNode.height;
      }
    }

    return result;
  }

  private directionToRankdir(dir: FlowDirection): string {
    switch (dir) {
      case 'TD': return 'TB';
      case 'LR': return 'LR';
      case 'RL': return 'RL';
      case 'BT': return 'BT';
    }
  }
}
