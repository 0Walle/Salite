import { MArray } from "./types.ts";

export function checkShape(shape: number[], errPrefix = ''): [number[], number] {
	if (shape.length == 0) return [[], 0];

	const len = shape.reduce((a, b) => a*b);
	
	if (isNaN(len) || !Number.isInteger(len) || len <= 0) 
		throw `${errPrefix}Invalid Shape ⟨ ${shape.join(' ')} ⟩`;
	
	return [ shape, len ];
}

export function strideAxis<T>(y: MArray<T>, axis: number): number {
	let r = y.count;
	for (let i = 0; i < axis; i++) {
		r /= y.shape[i];
	}
	return r;
}

export function* byRank<T>(y: MArray<T>, axis: number) {
	const stride = strideAxis(y, axis);
	for (let i = 0; i < stride; i++) {
		const r = Array<number>(axis);
	
		let k = i;
		let s = axis;
		while (s > 0) {
			const j = y.shape[--s];
			r[s] = k % j;
			k = Math.floor(k / j);
		}

		yield r;
	}
}

export function* byCells<T>(y: MArray<T>) {
	if (y.shape.length == 0) throw `Rank error: Cells of scalar`

	const len = y.shape[0];
	const stride = y.count / len;
	for (let i = 0; i < len; i++) {		
		yield new Slice(y, y.shape.slice(1), stride, i * stride);
	}
}

export function selectRank<T>(y: MArray<T>, index: number[]): Slice<T> {
	let acc = 0;
	let stride = y.count;
	for (let i = 0; i < index.length; i++) {
		const x = index[i];
		stride /= y.shape[i];
		acc += (x < 0 ? y.shape[i] + x : x) * stride;
	}

	return new Slice(y, y.shape.slice(index.length), stride, acc);
}

export function sliceCell<T>(y: MArray<T>, index: number): MArray<T> {
	if (y.shape.length == 0) throw "Rank Error";

	index = index < 0 ? y.shape[0] + index : index;

	if (index > y.shape[0]) throw "Index Error";
	
	const stride = y.count / y.shape[0];
	return new Slice(y, y.shape.slice(1), stride, index * stride);
}

function _leadingAxis(s: number[], t: number[]): [number, number] | null {
	if (s.length == 0) return [1,0];

	let i = 1;
	let j = s.reduce((a, b) => a*b);
	let k = 0;
	while (true) {
		if (k == t.length) return [i, j];
	
		if (s[k] == t[k]) {
			i *= s[k];
			j /= s[k];
			k += 1;
		} else return null;
	}
}

export function leadingAxis(s: number[], t: number[]): [number, number] | null {
	if (s.length > t.length) {
		return _leadingAxis(s, t);
	} else {
		return _leadingAxis(t, s);
	}
}

export class Slice<T> implements MArray<T> {
	fill: T | undefined

	constructor(private parent: MArray<T>, public shape: number[], public count: number, private _start: number) {
		this.fill = parent.fill;
	}

	isNil() { return this.count == 0 }

	pick(index: number) {
		if (index >= this.count) throw new Error("Index Error");
		return this.parent.pick(this._start + index);
	}
}

export class Box<T> implements MArray<T> {
	constructor(private data: T, public fill: T) {}

	get shape() { return []; }
	get count() { return 1; }

	isNil(): boolean { return false; }

	pick(index: number): T {
		if (index != 0) throw new Error("Index Error");
		return this.data;
	}
}

export class Reshape<T> implements MArray<T> {
	fill: T | undefined

	constructor(private parent: MArray<T>, public shape: number[], public count: number) {
		this.fill = parent.fill;
	}

	isNil() { return this.count == 0 }

	pick(index: number) {
		if (index >= this.count) throw new Error("Index Error");
		index = index % this.parent.count;
		return this.parent.pick(index);
	}
}

export class Pick<T> implements MArray<T> {
	fill: T | undefined
	constructor(private parent: MArray<T>, private indices: MArray<number>) {
		this.fill = parent.fill;
	}

	get shape() { return this.indices.shape }
	get count() { return this.indices.count }

	isNil() { return this.indices.isNil() }

	pick(index: number) {
		if (index >= this.count) throw new Error("Index Error");
		const i = this.indices.pick(index);
		return this.parent.pick(i);
	}
}

export class Zip<X,Y,R> implements MArray<R> {
	_shape: number[];
	_count: number;
	fill = undefined;

	_maxi: number;
	_maxj: number;
	_rightLeading: boolean;

	constructor(private left: MArray<X>, private right: MArray<Y>, private f: (x: X, y: Y) => R) {
		const gt = left.shape.length > right.shape.length ? left : right;
		this._rightLeading = gt == right;
		this._count = gt.count;
		this._shape = gt.shape;

		const axis = leadingAxis(left.shape, right.shape);
		if (axis == null) throw `Shapes Mismatch`
		this._maxi = axis[0];
		this._maxj = axis[1];

		// console.log('new', this)
	}

	get shape() { return this._shape }
	get count() { return this._count }

	isNil() { return this._count == 0 }

	pick(index: number) {
		if (index >= this.count) throw new Error("Index Error");
		if (this._maxj == 0) return this.f(this.left.pick(0), this.right.pick(0));
		let i = Math.trunc(index / this._maxj);
		let j = (i * this._maxj) + index % this._maxj;
		if (!this._rightLeading) [i, j] = [j, i];
		return this.f(this.left.pick(i), this.right.pick(j));
	}
}

export const Nil: MArray<never> = {
	//@ts-expect-error no value to never
	fill: null,
	get shape() { return []; },
	get count() { return 0; },
	isNil() { return true; },
	pick(_: number): never { throw new Error("Index Error") }
}

export class DataArray<T> implements MArray<T> {
	shape: number[];
	count: number;
	_data: T[];
	fill: T | undefined

	constructor(shape: number[], data: T[], fill?: T) {
		const [saneShape, count] = checkShape(shape);		
		this.count = count;
		this.shape = saneShape;
		this._data = data;
		this.fill = fill;
		if (count==0 && data.length==1) this.count=1;
	}

	isNil() {
		return this.count == 0
	}

	pick(index: number) {
		if (index >= this.count) throw new Error("Index Error");
		return this._data[index];
	}
}