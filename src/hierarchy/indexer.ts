import { ModuleDefinition, ModuleIndex } from './model';
import { parseModules } from './parser';
import { preprocessVerilog, PreprocessorOptions } from './preprocessor';

export type SourceFile = {
  uri: string;
  text: string;
};

export type ModuleIndexBuildResult = {
  index: ModuleIndex;
  warnings: string[];
};

export function buildModuleIndex(files: SourceFile[]): ModuleIndex {
  return buildModuleIndexWithWarnings(files).index;
}

export function buildModuleIndexWithWarnings(
  files: SourceFile[],
  options: PreprocessorOptions = {}
): ModuleIndexBuildResult {
  const modules = new Map<string, ModuleDefinition>();
  const duplicates = new Map<string, ModuleDefinition[]>();
  const warnings: string[] = [];

  for (const file of files) {
    const preprocessed = preprocessVerilog(file, options);
    warnings.push(...preprocessed.warnings);

    for (const definition of parseModules(preprocessed.text, file.uri)) {
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

  return {
    index: { modules, duplicates },
    warnings: [...new Set(warnings)],
  };
}
