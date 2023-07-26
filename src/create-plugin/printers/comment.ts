import {doc, Doc, ParserOptions, AstPath} from 'prettier';

import {hasNewline, skipNewline, isPreviousLineEmpty} from './utils';
import {Comment, Expression, ObjectProperty, MultiLineComment} from '../parser';

const {breakParent, cursor, hardline, join, lineSuffix} = doc.builders;

function isIndentableBlockComment(comment: MultiLineComment) {
  // If the comment has multiple lines and every line starts with a star
  // we can fix the indentation of each line. The stars in the `/*` and
  // `*/` delimiters are not included in the comment value, so add them
  // back first.
  const lines = `*${comment.comment}*`.split('\n');
  return lines.length > 1 && lines.every(line => line.trim().startsWith('*'));
}

function printIndentableBlockComment(comment: MultiLineComment) {
  const lines = comment.comment.split('\n');

  return [
    '/*',
    join(
      hardline,
      lines.map((line, index) =>
        index === 0
          ? line.trimRight()
          : ' ' + (index < lines.length - 1 ? line.trim() : line.trimLeft()),
      ),
    ),
    '*/',
  ];
}

export function printComment(
  commentPath: AstPath<Comment>,
  options: ParserOptions,
  ensureSafeForContentAfter = false,
): Doc {
  const comment = commentPath.getValue();

  switch (comment.type) {
    case 'multi-line comment': {
      if (isIndentableBlockComment(comment)) {
        return printIndentableBlockComment(comment);
      }

      return (
        '/*' + comment.comment + '*/' + (ensureSafeForContentAfter ? ' ' : '')
      );
    }
    case 'single line comment':
      return [
        // Print shebangs with the proper comment characters
        options.originalText.slice(options.locStart(comment)).startsWith('#!')
          ? '#!'
          : '// ',
        comment.comment.trim(),
        ensureSafeForContentAfter ? hardline : '',
      ];
    default:
      throw new Error('Not a comment: ' + JSON.stringify(comment));
  }
}

export function printLeadingComment(
  commentPath: AstPath<Comment>,
  options: ParserOptions,
): Doc {
  const comment = commentPath.getValue();
  const contents = printComment(commentPath, options);
  if (!contents) {
    return '';
  }
  const isBlock = (
    options as unknown as {
      printer: {isBlockComment?: (comment: Comment) => boolean};
    }
  ).printer.isBlockComment?.(comment);

  // Leading block comments should see if they need to stay on the
  // same line or not.
  if (!isBlock) {
    return contents;
  }

  return [
    contents,
    hasNewline(options.originalText, options.locEnd(comment)) ? hardline : ' ',
  ];
}

export function printTrailingComment(
  commentPath: AstPath<Comment>,
  options: ParserOptions,
  ensureSafeForContentAfter = false,
): Doc {
  const comment = commentPath.getValue();
  const contents = printComment(
    commentPath,
    options,
    ensureSafeForContentAfter,
  );
  if (!contents) {
    return '';
  }
  const isBlock = (
    options as unknown as {
      printer: {isBlockComment?: (comment: Comment) => boolean};
    }
  ).printer.isBlockComment?.(comment);

  if (
    hasNewline(options.originalText, options.locStart(comment), {
      backwards: true,
    })
  ) {
    // This allows comments at the end of nested structures:
    // {
    //   x: 1,
    //   y: 2
    //   // A comment
    // }
    // Those kinds of comments are almost always leading comments, but
    // here it doesn't go "outside" the block and turns it into a
    // trailing comment for `2`. We can simulate the above by checking
    // if this a comment on its own line; normal trailing comments are
    // always at the end of another expression.

    const isLineBeforeEmpty = isPreviousLineEmpty(
      options.originalText,
      comment,
      options.locStart,
    );

    return lineSuffix([hardline, isLineBeforeEmpty ? hardline : '', contents]);
  } else if (isBlock) {
    // Trailing block comments never need a newline
    return [' ', contents];
  }

  return [lineSuffix([' ', contents]), !isBlock ? breakParent : ''];
}

function prependCursorPlaceholder(
  path: AstPath,
  options: ParserOptions,
  printed: Doc,
): Doc {
  if (
    path.getNode() ===
      (options as unknown as {cursorNode: unknown}).cursorNode &&
    path.getValue()
  ) {
    return [cursor, printed, cursor];
  }
  return printed;
}

function isEmpty<T>(arr?: T[]): arr is [T, ...T[]] {
  return !!arr?.length;
}

export function printComments(
  path: AstPath<Expression | ObjectProperty>,
  print: (path: AstPath) => Doc,
  options: ParserOptions,
): Doc {
  const value = path.getValue();
  const printed = print(path);

  if (
    !value ||
    (isEmpty(value.leadingComments) && isEmpty(value.trailingComments))
  ) {
    return prependCursorPlaceholder(path, options, printed);
  }

  const leadingParts = path.map((commentPath: AstPath) => {
    const contents = printLeadingComment(commentPath, options);

    const text = options.originalText;
    const index = skipNewline(text, options.locEnd(commentPath.getNode()));

    if (index !== false && hasNewline(text, index)) {
      return [contents, hardline];
    } else {
      return contents;
    }
  }, 'leadingComments');

  const trailingParts = [
    printed,
    ...path.map(
      (commentPath: AstPath) => printTrailingComment(commentPath, options),
      'trailingComments',
    ),
  ];

  return prependCursorPlaceholder(
    path,
    options,
    leadingParts.concat(trailingParts),
  );
}
