import * as vscode from 'vscode';
import { resolveHierarchy } from './hierarchy/resolver';
import { formatHierarchyWarnings, formatIndexWarnings, summarizeHierarchy } from './hierarchy/summary';
import { HierarchyTreeItem, HierarchyTreeProvider } from './views/hierarchyTreeProvider';
import {
  buildWorkspaceModuleIndexWithStats,
  getMaxDepthSetting,
  getWatcherPattern,
  shouldAutoRefresh,
  WorkspaceModuleIndex,
} from './workspace/workspaceIndexer';
import { getModuleNamesDeclaredInUri } from './workspace/moduleSelection';

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Verilog Hierarchy');
  const provider = new HierarchyTreeProvider();
  let selectedTopModule: string | undefined;
  let refreshTimer: NodeJS.Timeout | undefined;

  context.subscriptions.push(output);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('verilogHierarchy.view', provider)
  );

  const watcher = vscode.workspace.createFileSystemWatcher(getWatcherPattern());
  const scheduleRefresh = () => {
    const topModuleName = selectedTopModule;
    if (!topModuleName || !shouldAutoRefresh()) {
      return;
    }
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }
    refreshTimer = setTimeout(() => {
      refreshHierarchy(provider, output, topModuleName, undefined, 'auto').catch((error: unknown) => {
        output.appendLine(`Auto refresh failed: ${formatError(error)}`);
      });
    }, 300);
  };
  context.subscriptions.push(watcher);
  context.subscriptions.push(watcher.onDidCreate(scheduleRefresh));
  context.subscriptions.push(watcher.onDidChange(scheduleRefresh));
  context.subscriptions.push(watcher.onDidDelete(scheduleRefresh));

  context.subscriptions.push(
    vscode.commands.registerCommand('verilogHierarchy.selectTopModule', async (itemOrUri?: HierarchyTreeItem | vscode.Uri) => {
      output.appendLine('Select Top Module command invoked.');
      if (itemOrUri instanceof vscode.Uri) {
        const topModuleName = await selectTopModuleFromExplorerUri(provider, output, itemOrUri);
        if (topModuleName) {
          selectedTopModule = topModuleName;
        }
        return;
      }

      if (itemOrUri) {
        selectedTopModule = await setTopModuleFromTreeItem(provider, output, itemOrUri);
        return;
      }

      const workspaceIndex = await buildWorkspaceModuleIndexWithStats();
      const moduleNames = [...workspaceIndex.index.modules.keys()].sort();
      if (moduleNames.length === 0) {
        provider.setMessage('No Verilog/SystemVerilog modules found in this workspace.');
        vscode.window.showWarningMessage('Verilog Hierarchy: no modules found.');
        return;
      }

      const picked = await vscode.window.showQuickPick(moduleNames, {
        title: 'Select TOP module',
        placeHolder: 'TOP module',
      });
      if (!picked) {
        return;
      }

      selectedTopModule = picked;
      await refreshHierarchy(provider, output, selectedTopModule, workspaceIndex);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('verilogHierarchy.setAsTopModule', async (item?: HierarchyTreeItem) => {
      output.appendLine('Set as Top Module command invoked.');
      if (!item) {
        vscode.window.showInformationMessage('Verilog Hierarchy: no hierarchy node selected.');
        return;
      }
      selectedTopModule = await setTopModuleFromTreeItem(provider, output, item);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('verilogHierarchy.refresh', async () => {
      output.appendLine('Refresh command invoked.');
      if (!selectedTopModule) {
        provider.setMessage('Select a top module to show HDL hierarchy.');
        return;
      }
      await refreshHierarchy(provider, output, selectedTopModule);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('verilogHierarchy.revealSource', async (item?: HierarchyTreeItem) => {
      output.appendLine('Reveal Source command invoked.');
      if (!item || !item.node.declaration.uri) {
        vscode.window.showInformationMessage('Verilog Hierarchy: no source node selected.');
        return;
      }
      await revealSource(item.node.declaration);
    })
  );
}

export function deactivate(): void {
  // No extension resources need explicit disposal beyond context subscriptions.
}

async function selectTopModuleFromExplorerUri(
  provider: HierarchyTreeProvider,
  output: vscode.OutputChannel,
  uri: vscode.Uri
): Promise<string | undefined> {
  const workspaceIndex = await buildWorkspaceModuleIndexWithStats();
  const moduleNames = getModuleNamesDeclaredInUri(workspaceIndex.index, uri.toString());

  if (moduleNames.length === 0) {
    vscode.window.showWarningMessage(`Verilog Hierarchy: no modules found in ${uri.fsPath}.`);
    return undefined;
  }

  const picked = moduleNames.length === 1
    ? moduleNames[0]
    : await vscode.window.showQuickPick(moduleNames, {
        title: 'Select TOP module',
        placeHolder: 'TOP module in selected file',
      });

  if (!picked) {
    return undefined;
  }

  await refreshHierarchy(provider, output, picked, workspaceIndex);
  return picked;
}

async function refreshHierarchy(
  provider: HierarchyTreeProvider,
  output: vscode.OutputChannel,
  topModuleName: string,
  existingIndex?: WorkspaceModuleIndex,
  reason: 'manual' | 'auto' = 'manual'
): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Building HDL hierarchy for ${topModuleName}`,
      cancellable: false,
    },
    async () => {
      const startedAt = Date.now();
      const workspaceIndex = existingIndex ?? (await buildWorkspaceModuleIndexWithStats());
      const hierarchy = resolveHierarchy(workspaceIndex.index, topModuleName, getMaxDepthSetting());
      if (!hierarchy) {
        provider.setMessage(`Top module not found: ${topModuleName}`);
        vscode.window.showWarningMessage(`Verilog Hierarchy: top module not found: ${topModuleName}`);
        return;
      }

      provider.setHierarchy(hierarchy);
      logRefreshResult(output, workspaceIndex, hierarchy, topModuleName, reason, Date.now() - startedAt);
    }
  );
}

async function revealSource(location: { uri: string; line: number; character: number }): Promise<void> {
  const uri = vscode.Uri.parse(location.uri);
  const position = new vscode.Position(location.line, location.character);
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document, {
    selection: new vscode.Range(position, position),
    preview: false,
  });
}

async function setTopModuleFromTreeItem(
  provider: HierarchyTreeProvider,
  output: vscode.OutputChannel,
  item: HierarchyTreeItem
): Promise<string> {
  const topModuleName = item.node.moduleName;
  await refreshHierarchy(provider, output, topModuleName);
  return topModuleName;
}

function logRefreshResult(
  output: vscode.OutputChannel,
  workspaceIndex: WorkspaceModuleIndex,
  hierarchy: NonNullable<ReturnType<typeof resolveHierarchy>>,
  topModuleName: string,
  reason: 'manual' | 'auto',
  elapsedMs: number
): void {
  const summary = summarizeHierarchy(hierarchy);
  output.appendLine(
    [
      `Refresh (${reason}) complete.`,
      `Top: ${topModuleName}.`,
      `Files: ${workspaceIndex.fileCount}.`,
      `Modules: ${workspaceIndex.index.modules.size}.`,
      `Nodes: ${summary.totalNodes}.`,
      `Unresolved: ${summary.unresolvedNodes}.`,
      `Cycles: ${summary.cycleNodes}.`,
      `Max depth: ${summary.maxDepth}.`,
      `Elapsed: ${elapsedMs} ms.`,
    ].join(' ')
  );

  const warnings = [
    ...workspaceIndex.warnings,
    ...formatIndexWarnings(workspaceIndex.index),
    ...formatHierarchyWarnings(hierarchy),
  ];

  for (const warning of warnings) {
    output.appendLine(`Warning: ${warning}`);
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
