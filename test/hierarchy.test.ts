import assert from 'node:assert/strict';
import test from 'node:test';
import { buildModuleIndex } from '../src/hierarchy/indexer';
import { parseModules } from '../src/hierarchy/parser';
import { resolveHierarchy } from '../src/hierarchy/resolver';

test('parseModules detects module declarations and instances', () => {
  const text = `
module child;
endmodule

module top;
  child u_child();
  param_child #(.WIDTH(8)) u_param (
    .clk(clk)
  );
endmodule
`;

  const modules = parseModules(text, 'file:///simple.sv');
  const top = modules.find((moduleDefinition) => moduleDefinition.name === 'top');

  assert.equal(modules.length, 2);
  assert.ok(top);
  assert.deepEqual(
    top.instances.map((instance) => [instance.moduleName, instance.instanceName, instance.parameterized]),
    [
      ['child', 'u_child', false],
      ['param_child', 'u_param', true],
    ]
  );
});

test('parseModules ignores commented-out modules and instances', () => {
  const text = `
// module fake;
module real;
  /* other u_other(); */
  child u_child();
endmodule
`;

  const modules = parseModules(text, 'file:///comments.sv');
  assert.deepEqual(
    modules.map((moduleDefinition) => moduleDefinition.name),
    ['real']
  );
  assert.equal(modules[0].instances.length, 1);
  assert.equal(modules[0].instances[0].instanceName, 'u_child');
});

test('buildModuleIndex tracks duplicate module definitions', () => {
  const index = buildModuleIndex([
    { uri: 'file:///a.sv', text: 'module dup; endmodule' },
    { uri: 'file:///b.sv', text: 'module dup; endmodule' },
  ]);

  assert.equal(index.modules.get('dup')?.declaration.uri, 'file:///a.sv');
  assert.equal(index.duplicates.get('dup')?.length, 2);
});

test('resolveHierarchy builds children, unresolved nodes, and cycles', () => {
  const index = buildModuleIndex([
    {
      uri: 'file:///hier.sv',
      text: `
module top;
  child u_child();
  missing u_missing();
endmodule

module child;
  grand u_grand();
endmodule

module grand;
  top u_cycle();
endmodule
`,
    },
  ]);

  const hierarchy = resolveHierarchy(index, 'top');
  assert.ok(hierarchy);
  assert.equal(hierarchy.children[0].moduleName, 'child');
  assert.equal(hierarchy.children[0].children[0].moduleName, 'grand');
  assert.equal(hierarchy.children[0].children[0].children[0].cycle, true);
  assert.equal(hierarchy.children[1].unresolved, true);
  assert.equal(hierarchy.children[1].moduleName, 'missing');
});

