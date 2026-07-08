import * as vscode from 'vscode';
import { HierarchyTreeProvider } from './views/hierarchyTreeProvider';

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel('Verilog Hierarchy');
  const provider = new HierarchyTreeProvider();

  context.subscriptions.push(output);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('verilogHierarchy.view', provider)
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('verilogHierarchy.selectTopModule', async () => {
      output.appendLine('Select Top Module command invoked.');
      vscode.window.showInformationMessage('Verilog Hierarchy: parser is not implemented yet.');
      provider.setMessage('Parser will be implemented in Phase 2.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('verilogHierarchy.refresh', () => {
      output.appendLine('Refresh command invoked.');
      provider.refresh();
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('verilogHierarchy.revealSource', () => {
      output.appendLine('Reveal Source command invoked.');
      vscode.window.showInformationMessage('Verilog Hierarchy: no source node selected yet.');
    })
  );
}

export function deactivate(): void {
  // No extension resources need explicit disposal beyond context subscriptions.
}

