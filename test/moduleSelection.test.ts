import assert from 'node:assert/strict';
import test from 'node:test';
import { buildModuleIndex } from '../src/hierarchy/indexer';
import { getModuleNamesDeclaredInUri } from '../src/workspace/moduleSelection';

test('getModuleNamesDeclaredInUri returns sorted modules declared in the selected file', () => {
  const index = buildModuleIndex([
    {
      uri: 'file:///selected.sv',
      text: `
module z_top;
endmodule

module a_top;
endmodule
`,
    },
    {
      uri: 'file:///other.sv',
      text: 'module other; endmodule',
    },
  ]);

  assert.deepEqual(getModuleNamesDeclaredInUri(index, 'file:///selected.sv'), ['a_top', 'z_top']);
});

test('getModuleNamesDeclaredInUri returns an empty list when the selected file has no modules', () => {
  const index = buildModuleIndex([
    {
      uri: 'file:///other.sv',
      text: 'module other; endmodule',
    },
  ]);

  assert.deepEqual(getModuleNamesDeclaredInUri(index, 'file:///selected.sv'), []);
});
