import { HierarchyNode, ModuleIndex } from './model';

export type HierarchySummary = {
  totalNodes: number;
  unresolvedNodes: number;
  cycleNodes: number;
  maxDepth: number;
};

export function summarizeHierarchy(root: HierarchyNode): HierarchySummary {
  const summary: HierarchySummary = {
    totalNodes: 0,
    unresolvedNodes: 0,
    cycleNodes: 0,
    maxDepth: 0,
  };

  visit(root, 0, summary);
  return summary;
}

export function formatIndexWarnings(index: ModuleIndex): string[] {
  const warnings: string[] = [];

  for (const [moduleName, definitions] of [...index.duplicates.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    const locations = definitions.map((definition) => formatLocation(definition.declaration)).join(', ');
    warnings.push(`Duplicate module "${moduleName}" definitions: ${locations}`);
  }

  return warnings;
}

export function formatHierarchyWarnings(root: HierarchyNode): string[] {
  const warnings: string[] = [];
  collectHierarchyWarnings(root, warnings);
  return warnings;
}

function visit(node: HierarchyNode, depth: number, summary: HierarchySummary): void {
  summary.totalNodes += 1;
  summary.maxDepth = Math.max(summary.maxDepth, depth);
  if (node.unresolved) {
    summary.unresolvedNodes += 1;
  }
  if (node.cycle) {
    summary.cycleNodes += 1;
  }

  for (const child of node.children) {
    visit(child, depth + 1, summary);
  }
}

function collectHierarchyWarnings(node: HierarchyNode, warnings: string[]): void {
  if (node.unresolved) {
    warnings.push(`Unresolved module "${node.moduleName}" at ${formatLocation(node.declaration)}`);
  }
  if (node.cycle) {
    warnings.push(`Cycle stopped at "${node.moduleName}" instance "${node.instanceName ?? '(root)'}" at ${formatLocation(node.declaration)}`);
  }

  for (const child of node.children) {
    collectHierarchyWarnings(child, warnings);
  }
}

function formatLocation(location: { uri: string; line: number; character: number }): string {
  return `${location.uri}:${location.line + 1}:${location.character + 1}`;
}

