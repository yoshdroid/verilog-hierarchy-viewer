import assert from 'node:assert/strict';
import test from 'node:test';
import { buildModuleIndexWithWarnings } from '../src/hierarchy/indexer';
import { preprocessVerilog } from '../src/hierarchy/preprocessor';
import { resolveHierarchy } from '../src/hierarchy/resolver';

test('preprocessVerilog keeps the active ifdef branch from configured defines', () => {
  const result = preprocessVerilog(
    {
      uri: 'file:///top.sv',
      text: `
module top;
\`ifdef USE_FAST
  fast_child u_impl();
\`else
  slow_child u_impl();
\`endif
endmodule
`,
    },
    { defines: { USE_FAST: true } }
  );

  assert.match(result.text, /fast_child u_impl/);
  assert.doesNotMatch(result.text, /slow_child u_impl/);
});

test('preprocessVerilog expands active includes through the resolver', () => {
  const result = preprocessVerilog(
    {
      uri: 'file:///top.sv',
      text: `
module top;
\`include "children.vh"
endmodule
`,
    },
    {
      resolveInclude: (includePath) =>
        includePath === 'children.vh'
          ? {
              uri: 'file:///children.vh',
              text: '  child u_child();',
            }
          : undefined,
    }
  );

  assert.match(result.text, /child u_child/);
  assert.deepEqual(result.warnings, []);
});

test('preprocessVerilog skips includes in inactive conditionals', () => {
  const result = preprocessVerilog(
    {
      uri: 'file:///top.sv',
      text: `
module top;
\`ifdef DISABLED
\`include "missing.vh"
\`endif
endmodule
`,
    },
    {}
  );

  assert.doesNotMatch(result.text, /missing/);
  assert.deepEqual(result.warnings, []);
});

test('buildModuleIndexWithWarnings indexes modules after include and define preprocessing', () => {
  const result = buildModuleIndexWithWarnings(
    [
      {
        uri: 'file:///top.sv',
        text: `
module top;
\`include "children.vh"
endmodule
`,
      },
    ],
    {
      defines: { USE_FAST: true },
      resolveInclude: (includePath) =>
        includePath === 'children.vh'
          ? {
              uri: 'file:///children.vh',
              text: `
\`ifdef USE_FAST
  fast_child u_impl();
\`else
  slow_child u_impl();
\`endif
module fast_child;
endmodule
`,
            }
          : undefined,
    }
  );

  const hierarchy = resolveHierarchy(result.index, 'top');

  assert.ok(hierarchy);
  assert.equal(hierarchy.children[0].moduleName, 'fast_child');
  assert.equal(hierarchy.children[0].instanceName, 'u_impl');
  assert.deepEqual(result.warnings, []);
});
