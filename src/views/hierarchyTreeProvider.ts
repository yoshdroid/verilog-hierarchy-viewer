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
    this.description = getDescription(node);
    this.tooltip = getTooltip(node);
    this.command = {
      command: 'verilogHierarchy.revealSource',
      title: 'Reveal Source',
      arguments: [this],
    };
    this.iconPath = new vscode.ThemeIcon(node.unresolved ? 'warning' : node.cycle ? 'debug-restart' : 'symbol-structure');
  }
}

function getDescription(node: HierarchyNode): string | undefined {
  if (node.unresolved) {
    return 'unresolved';
  }
  if (node.cycle) {
    return 'cycle';
  }
  return `${node.children.length} child${node.children.length === 1 ? '' : 'ren'}`;
}

function getTooltip(node: HierarchyNode): string {
  const location = node.declaration.uri ? `${node.declaration.uri}:${node.declaration.line + 1}:${node.declaration.character + 1}` : 'no source location';
  const status = node.unresolved ? 'unresolved module' : node.cycle ? 'cycle stopped' : 'resolved module';
  return `${node.instanceName ? `${node.instanceName} : ` : ''}${node.moduleName}\n${status}\n${location}`;
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
