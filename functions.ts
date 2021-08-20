import { MultiArray, Slice } from "./multiarray.ts"

export type Value = MultiArray<number | string | Value>

export type Prefix = (x: Value) => Value
export type Infix = (w: Value, x: Value) => Value

export function makeScalar(v: number | string | Value): Value {
    return new MultiArray([], [v])
}

export function makeArray(arr: (Value | number | string)[]): Value {
    if (arr.length == 0) {
        return new MultiArray([], [])
    }

    return new MultiArray([arr.length], arr)
    
}

export function makeEmpty(): Value {
    return new MultiArray([], [])
}

export function makeString(str: string): Value {
    const a = Array.from(str)
    return new MultiArray([a.length], a)
}

function makeArithPrefix(num: (x: number) => number): Prefix {
    const rec: Prefix = (x) => {
        return x.map(w => {
            switch (typeof w) {
                case "number": return num(w)
                case "string": throw "Domain Error"
                case "object": return rec(w)
            }
        })
    }
    return rec
}

function makeArithInfix(num: (x: number, y: number) => number): Infix {
    const rec: Infix = (x, y) => {
        return MultiArray.zip(x, y, (a, b) => {
            let s = typeof a
            let t = typeof b

            if (s === 'string' || t === 'string') throw "Invalid type character at arithmetic function"

            if (s === 'number' && t === 'number') return num(<number>a, <number>b)

            let c = makeBox(a)
            let d = makeBox(b)
            return rec(<Value>c, <Value>d)
        })
    }
    return rec
}

export const add: Infix = makeArithInfix((x, y) => x + y)
export const neg: Prefix = makeArithPrefix(x => -x)
export const sub: Infix = makeArithInfix((x, y) => x - y)
export const sign: Prefix = makeArithPrefix(Math.sign)
export const mult: Infix = makeArithInfix((x, y) => x * y)
export const recp: Prefix = makeArithPrefix(x => 1/x)
export const div: Infix = makeArithInfix((x, y) => x / y)
export const exp: Prefix = makeArithPrefix(Math.exp)
export const pow: Infix = makeArithInfix((x, y) => x ** y)
export const ln: Prefix = makeArithPrefix(Math.log)
export const root: Infix = makeArithInfix((x, y) => y ** (1/x))
export const sqrt: Prefix = makeArithPrefix(Math.sqrt)
export const log: Infix = makeArithInfix((x, y) => Math.log(y)/Math.log(x))
export const abs: Prefix = makeArithPrefix(Math.abs)
export const mod: Infix = makeArithInfix((x, y) => x == 0 ? y : y % x)
export const floor: Prefix = makeArithPrefix(Math.floor)
export const min: Infix = makeArithInfix((x, y) => Math.min(x, y))
export const ceil: Prefix = makeArithPrefix(Math.ceil)
export const max: Infix = makeArithInfix((x, y) => Math.max(x, y))

export const and: Infix = makeArithInfix((x, y) => x & y)
export const or: Infix = makeArithInfix((x, y) => x | y)
export const not: Prefix = makeArithPrefix(x => 1 - x)

export const length: Prefix = (x) => {
    if (x._data.length == 0) return makeScalar(0)

    return makeScalar(x._shape[0] ?? 1)
}
export const rank: Prefix = (x) => makeScalar(x._shape.length)
export const shape: Prefix = (x) => makeArray(x._shape)
export const count: Prefix = (x) => makeScalar(x._data.length)

function cmp_scalar_le(x: number | string | Value, y: number | string | Value): number {
    let s = typeof x, t = typeof y
    return +(s != t ? s <= t : x <= y)
}

function cmp_scalar_ge(x: number | string | Value, y: number | string | Value): number {
    let s = typeof x, t = typeof y
    return +(s != t ? s >= t : x >= y)
}

function cmp_scalar_eq(x: number | string | Value, y: number | string | Value): number {
    let s = typeof x, t = typeof y
    if (s != t) return 0
    if (s == 'object') return +match_values(<Value>x, <Value>y)
    return +(x == y)
}

export const cmp_lt: Infix = (x, y) => {
    return MultiArray.zip(x, y, (x, y) => 1 - cmp_scalar_ge(x, y))
}
export const cmp_le: Infix = (x, y) => {
    return MultiArray.zip(x, y, cmp_scalar_le)
}
export const cmp_ge: Infix = (x, y) => {
    return MultiArray.zip(x, y, cmp_scalar_ge)
}
export const cmp_gt: Infix = (x, y) => {
    return MultiArray.zip(x, y, (x, y) => 1 - cmp_scalar_le(x, y))
}
export const cmp_eq: Infix = (x, y) => { 
    return MultiArray.zip(x, y, cmp_scalar_eq)
}
export const cmp_ne: Infix = (x, y) => { 
    return MultiArray.zip(x, y, (x, y) => 1 - cmp_scalar_eq(x, y))
}

function match_values(a: Value, b: Value): boolean {
    return a.match(b, (x, y) => !cmp_scalar_eq(x, y))
}

export const match: Infix = (x, y) => makeScalar(+match_values(x, y))
export const not_match: Infix = (x, y) => makeScalar(+!match_values(x, y))

export const id: Prefix = (x) => x
export const left: Infix = (x, y) => x
export const right: Infix = (x, y) => y


export const join: Infix = (x, y) => {
    if (x._data.length == 0) return y
    if (y._data.length == 0) return x

    return x.concat(y)
}
export const couple: Infix = (x, y) => {
    return x.couple(y)
}

export const deshape: Prefix = (x) => x.deshape()
export const reshape: Infix = (x, y) => {
    if (x.rank > 1) throw "Rank Error"
    let shape = x._data.map(Number)
    return y.reshape(shape)
}

export const iota: Prefix = (x) => {
    if (x.rank > 1) throw "Rank Error"

    let shape = x._data.map(Number)
    const length = Math.floor(shape.reduce((a, b) => a * b))

    if (isNaN(length)) throw "Length Error"
    if (length < 0) throw "Length Error"
    if (length == 0) return makeEmpty()

    const data = Array(length).fill(0).map((_,i) => i)
    return new MultiArray(shape, data).reshape(shape)
}

export function takeScalar(x: Value): number {
    if (x.rank != 0) throw "Rank Error"
    const n = x._data[0]
    if (typeof n != 'number') throw "Domain Error"
    return n
}

export function takeNumbers(x: Value): number[] {
    if (x.rank != 1) throw "Rank Error"
    const n = x._data.map(Number)
    if (n.some(isNaN)) throw "Domain Error"
    return n
}

// *Transpose
export const reverse: Prefix = (v) => {
    if (v.rank == 0) return v

    const slices = v.firstAxisToArray()
    return v.select(slices.reverse())
}

export const rotate: Infix = (x, y) => {
    const n = takeScalar(x)

    if (y.rank == 0) return y

    const slices = y.firstAxisToArray()

    let rotated_slices

    if (n > 0) {
        const removed = slices.splice(0, n % slices.length)
        rotated_slices = [...slices, ...removed]
    } else {
        const removed = slices.splice(0, (slices.length + n) % slices.length)
        rotated_slices = [...slices, ...removed]
    }

    const rotated = y.select(rotated_slices)
    return rotated

}

export const take: Infix = (x, y) => {
    const n = takeScalar(x)
    
    const slices = y.firstAxisToArray()
    if (n > 0) {
        return y.select(slices.slice(0, n))
    } 

    return y.select(slices.slice(slices.length + n))
}

export const drop: Infix = (x, y) => {
    const n = takeScalar(x)

    const slices = y.firstAxisToArray()

    if (n > 0) {
        return y.select(slices.slice(n))
    }

    return y.select(slices.slice(0, n))
}

export const first: Prefix = (x) => {
    if (!x._data[0]) return makeEmpty()
    return makeScalar(x._data[0])
}

export const first_cell: Prefix = (y) => {
    const final = y.getFirst(0)
    return y.slice(final)
}

export const pick: Infix = (x, y) => {
    if (x.rank == 0) {
        const n = takeScalar(x)
        return makeScalar(y._data[n])
    }

    try {
        let n = takeNumbers(x)
        return makeScalar(y.get(n))
    } catch {
        const result = x.map(i => pick(makeScalar(i), y)._data[0])
        return result
    }
}

export const select: Infix = (x, y) => {
    if (y.rank == 0) throw "Rank Error"

    if (x.rank == 0) {
        let n = takeScalar(x)
        const slice = y.getFirst(n ?? 0)
        return y.slice(slice)
    }

    let n = takeNumbers(x)
    const slices = n.map(i => y.getFirst(i))
    return y.select(slices)
}

export const membership: Infix = (y, x) => {
    const final = y.map((a: string | number | Value) => {
        for (const val of x._data) {
            if (cmp_scalar_eq(val, a)) return 1
        }
        return 0
    })
    return final
}

export const indexof: Infix = (x, y) => {
    const final = y.map((a: string | number | Value) => {
        for (let i = 0; i < x._data.length; ++i) {
            if (cmp_scalar_eq(x._data[i], a)) return i
        }
        return x._data.length
    })
    
    return final
}

export const indices: Prefix = (x) => {
    const n = takeNumbers(x)
    const data = n.flatMap((n, i) => <number[]>(Array(n).fill(i)))
    return makeArray(data)
}

export const replicate: Infix = (x, y) => {
    const indices_list = takeNumbers(x)

    if (y.length !== indices_list.length) throw "Lenght Error"

    const indices = indices_list.flatMap((n, i) => <number[]>(Array(n).fill(i)))
    const slices = indices.map((i) => y.getFirst(i))

    return y.select(slices)
}

export const mark_firsts: Prefix = (x) => {
    if (x.rank != 1) throw "Shape Error"
    const uniques: Set<number | string | Value> = new Set()
    const data = x.map((n: number | string | Value) => uniques.has(n) ? 0 : ( uniques.add(n), 1))
    return data
}

export const unique: Prefix = (x) => {
    if (x.rank != 1) throw "Shape Error"

    const uniques: (number | string | Value)[] = []
    const has = (v: number | string | Value) => uniques.some(u => cmp_scalar_eq(u, v))
    const data = x._data.filter(n => has(n) ? false : (uniques.push(n), true))
    return makeArray(data)
}

export const group: Infix = (x, y) => {
    const groups = takeNumbers(x)

    let data: Slice[][] = []

    for (let i = 0; i < groups.length; i++) {
        const n = groups[i]

        if (n < 0) continue

        const slice = y.getFirst(i)

        if (data[n] == undefined) {
            data[n] = [slice]
        } else {
            data[n].push(slice)
        }
    }

    if (data.length == 0) return makeEmpty()

    for (let i = 0; i < data.length; i++) {
        if (data[i] == undefined) data[i] = []
    }

    const boxes = data.map(slices => y.select(slices))

    return new MultiArray([data.length], boxes)
}

export const group_indices: Prefix = (x) => {
    const groups = takeNumbers(x)

    const data: number[][] = []

    groups.forEach((n, i) => {
        if (n < 0) return

        if (data[n] == undefined) data[n] = []

        data[n].push(i)
    })

    for (let i = 0; i < data.length; i++) {
        if (data[i] == undefined) data[i] = []
    }

    return makeArray(data.map(x => makeArray(x)))
}

export const find: Infix = (pat, x) => {
    if (x.rank == 0) throw "Rank Error"

    if (pat.rank == 0) {
        return cmp_eq(pat, x)
    }

    if (pat.rank != x.rank) throw "Rank Error"

    const pat_len = pat.length ?? 0
    const x_len = x.length ?? 0

    if (pat_len > x_len) return makeEmpty()

    if (pat_len == x_len) {
        if (match_values(pat, x)) {
            return makeArray([1].concat(new Array(x_len-1).fill(0)))
        } else {
            return makeArray(new Array(x_len).fill(0))
        }
    }

    const pat_cells = pat.firstAxisToArray()
    const cells = x.firstAxisToArray()

    const result = new Array(x_len).fill(0)

    for (let i = 0; i < x_len - pat_len; i++) {
        let got = 1
        for (let j = 0; j < pat_cells.length; j++) {
            const pat_c = pat.slice(pat_cells[j])
            const x_c = x.slice(cells[i + j])

            if (false == match_values(pat_c, x_c)) {
                got = 0
                break
            }
        }
        result[i] = got
    }

    return makeArray(result)
}

export const enclose: Prefix = (x) => {
    return new MultiArray([], [x])
}

export function makeBox(v: number | string | Value): Value {
    return typeof v == 'object' ? v : makeScalar(v)
}

export function unwrapBox(v: Value): number | string | Value {
    if (v.rank == 0) return v._data[0]
    return v
}

export const merge: Prefix = (x) => {
    if (x.rank == 0) return x

    let first = makeBox(x._data[0])

    const result = x._data.map(makeBox).reduce((acc, v) => {
        if (!MultiArray.same_shape(first, v)) throw "Shape Error"

        return acc.concat(v)
    })

    return result.reshape([...x._shape, ...first._shape])
}

export const windows: Infix = (n, x) => {
    if (x.rank == 0) return x

    const len = takeScalar(n)

    if (len <= 0) throw "Value Error"

    if (len >= x._shape[0]) throw "Value Error"

    let windows: Slice[] = []

    const span = x._shape[0] - len + 1

    for (let i = 0; i < span; i++) {
        let a = x.getFirst(i)
        let b = x.getFirst(i + len - 1)

        windows.push({ start: a.start, end: b.end, shape: [len, ...a.shape] })
    }

    let data: any[] = []

    for (let i = 0; i < windows.length; i++) {
        const slice = windows[i]
        
        data = data.concat(x._data.slice(slice.start, slice.end))
    }

    return new MultiArray([windows.length, ...windows[0].shape], data)
}

export const solo: Prefix = (x) => {
    return x.reshape([1, ...x._shape])
}

function scalar_depth(v: number | string | Value) {
    let s = typeof v
    if (s == 'object') return value_depth(<Value>v)
    return 0
}

function value_depth(v: Value): number {
    if (v.rank == 0) return 0
    return 1 + Math.max(...v._data.map(scalar_depth))
}

export const depth: Prefix = (x) => {
    return makeScalar(value_depth(x))
}


function compare_values(a: Value, b: Value): number {
    if (!cmp_scalar_le(a, b)) return 1
    if (!cmp_scalar_ge(a, b)) return -1
    return 0
}

export const grade_up: Prefix = (x) => {
    const slices = x.firstAxisToArray()
    const sliced = slices.map(s => x.slice(s))

    const indices = slices.map((_, i) => i).sort((a, b) => {
        return compare_values(sliced[a], sliced[b])
    })

    return makeArray(indices)
}

export const grade_down: Prefix = (x) => {
    const slices = x.firstAxisToArray()
    const sliced = slices.map(s => x.slice(s))

    const indices = slices.map((_, i) => i).sort((a, b) => {
        return compare_values(sliced[a], sliced[b]) * -1
    })

    return makeArray(indices)
}

export const under_indices: Prefix = (x) => {
    const indices = takeNumbers(x)

    const data: number[] = []

    indices.forEach(n => {
        if (n < 0) return

        if (data[n] == undefined) data[n] = 0

        data[n] += 1
    })

    for (let i = 0; i < data.length; i++) {
        if (data[i] == undefined) data[i] = 0
    }

    return makeArray(data)
}

export function underBoxPrefix(f: Prefix): (v: number | string | Value) => number | string | Value {
    return (v) => unwrapBox(f(makeBox(v)))
}

export function underBoxInfix(f: Infix): (a: number | string | Value, b: number | string | Value) => number | string | Value {
    return (a, b) => unwrapBox(f(makeBox(a), makeBox(b)))
}

export const reduce: (f: Infix) => Prefix = (f) => (w) => {
    if (w.length == undefined) return w

    const result = w.map(makeBox).reduce(f)

    if (result.rank == 0) return result._data[0]
    return result
}

export const each: (f: Prefix) => Prefix = (f) => (w) => {

    let data: (number | string | Value)[] = []
    for (let index = 0; index < w._data.length; index++) {
        const result = underBoxPrefix(f)(w._data[index])
        data.push(result)
    }

    return new MultiArray(w._shape, data, w._strides)
}

export const cellsPrefix: (f: Prefix) => Prefix = (f) => (w) => {
    const cells = w.firstAxisToArray()

    let data: (Value | string | number)[] = []

    let shape: number[] | null = null

    for (const slice of cells) {
        const cell = f(w.slice(slice))

        if (shape == null) {
            shape = cell._shape
        } else if (cell._shape.length != shape.length 
            || !cell._shape.every((n, i) => n == (<number[]>shape)[i])) {
                throw "Shape Error"
        }

        data = data.concat(cell._data)
    }

    if (w.length == undefined || shape == null) return makeEmpty()
    return new MultiArray([w.length, ...shape], data)
}

export const cellsInfix: (f: Infix) => Infix = (f) => (a, w) => {
    if (a.length != w.length) throw "Length Error"

    const a_arr = a.firstAxisToArray()
    const w_arr = w.firstAxisToArray()

    let data: (Value | string | number)[] = []

    let shape: number[] | null = null

    for (let i = 0; i < a_arr.length; i++) {
        const x = a.slice(a_arr[i])
        const y = w.slice(w_arr[i])
        
        const result = f(x, y)

        if (shape == null) {
            shape = result._shape
        } else if (result._shape.length != shape.length 
            || !result._shape.every((n, i) => n == (<number[]>shape)[i])) {
                throw "Shape Error"
        }

        data = data.concat(result._data)
    }

    if (shape == null) return makeEmpty()
    return new MultiArray([a_arr.length, ...shape], data)
}

export const table: (f: Infix) => Infix = (f) => (a, w) => {
    const a_arr = a.firstAxisToArray()
    const w_arr = w.firstAxisToArray()

    let data: (Value | string | number)[] = []

    for (const a_slice of a_arr) {
        for (const w_slice of w_arr) {
            const x = a.slice(a_slice)
            const y = w.slice(w_slice)

            const result = unwrapBox(f(x, y))

            data.push(result)
        }
    }
    
    return new MultiArray([a_arr.length, w_arr.length], data)
}