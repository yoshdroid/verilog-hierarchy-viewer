import * as vscode from 'vscode';

class MessageItem extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'message';
  }
}

export class HierarchyTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
  private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
  private message = 'Select a top module to show HDL hierarchy.';

  getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(): vscode.ProviderResult<vscode.TreeItem[]> {
    return [new MessageItem(this.message)];
  }

  setMessage(message: string): void {
    this.message = message;
    this.refresh();
  }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }
}

