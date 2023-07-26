import {JsonObject, JsonArray} from './values';

export interface Position {
  offset: number;

  line: number;
  column: number;
}

export interface BaseNode {
  start: Readonly<Position>;
  end: Readonly<Position>;
  rawText: string;
}

export interface SingleLineComment extends BaseNode {
  type: 'single line comment';
  comment: string;

  precedingNode?: Node;
  enclosingNode?: ArrayExpression | ObjectExpression;
  followingNode?: Node;
}

export interface MultiLineComment extends BaseNode {
  type: 'multi-line comment';
  comment: string;

  precedingNode?: Node;
  enclosingNode?: ArrayExpression | ObjectExpression;
  followingNode?: Node;
}

export type Comment = SingleLineComment | MultiLineComment;

export interface BaseValueNode extends BaseNode {
  leadingComments?: Comment[];
  trailingComments?: Comment[];
}

export interface ObjectProperty extends BaseValueNode {
  type: 'object property';
  key: StringLiteral | Identifier;
  value: Expression;
}

export interface ArrayExpression extends BaseValueNode {
  type: 'array';
  elements: Expression[];
  value: JsonArray;

  leadingInnerComments?: Comment[];
  trailingInnerComments?: Comment[];
}

export interface ObjectExpression extends BaseValueNode {
  type: 'object';
  properties: ObjectProperty[];
  value: JsonObject;

  leadingInnerComments?: Comment[];
  trailingInnerComments?: Comment[];
}

export interface FalseLiteral extends BaseValueNode {
  type: 'false';
  value: false;
}

export interface TrueLiteral extends BaseValueNode {
  type: 'true';
  value: true;
}

export interface NullLiteral extends BaseValueNode {
  type: 'null';
  value: null;
}

export interface NumberLiteral extends BaseValueNode {
  type: 'number';
  value: number;
}

export interface StringLiteral extends BaseValueNode {
  type: 'string';
  value: string;
}

export interface Identifier extends BaseValueNode {
  type: 'identifier';
  value: string;
}

export type Literal =
  | FalseLiteral
  | Identifier
  | NullLiteral
  | NumberLiteral
  | StringLiteral
  | TrueLiteral;
export type Expression = ArrayExpression | ObjectExpression | Literal;
export type Node = Expression | ObjectProperty | Program;

export interface Program extends BaseValueNode {
  type: 'program';
  expression: Expression;
}
