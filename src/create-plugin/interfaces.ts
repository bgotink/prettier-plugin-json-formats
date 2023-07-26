import type {ParserOptions} from 'prettier';

import type {Node, Expression} from './parser';

export interface AstModifier<T extends Node = Expression, R extends Node = T> {
  (node: T, options: ParserOptions): R;
}
