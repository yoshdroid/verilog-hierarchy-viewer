import * as vscode from 'vscode';
import { TextDecoder } from 'node:util';
import { buildModuleIndexWithWarnings, SourceFile } from '../hierarchy/indexer';
import { ModuleIndex } from '../hierarchy/model';

const decoder = new TextDecoder('utf-8');

export type WorkspaceModuleIndex = {
  index: ModuleIndex;
  fileCount: number;
  warnings: string[];
};

export async function buildWorkspaceModuleIndex(): Promise<ModuleIndex> {
  return (await buildWorkspaceModuleIndexWithStats()).index;
}

export async function buildWorkspaceModuleIndexWithStats(): Promise<WorkspaceModuleIndex> {
  const files = await readWorkspaceSourceFiles();
  const result = buildModuleIndexWithWarnings(files, {
    defines: getDefinesSetting(),
    resolveInclude: createIncludeResolver(files),
  });
  return {
    index: result.index,
    fileCount: files.length,
    warnings: result.warnings,
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

function getDefinesSetting(): Record<string, unknown> {
  return vscode.workspace.getConfiguration('verilogHierarchy').get<Record<string, unknown>>('defines', {});
}

function getIncludePathsSetting(): string[] {
  return vscode.workspace.getConfiguration('verilogHierarchy').get<string[]>('includePaths', []);
}

function createIncludeResolver(files: SourceFile[]): (includePath: string, fromUri: string) => SourceFile | undefined {
  const byUri = new Map(files.map((file) => [file.uri, file]));
  const byBasename = new Map<string, SourceFile[]>();

  for (const file of files) {
    const basename = getUriBasename(file.uri);
    const entries = byBasename.get(basename) ?? [];
    entries.push(file);
    byBasename.set(basename, entries);
  }

  return (includePath: string, fromUri: string): SourceFile | undefined => {
    const direct = byUri.get(resolveSiblingUri(includePath, fromUri));
    if (direct) {
      return direct;
    }

    for (const includeRoot of getIncludePathsSetting()) {
      const includeUri = resolveIncludePathUri(includeRoot, includePath, fromUri);
      const resolved = byUri.get(includeUri);
      if (resolved) {
        return resolved;
      }
    }

    const basenameMatches = byBasename.get(getPathBasename(includePath)) ?? [];
    return basenameMatches.length === 1 ? basenameMatches[0] : undefined;
  };
}

function resolveSiblingUri(includePath: string, fromUri: string): string {
  const from = vscode.Uri.parse(fromUri);
  const directory = from.with({ path: from.path.replace(/\/[^/]*$/, '') });
  return vscode.Uri.joinPath(directory, includePath).toString();
}

function resolveIncludePathUri(includeRoot: string, includePath: string, fromUri: string): string {
  const root = includeRoot.replace(/\\/g, '/');
  const baseUri = root.startsWith('/') || /^[A-Za-z]:\//.test(root)
    ? vscode.Uri.file(root)
    : vscode.Uri.joinPath(vscode.workspace.getWorkspaceFolder(vscode.Uri.parse(fromUri))?.uri ?? vscode.Uri.parse(fromUri), root);
  return vscode.Uri.joinPath(baseUri, includePath).toString();
}

function getUriBasename(uri: string): string {
  return getPathBasename(vscode.Uri.parse(uri).path);
}

function getPathBasename(path: string): string {
  return path.replace(/\\/g, '/').split('/').pop() ?? path;
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
