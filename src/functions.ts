import { Box, Nil, sliceCell, Zip, byRank, Pick, selectRank, DataArray, Reshape, byCells, checkShape, leadingAxis } from './array.ts';
import { IntList, NumberArray, BoolArray, StringArray, Iota, isList, isArray, isNil, isNumber, } from './functions_core.ts';
import { MArray, Value, Prefix, Infix, Bifunc, FuncMap, UndoMap, MonadMap, DyadMap, FuncDesc } from "./types.ts";
import * as Core from './functions_core.ts';

export function valences(prefix: Prefix, infix: Infix): (y: Value, x?: Value) => Value {	
	return (y,x?)=> x == undefined ? prefix(y) : infix(x, y)
}

function _toNumberArray(y: Value): MArray<number> | null {
	if (y instanceof NumberArray) return y;
	if (y instanceof Iota) return y;

	if (!isArray(y)) return null

	const numbers = new Array(y.count);
	for (let i = 0; i < y.count; i++) {
		const n = y.pick(i);
		if (!isNumber(n)) return null;
		numbers[i] = n
	}
	return new NumberArray(y.shape, numbers);
}

function _toIntList(y: Value): number[] | null {
	if (!isList(y)) return null

	const numbers = Array<number>(y.count);
	for (let i = 0; i < y.count; i++) {
		const n = y.pick(i);
		if (!isNumber(n)) return null;
		numbers[i] = n;
		if (Number.isInteger(n) == false) return null
	}
	return numbers
}

function _orElse<T>(x: T | null, name: string, message: string): T {
	if (x == null) throw Core.errorPrefix(name, message);
	return x;
}

export function _toBool(y: Value): boolean {
	if (isNil(y)) return false;
	if (isArray(y)) return true;

	if (typeof y == 'string') return true;
	if (y == 0 || isNaN(y)) return false;

	return true;
}

export function _toString(y: Value): string {
	if (!isList(y)) throw "Rank Error";

	if (y instanceof StringArray) return y.toString();

	let string = '';
	for (let i = 0; i < y.count; i++) {
		const v = y.pick(i);
		if (typeof v != 'string') {
			throw "Domain Error";
		}
		string += v;
	}
	return string;
}

//#region Runtime Base Functions (Provide)

function _valueLe(x: Value, y: Value): number {
	if (typeof x == 'object' && typeof y == 'object') return +(_compareArrays(x, y) <= 0);
	const s = typeof x, t = typeof y;
	if (s != t) return 0;
    return +(x <= y);
}

function _valueGe(x: Value, y: Value): number {
	if (typeof x == 'object' && typeof y == 'object') return +(_compareArrays(x, y) >= 0);
    const s = typeof x, t = typeof y;
	if (s != t) return 0;
    return +(x >= y);
}

function _matchArrays(a: MArray<Value>, b: MArray<Value>): number {
	if (rank(a) != rank(b)) return 0;
	const sha = a.shape, shb = b.shape;
	for (let i = rank(a); i >= 0; --i) {
		if (sha[i] !== shb[i]) return 0;
	}
	for (let i = 0; i < a.count; ++i) {
		if (funcMatch(a.pick(i), b.pick(i)) == 0) return 0;
	}
	return 1;
}

function _compareArrays(a: MArray<Value>, b: MArray<Value>): number {
	const ranka = rank(a);
	const rankb = rank(b);

	if (ranka < rankb) return -1;
	if (ranka > rankb) return 1;

	let min = 1;
	for (let i = 0; i < ranka; ++i) {
		min *= Math.min(a.shape[i], b.shape[i]);
		if (a.shape[i] !== b.shape[i]) break;
	}

	let i = 0
	for (; i < min-1; ++i) {
		if (!funcMatch(a.pick(i), b.pick(i))) break;
	}

	if (!_valueGe(a.pick(i), b.pick(i))) return -1;
	if (funcMatch(a.pick(i), b.pick(i))) return 0;
	return 1;
}

function _insertionSort(cells: Value[]): number[] {
	const arr = new Array<number>(cells.length);
	arr[0] = 0;
    
    for(let i = 1; i < arr.length; i++){
		arr[i] = i;
        for(let j = i - 1; j > -1; j--){
            if(1-_valueGe(cells[arr[j + 1]], cells[arr[j]])){
				const temp = arr[j+1];
				arr[j+1] = arr[j]
				arr[j] = temp;
            }
        }
    }

  	return arr;
}

function _insertionSortInv(cells: Value[]): number[] {
	const arr = new Array<number>(cells.length);
	arr[0] = 0;
    
    for(let i = 1; i < arr.length; i++){
		arr[i] = i;
        for(let j = i - 1; j > -1; j--){
            if(1-_valueLe(cells[arr[j + 1]], cells[arr[j]]) > 0){
				const temp = arr[j+1];
				arr[j+1] = arr[j]
				arr[j] = temp;
            }
        }
    }

  	return arr;
}

function _merge(arrays: Value[], fill: Value | undefined, outerShape: number[] | null = null): Value {
	const r = rank(arrays[0]);
	const sh = shape(arrays[0]);
	
	for (let i = 0; i < arrays.length; i++) {
		if (r != rank(arrays[i])) throw Core.errorPrefix(">w", "Elements of %w must have matching shapes");
		const sh_ = shape(arrays[i]);
		for (let j = r; j >= 0; --j) {
			if (sh[j] !== sh_[j]) throw Core.errorPrefix(">w", "Elements of %w must have matching shapes");
		}
	}

	const count = typeof arrays[0] == 'object' ? arrays[0].count : 1;
	const data = new Array(count * arrays.length);
	for (let j = 0; j < arrays.length; j++) {
		const arr = arrays[j];
		if (!isArray(arr)) {
			data[j*count] = arrays[j];
			continue;
		}

		for (let i = 0; i < count; i++) {
			data[j*count+i] = arr.pick(i);
		}
	}

	const newShape = outerShape ?? [arrays.length];
	return new DataArray([...newShape, ...sh], data, fill);
}

//#endregion

//#region Properties Functions 

function rank(y: Value): number {
	if (typeof y == 'object') return y.shape.length;
	return 0;
}

export function length(y: Value): number { return (typeof y == 'object') ? y.shape[0] ?? 0 : 1 }
function shape(y: Value): number[] { return (typeof y == 'object') ? y.shape : [] }

function funcDepth(v: Value): number {
	if (typeof v != 'object') return 0;

	let max = 0;
	for (let i = 0; i < v.count; i++) {
		const scalar = v.pick(i);
		if (typeof scalar != 'object') continue;
		const d = funcDepth(scalar);
		if (d > max) max = d;
	}
	return 1 + max;
}

//#endregion

//#region Math Functions

function pervasiveInfix(x: Value, y: Value, f: (x: Value, y: Value) => number | string): Value {
	if (isNil(y)) return Nil;
	if (isNil(x)) return Nil;
	
	let rx;
	const R = +(rx = isArray(x)) + +isArray(y);

	if (R == 0) {
		return f(x, y);
	} else if (R == 1) {
		if (rx) {
			return pervasivePrefix(x as MArray<Value>, k => f(k, y));
		} else {
			return pervasivePrefix(y as MArray<Value>, k => f(x, k));
		}
	} else {
		return new Zip(x as MArray<Value>, y as MArray<Value>, (a, b) => {
			if (typeof a == 'object') return pervasiveInfix(a, funcEnclose(b), f);
			if (typeof b == 'object') return pervasiveInfix(funcEnclose(a), b, f);
	
			return f(a, b);
		})
	}
}

function pervasivePrefix(y: MArray<Value>, f: (x: Value) => number | string): Value {
	if (isNil(y)) return Nil;
	
	const data = Array(y.count);
	for (let i = 0; i < y.count; i++) {
		const k = y.pick(i);
		if (typeof k == 'object') {
			data[i] = pervasivePrefix(k, f);
			
		} else {
			data[i] = f(k);
		}
	}

	return new DataArray(y.shape, data, y.fill);
}

function makeArithFunctionInfix(name: string, f: (x: Value, y: Value) => number): Infix {
	return function(x, y) {
		try {
			let rx;
			const R = +(rx = isArray(x)) + +isArray(y);

			if (R == 0) {
				return f(x, y);
			} else if (R == 1) {
				if (rx) {
					return pervasivePrefix(x as MArray<Value>, k => f(k, y));
				} else {
					return pervasivePrefix(y as MArray<Value>, k => f(x, k));
				}
			} else {
				return pervasiveInfix(x, y, f);
			}
		} catch (e) {
			if (typeof e == 'string') throw Core.errorPrefix(`a${name}w`, e)
			e.message = `a${name}w: ` + e.message;
			throw e;
		}
	}
}

function makeCmpFunctionInfix(name: string, f: (x: Value, y: Value) => number): Infix {
	return function(x, y) {
		if (rank(x) == 0 && rank(y) == 0) {
			return f(x, y)
		}

		try {
			if (isArray(x)) return pervasiveInfix(x, isArray(y) ? y : funcEnclose(y), f)

			// return new Zip(funcEnclose(x), isArray(y) ? y : funcEnclose(y), f);
			return pervasiveInfix(funcEnclose(x), isArray(y) ? y : funcEnclose(y), f)
		} catch (e) {
			if (typeof e == 'string') throw Core.errorPrefix(`a${name}w`, e)
			throw e;
		}
	}
}

function makeArithFunctionPrefix(name: string, f: (y: Value) => number): Prefix {
	return function(y) {
		try {
			if (!isArray(y)) return f(y);

			return pervasivePrefix(y, f);
		} catch (e) {
			if (typeof e == 'string') throw Core.errorPrefix(`${name}w`, e)
			e.message = `${name}w: ` + e.message;
			throw e;
		}
	}
}

const _charT = (c: string, t: number) => String.fromCodePoint((c.codePointAt(0) as number)+t);
const funcAdd: Infix = (x, y) => pervasiveInfix(x, y, (a,b) => {
		const s=typeof a, t=typeof b;
		if (s==="number" && t==="number") return <number>a+<number>b;
		if (s==="number" && t==="string") return _charT(<string>b,<number>a);
		if (s==="string" && t==="number") return _charT(<string>a,<number>b);
		if (s==="string" && t==="string") throw Error("+: Cannot add two characters");
		throw Error("+: Cannot add values");
	});
const funcSub: Infix = (x, y) => pervasiveInfix(x, y, (a,b) => {
	if (typeof b == 'string') {
		if (typeof a == "string") return (a.codePointAt(0) as number)-(b.codePointAt(0) as number);
		throw Error("-: Cannot subtract values");
	}

	const s=typeof a;
	if (s==="number") return <number>a-<number>b;
	if (s==="string") return _charT(<string>a,<number>-b);
	throw Error("-: Cannot subtract values");
});

const funcSum: Prefix = (y) => {
	if (!isArray(y)) throw Core.errorPrefix("+w", "%w must be an array");

	const it = byCells(y);
	let acc: Value = it.next().value ?? 0;
	while (true) {
		const w = it.next();
		if (w.done) break;
		acc = funcAdd(w.value, acc)
	}

	if (shape(acc).length == 0) return funcFirst(acc);

	return acc;
}

const funcProduct: Prefix = (y) => {
	if (!isArray(y)) throw Core.errorPrefix("×w", "%w must be an array");

	const it = byCells(y);
	let acc: Value = it.next().value ?? 0;
	while (true) {
		const w = it.next();
		if (w.done) break;
		acc = funcMult(w.value, acc)
	}

	if (shape(acc).length == 0) return funcFirst(acc);

	return acc;
}

const funcMult = makeArithFunctionInfix('×', (a, b) => { if (!isNumber(a) || !isNumber(b)) throw Core.errorPrefix("×", "Operands must be numbers"); return a * b });
const funcDiv  = makeArithFunctionInfix('÷', (a, b) => { if (!isNumber(a) || !isNumber(b)) throw Core.errorPrefix("÷", "Operands must be numbers"); return a / b });
const funcPow  = makeArithFunctionInfix('^', (a, b) => { if (!isNumber(a) || !isNumber(b)) throw Core.errorPrefix("^", "Operands must be numbers"); return a ** b });
const funcRoot = makeArithFunctionInfix('√', (a, b) => { if (!isNumber(a) || !isNumber(b)) throw Core.errorPrefix("√", "Operands must be numbers"); return b ** (1/a) });
const funcMod  = makeArithFunctionInfix('%', (a, b) => { if (!isNumber(a) || !isNumber(b)) throw Core.errorPrefix("%", "Operands must be numbers"); return a == 0 ? b : b % a });
const funcLog  = makeArithFunctionInfix('∟', (a, b) => { if (!isNumber(a) || !isNumber(b)) throw Core.errorPrefix("∟", "Operands must be numbers"); return Math.log(b)/Math.log(a) });
const funcMin  = makeArithFunctionInfix('⌊', (a, b) => { if (!isNumber(a) || !isNumber(b)) throw Core.errorPrefix("⌊", "Operands must be numbers"); return Math.min(a, b) });
const funcMax  = makeArithFunctionInfix('⌈', (a, b) => { if (!isNumber(a) || !isNumber(b)) throw Core.errorPrefix("⌈", "Operands must be numbers"); return Math.max(a, b) });
const funcAbDf = makeArithFunctionInfix('±', (a, b) => { if (!isNumber(a) || !isNumber(b)) throw Core.errorPrefix("±", "Operands must be numbers"); return Math.abs(a - b) });



const funcNeg   = makeArithFunctionPrefix('-', x => { if (!isNumber(x)) throw Core.errorPrefix("-", "Not a number"); return -x });
const _funcRecp  = makeArithFunctionPrefix('÷', x => { if (!isNumber(x)) throw Core.errorPrefix("÷", "Not a number"); return 1/x });
const funcExp   = makeArithFunctionPrefix('^', x => { if (!isNumber(x)) throw Core.errorPrefix("^", "Not a number"); return Math.exp(x) });
const funcSqrt  = makeArithFunctionPrefix('√', x => { if (!isNumber(x)) throw Core.errorPrefix("√", "Not a number"); return Math.sqrt(x) });
const funcAbs   = makeArithFunctionPrefix('%', x => { if (!isNumber(x)) throw Core.errorPrefix("%", "Not a number"); return Math.abs(x) });
const funcLn    = makeArithFunctionPrefix('∟', x => { if (!isNumber(x)) throw Core.errorPrefix("∟", "Not a number"); return Math.log(x) });
const funcFloor = makeArithFunctionPrefix('⌊', x => { if (!isNumber(x)) throw Core.errorPrefix("⌊", "Not a number"); return Math.floor(x) });
const funcCeil  = makeArithFunctionPrefix('⌈', x => { if (!isNumber(x)) throw Core.errorPrefix("⌈", "Not a number"); return Math.ceil(x) });
const funcSign  = makeArithFunctionPrefix('±', x => { if (!isNumber(x)) throw Core.errorPrefix("±", "Not a number"); return Math.sign(x) });

const funcNot = makeArithFunctionPrefix('~', x => { if (!isNumber(x)) throw Core.errorPrefix("~", "Not a number"); return 1-x });
const funcAnd = makeArithFunctionInfix('∧',(a, b) => { if (!isNumber(a) || !isNumber(b)) throw Core.errorPrefix("∧", "Operands must be numbers"); return a & b });
const funcOr = makeArithFunctionInfix('∨', (a, b) => { if (!isNumber(a) || !isNumber(b)) throw Core.errorPrefix("∨", "Operands must be numbers"); return a | b });

const funcCmpLe = makeCmpFunctionInfix('≤',(a, b) => _valueLe(a, b));
const funcCmpLt = makeCmpFunctionInfix('<',(a, b) => 1-_valueGe(a, b));
const funcCmpGe = makeCmpFunctionInfix('≥',(a, b) => _valueGe(a, b));
const funcCmpGt = makeCmpFunctionInfix('>',(a, b) => 1-_valueLe(a, b));
const funcCmpNe = makeCmpFunctionInfix('≠',(a, b) => 1-funcMatch(a, b));
const funcCmpEq = makeCmpFunctionInfix('=',(a, b) => funcMatch(a, b));

function makeCircleFunction(name: string, f: (y: number) => number): Bifunc {
	return function(y, x?) {
		if (x != undefined) throw Core.errorPrefix(`${name}w`, "Must be called with 1 argument");
		if (isNumber(y)) return f(y);
		if (!isArray(y)) throw Core.errorPrefix(`${name}w`, "%w must be a number or number list")
		const rec = (w: MArray<Value>) => {
			if (isNil(w)) return Nil;

			const data = Array(w.count);
			for (let i = 0; i < w.count; i++) {
				const k = w.pick(i);
				if (typeof k == 'object') {
					data[i] = rec(k);
				} else {
					if (!isNumber(k)) throw Core.errorPrefix(`${name}w`, "Not a number");
					data[i] = f(k);
				}
			}

			return new DataArray(w.shape, data, w.fill);
		};
		return rec(y);
	}
}

const funcCircleSin: [Bifunc, Bifunc] = [ makeCircleFunction('Sin', Math.sin), makeCircleFunction('Asin', Math.asin) ];
const funcCircleCos: [Bifunc, Bifunc] = [ makeCircleFunction('Cos', Math.cos), makeCircleFunction('Acos', Math.acos) ];
const funcCircleTan: [Bifunc, Bifunc] = [ makeCircleFunction('Tan', Math.tan), makeCircleFunction('Atan', Math.atan) ];
const funcCircleSinh: [Bifunc, Bifunc] = [ makeCircleFunction('Sinh', Math.sinh), makeCircleFunction('Asinh', Math.asinh) ];
const funcCircleCosh: [Bifunc, Bifunc] = [ makeCircleFunction('Cosh', Math.cosh), makeCircleFunction('Acosh', Math.acosh) ];
const funcCircleTanh: [Bifunc, Bifunc] = [ makeCircleFunction('Tanh',  Math.tanh), makeCircleFunction('Atanh',  Math.atanh) ];

//#endregion Math Functions

//#region Shaping Functions

function reshape(x: number[], y: Value): Value {
	const [saneShape, count] = checkShape(x, 'αρω: ');
	if (count == 0) { return Nil; }
	if (isArray(y)) {
		return new Reshape(y, saneShape, count);
	} else {
		return new Reshape(new Box(y, y), saneShape, count);
	}
}

function funcEnclose(y: Value): Box<Value> { return new Box(y, Nil); }

function funcDeshape(y: Value): Value {
	if (!isArray(y)) return new DataArray([1], [y]);
	if (y.count == 0) { return Nil; }
	return new Reshape(y, [y.count], y.count);
}

function funcSolo(y: Value): Value {
	if (!isArray(y)) return new DataArray([1], [y]);
	if (y.count == 0) { return Nil; }
	return new Reshape(y, [1, ...y.shape], y.count);
}

function funcMerge(y: Value): Value {
	if (!isArray(y)) throw Core.errorPrefix(">w", "Rank of %w must be >0")

	const arrays = new Array<Value>(y.count);
	for (let i = 0; i < y.count; i++) { arrays[i] = y.pick(i); }

	return _merge(arrays, y.fill ?? Nil, y.shape);
}

function funcReshape(x: Value, y: Value) {
	if (isNumber(x)) return reshape([x], y);
	const shape = _orElse(_toIntList(x), "aρw", "%a must be a number or list");
	return reshape(shape, y);
}

function funcJoinTo(x: Value, y: Value): Value {
	if (isNil(x)) return y;
	if (isNil(y)) return x;

	let diff = rank(x) - rank(y);
	
	if (diff == 1) {
		y = funcSolo(y);
	} else if (diff == -1) {
		x = funcSolo(x);
	}
		
	diff = rank(x) - rank(y);
	const ranks = rank(x);

	if (diff != 0) throw Core.errorPrefix("a;w", "Rank of %a and %w must differ by at least 1");

	if (ranks == 0) return new DataArray([2], [x, y]);

	if (!isArray(x) || !isArray(y)) throw "Unreachable";

	const newShape = [...x.shape];
	newShape[0] = x.shape[0] + y.shape[0];
	for (let i = ranks; i >= 1; --i) {
		if (x.shape[i] !== y.shape[i]) throw Core.errorPrefix("a;w", "Cell shapes of %a and %w must match");
	}

	const newData = new Array(x.count + y.count);
	for (let i = 0; i < x.count; i++) newData[i] = x.pick(i);	
	for (let i = 0; i < y.count; i++) newData[i+x.count] = y.pick(i);

	return new DataArray(newShape, newData)
}

function funcCouple(x: Value, y: Value): Value {
	return _merge([x, y], Nil);
}

//#endregion Shaping Functions

//#region Search Functions

function _indexof(y: Value, searchIn: Value[]): number {
	for (let i = 0; i < searchIn.length; i++) {
		if (funcMatch(y, searchIn[i])) return i;
	}
	return searchIn.length;
}

function funcMemberof(y: Value, x: Value): number | MArray<number> {
	if (!isList(x)) throw Core.errorPrefix("aεw", "%w must be a list");

	const searchIn = Array<Value>(x.count);
	for (let j = 0; j < x.count; j++) searchIn[j] = x.pick(j);

	if (isArray(y)) {
		const data = new Array<number>(y.count);
		for (let i = 0; i < y.count; ++i) {
			data[i] = +(_indexof(y.pick(i), searchIn) < searchIn.length);
		}
		return new BoolArray(y.shape, data);
	}

	return +(_indexof(y, searchIn) < searchIn.length);
}

function funcIndexof(x: Value, y: Value): MArray<number> | number {
	if (!isList(x)) throw Core.errorPrefix("aιw", "%a must be a list");

	const searchIn = Array(x.count);
	for (let j = 0; j < x.count; j++) searchIn[j] = x.pick(j);

	if (isArray(y)) {
		const data = new Array<number>(y.count);
		for (let i = 0; i < y.count; ++i) {
			data[i] = _indexof(y.pick(i), searchIn);
		}
		return new NumberArray(y.shape, data);
	}

	return _indexof(y, searchIn);
}

function funcProgIndexof(x: Value, y: Value): MArray<number> | number {
	if (!isList(x)) throw Core.errorPrefix("a:ιw", "%a must be a list");

	const searchIn = Array(x.count);
	for (let j = 0; j < x.count; j++) searchIn[j] = x.pick(j);
	const used = Array<boolean>(x.count).fill(false);

	if (isArray(y)) {
		const data = new Array<number>(y.count);
		for (let i = 0; i < y.count; ++i) {
			let j;
			for (j = 0; j < searchIn.length; j++) {
				if (!used[j] && funcMatch(y.pick(i), searchIn[j])) {
					used[j] = true;
					data[i] = j;
					break;
				}
			}
			if (j == searchIn.length) data[i] = j;
		}
		return new NumberArray(y.shape, data);
	}

	return _indexof(y, searchIn);
}

function funcFind(x: Value, y: Value): Value {
	if (isNil(x)) return Nil;
	if (!isArray(y)) throw Core.errorPrefix("a:εw", "%w must be an array")
	const r = rank(y);
	const xsh = shape(x);
	const windowShape = Array(r);
	let count = 1;
	for (let i = 0; i < r; i++) {
		if (i < rank(x)) windowShape[r-i-1] = xsh[i];
		else windowShape[r-i-1] = 1;
		count *= windowShape[r-i-1];
	}
	
	const data = new Array<number>(count);
	let i = 0;
	const [span, gen] = _byWindows(windowShape, y);
	for (const cell of gen()) {
		data[i++] = funcMatch(x, reshape(xsh, cell));
	}

	return new BoolArray([...span], data);
}

function funcLocate(x: Value, y: Value) {
	if (!isList(y)) throw Core.errorPrefix("a¥w", "%w must be a list");
	if (!isArray(x)) return funcCmpEq(x, y);

	const len = length(x);

	const r = Array(y.count).fill(0);
	for (let i = 0; i < y.count-len+1;) {
		let j = 0;
		while (j < len && funcMatch(y.pick(i), x.pick(j))) { i += 1; j += 1; }
		if (j == len) {
			for (let k = len; k > 0; k--) r[i-k] = len-k+1;
			j = 0;
		} else {
			i++;
		}
	}

	return new NumberArray([r.length], r);
}

function funcStep(x: Value) {
	if (isNil(x)) return Nil;

	const mat = _orElse(_toIntList(x), "¥w", "%w must be a list of integers")

	const r = Array(mat.length);
	let k = 0;
	for (let i = 0; i < mat.length;) {
		while (mat[i] > 0) {
			r[i] = -1;
			i++;
		}
		while (mat[i] == 0) {
			r[i] = k;
			i++;
		}
		k += 1;
	}

	return new NumberArray([r.length], r);
}

function funcMarkFirsts(y: Value): BoolArray {
	if (!isArray(y)) throw Core.errorPrefix(":εw", "Rank of %w must be >0")

	const uniques: Value[] = [];
    const has = (v: Value) => uniques.some(u => funcMatch(u, v));

	const data = [];

	for (const cell of byCells(y)) {
		if (has(cell)) {
			data.push(0);
		} else {
			data.push(1);
			uniques.push(cell);
		}
	}
    
	return new BoolArray([data.length], data);
}

function funcUnique(y: Value): Value {
	if (!isArray(y)) throw Core.errorPrefix(":εw", "Rank of %w must be >0")

	const uniques: Value[] = [];
    const has = (v: Value) => uniques.some(u => funcMatch(u, v));

	for (const cell of byCells(y)) {
		if (has(cell)) continue;
		uniques.push(cell);
	}

	return _merge(uniques, y.fill);
}

function funcIntersection(x: Value, y: Value): Value {
	if (!isArray(x)) throw Core.errorPrefix("a∩w", "%a must be an array");
	if (!isArray(y)) throw Core.errorPrefix("a∩w", "%w must be an array");

	const xcells: Value[] = Array.from(byCells(x));
    const has = (v: Value) => xcells.some(u => funcMatch(u, v));
	const set: Value[] = [];

	for (const cell of byCells(y)) {
		if (has(cell)) set.push(cell);
	}

	return _merge(set, y.fill);
}

function funcWithout(x: Value, y: Value): Value {
	if (rank(x) == 0) x = funcDeshape(x);

	if (!isArray(x)) throw Core.errorPrefix("a~w", "%a must be an array");
	if (!isArray(y)) throw Core.errorPrefix("a~w", "%w must be an array");

	const xcells: Value[] = Array.from(byCells(x));
    const has = (v: Value) => xcells.some(u => funcMatch(u, v));
	const set: Value[] = [];

	for (const cell of byCells(y)) {
		if (has(cell)) continue;
		set.push(cell);
	}

	if (set.length == 0) return Nil;

	return _merge(set, y.fill);
}

function funcOccurrenceCount(y: Value): IntList {
	if (!isArray(y)) throw Core.errorPrefix("εw", "Rank of %w must be >0")

	const searchIn: Value[] = [];
	const count: number[] = [];
	const len = y.shape[0];
	const data = new Array(len);
	next: for (let i = 0; i < len; i++) {
		const cell = sliceCell(y, i);

		for (let j = 0; j < searchIn.length; j++) {
			if (funcMatch(searchIn[j], cell)) {
				data[i] = count[j] += 1;
				continue next;
			}
		}

		searchIn.push(cell);
		count.push(0);
		data[i] = 0;
	}

	return new IntList(data, 0);
}

//#endregion Search Functions

//#region Matching/Sorting Functions

function funcGradeUp(y: Value): IntList {
	if (!isArray(y)) throw Core.errorPrefix('≥w', "Rank of %w must be >0");
	const cells = Array.from(byCells(y));
	const indices = _insertionSort(cells);
    return new IntList(indices, -1);
}

function funcGradeDown(y: Value): IntList {
	if (!isArray(y)) throw Core.errorPrefix('≤w', "Rank of %w must be >0");
	const cells = Array.from(byCells(y));
	const indices = _insertionSortInv(cells);
    return new IntList(indices, -1);
}

function funcSortUp(y: Value): Value { return funcSelect(funcGradeUp(y), y); }
function funcSortDown(y: Value): Value { return funcSelect(funcGradeDown(y), y); }

export function funcMatch(x: Value, y: Value): number {
	if (typeof x != typeof y) return 0;
	if (typeof x == 'object' && typeof y == 'object') return _matchArrays(x, y)
    return +(x === y);
}
function _funcNotMatch(x: Value, y: Value): number { return 1 - funcMatch(x,y); }

//#endregion

//#region Indices Functions

function _generateIndicesNumber(mask: MArray<number>): number[] {
	const indices = [];
	for (let i = 0; i < mask.count; i++) {
		for (let _ = 0; _ < mask.pick(i); _++) indices.push(i);
	}
	return indices;
}

function _generateIndicesBool(bools: BoolArray): number[] {	
	const indices = [];
	for (let i = 0; i < bools.count; i++) {
		if (bools.pick(i)) indices.push(i);
	}
	return indices;
}

function funcUndoIndices(y: Value): MArray<number> | typeof Nil {
	if (isNil(y)) return Nil;

	const indices = _orElse(_toIntList(y), "aF¤$w", "%w must be a list of integers");

	const len = Math.max(...indices);
    const data = Array<number>(len+1).fill(0);
	for (let i = 0; i < indices.length; i++) {
        data[indices[i]] += 1
	}

    return new IntList(data, 0);
}

function dyadUnderReplicate(x: Value, y: Value, f: Bifunc): Value {
	const indices = _orElse(_toIntList(x), "aF¤$w", "%a must be a integer list");

	if (!isArray(y)) throw Core.errorPrefix("aF¤$w", "Rank of %w must be >0");

	if (indices.length != y.shape[0]) throw Core.errorPrefix("aF¤$w", "Lengths of %a and %w must match");

	const arrays = new Array(indices.length);

	for (let i = 0; i < indices.length; i++) {
		const n = indices[i];
		if (n == 0) {
			arrays[i] = sliceCell(y, i);
		} else {
			arrays[i] = f(sliceCell(y, i));
		} 
	}
	
	return _merge(arrays, y.fill);
}

function funcReplicate(x: Value, y: Value): Value {
	if (!isList(x)) throw Core.errorPrefix("a$w", "Rank of %a must be 1");
	if (!isArray(y)) throw Core.errorPrefix("a$w", "Rank of %w must be >0");
	if (y.shape[0] !== x.shape[0]) throw Core.errorPrefix("a$w", "Length of %a must match %w");
	return funcSelect(funcIndices(x), y)
}

function funcIndices(y: Value): IntList {
	if (!isList(y)) throw Core.errorPrefix("$w", "Rank of %w must be 1");
	if (y instanceof BoolArray) return new IntList(_generateIndicesBool(y), 0);
	const numbers = _toNumberArray(y);
	if (!numbers) throw Core.errorPrefix("$w", "Elements of %w must be numbers");
	return new IntList(_generateIndicesNumber(numbers), 0);
}

function funcRepresent(x: Value, y: Value): Value {
	if (isNil(y)) return Nil;
	if (rank(x) != 1) throw Core.errorPrefix("aδw", "Rank of %a must be 1");
	const shape = _orElse(_toIntList(x), "aδw", "Elements of %a must be integers");

	if (isNumber(y)) return new IntList(Core.represent(shape, y), 1)

	if (!isArray(y)) throw Core.errorPrefix("aδw", "%w must be number or array of numbers");

	const data = Array(y.count);
	for (let i = 0; i < y.count; i++) {
		const a = y.pick(i);
		if (!isNumber(a)) throw Core.errorPrefix("aδw", "Elements of %w must be numbers");
		data[i] = new IntList(Core.represent(shape, a), 1);
	}

	return new DataArray(y.shape, data);
}

function funcUndoRepresent(x: Value, y: Value): Value {
	// if (isNil(y)) return Nil;
	const shape = _orElse(_toIntList(x), "aδ˜w", "%a must be an integer list");
	const index = _toIntList(y)
	if (index) return _orElse(Core.indexAt(shape, index), "aδ˜w", "%w is an invalid index");

	throw Core.errorPrefix("aδ˜w", "%w must be an integer list");
}

function funcStrides(y: Value): Value {
	if (!isList(y)) throw Core.errorPrefix("δw", "Rank of %w must be 1");
	const shape = _orElse(_toIntList(y), "δw", "Elements of %w must be integers");
	return new IntList(Core.strides(shape), 0);
}

//#endregion

//#region Structural/Pick Functions

function funcFirst(y: Value): Value {
	if (isNil(y)) throw Core.errorPrefix('¢w', "%w can't be empty");
	if (typeof y != 'object') return y;
	return y.pick(0);
}

const funcPick: Infix = (x, y) => {
	if (!isArray(y)) throw Core.errorPrefix('a¢w', "%w must be an array");
	try {
		if (isNumber(x)) return y.pick(x);
		const numbers = _orElse(_toNumberArray(x), 'a¢w', "%a must be an array of numbers");
		return Core.pick(numbers, y)
	} catch (e) {
		throw Core.errorPrefix('a¢w', e)
	}
}

const funcPickIndex: Infix = (x, y) => {
	if (!isArray(y)) throw Core.errorPrefix('a:¢w', "%w must be an array");
	const numbers = _toIntList(x);
	if (numbers) {
		return y.pick(_orElse(Core.indexAt(y.shape, numbers), "a:¢w", "%a is an invalid index"));
	}
	if (!isArray(x)) throw Core.errorPrefix('a:¢w', "%a must be an index of index list");

	const data = new Array(x.count);
	for (let i = 0; i < x.count; i++) {
		const index = _toIntList(x.pick(i));
		if (index == null) throw Core.errorPrefix('a:¢w', "Elements of %a must be an index");
		if (index.length != y.shape.length) throw Core.errorPrefix('a:¢w', "Length of index must be same rank of %w");
		const index1 = Core.indexAt(y.shape, index);
		if (index1 == null) throw Core.errorPrefix('a:¢w', "Invalid index in %a");
		data[i] = y.pick(index1);
	}

	return new DataArray(x.shape, data, y.fill);
}

const funcSelect: Infix = (x, y) => {
	if (!isArray(y)) throw Core.errorPrefix('a@w', "%w must be an array");
	if (typeof x == 'number') return sliceCell(y, x);
	if (isNil(x)) return Nil;
	const numbers = _orElse(_toNumberArray(x), 'a@w', "%a must be an array of numbers");
	const arrays = [];
	for (let i = 0; i < numbers.count; i++) {
		const j = numbers.pick(i);
		arrays.push(sliceCell(y, j));
	}
	return _merge(arrays, y.fill, numbers.shape);
}

function funcRotate(x: Value, y: Value) {
	if (!isArray(y)) return y;
	const axis = isNumber(x) ? [x] : _orElse(_toIntList(x), "aφw", "%a must be a number or list");
	
	const rotate = Array(axis.length);
	const modulo = Array(axis.length);
	let mod = y.count;
	for (let k = 0; k < axis.length; k++) {
		const len = y.shape[k];
		const st = mod / len;
		modulo[k] = mod;
		rotate[k] = (axis[k] < 0 ? len + (axis[k]%len) : axis[k]) * st
		mod = st
	}

	const data = Array(y.count);
	for (let i = 0; i < y.count; i++) {
		let index = i;
		for (let k = 0; k < axis.length; k++) {
			const rot = rotate[k];
			const mod = modulo[k];
			index = ((index+rot) % mod) + (Math.trunc(index/mod)*mod);
		}
		data[i] = y.pick(index);
	}

	return new DataArray(y.shape, data);
}

function funcReverse(y: Value): Value {
	if (!isArray(y)) return y;
	
	const len = y.shape[0];
	const stride = y.count/len;
	const picks = Array(y.count);
	for (let i = 0; i < len; i++) {
		for (let j = 0; j < stride; j++) {
			picks[i*stride+j] = (len-i-1)*stride+j;
		}
	}

	return new Pick(y, new NumberArray(y.shape, picks));
}

function funcTranspose(y: Value): Value {
	if (isArray(y)) return Core.transpose(y);
	return y;
}

function _take(x: number, y: MArray<Value>): Value {
	if (x == 0) return Nil;
	
	const len = y.shape[0];
	const stride = y.count/len;

	const shape = [...y.shape];
	shape[0] = Math.abs(x);

	const data = Array<Value>(stride * Math.abs(x));
	if (x >= 0) {
		// if (x > len) return y;
		for (let i = 0; i < x; i++) {
			for (let j = 0; j < stride; j++) {
				if (i >= len) {
					data[i*stride+j] = y.fill ?? Nil;
				} else {
					data[i*stride+j] = y.pick(i*stride+j);
				}
			}
		}
	} else {
		for (let i = 0; i < -x; i++) {
			const celli = (i+len+x);
			for (let j = 0; j < stride; j++) {
				if (celli < 0) {
					data[i*stride+j] = y.fill ?? Nil;
				} else {
					data[i*stride+j] = y.pick(celli*stride+j);
				}
			}
		}
	}
	
	return new DataArray(shape, data, y.fill);
}

function _drop(x: number, y: MArray<Value>): Value {
	if (x == 0) return y;
	
	const len = y.shape[0] ?? 1;
	const stride = y.count/len;

	const shape = [...y.shape];
	shape[0] = len-Math.abs(x);

	if ((len-Math.abs(x)) <= 0) return Nil;
	const picks = Array<number>(stride * (len-Math.abs(x)));

	if (x >= 0) {
		for (let i = 0; i < len-x; i++) { 
			for (let j = 0; j < stride; j++) {
				picks[i*stride+j] = (i+x)*stride+j;
			}
		} //indices.push(i);
	} else {
		for (let i = 0; i < (len+x)*stride; i+=stride) {
			for (let j = 0; j < stride; j++) {
				picks[i+j] = i+j;
			}
		} //indices.push(i);
	}

	// console.log(picks)
	
	return new Pick(y, new NumberArray(shape, picks));
}

function funcNudgeRight(y: Value) {
	if (!isArray(y)) throw Core.errorPrefix("↑w", "Rank of %w must be >0");
	return funcJoinTo(y.fill ?? Nil, y);
}

function funcNudgeLeft(y: Value) {
	if (!isArray(y)) throw Core.errorPrefix("↓w", "Rank of %w must be >0");
	return funcJoinTo(y, y.fill ?? Nil);
}

//#endregion

//#region Other Functions

function _funcType(y: Value): Value {
	const t = (typeof y)[0];
	const z = {s: ' ', b: 0, n: 0, o: Nil}[<'s'|'n'|'b'|'o'>t];
	return z;
}

function funcIota(y: Value) {
	if (isNumber(y)) return new Iota([y]);
	const shape = _orElse(_toIntList(y), "ιw", "%w must be a number or list");
	if (shape.length == 0) { return Nil; }
	return new Iota(shape);
}

function _byWindows(window: number[], y: MArray<Value>): [number[], () => Generator<Value, void, unknown>] {
	const span = new Array<number>(window.length);
    for (let i = 0; i < window.length; i++) {
        span[i] = 1+y.shape[i]-window[i];
    }

	const windowLen = window.reduce((a,b)=>a*b);
	const count = span.reduce((a,b)=>a*b);

	return [span, function* () {
		for (let i = 0; i < count; i++) {
			const at = Core.represent(span, i);
	
			const arrays = [];
			for (let j = 0; j < windowLen; j++) {
				const r = Core.represent(window, j).map((x, i) => x+at[i]);
	
				arrays.push(selectRank(y, r));
			}
			yield _merge(arrays, y.fill, window);
		}
	}]
	
}

function funcWindows(x: Value, y: Value): Value {
	
	let windowShape: number[];
	if (isNumber(x)) windowShape = [x]
	else windowShape = _orElse(_toIntList(x), "a↕w", "%a must be a number or list");

	if (!isArray(y)) throw Core.errorPrefix("a↕w", "%w must be an array");

	const [span, gen] = _byWindows(windowShape, y);

	const arrays = Array.from(gen());
	return _merge(arrays, y.fill, span);
}

function funcGroupIndices(y: Value) {
	const groups = Core.groupIndices(_orElse(_toIntList(y), "μw", "%w must be an integer list"));

	return new DataArray([groups.length], groups);
}

function funcGroup(x: Value, y: Value) {
	if (!isArray(y)) throw Core.errorPrefix("aμw", "%w must be an array");
	const groups = Core.groupIndices(_orElse(_toIntList(x), "μw", "%w must be an integer list"));

	const boxes = Array(groups.length);
	for (let i = 0; i < groups.length; i++) {
		if (isNil(groups[i])) boxes[i] = groups[i];
		else boxes[i] = funcSelect(groups[i], y);
	}

	return new DataArray([groups.length], boxes);
}

function funcSplit(x: Value, y?: Value) {
	if (isNumber(x) && y) {
		if (!isArray(y)) throw Core.errorPrefix("a|w", "%w must be an array");
		return new DataArray([2], [_take(x, y), _drop(x+1, y)]);
	}

	const indices = _toIntList(x);
	if (indices == null) throw Core.errorPrefix("a|w", "%a must be an integer list");

	const len = indices.reduce((a,b)=>a+b);
	const r = Array<number>(len);
	let count = 0;
	for (let i = 0; i < indices.length; i++) {
		r[i] = count;
		if (indices[i] != 0) {
			r[i] = -1;
			count += indices[i];
		}
	}

	if (y)
		return funcGroup(new NumberArray([r.length], r), y);
	return new NumberArray([r.length], r)
}

//#endregion

//#region Monads & Dyads

function monadEach(f: Bifunc): Prefix {
	return (y) => {
		if (!isArray(y)) return f(y);

		const r = Array(y.count);
		for (let i = 0; i < y.count; i++) {
			r[i] = f(y.pick(i));
		}

		return new DataArray(y.shape, r);
	}
}

function monadZip(f: Bifunc): Infix {
	return (x, y) => {
		if (!isArray(y)) return monadEach(k => f(y, k))(x);
		if (!isArray(x)) return monadEach(k => f(k, x))(y);

		const gt = x.shape.length > y.shape.length ? x : y;
		const _rightLeading = gt == y;
		const count = gt.count;

		const axis = leadingAxis(x.shape, y.shape);
		if (axis == null) throw `Shapes Mismatch`
		const _maxj = axis[1];

		if (_maxj == 0) return f(y.pick(0), x.pick(0));

		const data = Array(count);
		for (let i = 0; i < count; i++) {
			let _i = Math.trunc(i / _maxj);
			let _j = (_i * _maxj) + i % _maxj;
			if (!_rightLeading) [_i, _j] = [_j, _i];
			data[i] = f(y.pick(_j), x.pick(_i));
		}

		return new DataArray(gt.shape, data);
	}
}

function monadTable(f: Bifunc): Infix {
	return (x, y) => {
		if (!isArray(y)) return monadEach(k => f(y, k))(x);
		if (!isArray(x)) return monadEach(k => f(k, x))(y);

		const lenx = x.shape[0];
		const leny = y.shape[0];

		const data = Array(lenx * leny);
		for (let i = 0; i < lenx; i++) {
			for (let j = 0; j < leny; j++) {
				data[i*leny+j] = f(y.pick(j), x.pick(i));
			}
		}

		return _merge(data, undefined, [lenx, leny]);
	}
}

function monadFold(f: Bifunc): Prefix {
	return function(y: Value, x?: Value) {
		if (rank(y) == 0) return y;
		if (!isList(y)) throw Core.errorPrefix("F/w", "%w must be a list")

		let l = y.count - 1;
		let r;
		if (x == undefined) r = y.pick(l--);
		else r = x;
		for (let i = l; i >= 0; i--) {
			r = f(r, y.pick(i));
		}
		return r;
	}
}

function monadScan(f: Bifunc): Prefix {
	return function(y: Value) {
		if (!isArray(y)) return y;

		const len = y.shape[0];
		const r = Array<Value>(len);
		let acc: Value;
		
		if (rank(y) == 1) {
			r[0] = acc = y.pick(0)
			for (let i = 1; i < len; i++) {
				r[i] = acc = f(y.pick(i), acc);
			}
			return new DataArray([r.length], r);
		}

		r[0] = acc = sliceCell(y, 0);
		for (let i = 1; i < len; i++) {
			r[i] = acc = f(acc, sliceCell(y, i));
		}
		return _merge(r, undefined);
	}
}

function monadScanWith(f: Infix): Infix {
	return function(x: Value, y: Value) {
		if (!isArray(y)) return y;
		const len = y.shape[0];
		const r = new Array<Value>(len);
		let acc = x;
		r[0] = x;
		for (let i = 0; i < len; i++) {
			acc = f(acc, sliceCell(y, i));
			r[i] = acc;
		}
		return new DataArray([len], r);
	}
}

function monadCells(f: Bifunc): Bifunc {
	return (y: Value, x?: Value) => {
		const level = +(rank(y)>0) + 2*+(x != undefined ? rank(x)>0 : 0);

		if (level == 0) {
			return funcEnclose(f(y, x));
		} else if (level == 1) { // x is scalar
			const _y = y as MArray<Value>
			const data = Array.from(byCells(_y), k => f(k, x))
			return _merge(data, _y.fill);
		} else if (level == 2) { // y is scalar
			const _x = x as MArray<Value>
			const data = Array.from(byCells(_x), k => f(y, k))
			return _merge(data, _x.fill);
		}

		
		const _y = y as MArray<Value>
		const _x = x as MArray<Value> | undefined
		
		const data = new Array<Value>(_y.shape[0]);
		if (_x != undefined) {
			if (_x.shape[0] != _y.shape[0]) throw Core.errorPrefix("aF`w", "Lengths of %a and %w must match");
		
			for (let i = 0; i < _y.shape[0]; i++) {
				data[i] = f(sliceCell(_y, i), sliceCell(_x, i));
			}
		} else {
			for (let i = 0; i < _y.shape[0]; i++) {
				data[i] = f(sliceCell(_y, i));
			}
		}

		return _merge(data, _y.fill);
	}
}

function dyadRank(y: Value, x: Value | undefined, f: Bifunc, g: Bifunc) {
	const rank = g(y, x);
	if (!isNumber(rank)) throw Core.errorPrefix("aF↓Gw", "Result of %aG%w must be number");
	if (!isArray(y) || x != undefined && !isArray(x)) throw Core.errorPrefix("aF↓Gw", "%w and %a must be arrays");

	const cells = new Array<Value>();
	for (const index of byRank(y, rank)) {
		cells.push(f(selectRank(y, index), x != undefined ? selectRank(x, index) : x));
	}
	return _merge(cells, y.fill, y.shape);
}

//#endregion

export const builtin_functions: FuncMap = {
    '+': [
		valences(funcSum, funcAdd),
		valences(_ => _orElse<Value>(null, "+˜w", "Must be called with two arguments"), (x,fy)=>funcSub(fy,x))
	],
    '-': [(y,x=0)=>funcSub(x, y), (y,x=0)=>funcSub(x, y)],
    '×': [
		valences(funcProduct, funcMult),
		valences(_ => _orElse<Value>(null, "×˜", "Must be called with two arguments"), (x,fy)=>funcDiv(fy,x)),
	],
    '÷': [(y,x=1)=>funcDiv(x, y), (y,x=1)=>funcDiv(x, y)],
    '%': [valences(funcAbs, funcMod)],
    '√': [valences(funcSqrt, funcRoot), valences((y)=>funcMult(y,y), (x,fy)=>funcPow(fy,x))],
    '^': [valences(funcExp, funcPow), valences(funcLn, funcLog)],
    '⌊': [valences(funcFloor, funcMin)],
    '⌈': [valences(funcCeil, funcMax)],
	'±': [valences(funcSign, funcAbDf)],

    '∧': [valences(funcSortUp, funcAnd)],
    '∨': [valences(funcSortDown, funcOr)],
    '~': [valences(funcNot, funcWithout), (y, x?) => {
		if (x != undefined) throw Core.errorPrefix("~˜", "Must be called with one argument");
		return funcNot(y);
	}],

    '≤': [valences(funcGradeDown, funcCmpLe)],
    '<': [valences(funcEnclose, funcCmpLt), (y, x?) => {
		if (x != undefined) throw Core.errorPrefix("<˜", "Must be called with one argument");
		return isArray(y) && rank(y) == 0 ? y.pick(0) : y;
	}],
    '≥': [valences(funcGradeUp, funcCmpGe)],
    '>': [valences(funcMerge, funcCmpGt), 
		valences((y)=> {
			if (!isArray(y)) throw Core.errorPrefix(">˜w", "%w must be an array");
			const a = Array.from(byCells(y));
			return new DataArray([a.length], a)
		}, _ => _orElse<Value>(null, ">˜", "Must be called with one argument")),
	],
    '≠': [valences(rank, funcCmpNe)],
    '=': [valences(length, funcCmpEq)],
    '≡': [valences(funcDepth, funcMatch)],

    ';': [valences(funcDeshape, funcJoinTo)],
    '&': [valences(funcSolo, funcCouple),
		valences((y) => funcSelect(0, y), _ => _orElse<Value>(null, "&˜", "Must be called with one argument"))],
    ':;': [(y,x?) => new DataArray([x != undefined ? 2 : 1], x != undefined ? [x,y] : [y])],

    '↕': [valences(funcDeshape, funcWindows)],
    'ρ': [(y, x?) => x != undefined ? funcReshape(x, y) : new IntList(shape(y), 1)],
    'φ': [valences(funcReverse, funcRotate), valences(funcReverse, (x,fy)=> funcRotate(funcNeg(x), fy))],
    'Ø': [funcTranspose, funcTranspose],
    'μ': [valences(funcGroupIndices, funcGroup)],
	
    'ι': [valences(funcIota, funcIndexof)], // Undo [Shape, null]?
    ':ι': [valences(y => funcRepresent(y,funcIota(y)), funcProgIndexof)],
    'ε': [valences(funcOccurrenceCount, funcMemberof)],
    ':ε': [valences(funcMarkFirsts, funcFind)],
	'∩': [valences(funcUnique, funcIntersection)],

    '$': [valences(funcIndices, funcReplicate), (y, x?) => {
		if (x != undefined) throw Core.errorPrefix("$˜", "Must be called with one argument");
		return funcUndoIndices(y);
	}],

    '◄': [(y, x?) => x ?? y],
    '►': [(y, _?) => y],

    '¢': [(y, x=0) => funcPick(x, y)],
    ':¢': [(y, x?) => x == undefined ? funcPick(0, y) : funcPickIndex(x, y)],
    '@': [(y, x=0) => funcSelect(x, y)],

    '↑': [valences(funcNudgeLeft, (x, y) => {
		if(!isNumber(x)) throw Core.errorPrefix("a↑w", "%a must be a number");
		if(isNil(y)) return Nil;
		if(!isArray(y)) throw Core.errorPrefix("a↑w", "%w must be an array"+y+x);
		return _take(x, y)
	})],
    '↓': [valences(funcNudgeRight, (x,y) => {
		if(!isNumber(x)) throw Core.errorPrefix("a↓w", "%a must be a number");
		if(isNil(y)) return Nil;
		if(!isArray(y)) throw Core.errorPrefix("a↓w", "%w must be an array"+y+x);
		return _drop(x, y)
	})],
    'δ': [valences(funcStrides, funcRepresent), (y, x?) => {
		if (x == undefined) throw Core.errorPrefix("δ˜", "Must be called with two arguments");
		return funcUndoRepresent(x, y);
	}],
    '|': [valences(funcSplit, funcSplit)],
    '¥': [valences(funcStep, funcLocate)],
    'η': [(y, op = 10) => {
		const str = _toString(y);
		if (!isNumber(op)) throw Core.errorPrefix("aηw", "%a must be a number")
        switch (op) {
            case 0: return str.charCodeAt(0)
            case 1: return parseInt(str, 10)
            default:
                return parseInt(str, op)
        }
    }, (y, op = 10) => {
		if (!isNumber(y)) throw Core.errorPrefix("aη˜w", "%w must be a number");
        if (!isNumber(op)) throw Core.errorPrefix("aη˜w", "%a must be a number")
        switch (op) {
            case 0: return String.fromCodePoint(y);
            case 1: return StringArray.from(y.toString(10));
            default:
                return StringArray.from(y.toString(op));
        }
	}],
    '!': [(y, x) => {
		if (funcMatch(1,y) == 0) throw x ?? `Assertion error`;
        return y;
    }],
    '?': [(y, x?) => {
		if (isNil(y)) return x ?? 0;
		return x == undefined ? 1 : y;
	}],
	'Sin': funcCircleSin,
	'Cos': funcCircleCos,
	'Tan': funcCircleTan,
	'Sinh': funcCircleSinh,
	'Cosh': funcCircleCosh,
	'Tanh': funcCircleTanh,
}

export const builtin_monads: MonadMap = {
	'¯': (f) => f,
	'˜': ([f, uf]) => {
		if (uf == undefined) {
			throw Core.errorPrefix("F˜", "F is not invertible");
		}
        return [ uf, f ];
    },
    '/': ([f]) => {
        return [ monadFold(f) ];
    },
    '\\': ([f]) => {
        return [ valences(monadScan(f), monadScanWith(f)) ];
    }, 
    '§': ([f]) => {
        return [ (y, x?) => f(x ?? y, y) ];
    },
    '¨': ([f, uf]) => {
		
        return [
			valences(monadEach(f), monadZip(f)),
			uf && valences(monadEach(uf), monadZip(uf)),
		]
    },
    '˝': ([f, uf]) => {
        return [ 
			valences(monadEach(f), monadTable(f)),
			uf && ((y, x?) => {
				if (x != undefined) throw Core.errorPrefix('aF˝˜w', "Function is not invertible");
				return monadEach(uf)(y);
			})
		]
    },
    '`': ([f]) => {
        return [ monadCells(f) ]
    }
}

export const atop = ([f, uf]: FuncDesc, [g, ug]: FuncDesc): FuncDesc => {
	return [
		(y, x?)=>f(g(y, x)),
		uf && ug && ((y, x?)=>ug(uf(y), x)),
	]
}

export const builtin_dyads: DyadMap = {
    '•': atop,
    '°': ([f, uf], [g, ug]) => {
        return [
            (y, x?) => f(g(y), x != undefined ? g(x) : x),
            ug && uf && ((y, x?) => ug(uf(y), x))
        ]
    },
    '→': ([f], [g]) => {
        return [
            (y, x?) => g(y, f(x ?? y))
        ]
    },
    '←': ([f], [g]) => {
        return [
            (y, x?) => f(g(y), x ?? y)
        ]
    },
    'ⁿ': ([f, _], [g]) => {
        return [
            (y, x?) => {
                const n = g(y, x);
				if (!isNumber(n)) throw Core.errorPrefix("FⁿG","G%w is not a number");
                let result = y;
                for (let i = 0; i < n; ++i) { result = f(result, x) }
                return result;
            },
        ]
    },
    '®': ([f, uf], [g]) => {
        return [
            (y, x) => dyadRank(y, x, f, g),
            uf && ((y, x) => dyadRank(y, x, uf, g))
        ]
    },
    '¤': ([f, _], [g, ug]) => {		
		// G˜ F G y
		// w G˜ F wGy
		return [
			ug && ((y, x?) => ug(f(g(y, x), x)))
		] as FuncDesc
		
		// throw "Can't find under for the function"
    },
    '↔': ([f, uf], [g, ug]) => {
        return [
			(y, x?) => x != undefined ? g(y,x) : f(y),
			uf && ug && ((y, x?) => x != undefined ? ug(y,x) : uf(y)),
		]
    },
	'Δ': ([f], [g]) => {
        return [
			(y, x?) => {
				let r = y;
				while (_toBool(g(r, x))) {
					r = f(r, x);
				}
				return r;
			}
		]
    },
}

export const builtin_functions_under: UndoMap = {
    '↕': [(f) => (y) => reshape(shape(y), f(funcDeshape(y))), (f) => (x, y) => {
		let windowShape: number[];
		if (isNumber(x)) windowShape = [x]
		else windowShape = _orElse(_toIntList(x), "aF¤↕w", "%a must be a number or list");
	
		if (!isArray(y)) throw Core.errorPrefix("aF¤↕w", "%w must be an array");
	
		const [span, gen] = _byWindows(windowShape, y);
	
		const arrays = Array.from(gen(), v => f(v));
		return _merge(arrays, y.fill, span);
    }],
    'ρ': [
		(f) => (y) => reshape(_orElse(_toIntList(f(y)), "F¤ρw", "%w must be a integer list"), y),
		(f) => (_, y) => reshape(shape(y), f(y))],

    '¢': [(f) => (y) => {
		if (!isArray(y)) throw Core.errorPrefix("F¤¢w", "%w must be an array");
		
        const data = Array(y.count);
		data[0] = f(y);
		for (let i = 1; i < y.count; i++) {
			data[i] = y.pick(i);
		}

        return new DataArray(y.shape, data, y.fill);
    }, (f) => (x_, y) => {
		if (!isArray(y)) throw Core.errorPrefix("aF¤¢w", "%w must be an array");

		const x = _toNumberArray(funcDeshape(x_));
		if (x==null) throw Core.errorPrefix("aF¤¢w", "%x must be an array of numbers");

		const data = new Array(y.count);
		for (let i = 0; i < x.count; i++) {
			const j = x.pick(i);
			data[j] = f(y.pick(j));
		}

		for (let i = 0; i < y.count; i++) {
			if (data[i] == undefined) data[i] = y.pick(i);
		}

		return new DataArray(y.shape, data, y.fill);
    }],
	':¢': [(f) => (y) => {
		if (!isArray(y)) throw Core.errorPrefix("F¤¢w", "%w must be an array");
		
        const data = Array(y.count);
		data[0] = f(y);
		for (let i = 1; i < y.count; i++) {
			data[i] = y.pick(i);
		}

        return new DataArray(y.shape, data, y.fill);
    }, (f) => (x, y) => {
		if (!isArray(y)) throw Core.errorPrefix('a:¢w', "%w must be an array");
		const numbers = _toIntList(x);
		if (numbers) {
			const data = new Array(y.count);
			for (let i = 0; i < y.count; i++) {
				data[i] = y.pick(i);
			}
			const index = _orElse(Core.indexAt(y.shape, numbers), "a:¢w", "%a is an invalid index");
			data[index] = f(y.pick(index));

			return new DataArray(y.shape, data, y.fill);
		}
		if (!isArray(x)) throw Core.errorPrefix('a:¢w', "%a must be an index of index list");

		const data = new Array(y.count);
		for (let i = 0; i < y.count; i++) {
			data[i] = y.pick(i);
		}

		for (let i = 0; i < x.count; i++) {
			const index = _toIntList(x.pick(i));
			if (index == null) throw Core.errorPrefix('a:¢w', "Elements of %a must be an index");
			if (index.length != y.shape.length) throw Core.errorPrefix('a:¢w', "Length of index must be same rank of %w");
			const index1 = Core.indexAt(y.shape, index);
			if (index1 == null) throw Core.errorPrefix('a:¢w', "Invalid index in %a");
			data[index1] = f(y.pick(index1));
		}

		return new DataArray(y.shape, data, y.fill);
    }],
    '@': [(f) => (y) => {
		if (!isArray(y)) throw Core.errorPrefix("F¤@w", "%w must be an array");
		const arrays: Value[] = Array.from(byCells(y));
		arrays[0] = f(y);
		return _merge(arrays, y.fill);
    },  (f) => (x_, y) => {
		if (!isArray(y)) throw Core.errorPrefix("F¤@w", "%w must be an array");
		const x = _toNumberArray(x_);
		if (x==null) throw Core.errorPrefix("aF¤@w", "%x must be an array of numbers");
		const cells: Value[] = Array.from(byCells(y));
		for (let i = 0; i < x.count; i++) {
			const j = x.pick(i);
			cells[j] = f(sliceCell(y, j));
		}

		return _merge(cells, y.fill, x.shape);
    } ],
    '$': [null, (f) => (x, y) => dyadUnderReplicate(x, y, f)],
    '↓': [null, (f) => (x, y) => {
		if (!isArray(y)) throw Core.errorPrefix("aF¤↓w", "%w must be an array");
		if (!isNumber(x)) throw Core.errorPrefix("aF¤↓w", "%a must be a number");
        if (x >= 0) {
            return funcJoinTo(f(_take(x, y)), _drop(x, y));
        }
        return funcJoinTo(_drop(x, y),f(_take(x, y)))
    }],
    '↑': [null, (f) => (x, y) => {
		if (!isArray(y)) throw Core.errorPrefix("aF¤↑w", "%w must be an array");
        if (!isNumber(x)) throw Core.errorPrefix("aF¤↑w", "%a must be a number");
        if (x >= 0) {
            return funcJoinTo(_take(x, y), f(_drop(x, y)))
        }
        return funcJoinTo(f(_drop(x, y)), _take(x, y))
    }],
	'?': [
		f => y => isNil(y) ? y : f(y),
		f => (x, y) => isNil(y) ? f(x) : f(y)
	],
}