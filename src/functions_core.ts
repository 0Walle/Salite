import {
	DataArray, Nil, strideAxis, checkShape
} from './array.ts';
import { MArray, Value, FuncDesc } from "./types.ts";

export function errorPrefix(name: string, message: string | Error) {
	if (typeof message != 'string') {
		message.message = `${name.replace('a', 'α').replace('w', 'ω')}: ${message.message}`
		return message;
	}
	message = message.replace('%a', 'α').replace('%w', 'ω');
	return `${name.replace('a', 'α').replace('w', 'ω')}: ${message}`
}

export class NumberArray extends DataArray<number> {}

export class IntList extends NumberArray {
	constructor(data: number[], fill: number) { super(data.length > 0 ? [data.length] : [], data, fill) }
}

export class BoolArray extends DataArray<number> {}

export class StringArray extends DataArray<string> {
	static from(s: string) {
		return new StringArray([s.length], Array.from(s), ' ');
	}

	toString(): string {
		return this._data.join('');
	}

	toStrings(): string[] {
		if (this.shape.length < 2) return [this.toString()];
		const stride = this.shape[this.shape.length-1];
		const len = this.count / stride;	
		const strings = Array(len);
		for (let i = 0; i < len; i++) {
			strings[i] = this._data.slice(i*stride, i*stride + stride).join('');
		}
		return strings;
	}
}

export class Iota implements MArray<number> {
	shape: number[];
	count: number;
	fill: number;

	constructor(shape: number[]) {
		const [saneShape, count] = checkShape(shape, 'ιω: ');
		this.shape = saneShape;
		this.count = count;
		this.fill = 0;
	}

	isNil() { return this.count == 0 }

	pick(index: number) {
		if (index >= this.count) throw new Error("Index Error");
		return index;
	}
}

export class FunctionArray implements MArray<Value> {
	constructor(public func: FuncDesc, public name = 'ƒ') {}

	fill = undefined;
	shape = [];
	count = 1;
	
	isNil() { return false }

	pick(index: number): Value {
		if (this.func[0] == null) throw errorPrefix(this.name, `${this.name} is not prefix`);
		return this.func[0](index);
	}

	toString() {
		return 'ƒ'+this.name;
	}
}

export function isArray(y: Value): y is MArray<Value> {
	return (typeof y == 'object' && y.count > 0);
}

export function isList(y: Value): y is MArray<Value> {
	return (typeof y == 'object' && y.shape.length == 1);
}

export function isNil(y: Value) {
	return (typeof y == 'object' && y.isNil());
}

export function isNumber(y: Value): y is number {
	return (typeof y == 'number');
}

export function transpose<T>(y: MArray<T>): MArray<T> {
    if (y.shape.length < 2) return y;

    const first = y.shape[0];
    const tail = strideAxis(y, 1);

    const data = new Array(y.count);
	
    let k = 0;
    for (let j = 0; j < tail; j++) {        
        for (let i = 0; i < first; i++) {
            data[k++] = y.pick(i * tail + j);
        }
    }

    return new DataArray([...y.shape.slice(1), first], data, y.fill);
}

export function pick<T>(x: MArray<number>, y: MArray<T>): MArray<T> {
	const data = new Array<T>(x.count);
	for (let i = 0; i < x.count; i++) {
		data[i] = y.pick(x.pick(i));
	}

	return new DataArray(x.shape, data, y.fill);
}

export function groupIndices(groups: number[]): MArray<number>[] {
    const groupsArr: number[][] = []
    for (let i = 0; i < groups.length; i++) {
        const n = groups[i];
        if (n < 0) continue;

        if (groupsArr[n] == undefined) {
            groupsArr[n] = [i]
        } else {
            groupsArr[n].push(i)
        }
    }

	const boxes = new Array<MArray<number>>(groupsArr.length);
    for (let i = 0; i < groupsArr.length; i++) {
        if (groupsArr[i] == undefined) {
			boxes[i] = Nil;
		} else {
			boxes[i] = new IntList(groupsArr[i], 0);
		}

    }

	return boxes;
}

export function represent(shape: number[], index: number): number[] {
	const r = Array<number>(shape.length).fill(1);
	
    let k = index;
    let s = shape.length;
    while (s > 0) {
        const j = shape[--s];
        r[s] = j == 0 ? k : k % j;
        k = Math.floor(j == 0 ? 0 : k / j);
    }

    return r;
}

export function indexAt(shape: number[], index: number[]) {
	const count = shape.reduce((a,b)=>a*b);
	let stride = count/shape[0];
	let k = 0;
	for (let i = 0; i < index.length; i++) {
		let j = index[i];
		j = j < 0 ? shape[i] + j : j;
		if (j >= shape[i]) return null;
		k += index[i] * stride;
		stride /= shape[i+1];
	}
	return k;
}

export function strides(x: number[]): number[] {
	const strides = Array(x.length);

	let r = x.reduce((a,b)=>a*b);
	for (let i = 0; i < x.length; i++) {
		r /= x[i];
		strides[i] = r;
	}

	return strides;
}