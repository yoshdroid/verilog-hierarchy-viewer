import { ModuleIndex } from '../hierarchy/model';

export function getModuleNamesDeclaredInUri(index: ModuleIndex, uri: string): string[] {
  return [...index.modules.values()]
    .filter((definition) => definition.declaration.uri === uri)
    .map((definition) => definition.name)
    .sort();
}
