import type {ParserOptions} from 'prettier';

import type {
  Expression,
  ObjectExpression,
  ObjectProperty,
  StringLiteral,
  ArrayExpression,
  Node,
} from './parser';

import type {AstModifier} from './interfaces';

function isStringLiteral(node: Node): node is StringLiteral {
  return node.type === 'string';
}

function isArrayExpression(node: Node): node is ArrayExpression {
  return node.type === 'array';
}

function isObjectExpression(node: Node): node is ObjectExpression {
  return node.type === 'object';
}

export function combine(...fns: AstModifier[]): AstModifier {
  return (node, opts) => fns.reduce((node, fn) => fn(node, opts), node);
}

export function ifObjectExpression(
  fn: AstModifier<ObjectExpression, Expression>,
): AstModifier {
  return (node, opts) => (isObjectExpression(node) ? fn(node, opts) : node);
}

export function ifArrayExpression(
  fn: AstModifier<ArrayExpression, Expression>,
): AstModifier {
  return (node, opts) => (isArrayExpression(node) ? fn(node, opts) : node);
}

export const replaceProperties = (
  replacer: (
    props: ObjectProperty[],
    opts: ParserOptions,
    node: ObjectExpression,
  ) => ObjectProperty[],
): AstModifier<Expression, Expression> =>
  ifObjectExpression((node, opts) => ({
    ...node,
    properties: replacer(node.properties, opts, node),
  }));

export const replacePropertyValues = (
  replacer: (
    prop: Expression,
    opts: ParserOptions,
    key: string,
    node: ObjectExpression,
  ) => Expression,
): AstModifier<Expression, Expression> =>
  replaceProperties((properties, opts, node) =>
    properties.map(prop => ({
      ...prop,
      value: replacer(prop.value, opts, getKey(prop), node),
    })),
  );

export const replacePropertyValue = (
  key: string,
  replacer: (
    prop: Expression,
    opts: ParserOptions,
    node: ObjectExpression,
  ) => Expression,
): AstModifier<Expression, Expression> =>
  replaceProperties((properties, opts, node) =>
    properties.map(prop =>
      getKey(prop) === key
        ? {...prop, value: replacer(prop.value, opts, node)}
        : prop,
    ),
  );

export function getProperty(
  node: ObjectExpression,
  key: string,
): ObjectProperty | undefined {
  return node.properties.find(prop => getKey(prop) === key);
}

export const renameProperty = (
  oldKey: string,
  newKey: string,
): AstModifier<Expression, Expression> =>
  replaceProperties(properties =>
    properties.map(prop => {
      if (getKey(prop) !== oldKey) {
        return prop;
      }

      const key = prop.key;

      return {
        ...prop,
        key: isStringLiteral(prop.key)
          ? {
              ...key,
              value: newKey,
            }
          : {
              ...key,
              name: newKey,
            },
      };
    }),
  );

export const sortObjectProperties = (
  order?:
    | string[]
    | ((node: ObjectExpression, opts: ParserOptions) => string[] | undefined),
): AstModifier<Expression, Expression> =>
  replaceProperties((properties, opts, node) => {
    const actualOrder =
      (order && (typeof order === 'function' ? order(node, opts) : order)) ||
      properties.map(getKey).sort();
    return [
      ...properties
        .filter(prop => actualOrder.includes(getKey(prop)))
        .sort((a, b) => {
          return (
            actualOrder.indexOf(getKey(a)) - actualOrder.indexOf(getKey(b))
          );
        }),

      ...properties
        .filter(prop => !actualOrder.includes(getKey(prop)))
        .sort((a, b) => {
          const aKey = getKey(a);
          const bKey = getKey(b);

          if (aKey > bKey) {
            return 1;
          } else if (aKey < bKey) {
            return -1;
          } else {
            return 0;
          }
        }),
    ];
  });

export function deepSortObjectProperties(
  order?:
    | string[]
    | ((node: ObjectExpression, opts: ParserOptions) => string[] | undefined),
): AstModifier<Expression, Expression> {
  const deepSort = combine(
    sortObjectProperties(order),
    replacePropertyValues((node, opts) =>
      isObjectExpression(node) ? deepSort(node, opts) : node,
    ),
  );

  return deepSort;
}

function getKey(prop: ObjectProperty): string {
  return prop.key.value;
}

export function getPropertyKeys(node: ObjectExpression): string[] {
  return node.properties.map(getKey);
}

export const sortStringArray = ifArrayExpression(node => {
  if (node.elements.some(node => !isStringLiteral(node))) {
    return node;
  }

  return {
    ...node,

    elements: [...node.elements].sort((a, b) =>
      (a as StringLiteral).value.localeCompare((b as StringLiteral).value),
    ),
  };
});
