import { ModuleDefinition, ModuleInstance, SourceLocation } from './model';

type CommentMaskState = {
  inBlockComment: boolean;
};

const MODULE_DECLARATION_PATTERN = /\bmodule\s+([A-Za-z_][A-Za-z0-9_$]*)\b/g;
const END_MODULE_PATTERN = /\bendmodule\b/g;

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
  for (const candidateOffset of findLineContentOffsets(body)) {
    const parsed = parseInstanceAt(body, candidateOffset);
    if (parsed && !NON_INSTANCE_KEYWORDS.has(parsed.moduleName)) {
      instances.push({
        moduleName: parsed.moduleName,
        instanceName: parsed.instanceName,
        declaration: offsetToLocation(fullText, uri, bodyOffset + candidateOffset),
        parameterized: parsed.parameterized,
      });
    }
  }

  return instances;
}

function parseInstanceAt(text: string, start: number):
  | {
      moduleName: string;
      instanceName: string;
      parameterized: boolean;
    }
  | undefined {
  const moduleName = readIdentifier(text, start);
  if (!moduleName) {
    return undefined;
  }

  let cursor = skipWhitespace(text, moduleName.end);
  let parameterized = false;
  if (text[cursor] === '#') {
    parameterized = true;
    cursor = skipWhitespace(text, cursor + 1);
    const parameterEnd = consumeBalanced(text, cursor, '(', ')');
    if (parameterEnd === undefined) {
      return undefined;
    }
    cursor = skipWhitespace(text, parameterEnd);
  }

  const instanceName = readIdentifier(text, cursor);
  if (!instanceName) {
    return undefined;
  }
  cursor = skipWhitespace(text, instanceName.end);

  while (text[cursor] === '[') {
    const dimensionEnd = consumeBalanced(text, cursor, '[', ']');
    if (dimensionEnd === undefined) {
      return undefined;
    }
    cursor = skipWhitespace(text, dimensionEnd);
  }

  if (consumeBalanced(text, cursor, '(', ')') === undefined) {
    return undefined;
  }

  return {
    moduleName: moduleName.value,
    instanceName: instanceName.value,
    parameterized,
  };
}

function findLineContentOffsets(text: string): number[] {
  const offsets: number[] = [];
  let lineStart = 0;

  while (lineStart < text.length) {
    let contentStart = lineStart;
    while (text[contentStart] === ' ' || text[contentStart] === '\t' || text[contentStart] === '\r') {
      contentStart += 1;
    }
    if (isIdentifierStart(text[contentStart])) {
      offsets.push(contentStart);
    }

    const newline = text.indexOf('\n', lineStart);
    if (newline === -1) {
      break;
    }
    lineStart = newline + 1;
  }

  return offsets;
}

function readIdentifier(text: string, start: number): { value: string; end: number } | undefined {
  if (!isIdentifierStart(text[start])) {
    return undefined;
  }

  let end = start + 1;
  while (isIdentifierPart(text[end])) {
    end += 1;
  }
  return { value: text.slice(start, end), end };
}

function isIdentifierStart(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z_]/.test(character);
}

function isIdentifierPart(character: string | undefined): boolean {
  return character !== undefined && /[A-Za-z0-9_$]/.test(character);
}

function skipWhitespace(text: string, start: number): number {
  let cursor = start;
  while (/\s/.test(text[cursor] ?? '')) {
    cursor += 1;
  }
  return cursor;
}

function consumeBalanced(
  text: string,
  start: number,
  opening: '(' | '[',
  closing: ')' | ']'
): number | undefined {
  if (text[start] !== opening) {
    return undefined;
  }

  let depth = 0;
  let inString = false;
  for (let cursor = start; cursor < text.length; cursor += 1) {
    const character = text[cursor];
    if (inString) {
      if (character === '\\') {
        cursor += 1;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === opening) {
      depth += 1;
    } else if (character === closing) {
      depth -= 1;
      if (depth === 0) {
        return cursor + 1;
      }
    }
  }

  return undefined;
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
