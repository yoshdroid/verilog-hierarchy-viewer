import { HierarchyNode, ModuleDefinition, ModuleIndex, SourceLocation } from './model';

const UNKNOWN_LOCATION: SourceLocation = {
  uri: '',
  line: 0,
  character: 0,
};

export function resolveHierarchy(index: ModuleIndex, topModuleName: string, maxDepth = 100): HierarchyNode | undefined {
  const top = index.modules.get(topModuleName);
  if (!top) {
    return undefined;
  }

  return resolveModule(index, top, undefined, top.declaration, [], 0, maxDepth);
}

function resolveModule(
  index: ModuleIndex,
  moduleDefinition: ModuleDefinition,
  instanceName: string | undefined,
  declaration: SourceLocation,
  ancestry: string[],
  depth: number,
  maxDepth: number
): HierarchyNode {
  const node: HierarchyNode = {
    moduleName: moduleDefinition.name,
    instanceName,
    declaration,
    children: [],
  };

  if (depth >= maxDepth) {
    return node;
  }

  const nextAncestry = [...ancestry, moduleDefinition.name];
  for (const instance of moduleDefinition.instances) {
    const childDefinition = index.modules.get(instance.moduleName);
    if (!childDefinition) {
      node.children.push({
        moduleName: instance.moduleName,
        instanceName: instance.instanceName,
        declaration: instance.declaration,
        children: [],
        unresolved: true,
      });
      continue;
    }

    if (nextAncestry.includes(instance.moduleName)) {
      node.children.push({
        moduleName: instance.moduleName,
        instanceName: instance.instanceName,
        declaration: instance.declaration,
        children: [],
        cycle: true,
      });
      continue;
    }

    node.children.push(
      resolveModule(index, childDefinition, instance.instanceName, instance.declaration, nextAncestry, depth + 1, maxDepth)
    );
  }

  return node;
}

export function createMissingTopNode(topModuleName: string): HierarchyNode {
  return {
    moduleName: topModuleName,
    declaration: UNKNOWN_LOCATION,
    children: [],
    unresolved: true,
  };
}

