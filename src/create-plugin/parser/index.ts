import {JsonFlags} from '../flags';

import {Parser} from 'prettier';
import {Node, Program} from './nodes';
import {parseJson} from './parser';
import {AstModifier} from '../interfaces';

export * from './nodes';
export * from './values';
export {parseJson, InvalidJsonError} from './parser';

function locStart(node: Node): number {
  return node.start.offset;
}

function locEnd(node: Node): number {
  return node.end.offset;
}

export function createParser(
  astFormat: string,
  modifier: AstModifier,
  flags = JsonFlags.Loose,
): Parser<Node> {
  return {
    astFormat,
    locStart,
    locEnd,
    parse: (text, options): Program => {
      const expression = modifier(parseJson(text, flags), options);

      return {
        type: 'program',
        expression,

        rawText: expression.rawText,
        end: expression.end,
        start: expression.start,
      };
    },
  };
}
