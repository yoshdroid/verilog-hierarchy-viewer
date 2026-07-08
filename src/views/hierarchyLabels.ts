import { HierarchyNode } from '../hierarchy/model';

export function formatHierarchyLabel(node: HierarchyNode): string {
  const prefix = node.instanceName ? `${node.instanceName} : ` : '';
  const suffix = node.unresolved ? ' (unresolved)' : node.cycle ? ' (cycle)' : '';
  return `${prefix}${node.moduleName}${suffix}`;
}

