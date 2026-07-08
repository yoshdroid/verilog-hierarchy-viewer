export type SourceLocation = {
  uri: string;
  line: number;
  character: number;
};

export type ModuleInstance = {
  moduleName: string;
  instanceName: string;
  declaration: SourceLocation;
  parameterized: boolean;
};

export type ModuleDefinition = {
  name: string;
  declaration: SourceLocation;
  instances: ModuleInstance[];
};

export type ModuleIndex = {
  modules: Map<string, ModuleDefinition>;
  duplicates: Map<string, ModuleDefinition[]>;
};

export type HierarchyNode = {
  moduleName: string;
  instanceName?: string;
  declaration: SourceLocation;
  children: HierarchyNode[];
  unresolved?: boolean;
  cycle?: boolean;
};

