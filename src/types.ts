export interface MArray<T> {
	shape: number[];
	count: number;
	fill: T | undefined;

	isNil(): boolean;

	pick(index: number): T;
}

export type Value = number | string | MArray<Value>;
export type Prefix = (y: Value) => Value
export type Infix = (x: Value, y: Value) => Value
export type Bifunc = (y: Value, x?: Value) => Value
// export type FuncDesc = [Prefix | null, Infix | null, Prefix?, Infix?]
export type FuncDesc = [Bifunc, Bifunc?]

export type UndoPrefix = (func: Prefix) => Prefix
export type UndoInfix = (func: Prefix) => Infix
export type UndoDesc = [UndoPrefix | null, UndoInfix | null]

export type Monad = (f: FuncDesc) => FuncDesc
export type Dyad = (f: FuncDesc, g: FuncDesc) => FuncDesc
export type FuncMap = { [name: string]: FuncDesc | undefined }
export type MonadMap = { [name: string]: Monad | undefined }
export type DyadMap = { [name: string]: Dyad | undefined }
export type UndoMap = { [name: string]: UndoDesc | undefined }
export type ValueMap = { [name: string]: Value | undefined }