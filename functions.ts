import { MultiArray, Slice } from "./multiarray.ts"

export type Value 
    = { kind: 'num', value: MultiArray<number> }
    | { kind: 'char', value: MultiArray<string> }
    | { kind: 'box', value: MultiArray<Value> }

export type Prefix = (x: Value) => Value
export type Infix = (w: Value, x: Value) => Value

export function fromMultiArray(m: MultiArray<number | string | Value>): Value {
    switch (typeof m._data[0]) {
        case "number":
            return ({ kind: 'num', value: <MultiArray<number>>m})
        case "string":
            return ({ kind: 'char', value: <MultiArray<string>>m})
        case "object":
            return ({ kind: 'box', value: <MultiArray<Value>>m})
        default:
            return ({ kind: 'box', value: new MultiArray([], [])})

    }
}

export function fromMultiArrayUnwrap(m: MultiArray<number | string | Value>): Value {
    switch (typeof m._data[0]) {
        case "number":
            return ({ kind: 'num', value: <MultiArray<number>>m})
        case "string":
            return ({ kind: 'char', value: <MultiArray<string>>m})
        case "object":
            if (m.rank == 0) return (<MultiArray<Value>>m)._data[0] ?? makeEmpty()
            return ({ kind: 'box', value: <MultiArray<Value>>m})
        default:
            return ({ kind: 'box', value: new MultiArray([], [])})

    }
}

export function makeChar(ch: string): Value {
    return ({ kind: 'char', value: new MultiArray([], [ch]) })
}

export function makeScalar(n: number): Value {
    return ({ kind: 'num', value: new MultiArray([], [n]) })
}

export function chooseScalar(v: number | string | Value): Value {
    switch (typeof v) {
        case "number":
            return ({ kind: 'num', value: new MultiArray([], [v])})
        case "string":
            return ({ kind: 'char', value: new MultiArray([], [v])})
        case "object":
            return v
        default:
            throw "Really Bad Error"
    }
}

export function makeArray(arr: (Value[]|number[]|string[]), empty: 'box' | 'num' | 'char' = 'box'): Value {
    if (arr.length == 0) {
        return ({ kind: empty, value: new MultiArray([], [])})
    }

    switch (typeof arr[0]) {
        case "number":
            return ({ kind: 'num', value: new MultiArray([arr.length], <number[]>arr)})
        case "string":
            return ({ kind: 'char', value: new MultiArray([arr.length], <string[]>arr)})
        case "object":
            return ({ kind: 'box', value: new MultiArray([arr.length], <Value[]>arr)})
    }
    
}

export function makeEmpty(kind: 'box' | 'num' | 'char' = 'box'): Value {
    return ({ kind: kind, value: new MultiArray([], [])})
}

export function makeString(str: string): Value {
    const a = Array.from(str)
    return ({ kind: 'char', value: new MultiArray([a.length], <string[]>a)})
}

function throwErr(err: string): (x: any) => Value {
    return (_) => { throw new Error(err) }
}

function throwErrG<T>(err: string): (x: any) => T {
    return (_) => { throw new Error(err) }
}

function chooseFunc(num: (x: MultiArray<number>) => Value, char: (x: MultiArray<string>) => Value, arr: (x: MultiArray<Value>) => Value): Prefix {
    return (x) => {
        switch (x.kind) {
            case "num": return num(x.value)
            case "char": return char(x.value)
            case "box": return arr(x.value)
        }
    }
}

function makeArithPrefix(num: (x: MultiArray<number>) => Value): Prefix {
    const rec: Prefix = (x) => {
        switch (x.kind) {
            case "num": return num(x.value)
            case "char": return throwErr("Domain Error")(x)
            case "box": return fromMultiArray(x.value.map(makeArithPrefix(num)))
        }
    }
    return rec
}

function makeArithInfix(num: (x: number, y: number) => number): Infix {
    const rec: Infix = (x, y) => {
        if (x.kind != y.kind) return throwErr(`Domain Error: ${x.kind} ≠ ${y.kind}`)(x)

        switch (x.kind) {
            case "num": return fromMultiArray(MultiArray.zip(x.value, <MultiArray<number>>y.value, num))
            case "char": return throwErr("Domain Error")(x)
            case "box": return fromMultiArray(MultiArray.zip(x.value, <MultiArray<Value>>y.value, makeArithInfix(num)))
        }
    }
    return rec
}

function makeCompInfix(num: (x: number, y: number) => boolean, char: (x: string, y: string) => boolean): Infix {
    const rec: Infix = (x, y) => { 
        if (x.kind != y.kind) return throwErr("Domain Error")(x)

        switch (x.kind) {
            case "num": return fromMultiArray(MultiArray.zip(x.value, <MultiArray<number>>y.value, (x, y) => +num(x, y)))
            case "char": return fromMultiArray(MultiArray.zip(x.value, <MultiArray<string>>y.value, (x, y) => +char(x, y)))
            case "box": return fromMultiArray(MultiArray.zip(x.value, <MultiArray<Value>>y.value, (x, y) => rec(x, y)))
        }
    }
    return rec
}

function makeSameKind<T extends number | string | Value>(f: (a: MultiArray<T>, b: MultiArray<T>) => MultiArray<T>): Infix {
    return (x, y) => {
        if (x.kind != y.kind) return throwErr("Domain Error")(x)
        return fromMultiArray(f(<MultiArray<T>>x.value, <MultiArray<T>>y.value))
    }
}

export const add: Infix = makeArithInfix((x, y) => x + y)
export const neg: Prefix = makeArithPrefix(v => fromMultiArray(v.map(x => -x)))
export const sub: Infix = makeArithInfix((x, y) => x - y)
export const sign: Prefix = makeArithPrefix(v => fromMultiArray(v.map(x => Math.sign(x))))
export const mult: Infix = makeArithInfix((x, y) => x * y)
export const recp: Prefix = makeArithPrefix(v => fromMultiArray(v.map(x => 1/x)))
export const div: Infix = makeArithInfix((x, y) => x / y)
export const exp: Prefix = makeArithPrefix(v => fromMultiArray(v.map(x => Math.exp(x))))
export const pow: Infix = makeArithInfix((x, y) => x ** y)
export const ln: Prefix = makeArithPrefix(v => fromMultiArray(v.map(x => Math.log(x))))
export const root: Infix = makeArithInfix((x, y) => y ** (1/x))
export const sqrt: Prefix = makeArithPrefix(v => fromMultiArray(v.map(x => Math.sqrt(x))))
export const log: Infix = makeArithInfix((x, y) => Math.log(y)/Math.log(x))
export const abs: Prefix = makeArithPrefix(v => fromMultiArray(v.map(x => Math.abs(x))))
export const mod: Infix = makeArithInfix((x, y) => x == 0 ? y : y % x)
export const floor: Prefix = makeArithPrefix(v => fromMultiArray(v.map(x => Math.floor(x))))
export const min: Infix = makeArithInfix((x, y) => Math.min(x, y))
export const ceil: Prefix = makeArithPrefix(v => fromMultiArray(v.map(x => Math.ceil(x))))
export const max: Infix = makeArithInfix((x, y) => Math.max(x, y))

export const and: Infix = makeArithInfix((x, y) => x & y)
export const or: Infix = makeArithInfix((x, y) => x | y)
export const not: Prefix = makeArithPrefix(v => fromMultiArray(v.map(x => 1 - x)))

export const length: Prefix = (x) => {
    if (x.value._data.length == 0) return makeScalar(0)

    return makeScalar(x.value._shape[0] ?? 1)
}
export const rank: Prefix = (x) => makeScalar(x.value._shape.length)
export const shape: Prefix = (x) => makeArray(x.value._shape)
export const count: Prefix = (x) => makeScalar(x.value._data.length)

export const cmp_lt: Infix = (x, y) => {
    if (x.kind != y.kind) return throwErr("Domain Error")(x)
    if (x.value.rank != y.value.rank) return throwErr("Rank Error")(x)

    switch (x.kind) {
        case "num": return fromMultiArray(MultiArray.zip(x.value, <MultiArray<number>>y.value, (x, y) => +(x < y)))
        case "char": {
            if (x.value.rank == 1) {
                return makeScalar(+(x.value._data.join('') < y.value._data.join('')))
            }

            return fromMultiArray(MultiArray.zip(x.value, <MultiArray<string>>y.value, (x, y) => +(x < y)))
        }
        case "box": {
            return fromMultiArray(MultiArray.zip(x.value, <MultiArray<Value>>y.value, (x, y) => cmp_lt(x, y)))
        }
    }
}
export const cmp_le: Infix = (x, y) => {
    if (x.kind != y.kind) return throwErr("Domain Error")(x)
    if (x.value.rank != y.value.rank) return throwErr("Rank Error")(x)

    switch (x.kind) {
        case "num": return fromMultiArray(MultiArray.zip(x.value,<MultiArray<number>>y.value, (x, y) => +(x <= y)))
        case "char": {
            if (x.value.rank == 1) {
                return makeScalar(+(x.value._data.join('') <= y.value._data.join('')))
            }

            return fromMultiArray(MultiArray.zip(x.value,<MultiArray<string>>y.value, (x, y) => +(x <= y)))
        }
        case "box": {
            return fromMultiArray(MultiArray.zip(x.value,<MultiArray<Value>>y.value, (x, y) => cmp_le(x, y)))
        }
    }
}
export const cmp_ge: Infix = (x, y) => {
    if (x.kind != y.kind) return throwErr("Domain Error")(x)
    if (x.value.rank != y.value.rank) return throwErr("Rank Error")(x)

    switch (x.kind) {
        case "num": return fromMultiArray(MultiArray.zip(x.value,<MultiArray<number>>y.value, (x, y) => +(x >= y)))
        case "char": {
            if (x.value.rank == 1) {
                return makeScalar(+(x.value._data.join('') >= y.value._data.join('')))
            }

            return fromMultiArray(MultiArray.zip(x.value,<MultiArray<string>>y.value, (x, y) => +(x >= y)))
        }
        case "box": {
            return fromMultiArray(MultiArray.zip(x.value,<MultiArray<Value>>y.value, (x, y) => cmp_ge(x, y)))
        }
    }
}

export const cmp_gt: Infix = (x, y) => {
    if (x.kind != y.kind) return throwErr("Domain Error")(x)
    if (x.value.rank != y.value.rank) return throwErr("Rank Error")(x)

    switch (x.kind) {
        case "num": return fromMultiArray(MultiArray.zip(x.value,<MultiArray<number>>y.value, (x, y) => +(x > y)))
        case "char": {
            if (x.value.rank == 1) {
                return makeScalar(+(x.value._data.join('') > y.value._data.join('')))
            }

            return fromMultiArray(MultiArray.zip(x.value,<MultiArray<string>>y.value, (x, y) => +(x > y)))
        }
        case "box": {
            return fromMultiArray(MultiArray.zip(x.value,<MultiArray<Value>>y.value, (x, y) => cmp_gt(x, y)))
        }
    }
}

export const cmp_eq: Infix = (x, y) => { 
    if (x.kind != y.kind) return throwErr("Domain Error")(x)

    switch (x.kind) {
        case "num": return fromMultiArray(MultiArray.zip(x.value, <MultiArray<number>>y.value, (x, y) => +(x == y)))
        case "char": return fromMultiArray(MultiArray.zip(x.value, <MultiArray<string>>y.value, (x, y) => +(x == y)))
        case "box": return fromMultiArray(MultiArray.zip(x.value, <MultiArray<Value>>y.value, (x, y) => +match_values(x, y)))
    }
}

export const cmp_ne: Infix = (x, y) => { 
    if (x.kind != y.kind) return throwErr("Domain Error")(x)

    switch (x.kind) {
        case "num": return fromMultiArray(MultiArray.zip(x.value, <MultiArray<number>>y.value, (x, y) => +(x != y)))
        case "char": return fromMultiArray(MultiArray.zip(x.value, <MultiArray<string>>y.value, (x, y) => +(x != y)))
        case "box": return fromMultiArray(MultiArray.zip(x.value, <MultiArray<Value>>y.value, (x, y) => +!match_values(x, y)))
    }
}

function match_values(a: Value, b: Value): boolean {
    if (a.kind != b.kind) return false

    switch (a.kind) {
        case 'num':
            return a.value.match(<MultiArray<number>>b.value, (x, y) => x == y)
        case 'char':
            return a.value.match(<MultiArray<string>>b.value, (x, y) => x == y)
        case 'box':
            return a.value.match(<MultiArray<Value>>b.value, match_values)
    }
}

export const match: Infix = (x, y) => makeScalar(+match_values(x, y))
export const not_match: Infix = (x, y) => makeScalar(+!match_values(x, y))

export const id: Prefix = (x) => x
export const left: Infix = (x, y) => x
export const right: Infix = (x, y) => y


export const join: Infix = (x, y) => {
    if (x.value._data.length == 0) return y
    if (y.value._data.length == 0) return x

    return makeSameKind((x, y) => x.concat(y))(x, y)
}
export const couple: Infix = (x, y) => {
    if (x.kind == y.kind) {
        return fromMultiArray(<any>x.value.couple(<any>y.value))
    }

    if (!MultiArray.same_shape(x.value, y.value)) throw "Shape Error"

    const a = x.value.firstAxisToArray().map(slice => fromMultiArrayUnwrap(<any>x.value.slice(slice)))
    const b = y.value.firstAxisToArray().map(slice => fromMultiArrayUnwrap(<any>y.value.slice(slice)))

    return fromMultiArray(new MultiArray([2, ...x.value._shape], a.concat(b)))
}

export const deshape: Prefix = (x) => <Value>{ kind: x.kind, value: x.value.deshape() }
export const reshape: Infix = (x, y) => {
    if (x.kind != 'num') throw "Domain Error"
    return <Value>{kind: y.kind, value: y.value.reshape(x.value._data)}
}

export const iota: Prefix = (x) => {
    if (x.kind != 'num') throw "Domain Error"
    const length = Math.floor(x.value._data.reduce((a, b) => a * b))
    if (length < 0) throw "Length Error"
    if (length == 0) return makeEmpty('num')

    const data = Array(length).fill(0).map((_,i) => i)
    return {kind: 'num', value: new MultiArray(x.value._data, data).reshape(x.value._data)}
}

// *Transpose
export const reverse: Prefix = (v) => {
    if (v.value.rank == 0) return v

    const slices = v.value.firstAxisToArray()
    const final = v.value.select(slices.reverse())
    return <Value>({ kind: v.kind, value: final })
}

export const rotate: Infix = (x, y) => {
    if (x.kind != 'num') throw "Domain Error"
    if (x.value.rank != 0) throw "Rank Error"

    const n = x.value._data[0]

    if (y.value.rank == 0) return y

    
    if (n > 0) {
        const slices = y.value.firstAxisToArray()
        const removed = slices.splice(0, n % slices.length)
        const rotated_slices = [...slices, ...removed]
        const rotated = y.value.select(rotated_slices)
    
        return <Value>({ kind: y.kind, value: rotated })
    } else {
        
        const slices = y.value.firstAxisToArray()
        const removed = slices.splice(0, (slices.length + n) % slices.length)
        const rotated_slices = [...slices, ...removed]
        const rotated = y.value.select(rotated_slices)
    
        return <Value>({ kind: y.kind, value: rotated })
    }

}

export const take: Infix = (x, y) => {
    if (x.kind != 'num') throw "Domain Error"

    const n = x.value._data[0]
    
    const slices = y.value.firstAxisToArray()
    if (n > 0) {
        const final = y.value.select(slices.slice(0, n))
        return <Value>({ kind: y.kind, value: final })
    } 

    const final = y.value.select(slices.slice(slices.length + n))
    return <Value>({ kind: y.kind, value: final })
}

export const drop: Infix = (x, y) => {
    if (x.kind != 'num') throw "Domain Error"

    const n = x.value._data[0]
    const slices = y.value.firstAxisToArray()

    if (n > 0) {
        const final = y.value.select(slices.slice(n))
        return <Value>({ kind: y.kind, value: final })
    }

    const final = y.value.select(slices.slice(0, n))
    return <Value>({ kind: y.kind, value: final })
}

export const first: Prefix = (x) => {
    const val = chooseScalar(x.value._data[0])
    return val
}

export const first_cell: Prefix = (y) => {
    const final = y.value.getFirst(0)
    return <Value>({ kind: y.kind, value: y.value.slice(final) })
}

export const pick: Infix = (x, y) => {
    if (x.kind == 'box') {
        const result = x.value.map(i => pick(i, y).value._data[0])
        return <Value>{ kind: y.kind, value: result } 
    }

    if (x.kind != 'num') throw "Domain Error"

    if (x.value.rank == 0) {
        const val = y.value._data[x.value._data[0]]
        return chooseScalar(val)    
    }

    const val = y.value.get(x.value._data)
    return chooseScalar(val)
}

export const select: Infix = (x, y) => {
    if (x.kind != 'num') throw "Domain Error"
    
    if (y.value.rank == 0) throw "Rank Error"

    if (x.value.rank == 0) {
        const slice = y.value.getFirst(x.value._data[0] ?? 0)

        return <Value>({ kind: y.kind, value: y.value.slice(slice) })
    }

    if (x.value.rank != 1) throw "Rank Error"

    const slices = x.value._data.map(i => y.value.getFirst(i))

    return <Value>({ kind: y.kind, value: y.value.select(slices) })
}

export const membership: Infix = (y, x) => {
    if (x.kind != y.kind) throw "Domain Error"

    const final = y.value.map((a: string | number | Value) => {

        for (const val of x.value._data) {
            // match_values
            if (val == a) return 1
        }

        return 0
    })
    
    return <Value>({ kind: 'num', value: final })
}

export const indexof: Infix = (x, y) => {
    if (x.kind != y.kind) throw "Domain Error"

    const final = y.value.map((a: string | number | Value) => {

        for (let i = 0; i < x.value._data.length; ++i) {
            // match_values
            if (x.value._data[i] == a) return i
        }

        return x.value._data.length
    })
    
    return <Value>({ kind: 'num', value: final })
}

export const indices: Prefix = (x) => {
    if (x.kind != 'num') throw "Domain Error"
    if (x.value.rank != 1) throw "Shape Error"

    const data = x.value._data.flatMap((n, i) => <number[]>(Array(n).fill(i)))

    return makeArray(data)
}

export const replicate: Infix = (x, y) => {
    if (x.kind != 'num') throw "Domain Error"
    if (x.value.rank != 1) throw "Shape Error"

    const indices_list = x.value._data

    if (y.value.length !== indices_list.length) throw "Lenght Error"

    const indices = indices_list.flatMap((n, i) => <number[]>(Array(n).fill(i)))
    const slices = indices.map((i) => y.value.getFirst(i))
    const final = y.value.select(slices)

    return <Value>{ kind: y.kind, value: final }
}

export const mark_firsts: Prefix = (x) => {
    if (x.value.rank != 1) throw "Shape Error"

    const uniques: Set<number | string | Value> = new Set()

    const data = x.value.map((n: number | string | Value) => uniques.has(n) ? 0 : ( uniques.add(n), 1))

    return { kind: 'num', value: data}
}

export const unique: Prefix = (x) => {
    if (x.value.rank != 1) throw "Shape Error"

    switch (x.kind) {
        case 'num': {
            const uniques: Set<number> = new Set()

            const data = x.value._data.filter(n => uniques.has(n) ? false : (uniques.add(n), true))

            return makeArray(data)
        }
        case 'char': {
            const uniques: Set<string> = new Set()

            const data = x.value._data.filter(n => uniques.has(n) ? false : (uniques.add(n), true))

            return makeArray(data)
        }
        case 'box': {
            const uniques: Value[] = []

            const has = (v: Value) => uniques.some(u => match_values(u, v))

            const data = x.value._data.filter(n => has(n) ? false : (uniques.push(n), true))

            return makeArray(data)
        }
    }
}

export const group: Infix = (x, y) => {
    if (x.kind != 'num') throw "Domain Error"
    if (x.value.rank != 1) throw "Shape Error"

    let data: Slice[][] = []

    for (let i = 0; i < x.value._data.length; i++) {
        const n = x.value._data[i]

        if (n < 0) continue

        const slice = y.value.getFirst(i)

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

    const boxes = data.map(slices => <Value>({ kind: y.kind, value: y.value.select(slices)}))

    return { kind: 'box', value: new MultiArray([data.length], boxes)}
}

export const group_indices: Prefix = (x) => {
    if (x.kind != 'num') throw "Domain Error"
    if (x.value.rank != 1) throw "Shape Error"

    const data: number[][] = []

    x.value._data.forEach((n, i) => {
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
    if (pat.kind != x.kind) throw "Domain Error"

    if (x.value.rank == 0) throw "Rank Error"

    // if (pat.value.rank > x.value.rank) throw "Rank Error"
    // if (pat.value.rank < x.value.rank - 1) throw "Rank Error"

    if (pat.value.rank == 0) {
        return cmp_eq(pat, x)
    }

    if (pat.value.rank != x.value.rank) throw "Rank Error"

    const pat_len = pat.value.length ?? 0
    const x_len = x.value.length ?? 0

    if (pat_len > x_len) return makeEmpty()

    if (pat_len == x_len) {
        if (match_values(pat, x)) {
            return makeArray([1].concat(new Array(x_len-1).fill(0)))
        } else {
            return makeArray(new Array(x_len).fill(0))
        }
    }

    const pat_cells = pat.value.firstAxisToArray()
    const cells = x.value.firstAxisToArray()

    const result = new Array(x_len).fill(0)

    for (let i = 0; i < x_len - pat_len; i++) {
        let got = 1
        for (let j = 0; j < pat_cells.length; j++) {
            const pat_c = fromMultiArray(pat.value.slice(pat_cells[j]))
            const x_c = fromMultiArray(x.value.slice(cells[i + j]))

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
    return { kind: 'box', value: new MultiArray([], [x]) }
}

export const merge: Prefix = (x) => {
    if (x.kind != "box") throw "Domain Error"

    let first = x.value._data[0]

    const result = x.value._data.reduce((acc, v) => {
        if (acc.kind != v.kind) throw "Domain Error"

        if (!MultiArray.same_shape(first.value, v.value)) throw "Shape Error"

        return fromMultiArray(<any>acc.value.concat(<any>v.value))
    })

    

    return fromMultiArray(<any>result.value.reshape([...x.value._shape, ...first.value._shape]))
}

export const windows: Infix = (n, x) => {
    if (n.kind != "num") throw "Domain Error"
    if (n.value.rank != 0) throw "Rank Error"

    if (x.value.rank == 0) throw "Rank Error"

    const len = n.value._data[0]

    if (len <= 0) throw "Value Error"

    if (len >= x.value._shape[0]) throw "Value Error"

    let windows: Slice[] = []

    const span = x.value._shape[0] - len + 1

    for (let i = 0; i < span; i++) {
        let a = x.value.getFirst(i)
        let b = x.value.getFirst(i + len - 1)

        windows.push({ start: a.start, end: b.end, shape: [len, ...a.shape] })
    }

    let data: any[] = []

    for (let i = 0; i < windows.length; i++) {
        const slice = windows[i]
        
        data = data.concat(x.value._data.slice(slice.start, slice.end))
    }

    return <Value>({ kind: x.kind, value: new MultiArray([windows.length, ...windows[0].shape], data)})
}

export const solo: Prefix = (x) => {
    return <Value>{ kind: x.kind, value: x.value.reshape([1, ...x.value._shape]) }
}

function value_depth(v: Value): number {
    if (v.kind != 'box') return 0

    return 1 + Math.max(...v.value._data.map(value_depth))
}

export const depth: Prefix = (x) => {
    return makeScalar(value_depth(x))
}


function compare_values(a: Value, b: Value): number {
    const gt = cmp_gt(a, b)
    if (gt.kind != 'num') throw "Domain Error compare" + gt.kind
    if (gt.value.rank != 0) throw "Rank Error"
    if (gt.value._data[0] != 0) return 1

    const lt = cmp_lt(a, b)
    if (lt.kind != 'num') throw "Domain Error compare"
    if (lt.value.rank != 0) throw "Rank Error"
    if (lt.value._data[0] != 0) return -1

    return 0
}

export const grade_up: Prefix = (x) => {
    const slices = x.value.firstAxisToArray()
    const sliced = slices.map(s => x.value.slice(s))
    switch (x.kind) {
        case "num":
            if (x.value.rank == 1) {
                const indices = slices.map((_, i) => i).sort((a, b) => {
                    return <number>sliced[a]._data[0] - <number>sliced[b]._data[0]
                })
                return makeArray(indices)
            }

            throw "Rank Error"
        case "char": {
            if (x.value.rank == 1) {
                const strings = sliced.map(s => s._data.join(''))

                const indices = slices.map((_, i) => i).sort((a, b) => {
                    if (strings[a] > strings[b]) return 1
                    if (strings[a] < strings[b]) return -1
                    return 0
                })
                return makeArray(indices)
            }
    
            throw "Rank Error"
        }
        case "box": {
            if (x.value.rank == 1) {
                const indices = slices.map((_, i) => i).sort((a, b) => {
                    return compare_values(<Value>sliced[a]._data[0], <Value>sliced[b]._data[0])
                })
                return makeArray(indices)
            }
            throw "Rank Error"
        }
    }
}

export const grade_down: Prefix = (x) => {
    const slices = x.value.firstAxisToArray()
    const sliced = slices.map(s => x.value.slice(s))
    switch (x.kind) {
        case "num":
            if (x.value.rank == 1) {
                const indices = slices.map((_, i) => i).sort((a, b) => {
                    return (<number>sliced[a]._data[0] - <number>sliced[b]._data[0]) * -1
                })
                return makeArray(indices) 
            }

            throw "Rank Error"
        case "char": {
            if (x.value.rank == 1) {
                const strings = sliced.map(s => s._data.join(''))

                const indices = slices.map((_, i) => i).sort((a, b) => {
                    if (strings[a] > strings[b]) return -1
                    if (strings[a] < strings[b]) return 1
                    return 0
                })
                return makeArray(indices)
            }
    
            throw "Rank Error"
        }
        case "box": {
            if (x.value.rank == 1) {
                const indices = slices.map((_, i) => i).sort((a, b) => {
                    return compare_values(<Value>sliced[a]._data[0], <Value>sliced[b]._data[0]) * -1
                })
                return makeArray(indices)
            }
            throw "Rank Error"
        }
    }
}

export const under_indices: Prefix = (x) => {
    if (x.kind != 'num') throw "Domain Error"
    if (x.value.rank != 1) throw "Shape Error"

    const data: number[] = []

    x.value._data.forEach(n => {
        if (n < 0) return

        if (data[n] == undefined) data[n] = 0

        data[n] += 1
    })

    for (let i = 0; i < data.length; i++) {
        if (data[i] == undefined) data[i] = 0
    }

    return makeArray(data)
}

export const reduce: (f: Infix) => Prefix = (f) => (w) => {
    if (w.value.length == undefined) return w

    switch (w.kind) {
        case "num":
            return fromMultiArray(w.value.reduce((a, b) => {
                const x = makeScalar(a)
                const y = makeScalar(b)

                return (<number>(f(x, y).value._data[0]))
            }))
        case "char":
            return fromMultiArray(w.value.reduce((a, b) => {
                const x = makeChar(a)
                const y = makeChar(b)

                return (<string>(f(x, y).value._data[0]))
            }))
        case "box":
            return fromMultiArray(w.value.reduce(f))
    }
}

{
    const a = MultiArray.from([1, 2, 3, 4, 5, 6]).reshape([2, 3])
    
    const r = a.reduce((a, b) => a + b)

    console.log(r)
}

// console.log((new MultiArray([2, 2, 3], [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])).get([0, 0, -1]))

// console.log((new MultiArray([2, 2], [1, 2, 3, 4])).joinLast(new MultiArray([], [5])))
// console.log(MultiArray.from('<>>><<').map(s => +(s == '>') - +(s == '<')).reduce((a, b) => a + b))
