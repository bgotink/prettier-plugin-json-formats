import {doc, Doc, Printer, ParserOptions, util, AstPath} from 'prettier';
import {
  Node,
  Expression,
  ObjectProperty,
  StringLiteral,
  Identifier,
  ArrayExpression,
  ObjectExpression,
} from '../parser';
import {JsonFlags} from '../flags';
import {
  printLeadingComment,
  printTrailingComment,
  printComment,
} from './comment';
import {hasLeadingOwnLineComment, hasTrailingComment} from './utils';
import {keyword} from 'esutils';

const {hardline, indent, join} = doc.builders;
const {makeString} = util;

function shouldPrintComma(options: ParserOptions, flags: JsonFlags) {
  return (
    (flags & JsonFlags.TrailingCommasAllowed) !== 0 &&
    options.trailingComma !== 'none'
  );
}

function printNumber(rawNumber: string, flags: JsonFlags) {
  rawNumber = rawNumber.toLowerCase();

  if ((flags & JsonFlags.HexadecimalNumberAllowed) === 0) {
    rawNumber = rawNumber.replace(/0x([0-9a-f]+)/, (_, hex) =>
      Number.parseInt(hex, 16).toString(),
    );
  }

  if ((flags & JsonFlags.LaxNumberParsingAllowed) === 0) {
    // Remove leading +
    rawNumber = rawNumber.replace(/^\+/, '');
  }

  return (
    rawNumber
      // Remove unnecessary plus and zeroes from scientific notation.
      .replace(/^([+-]?[\d.]+e)(?:\+|(-))?0*(\d)/, '$1$2$3')
      // Remove unnecessary scientific notation (1e0).
      .replace(/^([+-]?[\d.]+)e[+-]?0+$/, '$1')
      // Make sure numbers always start with a digit.
      .replace(/^([+-])?\./, '$10.')
      // Remove extraneous trailing decimal zeroes.
      .replace(/(\.\d+?)0+(?=e|$)/, '$1')
      // Remove trailing dot.
      .replace(/\.(?=e|$)/, '')
  );
}

function getPreferredQuote(rawContent: string, prefersSingleQuote: boolean) {
  const double = {quote: '"' as const, regex: /"/g};
  const single = {quote: "'" as const, regex: /'/g};

  const preferred = prefersSingleQuote ? single : double;
  const alternate = preferred === single ? double : single;

  let result = preferred.quote;

  // If `rawContent` contains at least one of the quote preferred for enclosing
  // the string, we might want to enclose with the alternate quote instead, to
  // minimize the number of escaped quotes.
  if (
    rawContent.includes(preferred.quote) ||
    rawContent.includes(alternate.quote)
  ) {
    const numPreferredQuotes = (rawContent.match(preferred.regex) || []).length;
    const numAlternateQuotes = (rawContent.match(alternate.regex) || []).length;

    result =
      numPreferredQuotes > numAlternateQuotes
        ? alternate.quote
        : preferred.quote;
  }

  return result;
}

function printString(
  rawContent: string,
  {singleQuote}: ParserOptions,
  flags: JsonFlags,
): Doc {
  // `rawContent` is the string exactly like it appeared in the input source
  // code, without its enclosing quotes.
  const enclosingQuote =
    (flags & JsonFlags.SingleQuotesAllowed) !== 0
      ? getPreferredQuote(rawContent, singleQuote)
      : '"';

  // It might sound unnecessary to use `makeString` even if the string already
  // is enclosed with `enclosingQuote`, but it isn't. The string could contain
  // unnecessary escapes (such as in `"\'"`). Always using `makeString` makes
  // sure that we consistently output the minimum amount of escaped quotes.
  return makeString(rawContent, enclosingQuote, true);
}

function shouldQuoteKey(
  key: StringLiteral | Identifier,
  {quoteProps}: ParserOptions,
  objectHasStringKey: boolean,
  flags: JsonFlags,
) {
  // Strict JSON requires quoted keys
  if ((flags & JsonFlags.IdentifierKeyNamesAllowed) === 0) {
    return true;
  }

  // One of the keys needs to be quoted & we need to be consistent
  if (objectHasStringKey && quoteProps === 'consistent') {
    return true;
  }

  if (quoteProps === 'preserve') {
    return key.type === 'string';
  }

  return !keyword.isIdentifierNameES5(key.value);
}

function printPropertyKey(
  leftNode: Identifier | StringLiteral,
  printedLeft: Doc,
  options: ParserOptions,
): Doc {
  if (hasTrailingComment(leftNode)) {
    return indent([printedLeft, printTrailingComment(null!, options, true)]);
  }

  return [printedLeft];
}

function printPropertyValue(
  rightNode: Expression,
  printedRight: Doc,
  options: ParserOptions,
): Doc {
  if (hasLeadingOwnLineComment(options.originalText, rightNode, options)) {
    return indent([
      hardline,
      printLeadingComment(null!, options),
      printedRight,
    ]);
  }

  return [' ', printedRight];
}

function printObjectProperty(
  path: AstPath<ObjectProperty>,
  options: ParserOptions,
  objectHasStringKey: boolean,
  flags: JsonFlags,
  print: (node: AstPath) => Doc,
): Doc {
  const node = path.getNode();

  if (!node) {
    return '';
  }

  const key = shouldQuoteKey(node.key, options, objectHasStringKey, flags)
    ? printString(node.key.value, options, flags)
    : node.key.value;
  const value = path.call(print, 'value');

  return [
    printPropertyKey(node.key, key, options),
    ':',
    printPropertyValue(node.value, value, options),
  ];
}

function printWithComments(
  path: AstPath<Node>,
  options: ParserOptions,
  printed: Doc,
  flags: JsonFlags,
) {
  const node = path.getNode();

  if (!node || (flags & JsonFlags.CommentsAllowed) === 0) {
    return printed;
  }

  const prefix = node.leadingComments
    ? [
        join(
          hardline,
          path.map(
            node => printLeadingComment(node, options),
            'leadingComments',
          ),
        ),
        hardline,
      ]
    : '';
  const suffix = node.trailingComments
    ? join(
        hardline,
        path.map(
          node => printTrailingComment(node, options),
          'trailingComments',
        ),
      )
    : '';

  return [prefix, printed, suffix];
}

function createGenericPrint(flags: JsonFlags) {
  return (
    path: AstPath<Node>,
    options: ParserOptions,
    print: (node: AstPath) => Doc,
  ): Doc => {
    const node = path.node;
    switch (node.type) {
      case 'program':
        return [
          path.call(
            p => printWithComments(p, options, print(p), flags),
            'expression',
          ),
          hardline,
        ];
      case 'array': {
        const contentPrefix = node.leadingInnerComments
          ? [
              hardline,
              join(
                hardline,
                path.map(
                  commentPath => printComment(commentPath, options),
                  'leadingInnerComments',
                ),
              ),
            ]
          : '';
        const contentSuffix = node.trailingInnerComments
          ? [
              hardline,
              join(
                hardline,
                path.map(
                  commentPath => printComment(commentPath, options),
                  'trailingInnerComments',
                ),
              ),
            ]
          : '';

        if (node.elements.length === 0) {
          if (!contentPrefix && !contentSuffix) {
            return printWithComments(
              path as AstPath<ArrayExpression>,
              options,
              '[]',
              flags,
            );
          }

          return printWithComments(
            path as AstPath<ArrayExpression>,
            options,
            [
              '[',
              indent([
                contentPrefix,
                contentPrefix && contentSuffix ? hardline : '',
                contentSuffix,
              ]),
              hardline,
              ']',
            ],
            flags,
          );
        }

        const elements = path.map((element: AstPath<Expression>, i) => {
          const elementNode = element.getNode();
          const printedNode = print(element);

          const addComma =
            i < node.elements.length - 1 || shouldPrintComma(options, flags);

          const printed = printWithComments(
            element,
            options,
            addComma ? [printedNode, ','] : printedNode,
            flags,
          );
          const hasLeadingComments = !!(
            elementNode && elementNode.leadingComments
          );
          const hasTrailingComments = !!(
            elementNode && elementNode.trailingComments
          );

          return {printed, hasLeadingComments, hasTrailingComments};
        }, 'elements');

        const content: Doc[] = [];

        if (contentPrefix) {
          content.push(contentPrefix, hardline);
        }

        content.push(hardline);
        content.push(elements[0].printed);

        if (!elements[0].hasTrailingComments) {
          content.push(hardline);
        }

        for (let i = 1; i < elements.length; i++) {
          if (
            elements[i - 1].hasTrailingComments &&
            elements[i].hasLeadingComments
          ) {
            content.push(hardline);
          }

          content.push(elements[i].printed);

          if (!elements[i].hasTrailingComments) {
            content.push(hardline);
          }
        }

        if (contentSuffix) {
          content.push(hardline, contentSuffix);
        } else {
          content.pop();
        }

        return ['[', indent(content), hardline, ']'];
      }
      case 'object': {
        const contentPrefix = node.leadingInnerComments
          ? [
              hardline,
              join(
                hardline,
                path.map(
                  commentPath => printComment(commentPath, options),
                  'leadingInnerComments',
                ),
              ),
            ]
          : '';
        const contentSuffix = node.trailingInnerComments
          ? [
              hardline,
              join(
                hardline,
                path.map(
                  commentPath => printComment(commentPath, options),
                  'trailingInnerComments',
                ),
              ),
            ]
          : '';

        if (node.properties.length === 0) {
          if (!contentPrefix && !contentSuffix) {
            return printWithComments(
              path as AstPath<ObjectExpression>,
              options,
              '{}',
              flags,
            );
          }

          return printWithComments(
            path as AstPath<ObjectExpression>,
            options,
            [
              '{',
              indent([
                contentPrefix,
                contentPrefix && contentSuffix ? hardline : '',
                contentSuffix,
              ]),
              hardline,
              '}',
            ],
            flags,
          );
        }

        const properties = path.map((element, i) => {
          const propertyNode = element.getNode();
          const printedNode = print(element);

          const addComma =
            i < node.properties.length - 1 || shouldPrintComma(options, flags);

          const printed = printWithComments(
            element,
            options,
            addComma ? [printedNode, ','] : printedNode,
            flags,
          );
          const hasLeadingComments = !!(
            propertyNode && propertyNode.leadingComments
          );
          const hasTrailingComments = !!(
            propertyNode && propertyNode.trailingComments
          );

          return {printed, hasLeadingComments, hasTrailingComments};
        }, 'properties');

        const content: Doc[] = [];

        if (contentPrefix) {
          content.push(contentPrefix, hardline);
        }

        content.push(hardline);
        content.push(properties[0].printed);

        if (!properties[0].hasTrailingComments) {
          content.push(hardline);
        }

        for (let i = 1; i < properties.length; i++) {
          if (
            properties[i - 1].hasTrailingComments &&
            properties[i].hasLeadingComments
          ) {
            content.push(hardline);
          }

          content.push(properties[i].printed);

          if (!properties[i].hasTrailingComments) {
            content.push(hardline);
          }
        }

        if (contentSuffix) {
          content.push(hardline, contentSuffix);
        } else {
          content.pop();
        }

        return ['{', indent(content), hardline, '}'];
      }
      case 'object property':
        return printObjectProperty(
          path as AstPath<ObjectProperty>,
          options,
          /* TODO */ true,
          flags,
          print,
        );
      case 'null':
        return 'null';
      case 'true':
        return 'true';
      case 'false':
        return 'false';
      case 'number':
        return printNumber(node.rawText, flags);
      case 'string':
        return printString(node.value, options, flags);
      default:
        /* istanbul ignore next */
        throw new Error('unknown type: ' + JSON.stringify((node as Node).type));
    }
  };
}

export function createPrinter(flags: JsonFlags): Printer<Node> {
  return {
    print: createGenericPrint(flags),
  };
}
