export type PreprocessorInput = {
  uri: string;
  text: string;
};

export type PreprocessorOptions = {
  defines?: Record<string, unknown>;
  resolveInclude?: (includePath: string, fromUri: string) => PreprocessorInput | undefined;
  maxIncludeDepth?: number;
};

export type PreprocessorResult = {
  text: string;
  warnings: string[];
};

type ConditionalFrame = {
  parentActive: boolean;
  active: boolean;
  branchTaken: boolean;
};

const DIRECTIVE_PATTERN = /^\s*`(include|define|ifdef|ifndef|elsif|else|endif)\b(.*)$/;
const INCLUDE_PATTERN = /"([^"]+)"|<([^>]+)>/;
const IDENTIFIER_PATTERN = /^([A-Za-z_][A-Za-z0-9_$]*)/;
const MACRO_REFERENCE_PATTERN = /`([A-Za-z_][A-Za-z0-9_$]*)/g;

const COMPILER_DIRECTIVES = new Set([
  'begin_keywords',
  'celldefine',
  'default_nettype',
  'end_keywords',
  'endcelldefine',
  'line',
  'nounconnected_drive',
  'pragma',
  'resetall',
  'timescale',
  'unconnected_drive',
]);

export function preprocessVerilog(input: PreprocessorInput, options: PreprocessorOptions = {}): PreprocessorResult {
  const context = {
    defines: normalizeDefines(options.defines ?? {}),
    resolveInclude: options.resolveInclude,
    maxIncludeDepth: options.maxIncludeDepth ?? 32,
    warnings: [] as string[],
    includeStack: [] as string[],
    warnedMacros: new Set<string>(),
  };

  const text = preprocessText(input, context, 0);
  return {
    text,
    warnings: context.warnings,
  };
}

function preprocessText(
  input: PreprocessorInput,
  context: {
    defines: Set<string>;
    resolveInclude: PreprocessorOptions['resolveInclude'];
    maxIncludeDepth: number;
    warnings: string[];
    includeStack: string[];
    warnedMacros: Set<string>;
  },
  depth: number
): string {
  if (depth > context.maxIncludeDepth) {
    context.warnings.push(`Include depth exceeded at ${input.uri}`);
    return '';
  }
  if (context.includeStack.includes(input.uri)) {
    context.warnings.push(`Recursive include skipped: ${input.uri}`);
    return '';
  }

  context.includeStack.push(input.uri);
  const output: string[] = [];
  const conditionals: ConditionalFrame[] = [];
  const lines = input.text.split(/\r?\n/);

  for (const line of lines) {
    const directive = DIRECTIVE_PATTERN.exec(line);
    if (!directive) {
      if (isActive(conditionals)) {
        warnUnsupportedMacros(line, input.uri, context);
        output.push(line);
      } else {
        output.push('');
      }
      continue;
    }

    const keyword = directive[1];
    const argument = directive[2].trim();
    switch (keyword) {
      case 'include':
        output.push(isActive(conditionals) ? handleInclude(argument, input.uri, context, depth) : '');
        break;
      case 'define':
        if (isActive(conditionals)) {
          const name = parseIdentifier(argument);
          if (name) {
            context.defines.add(name);
          }
        }
        output.push('');
        break;
      case 'ifdef':
      case 'ifndef':
        conditionals.push(createConditionalFrame(conditionals, keyword, argument, context.defines));
        output.push('');
        break;
      case 'elsif':
        updateElsif(conditionals, argument, context.defines);
        output.push('');
        break;
      case 'else':
        updateElse(conditionals);
        output.push('');
        break;
      case 'endif':
        if (!conditionals.pop()) {
          context.warnings.push(`Unmatched \`endif in ${input.uri}`);
        }
        output.push('');
        break;
      default:
        output.push('');
    }
  }

  if (conditionals.length > 0) {
    context.warnings.push(`Unclosed conditional directive in ${input.uri}`);
  }

  context.includeStack.pop();
  return output.join('\n');
}

function handleInclude(
  argument: string,
  fromUri: string,
  context: {
    resolveInclude: PreprocessorOptions['resolveInclude'];
    warnings: string[];
    includeStack: string[];
    maxIncludeDepth: number;
    defines: Set<string>;
    warnedMacros: Set<string>;
  },
  depth: number
): string {
  const includeMatch = INCLUDE_PATTERN.exec(argument);
  const includePath = includeMatch?.[1] ?? includeMatch?.[2];
  if (!includePath) {
    context.warnings.push(`Unsupported include directive in ${fromUri}: ${argument}`);
    return '';
  }

  const included = context.resolveInclude?.(includePath, fromUri);
  if (!included) {
    context.warnings.push(`Include not found from ${fromUri}: ${includePath}`);
    return '';
  }

  return preprocessText(included, context, depth + 1);
}

function createConditionalFrame(
  stack: ConditionalFrame[],
  keyword: 'ifdef' | 'ifndef',
  argument: string,
  defines: Set<string>
): ConditionalFrame {
  const parentActive = isActive(stack);
  const name = parseIdentifier(argument);
  const condition = name ? defines.has(name) : false;
  const active = parentActive && (keyword === 'ifdef' ? condition : !condition);
  return {
    parentActive,
    active,
    branchTaken: active,
  };
}

function updateElsif(stack: ConditionalFrame[], argument: string, defines: Set<string>): void {
  const frame = stack[stack.length - 1];
  if (!frame) {
    return;
  }
  const name = parseIdentifier(argument);
  const condition = name ? defines.has(name) : false;
  frame.active = frame.parentActive && !frame.branchTaken && condition;
  frame.branchTaken = frame.branchTaken || frame.active;
  if (!name) {
    // Keep this warning low-key: malformed conditionals are ignored rather than fatal.
    frame.active = false;
    frame.branchTaken = frame.branchTaken || false;
  }
}

function updateElse(stack: ConditionalFrame[]): void {
  const frame = stack[stack.length - 1];
  if (!frame) {
    return;
  }
  frame.active = frame.parentActive && !frame.branchTaken;
  frame.branchTaken = true;
}

function isActive(stack: ConditionalFrame[]): boolean {
  return stack.every((frame) => frame.active);
}

function normalizeDefines(defines: Record<string, unknown>): Set<string> {
  const normalized = new Set<string>();
  for (const [name, value] of Object.entries(defines)) {
    if (value !== false && value !== null && value !== undefined) {
      normalized.add(name);
    }
  }
  return normalized;
}

function parseIdentifier(text: string): string | undefined {
  return IDENTIFIER_PATTERN.exec(text)?.[1];
}

function warnUnsupportedMacros(
  line: string,
  uri: string,
  context: {
    defines: Set<string>;
    warnings: string[];
    warnedMacros: Set<string>;
  }
): void {
  MACRO_REFERENCE_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = MACRO_REFERENCE_PATTERN.exec(line)) !== null) {
    const name = match[1];
    if (COMPILER_DIRECTIVES.has(name) || context.defines.has(name) || context.warnedMacros.has(name)) {
      continue;
    }
    context.warnedMacros.add(name);
    context.warnings.push(`Macro expansion is not supported for \`${name} in ${uri}`);
  }
}
