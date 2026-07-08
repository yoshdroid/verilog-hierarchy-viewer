import * as vscode from 'vscode';
import { TextDecoder } from 'node:util';
import { buildModuleIndex, SourceFile } from '../hierarchy/indexer';
import { ModuleIndex } from '../hierarchy/model';

const decoder = new TextDecoder('utf-8');

export type WorkspaceModuleIndex = {
  index: ModuleIndex;
  fileCount: number;
};

export async function buildWorkspaceModuleIndex(): Promise<ModuleIndex> {
  return (await buildWorkspaceModuleIndexWithStats()).index;
}

export async function buildWorkspaceModuleIndexWithStats(): Promise<WorkspaceModuleIndex> {
  const files = await readWorkspaceSourceFiles();
  return {
    index: buildModuleIndex(files),
    fileCount: files.length,
  };
}

export function getSourceFilePattern(): string {
  const configuration = vscode.workspace.getConfiguration('verilogHierarchy');
  const extensions = configuration.get<string[]>('fileExtensions', ['.v', '.sv', '.vh', '.svh']);
  return buildIncludePattern(extensions);
}

export function getExcludePattern(): string {
  const configuration = vscode.workspace.getConfiguration('verilogHierarchy');
  const exclude = configuration.get<string[]>('exclude', ['**/node_modules/**', '**/.git/**', '**/out/**']);
  return `{${exclude.join(',')}}`;
}

export function buildIncludePattern(extensions: string[]): string {
  const normalized = extensions.map((extension) => extension.replace(/^\./, ''));
  return `**/*.{${normalized.join(',')}}`;
}

async function readWorkspaceSourceFiles(): Promise<SourceFile[]> {
  const includePattern = getSourceFilePattern();
  const excludePattern = getExcludePattern();
  const uris = await vscode.workspace.findFiles(includePattern, excludePattern);

  return Promise.all(
    uris.map(async (uri) => ({
      uri: uri.toString(),
      text: decoder.decode(await vscode.workspace.fs.readFile(uri)),
    }))
  );
}

export function shouldAutoRefresh(): boolean {
  return vscode.workspace.getConfiguration('verilogHierarchy').get<boolean>('autoRefresh', true);
}

export function getMaxDepthSetting(): number {
  return vscode.workspace.getConfiguration('verilogHierarchy').get<number>('maxDepth', 100);
}

export function getWatcherPattern(): vscode.GlobPattern {
  return getSourceFilePattern();
}
