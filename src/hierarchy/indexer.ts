import { ModuleDefinition, ModuleIndex } from './model';
import { parseModules } from './parser';

export type SourceFile = {
  uri: string;
  text: string;
};

export function buildModuleIndex(files: SourceFile[]): ModuleIndex {
  const modules = new Map<string, ModuleDefinition>();
  const duplicates = new Map<string, ModuleDefinition[]>();

  for (const file of files) {
    for (const definition of parseModules(file.text, file.uri)) {
      const existing = modules.get(definition.name);
      if (existing) {
        const duplicateList = duplicates.get(definition.name) ?? [existing];
        duplicateList.push(definition);
        duplicates.set(definition.name, duplicateList);
        continue;
      }
      modules.set(definition.name, definition);
    }
  }

  return { modules, duplicates };
}

