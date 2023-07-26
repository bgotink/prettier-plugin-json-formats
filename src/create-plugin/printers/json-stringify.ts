import {doc, Doc, AstPath, Printer, ParserOptions} from 'prettier';
import {Node} from '../parser';

const {hardline, indent, join} = doc.builders;

function genericPrint(
  path: AstPath<Node>,
  _options: ParserOptions,
  print: (node: AstPath) => Doc,
): Doc {
  const node = path.node;
  switch (node.type) {
    case 'program':
      return [path.call(print, 'expression'), hardline];
    case 'array':
      return node.elements.length === 0
        ? '[]'
        : [
            '[',
            indent([
              hardline,
              join([',', hardline], path.map(print, 'elements')),
            ]),
            hardline,
            ']',
          ];
    case 'object':
      return node.properties.length === 0
        ? '{}'
        : [
            '{',
            indent([
              hardline,
              join([',', hardline], path.map(print, 'properties')),
            ]),
            hardline,
            '}',
          ];
    case 'object property':
      return [path.call(print, 'key'), ': ', path.call(print, 'value')];
    case 'null':
      return 'null';
    case 'true':
      return 'true';
    case 'false':
      return 'false';
    case 'string':
    case 'number':
    case 'identifier':
      return JSON.stringify(node.value);
    default:
      /* istanbul ignore next */
      throw new Error('unknown type: ' + JSON.stringify((node as Node).type));
  }
}

function clean(node: Node /*, newNode: Node, parent*/): Node | void {
  if (node.type === 'identifier') {
    return {...node, type: 'string'};
  }

  return;
}

export function createPrinter(): Printer<Node> {
  return {
    print: genericPrint,
    massageAstNode: clean,
  };
}
