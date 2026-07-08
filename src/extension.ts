import * as vscode from 'vscode';
import { resolveHierarchy } from './hierarchy/resolver';
import { HierarchyTreeItem, HierarchyTreeProvider } from './views/hierarchyTreeProvider';
import { buildWorkspaceModuleIndex } from './workspace/workspaceIndexer';

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Verilog Hierarchy');
  const provider = new HierarchyTreeProvider();
  let selectedTopModule: string | undefined;

  context.subscriptions.push(output);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('verilogHierarchy.view', provider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('verilogHierarchy.selectTopModule', async (item?: HierarchyTreeItem) => {
      output.appendLine('Select Top Module command invoked.');
      if (item) {
        selectedTopModule = item.node.moduleName;
        await refreshHierarchy(provider, output, selectedTopModule);
        return;
      }

      const index = await buildWorkspaceModuleIndex();
      const moduleNames = [...index.modules.keys()].sort();
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
      await refreshHierarchy(provider, output, selectedTopModule, index);
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

async function refreshHierarchy(
  provider: HierarchyTreeProvider,
  output: vscode.OutputChannel,
  topModuleName: string,
  existingIndex?: Awaited<ReturnType<typeof buildWorkspaceModuleIndex>>
): Promise<void> {
  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `Building HDL hierarchy for ${topModuleName}`,
      cancellable: false,
    },
    async () => {
      const index = existingIndex ?? (await buildWorkspaceModuleIndex());
      const hierarchy = resolveHierarchy(index, topModuleName, getMaxDepth());
      if (!hierarchy) {
        provider.setMessage(`Top module not found: ${topModuleName}`);
        vscode.window.showWarningMessage(`Verilog Hierarchy: top module not found: ${topModuleName}`);
        return;
      }

      provider.setHierarchy(hierarchy);
      output.appendLine(
        `Indexed ${index.modules.size} modules. Duplicate module names: ${index.duplicates.size}. Top: ${topModuleName}.`
      );
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

function getMaxDepth(): number {
  return vscode.workspace.getConfiguration('verilogHierarchy').get<number>('maxDepth', 100);
}
