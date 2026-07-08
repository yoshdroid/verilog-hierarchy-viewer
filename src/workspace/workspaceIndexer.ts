import * as vscode from 'vscode';
import { TextDecoder } from 'node:util';
import { buildModuleIndex, SourceFile } from '../hierarchy/indexer';
import { ModuleIndex } from '../hierarchy/model';

const decoder = new TextDecoder('utf-8');

export async function buildWorkspaceModuleIndex(): Promise<ModuleIndex> {
  const files = await readWorkspaceSourceFiles();
  return buildModuleIndex(files);
}

async function readWorkspaceSourceFiles(): Promise<SourceFile[]> {
  const configuration = vscode.workspace.getConfiguration('verilogHierarchy');
  const extensions = configuration.get<string[]>('fileExtensions', ['.v', '.sv', '.vh', '.svh']);
  const exclude = configuration.get<string[]>('exclude', ['**/node_modules/**', '**/.git/**', '**/out/**']);
  const includePattern = buildIncludePattern(extensions);
  const excludePattern = `{${exclude.join(',')}}`;
  const uris = await vscode.workspace.findFiles(includePattern, excludePattern);

  return Promise.all(
    uris.map(async (uri) => ({
      uri: uri.toString(),
      text: decoder.decode(await vscode.workspace.fs.readFile(uri)),
    }))
  );
}

function buildIncludePattern(extensions: string[]): string {
  const normalized = extensions.map((extension) => extension.replace(/^\./, ''));
  return `**/*.{${normalized.join(',')}}`;
}

