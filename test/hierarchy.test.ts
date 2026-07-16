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

test('parseModules does not treat compact control statements as instances', () => {
  const text = `
module top;
  if(foo) begin
  end
  for(i = 0; i < 4; i = i + 1) begin
  end
  case(foo)
    1'b0: foo = 1'b1;
  endcase
  assert(foo);
  assert property (foo);
  assume property (foo);
  cover property (foo);
  restrict property (foo);
endmodule
`;

  const modules = parseModules(text, 'file:///control.sv');
  assert.equal(modules[0].instances.length, 0);
});

test('parseModules still detects compact parameterized instances', () => {
  const text = `
module top;
  child#(.WIDTH(8))u_child(.clk(clk));
endmodule
`;

  const modules = parseModules(text, 'file:///parameterized.sv');
  assert.deepEqual(
    modules[0].instances.map((instance) => [instance.moduleName, instance.instanceName, instance.parameterized]),
    [['child', 'u_child', true]]
  );
});

test('parseModules detects plain and parameterized instances split across lines', () => {
  const text = `
module top;
  plain_child
    u_plain
    (
      .clk(clk)
    );

  parameterized_child
    #(
      .WIDTH(width_for_mode(MODE)),
      .LABEL("nested ) text")
    )
    u_parameterized
    [1:0]
    (
      .clk(clk)
    );
endmodule
`;

  const modules = parseModules(text, 'file:///multiline.sv');

  assert.deepEqual(
    modules[0].instances.map((instance) => [
      instance.moduleName,
      instance.instanceName,
      instance.parameterized,
      instance.declaration.line,
    ]),
    [
      ['plain_child', 'u_plain', false, 2],
      ['parameterized_child', 'u_parameterized', true, 8],
    ]
  );
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

test('resolveHierarchy follows multiline instances across source files', () => {
  const index = buildModuleIndex([
    {
      uri: 'file:///rtl/top.v',
      text: `
module top;
  child
    u_child
    (
      .clk(clk)
    );
endmodule
`,
    },
    {
      uri: 'file:///rtl/child.v',
      text: `
module child;
  grandchild #(
    .WIDTH(32)
  )
  u_grandchild (
    .clk(clk)
  );
endmodule
`,
    },
    {
      uri: 'file:///rtl/grandchild.v',
      text: 'module grandchild; endmodule',
    },
  ]);

  const hierarchy = resolveHierarchy(index, 'top');

  assert.ok(hierarchy);
  assert.equal(hierarchy.children[0].moduleName, 'child');
  assert.equal(hierarchy.children[0].declaration.uri, 'file:///rtl/top.v');
  assert.equal(hierarchy.children[0].children[0].moduleName, 'grandchild');
  assert.equal(hierarchy.children[0].children[0].declaration.uri, 'file:///rtl/child.v');
});
