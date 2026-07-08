import * as vscode from 'vscode';
import { HierarchyNode } from '../hierarchy/model';
import { formatHierarchyLabel } from './hierarchyLabels';

class MessageItem extends vscode.TreeItem {
  constructor(message: string) {
    super(message, vscode.TreeItemCollapsibleState.None);
    this.contextValue = 'message';
  }
}

export class HierarchyTreeItem extends vscode.TreeItem {
  constructor(readonly node: HierarchyNode) {
    super(
      formatHierarchyLabel(node),
      node.children.length > 0 ? vscode.TreeItemCollapsibleState.Expanded : vscode.TreeItemCollapsibleState.None
    );
    this.contextValue = 'hierarchyNode';
    this.description = node.unresolved ? 'unresolved' : node.cycle ? 'cycle' : undefined;
    this.tooltip = `${node.instanceName ? `${node.instanceName} : ` : ''}${node.moduleName}`;
    this.command = {
      command: 'verilogHierarchy.revealSource',
      title: 'Reveal Source',
      arguments: [this],
    };
    this.iconPath = new vscode.ThemeIcon(node.unresolved ? 'warning' : node.cycle ? 'debug-restart' : 'symbol-structure');
  }
}

export class HierarchyTreeProvider implements vscode.TreeDataProvider<HierarchyTreeItem | vscode.TreeItem> {
  private readonly onDidChangeTreeDataEmitter =
    new vscode.EventEmitter<HierarchyTreeItem | vscode.TreeItem | undefined | null | void>();
  readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
  private message = 'Select a top module to show HDL hierarchy.';
  private root: HierarchyNode | undefined;

  getTreeItem(element: HierarchyTreeItem | vscode.TreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: HierarchyTreeItem | vscode.TreeItem): vscode.ProviderResult<Array<HierarchyTreeItem | vscode.TreeItem>> {
    if (element instanceof HierarchyTreeItem) {
      return element.node.children.map((child) => new HierarchyTreeItem(child));
    }

    if (this.root) {
      return [new HierarchyTreeItem(this.root)];
    }

    return [new MessageItem(this.message)];
  }

  setMessage(message: string): void {
    this.message = message;
    this.root = undefined;
    this.refresh();
  }

  setHierarchy(root: HierarchyNode): void {
    this.root = root;
    this.refresh();
  }

  refresh(): void {
    this.onDidChangeTreeDataEmitter.fire();
  }
}
