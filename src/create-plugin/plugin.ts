import {SupportLanguage, Printer, Plugin} from 'prettier';

import {createPrinter as createJsonStringifyPrinter} from './printers/json-stringify';
import {createPrinter as createJsonPrinter} from './printers/json';
import {JsonFlags} from './flags';
import {AstModifier} from './interfaces';
import {Node, createParser} from './parser';

type PrinterFactory = (flags: JsonFlags) => Printer;

const createPrinter = new Map<string, PrinterFactory>([
  ['json-stringify', createJsonStringifyPrinter],
  ['json', createJsonPrinter],
]);

export type CustomLanguage = Omit<SupportLanguage, 'parsers'>;

export interface JsonPluginInput {
  language: CustomLanguage;

  modifier: AstModifier;

  flags?: JsonFlags;

  parserFlags?: JsonFlags;

  printer?: 'json-stringify' | 'json';
}

export function createJsonPlugin({
  language,
  modifier,
  flags = JsonFlags.Loose,
  parserFlags = JsonFlags.Loose,
  printer = 'json-stringify',
}: JsonPluginInput): Plugin<Node> {
  const astFormat = language.name;

  if (!createPrinter.has(printer)) {
    throw new Error(`Unknown JSON printer: ${printer}`);
  }

  return {
    parsers: {
      [astFormat]: createParser(astFormat, modifier, parserFlags),
    },
    printers: {
      [astFormat]: createPrinter.get(printer)!(flags),
    },

    languages: [
      {
        ...language,
        parsers: [astFormat],
      },
    ],
  };
}
