import { ModuleDefinition, ModuleInstance, SourceLocation } from './model';

type CommentMaskState = {
  inBlockComment: boolean;
};

const MODULE_DECLARATION_PATTERN = /\bmodule\s+([A-Za-z_][A-Za-z0-9_$]*)\b/g;
const END_MODULE_PATTERN = /\bendmodule\b/g;
const PARAMETERIZED_INSTANCE_DECLARATION_PATTERN =
  /^\s*([A-Za-z_][A-Za-z0-9_$]*)\s*#\s*\((?:[^()]|\([^()]*\))*\)\s*([A-Za-z_][A-Za-z0-9_$]*)\s*(?:\[[^\]]+\]\s*)?\(/;
const PLAIN_INSTANCE_DECLARATION_PATTERN =
  /^\s*([A-Za-z_][A-Za-z0-9_$]*)\s+([A-Za-z_][A-Za-z0-9_$]*)\s*(?:\[[^\]]+\]\s*)?\(/;

const NON_INSTANCE_KEYWORDS = new Set([
  'assign',
  'assert',
  'always',
  'always_comb',
  'always_ff',
  'always_latch',
  'assume',
  'begin',
  'case',
  'class',
  'cover',
  'covergroup',
  'else',
  'end',
  'endcase',
  'endclass',
  'endfunction',
  'endgenerate',
  'endmodule',
  'endpackage',
  'endprogram',
  'endproperty',
  'endsequence',
  'endtask',
  'for',
  'foreach',
  'function',
  'generate',
  'genvar',
  'if',
  'import',
  'inout',
  'input',
  'integer',
  'initial',
  'interface',
  'localparam',
  'logic',
  'module',
  'output',
  'package',
  'parameter',
  'program',
  'property',
  'reg',
  'restrict',
  'sequence',
  'task',
  'typedef',
  'wire',
]);

export function parseModules(text: string, uri: string): ModuleDefinition[] {
  const masked = maskComments(text);
  const modules: ModuleDefinition[] = [];
  const moduleRanges = findModuleRanges(masked, uri);

  for (const range of moduleRanges) {
    const body = masked.slice(range.bodyStart, range.bodyEnd);
    modules.push({
      name: range.name,
      declaration: range.declaration,
      instances: parseInstances(body, uri, masked, range.bodyStart),
    });
  }

  return modules;
}

function maskComments(text: string): string {
  const state: CommentMaskState = { inBlockComment: false };
  let result = '';

  for (let index = 0; index < text.length; index += 1) {
    const current = text[index];
    const next = text[index + 1];

    if (state.inBlockComment) {
      if (current === '*' && next === '/') {
        result += '  ';
        index += 1;
        state.inBlockComment = false;
      } else {
        result += current === '\n' ? '\n' : ' ';
      }
      continue;
    }

    if (current === '/' && next === '*') {
      result += '  ';
      index += 1;
      state.inBlockComment = true;
      continue;
    }

    if (current === '/' && next === '/') {
      result += '  ';
      index += 1;
      while (index + 1 < text.length && text[index + 1] !== '\n') {
        result += ' ';
        index += 1;
      }
      continue;
    }

    result += current;
  }

  return result;
}

function findModuleRanges(text: string, uri: string) {
  const ranges: Array<{
    name: string;
    declaration: SourceLocation;
    bodyStart: number;
    bodyEnd: number;
  }> = [];

  MODULE_DECLARATION_PATTERN.lastIndex = 0;
  let moduleMatch: RegExpExecArray | null;
  while ((moduleMatch = MODULE_DECLARATION_PATTERN.exec(text)) !== null) {
    const name = moduleMatch[1];
    const declaration = offsetToLocation(text, uri, moduleMatch.index);
    END_MODULE_PATTERN.lastIndex = MODULE_DECLARATION_PATTERN.lastIndex;
    const endMatch = END_MODULE_PATTERN.exec(text);
    if (!endMatch) {
      break;
    }

    ranges.push({
      name,
      declaration,
      bodyStart: MODULE_DECLARATION_PATTERN.lastIndex,
      bodyEnd: endMatch.index,
    });
    MODULE_DECLARATION_PATTERN.lastIndex = END_MODULE_PATTERN.lastIndex;
  }

  return ranges;
}

function parseInstances(body: string, uri: string, fullText: string, bodyOffset: number): ModuleInstance[] {
  const instances: ModuleInstance[] = [];
  const lines = body.split(/\r?\n/);
  let offset = bodyOffset;

  for (const line of lines) {
    const parsed = parseInstanceLine(line);
    if (parsed && !NON_INSTANCE_KEYWORDS.has(parsed.moduleName)) {
      instances.push({
        moduleName: parsed.moduleName,
        instanceName: parsed.instanceName,
        declaration: offsetToLocation(fullText, uri, offset + parsed.moduleOffset),
        parameterized: parsed.parameterized,
      });
    }
    offset += line.length + 1;
  }

  return instances;
}

function parseInstanceLine(line: string):
  | {
      moduleName: string;
      instanceName: string;
      moduleOffset: number;
      parameterized: boolean;
    }
  | undefined {
  const parameterizedMatch = PARAMETERIZED_INSTANCE_DECLARATION_PATTERN.exec(line);
  if (parameterizedMatch) {
    return {
      moduleName: parameterizedMatch[1],
      instanceName: parameterizedMatch[2],
      moduleOffset: parameterizedMatch.index + line.indexOf(parameterizedMatch[1]),
      parameterized: true,
    };
  }

  const plainMatch = PLAIN_INSTANCE_DECLARATION_PATTERN.exec(line);
  if (!plainMatch) {
    return undefined;
  }

  return {
    moduleName: plainMatch[1],
    instanceName: plainMatch[2],
    moduleOffset: plainMatch.index + line.indexOf(plainMatch[1]),
    parameterized: false,
  };
}

function offsetToLocation(text: string, uri: string, offset: number): SourceLocation {
  const prefix = text.slice(0, offset);
  const lines = prefix.split(/\r?\n/);
  return {
    uri,
    line: lines.length - 1,
    character: lines[lines.length - 1].length,
  };
}
