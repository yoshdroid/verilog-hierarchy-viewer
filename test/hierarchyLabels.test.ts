import assert from 'node:assert/strict';
import test from 'node:test';
import { formatHierarchyLabel } from '../src/views/hierarchyLabels';

test('formatHierarchyLabel shows root module name', () => {
  assert.equal(
    formatHierarchyLabel({
      moduleName: 'top',
      declaration: { uri: 'file:///top.sv', line: 0, character: 0 },
      children: [],
    }),
    'top'
  );
});

test('formatHierarchyLabel shows instance and module names', () => {
  assert.equal(
    formatHierarchyLabel({
      moduleName: 'child',
      instanceName: 'u_child',
      declaration: { uri: 'file:///top.sv', line: 4, character: 2 },
      children: [],
    }),
    'u_child : child'
  );
});

test('formatHierarchyLabel marks unresolved and cycle nodes', () => {
  assert.equal(
    formatHierarchyLabel({
      moduleName: 'missing',
      instanceName: 'u_missing',
      declaration: { uri: 'file:///top.sv', line: 5, character: 2 },
      children: [],
      unresolved: true,
    }),
    'u_missing : missing (unresolved)'
  );

  assert.equal(
    formatHierarchyLabel({
      moduleName: 'top',
      instanceName: 'u_cycle',
      declaration: { uri: 'file:///grand.sv', line: 2, character: 2 },
      children: [],
      cycle: true,
    }),
    'u_cycle : top (cycle)'
  );
});

