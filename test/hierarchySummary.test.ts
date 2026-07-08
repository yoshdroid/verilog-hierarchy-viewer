import assert from 'node:assert/strict';
import test from 'node:test';
import { buildModuleIndex } from '../src/hierarchy/indexer';
import { resolveHierarchy } from '../src/hierarchy/resolver';
import { formatHierarchyWarnings, formatIndexWarnings, summarizeHierarchy } from '../src/hierarchy/summary';

test('summarizeHierarchy counts nodes, unresolved modules, cycles, and depth', () => {
  const index = buildModuleIndex([
    {
      uri: 'file:///summary.sv',
      text: `
module top;
  child u_child();
  missing u_missing();
endmodule

module child;
  top u_cycle();
endmodule
`,
    },
  ]);

  const hierarchy = resolveHierarchy(index, 'top');
  assert.ok(hierarchy);

  assert.deepEqual(summarizeHierarchy(hierarchy), {
    totalNodes: 4,
    unresolvedNodes: 1,
    cycleNodes: 1,
    maxDepth: 2,
  });
});

test('formatIndexWarnings lists duplicate definitions with locations', () => {
  const index = buildModuleIndex([
    { uri: 'file:///a.sv', text: 'module dup; endmodule' },
    { uri: 'file:///b.sv', text: 'module dup; endmodule' },
  ]);

  assert.deepEqual(formatIndexWarnings(index), [
    'Duplicate module "dup" definitions: file:///a.sv:1:1, file:///b.sv:1:1',
  ]);
});

test('formatHierarchyWarnings lists unresolved and cycle nodes', () => {
  const index = buildModuleIndex([
    {
      uri: 'file:///warnings.sv',
      text: `
module top;
  child u_child();
  missing u_missing();
endmodule

module child;
  top u_cycle();
endmodule
`,
    },
  ]);
  const hierarchy = resolveHierarchy(index, 'top');
  assert.ok(hierarchy);

  assert.deepEqual(formatHierarchyWarnings(hierarchy), [
    'Cycle stopped at "top" instance "u_cycle" at file:///warnings.sv:8:3',
    'Unresolved module "missing" at file:///warnings.sv:4:3',
  ]);
});

