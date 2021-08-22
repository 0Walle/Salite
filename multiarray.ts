const _same_shape = (x: number[], y: number[]) => {
    return x.length == y.length && x.every((n, i) => y[i] == n)
}

export type Slice = { start: number, end: number, shape: number[] }

export class MultiArray<T> {
	_shape: number[];
	_strides: number[];
	_data: T[];

	constructor(shape: number[], data: T[], strides?: number[]) {
		if (data.length == 0) {
			this._shape = []
			this._strides = []
			this._data = []
			return
		}

		this._shape = shape
		this._data = data
		if (strides) {
			this._strides = strides
		} else if (shape.length == 0) {
			this._strides = []
		} else if (shape.length == 1) {
			this._strides = [1]
		} else {
			this._strides = shape
				.map((_, i) => shape
					.slice(i+1)
					.reduce((a, b) => a * b, 1))
		}
	}

	static from<T>(iter: Iterable<T>): MultiArray<T> {
		let data = Array.from(iter)
		return new MultiArray([data.length], data)
	}

	static same_shape(a: MultiArray<any>, b: MultiArray<any>): boolean {
		return _same_shape(a._shape, b._shape)
	}

	static zip<S, T, U>(s: MultiArray<S>, t: MultiArray<T>, f: (a: S, b: T) => U): MultiArray<U> {
		let [gt, lt] = s._shape.length > t._shape.length ? [s, t] : [t, s]

		if (lt.rank != 0 && !_same_shape(lt._shape, gt._shape.slice(-lt.rank))) throw "Shape Error"

		const lt_len = lt._data.length
		const gt_len = gt._data.length

		let data: U[] = Array(gt_len)

		const stride = lt.rank == 0 ? 0 : 1/gt._strides[lt.rank - 1]

		if (s == gt) {
			for (let i = 0; i < gt_len; i++) {
				data[i] = f(s._data[i], t._data[Math.floor(i * stride)])
			}
		} else {
			for (let i = 0; i < gt_len; i++) {
				data[i] = f(s._data[Math.floor(i * stride)], t._data[i])
			}
		}

		return new MultiArray(gt._shape, data, gt._strides)
	}

	public get rank(): number {
		return this._shape.length
	}

	public get length(): number | undefined {
		return this._shape[0]
	}

	map<U>(f: (x: T) => U): MultiArray<U> {
		const new_data = new Array(this._data.length)
		const len = this._data.length

		for (let i = 0; i < len; i++) {
			new_data[i] = f(this._data[i])
		}

		return new MultiArray(this._shape, new_data, this._strides)
	}

	reduce(f: (a: T, b: T) => T): MultiArray<T> {
        const last = this._shape[this._shape.length-1]

		const new_shape = this._shape.slice(0, -1)
		const new_count = new_shape.reduce((a, b) => a * b, 1)
        const new_data: T[] = Array(new_count)

		for (let i = 0; i < this._data.length; i++) {
			const j = Math.floor(i/last)
			if (new_data[j] === undefined) {
				new_data[j] = this._data[i]
				continue
			}
			new_data[j] = f(new_data[j], this._data[i])
		}

		return new MultiArray(new_shape, new_data)
	}

	reduceWith<U>(f: (a: U, b: T) => U, init: U): MultiArray<U> {
        const last = this._shape[this._shape.length-1]

		const new_shape = this._shape.slice(0, -1)
		const new_count = new_shape.reduce((a, b) => a * b)
        const new_data: U[] = Array(new_count)

		for (let i = 0; i < this._data.length; i++) {
			const j = Math.floor(i/last)
			if (new_data[j] === undefined) {
				new_data[j] = init
			}
			new_data[j] = f(new_data[j], this._data[i])
		}

		return new MultiArray(new_shape, new_data)
	}

	match(other: MultiArray<T>, equals: (a: T, b: T) => boolean): boolean {
		if (!_same_shape(this._shape, other._shape)) {
			return false
		}

		return this._data.every((n, i) => equals(other._data[i], n))
	}

	solo(): MultiArray<T> {
		return new MultiArray([1, ...this._shape], this._data)
	}

	concat(that: MultiArray<T>): MultiArray<T> {
		
		let a = this._shape.length > 0 ? this._shape : [1]
		let b = that._shape.length > 0 ? that._shape : [1]

		if (a.length == b.length) {
		} else if (a.length == b.length + 1) {
			b = [1, ...b]
		} else if (a.length + 1 == b.length) {
			a = [1, ...a]
		} else {
			throw "Shape Error"
		}

		const this_first = a[0]
		const this_rest = a.slice(1)
		const that_first = b[0]
		const that_rest = b.slice(1)
		if (!_same_shape(this_rest, that_rest)) throw "Shape Error"
		const new_data = this._data.concat(that._data)
		const new_shape = [this_first + that_first, ...this_rest]
		return new MultiArray(new_shape, new_data)
	}

	couple(other: MultiArray<T>): MultiArray<T> {
		if (!_same_shape(this._shape, other._shape)) throw "Shape Error"
		return new MultiArray([2, ...this._shape], this._data.concat(other._data))
	}

	deshape(): MultiArray<T> {
		return new MultiArray([this._data.length], this._data)
	}

	reshape(shape: number[]): MultiArray<T> {
		const length = Math.floor(shape.reduce((a, b) => a * b, 1))
		if (isNaN(length)) throw "Length Error"
		if (length < 0) throw "Length Error"
		
		if (length > this._data.length) {
			let times = Math.floor(length / this._data.length)
			let slice = length % this._data.length
			let new_data = <T[]>[].concat(...Array(times).fill(this._data))
			new_data = new_data.concat(this._data.slice(0, slice))
			return new MultiArray(shape, new_data)
		}

		if (length == 0) {
			return new MultiArray([], [])
		}

		if (length == this._data.length) {
			return new MultiArray(shape, this._data)
		}

		return new MultiArray(shape, this._data.slice(0, length))
	}

	firstAxisToArray(): Slice[] {
		const shape = this._shape.slice(1)
		const stride = this._strides[0]

		if (stride == undefined) return [ { start: 0, end: this._data.length, shape: this._shape} ]

		let result: Slice[] = []
		let i = 0
		while (i < this._data.length) {
			result.push({shape: shape, start: i, end: i + stride})
			i += stride
		}

		return result
	}
	
	get(index: number[]): T {
		if (index.length != this._shape.length) throw "Length Error"

		const i = index.map((x, i) => (x < 0 ? this._shape[i] + x : x) * this._strides[i]).reduce((a, b) => a + b)

		if (i >= this._data.length) throw "Index Error"

		return this._data[i]
	}

	getFirst(index: number): Slice {
		if (this.rank == 0) {
			throw "Rank Error"
		}

		const len = this._shape[0]

		if (index < 0) index = len + index

		if (index < 0 || index >= len) throw "Lenght Error"

		if (this.rank == 1) {
			return { start: index, end: index + 1, shape: [] }
		}

		const shape = this._shape.slice(1)
		const stride = this._strides[0]

		return { start: index * stride, end: (index + 1) * stride, shape }
	}

	slice(s: Slice): MultiArray<T> {
		return new MultiArray(s.shape, this._data.slice(s.start, s.end))
	}

	select(cells: number[]): MultiArray<T> {
		if (this.length == undefined) throw "Rank Error"

		if (cells.length == 0) return new MultiArray([], [])

		let new_data: T[] = []

		let shape = this._shape.slice(1)

		for (let i = 0; i < cells.length; i++) {
			let cell = cells[i]
			
			if (cell < 0) cell = this.length + cell

			if (cell >= this.length) throw "Lenght Error"
			if (cell < 0) throw "Lenght Error"

			new_data = new_data.concat(this._data.slice(cell * this._strides[0], (cell + 1) * this._strides[0]))
		}

		return new MultiArray([cells.length ,...shape], new_data)
	}
}