import { MultiArray } from "./multiarray.ts"
import * as Functions from "./functions.ts"
import { Value, Prefix, Infix } from "./functions.ts"
import { parse, Expr, ExprKind, tokenize, Token, TokenType, pretty_expr } from "./parser.ts"

type FuncDesc = [Prefix | null, Infix | null]
type ValueMap = { [name: string]: Value | undefined }
type FuncMap = { [name: string]: FuncDesc | undefined }
type MonadMap = { [name: string]: ((f: FuncDesc) => FuncDesc) | undefined }
type DyadMap = { [name: string]: ((f: FuncDesc, g: FuncDesc) => FuncDesc) | undefined }

class SaliteError extends Error {
    span: number | undefined

    constructor(message: string, col?: number) {
        super(message)
        this.name = "Evaluation Error"
        this.span = col
    }
}

class SaliteArityError extends SaliteError {
    at?: string
    expected: 1 | 2

    constructor(expected: 1 | 2, at?: string, col?: number) {
        let _a = expected == 1 ? 'prefix' : 'infix'
        let message = `Arity Error: Function is not ${_a}`
        if (at) {
            message = `Arity Error: Function at ${at} is not ${_a}`
        }
        super(message, col)
        this.name = "Arity Error"
        this.at = at
        this.expected = expected
    }
}

function pretty_value_(v: Value): string[] {
    if (v == undefined) return ['ERR']

    if (v.value._data.length == 0) return ['ø']

    switch (v.kind) {
        case "num": {
            if (v.value.rank == 0) return [`${v.value._data[0]}`]

            if (v.value.rank == 1) {
                return [`[ ${v.value._data.map(n => String(n)).join(' ')} ]`]
            }

            let i = 0
            let last = v.value._strides[v.value._strides.length-2]
            let strings = []
            let col_max = Array(last).fill(0)
            while (i < v.value._data.length) {
                if (i != 0 && v.value._strides.slice(0, -2).some(n => i % n == 0)) strings.push([""])

                const row_string = v.value._data.slice(i, i + last).map(n => String(n))

                row_string.forEach((s, i) => { if (s.length > col_max[i]) col_max[i] = s.length })

                strings.push(row_string)
                i += last
            }

            const padded = strings.map(s => s.map((s, i) => s.padStart(col_max[i])).join(' '))

            return [
                `┌─`.padEnd(padded[0].length+4),
                `╵ ${padded[0]}`,
                ...padded.slice(1).map(x => '  ' + x),
                `${' '.repeat(padded[0].length+3)}┘`
            ]
        }
        case "char": {
            if (v.value.rank == 0) return [`'${v.value._data[0]}'`]

            if (v.value.rank == 1) return [`'${v.value._data.join('')}'`]

            let i = 0
            let last = v.value._strides[v.value._strides.length-2]
            let strings = []
            while (i < v.value._data.length) {
                if (i != 0 && v.value._strides.slice(0, -2).some(n => i % n == 0)) strings.push("")
                strings.push(v.value._data.slice(i, i + last).join(''))
                i += last
            }

            return strings.map((s, i) => (i > 0 ? ' ' : '"') + s + ( i == strings.length - 1 ? '"' : ' '))
        }
        case "box": {
            let strings = v.value._data.map(pretty_value_)

            let len = Math.max(...strings.map(ss => ss[0].length))

            let hei = Math.max(...strings.map(ss => ss.length))

            if (hei == 1 && v.value.rank == 1) {
                return [
                    `⟨ ${strings.map(ss => ss.join(' ')).join(' ')} ⟩`
                ]
            }

            if (v.value.rank == 2 && hei == 1) {
                let new_strings: string[] = []

                let last = v.value._shape[1]
                let first = v.value._shape[0]

                const them = strings.map(s => s[0].padEnd(len))

                for (let i = 0; i < first; i++) {
                    const element = them.slice(i * last, (i+1) * last).join(' ')
                    new_strings.push(element)
                }

                len = new_strings[0].length

                return [
                    `┌~${v.value._shape.join(' ')}`.padEnd(len+3),
                    `╵ ${new_strings[0]}`,
                    ...new_strings.slice(1).map(s => '  ' + s),
                    `${' '.repeat(len+3)}┘`
                ]
            }

            if (v.value.rank == 0) {
                return [
                    `┌∙`.padEnd(len+4),
                    `╵ ${strings[0][0]}`,
                    ...strings[0].slice(1).map(s => '  ' + s),
                    `${' '.repeat(len+3)}┘`
                ]
            }

            return [
                `┌~${v.value._shape.join(' ')}`.padEnd(len+4),
                `╵ ${strings[0][0]}`,
                ...strings[0].slice(1).map(s => '  ' + s),
                ...strings.slice(1).flatMap(s => s.map(s => '  ' + s).join('\n')),
                `${' '.repeat(len+3)}┘`
            ]
        }
    }
}

const builtin_functions: FuncMap = {
    '+': [Functions.id, Functions.add],
    '-': [Functions.neg, Functions.sub],
    '*': [Functions.sign, Functions.mult],
    '%': [Functions.recp, Functions.div],
    '^': [Functions.exp, Functions.pow],
    '√': [Functions.sqrt, Functions.root],
    ':%': [Functions.abs, Functions.mod],
    ':^': [Functions.ln, Functions.log],
    ':-': [Functions.floor, Functions.min],
    ':+': [Functions.ceil, Functions.max],
    '∧': [Functions.grade_up, Functions.and],
    '∨': [Functions.grade_down, Functions.or],
    '~': [Functions.not, Functions.windows ],

    '≤': [null, Functions.cmp_le],
    '<': [Functions.enclose, Functions.cmp_lt],
    '≥': [null, Functions.cmp_ge],
    '>': [Functions.merge, Functions.cmp_gt],
    '=': [Functions.length, Functions.cmp_eq],
    '≠': [Functions.rank, Functions.cmp_ne],
    ':=': [Functions.count, Functions.match],
    ':≠': [Functions.depth, Functions.not_match],

    ';': [Functions.deshape, Functions.join],
    ':;': [Functions.solo, Functions.couple],

    'ι': [Functions.iota, Functions.indexof],
    'ρ': [Functions.shape, Functions.reshape],
    'φ': [Functions.reverse, Functions.rotate],
    'μ': [Functions.group_indices, Functions.group],

    'ε': [Functions.mark_firsts, Functions.membership],
    ':ε': [Functions.unique, Functions.find],

    '$': [Functions.indices, Functions.replicate],

    '⊣': [Functions.id, Functions.left],
    '⊢': [Functions.id, Functions.right],

    '¢': [Functions.first, Functions.pick],
    ':¢': [Functions.first_cell, Functions.select],

    ':<': [null, Functions.take],
    ':>': [null, Functions.drop],

    'Box': [(x) => {
        return Functions.fromMultiArray(x.value.map(Functions.chooseScalar))
    }, null], 
    

    'δ': [(w) => Functions.makeString(pretty_value(w)), (op, w) => {
        if (op.kind != 'num') throw "Domain Error"

        let n = op.value._data[0]

        switch (n) {
            case 0:
                if (w.kind != 'num') throw "Domain Error"
                return Functions.makeChar(String.fromCharCode(w.value._data[0]))
            default:
                return Functions.makeString(pretty_value(w))
        }
    }],
    ':δ': [(w) => {
        if (w.kind != 'char') throw "Domain Error"
        return Functions.makeScalar(parseFloat(w.value._data.join(''))) 
    }, (op, w) => {
        if (w.kind != 'char') throw "Domain Error"
        if (op.kind != 'num') throw "Domain Error"

        let str = w.value._data.join('')
        let n = op.value._data[0]

        switch (n) {
            case 0: return Functions.makeScalar(str.charCodeAt(0))
            case 1: return Functions.makeScalar(parseInt(str))
            default:
                return Functions.makeScalar(parseInt(str, n)) 
        }
    }],
    'Shout': [(w) => (alert(pretty_value(w)), w), null],
    '!': [(w) => {
        if (w.value._data[0] == undefined) throw "Error"

        const val = w.value._data[0]

        if (typeof val == 'number' && val == 0) {
            throw "Error"
        }

        return w
    }, null],
    'Fill': [null, (a, w) => {
        if (a.kind != 'num') throw "Domain Error"
        if (a.value.rank != 0) throw "Rank Error"
        const n = Math.floor(a.value._data[0])
        if (n < 0) throw "Lenght Error"

        const span = w.value._shape[0] ?? 1
        const spanned = Math.max(n - span, 0)
        const stride = w.value._strides[0] ?? 1

        const filler = new Array(spanned*stride)

        const new_shape = [n, ...w.value._shape.slice(1)]

        switch (w.kind) {
            case 'num': return <Value>{ kind: 'num', value: new MultiArray(new_shape, w.value._data.concat(filler.fill(0))) }
            case 'char': return <Value>{ kind: 'char', value: new MultiArray(new_shape, w.value._data.concat(filler.fill(' '))) }
            case 'box': return <Value>{ kind: 'box', value: new MultiArray(new_shape, w.value._data.concat(filler.fill(Functions.makeEmpty()))) }
        }
    }],
    '?': [null, (a, w) => {
        if (w.value._data[0] == undefined) return a
        return w
    }],
}

const builtin_functions_undo: { [name: string]: [((before: Value) => Prefix) | null, ((func: Prefix) => Infix) | null] | undefined } = {
    '+': [() => Functions.id, (f) => (a, w) => Functions.sub(f(w), a)],
    '⊣': [() => Functions.id, null],
    '⊢': [() => Functions.id, null],
    '-': [() => Functions.neg, (f) => (a, w) => Functions.add(f(w), a)],
    '~': [() => Functions.not, null],
    'φ': [() => Functions.reverse, (f) => (a, w) => Functions.rotate(Functions.neg(a), f(w))],

    '%': [() => Functions.recp, (f) => (a, w) => Functions.div(f(w), a)],
    '^': [() => Functions.ln, (f) => (a, w) => Functions.log(a, f(w))],
    '√': [() => (x) => Functions.mult(x, Functions.makeScalar(2)), (f) => (a, w) => Functions.pow(f(w), a)],
    ':^': [() => Functions.exp, (f) => (a, w) => Functions.pow(a, f(w))],

    '<': [() => Functions.first, null],

    ';': [(before) => (x) => Functions.reshape(Functions.shape(before), x), null],
    ':;': [() => Functions.first_cell, null],

    'ρ': [(before) => (x) => Functions.reshape(x, before), (f) => (_, w) => Functions.reshape(Functions.shape(w), f(w))],

    '¢': [(before) => (x) => {
        const new_data = [...before.value._data]

        if (x.kind != before.kind) throw "Domain Error"
        if (x.value.rank != 0) throw "Rank Error"

        new_data[0] = x.value._data[0]

        return Functions.fromMultiArray(new MultiArray(before.value._shape, new_data, before.value._strides))
    }, null],
    ':¢': [(before) => (x) => {
        const new_data = [...before.value._data]

        if (x.kind != before.kind) throw "Domain Error"

        if (x.value._shape.length != before.value._shape.length - 1) throw "Shape Error"
        
        if (before.value._shape.slice(1).every((n, i) => n == x.value._shape[i]) == false) throw "Shape Error"

        const vals = x.value._data

        for (let index = 0; index < vals.length; index++) {
            new_data[index] = vals[index]
        }

        return Functions.fromMultiArray(new MultiArray(before.value._shape, new_data, before.value._strides))
    }, null],
    '$': [() => Functions.under_indices, (f) => (a, w) => {
        if (a.kind != 'num') throw "Domain Error"
        if (a.value.rank != 1) throw "Rank Error"
        
        const indices = <number[]>a.value._data

        if (indices.length != w.value.length) throw "Length Error"
        
        const cells = w.value.firstAxisToArray().map(s => w.value.slice(s))

        let data: any[] = []

        for (let i = 0; i < indices.length; i++) {
            const n = indices[i];
            if (n == 0) {
                data = data.concat(cells[i]._data)
            } else {
                const result = f(Functions.fromMultiArray(cells[i]))

                if (result.kind != w.kind) throw "Domain Error"
                if (result.value.rank != w.value.rank - 1) throw "Rank Error"
                if (!result.value._shape.every((n, i) => n == w.value._shape[i+1])) throw "Shape Error"

                data = data.concat(result.value._data)
            }
        }

        return { kind: w.kind, value: new MultiArray(w.value._shape, data, w.value._strides)}
    }],
}

const builtin_monads: MonadMap = {
    '/': ([alpha1, alpha2]) => {
        if (alpha2 == null) throw "An error"

        return [ Functions.reduce(alpha2), null ]
    },
    '\\': ([alpha1, alpha2]) => {
        if (alpha2 == null) throw "An error"

        return [ (w) => {
            const slices = w.value.firstAxisToArray()

            const new_cells = [w.value.slice(slices[0])]

            slices.slice(1).forEach((slice, i: number) => {
                const a_ = new_cells[i]
                const w_ = w.value.slice(slice)
                const val = alpha2(<Value>{ kind: w.kind, value: a_}, <Value>{ kind: w.kind, value: w_})
                if (val.kind != w.kind) throw "Domain Error"
                new_cells.push(val.value)
            })
            
            return Functions.fromMultiArray(<any>new_cells.reduce((a, b) => a.concat(<any>b)))
        }, null ]
    }, 
    '§': ([alpha1, alpha2]) => {
        if (alpha2 == null) throw "An error"
        return [ (w) => alpha2(w, w), (a, w) => alpha2(w, a) ]
    },
    '.pair': ([alpha1, alpha2]) => {
        if (alpha2 == null) throw "An error"
        return [ (w) => {
            
            
            switch (w.kind) {
                case 'num': {
                    const cells = w.value._data.slice(1).map((c, i) => alpha2(Functions.makeScalar(w.value._data[i]), Functions.makeScalar(c)))

                    if (cells[0].value.rank == 0) {
                        return Functions.makeArray(<any>cells.map(v => v.value._data[0]))
                    }

                    return Functions.makeArray(cells)
                }
                case 'char': {
                    const cells = w.value._data.slice(1).map((c, i) => alpha2(Functions.makeChar(w.value._data[i]), Functions.makeChar(c)))

                    if (cells[0].value.rank == 0) {
                        return Functions.makeArray(<any>cells.map(v => v.value._data[0]))
                    }

                    return Functions.makeArray(cells)
                }
                case 'box': {
                    const cells = w.value._data.slice(1).map((c, i) => alpha2(w.value._data[i], c))

                    if (cells[0].value.rank == 0) {
                        return Functions.makeArray(<any>cells.map(v => v.value._data[0]))
                    }

                    return Functions.makeArray(cells)
                }
            }
            
        }, null ]
    },
    '¨': ([alpha1, alpha2]) => {
        return [ (w) => {
            if (alpha1 == null) throw "Function at ¨ is not prefix"

            let data: Value[] = []
            let data_n: number[] | null = []
            let data_c: string[] | null = []

            for (let index = 0; index < w.value._data.length; index++) {
                const result = alpha1(Functions.chooseScalar(w.value._data[index]))

                if (data_n) {
                    if (result.kind == 'num' && result.value.rank == 0) {
                        data_n.push(result.value._data[0])
                    } else {
                        data_n = null
                    }
                } 
                
                if (data_c) {
                    if (result.kind == 'char' && result.value.rank == 0) {
                        data_c.push(result.value._data[0])
                    } else {
                        data_c = null
                    }
                }

                data.push(result)
            }

            if (data_n) {
                return { kind: 'num', value: new MultiArray(w.value._shape, data_n, w.value._strides)}
            }

            if (data_c) {
                return { kind: 'char', value: new MultiArray(w.value._shape, data_c, w.value._strides)}
            }

            return Functions.fromMultiArray(new MultiArray(w.value._shape, data, w.value._strides))
        }, (a, w) => {
            if (alpha2 == null) throw "Function at ¨ is not infix"

            const a_arr = a.value
            const w_arr = w.value
            const zipped = MultiArray.zip(<MultiArray<any>>a_arr, <MultiArray<any>>w_arr, (a: any, w: any) => alpha2(Functions.chooseScalar(a), Functions.chooseScalar(w)))

            let kind = zipped._data.map(v => v.kind).reduce((acc, x) => acc == x ? acc : 'box')
            let scalars = zipped._data.every(v => v.value.rank == 0)

            if (kind == 'num' && scalars) {
                return Functions.fromMultiArray(zipped.map(v => <number>v.value._data[0]))
            } else if (kind == 'char' && scalars) {
                return Functions.fromMultiArray(zipped.map(v => <string>v.value._data[0]))
            }

            return Functions.fromMultiArray(zipped)
        } ]
    },
    '´': ([alpha1, alpha2]) => {
        return [ (w) => {
            if (alpha1 == null) throw "Function at .¨ is not prefix"

            const vals = w.value._data.map((n: any) => alpha1(Functions.chooseScalar(n)))
            let kind = vals.map(v => v.kind).reduce((acc, x) => acc == x ? acc : 'box')
            let scalars = vals.every(v => v.value.rank == 0)

            if (kind == 'num' && scalars) {
                return Functions.makeArray(vals.map(v => <number>v.value._data[0]))
            } else if (kind == 'char' && scalars) {
                return Functions.makeArray(vals.map(v => <string>v.value._data[0]))
            }

            return Functions.fromMultiArray(new MultiArray(w.value._shape, vals, w.value._strides))
        }, (a, w) => {
            if (alpha2 == null) throw "Function at .¨ is not infix"

            const a_arr = a.value.firstAxisToArray()
            const w_arr = w.value.firstAxisToArray()

            let data: Value[] = []
            let data_n: number[] | null = []

            for (const a_slice of a_arr) {
                for (const w_slice of w_arr) {
                    const x = Functions.fromMultiArrayUnwrap(a.value.slice(a_slice))
                    const y = Functions.fromMultiArrayUnwrap(w.value.slice(w_slice))

                    const result = alpha2(x, y)

                    if (data_n) {
                        if (result.kind == 'num' && result.value.rank == 0) {
                            data_n.push(result.value._data[0])
                        } else {
                            data_n = null
                        }
                    }

                    data.push(result)
                }
            }

            if (data_n) {
                return { kind: 'num', value: new MultiArray([a_arr.length, w_arr.length], data_n)}
            }
            
            return { kind: 'box', value: new MultiArray([a_arr.length, w_arr.length], data)}
        } ]
    },
    '`': ([alpha1, alpha2]) => {
        return [ (w) => {
            if (alpha1 == null) throw "Function at ` is not prefix"

            let data: Value[] = []
            let data_n: number[] | null = []
            let data_c: string[] | null = []

            let shape: number[] | null = null

            for (let index = 0; index < w.value._shape[0]; index++) {
                const slice = w.value.getFirst(index)

                const result = alpha1(Functions.fromMultiArray(w.value.slice(slice)))

                if (shape == null) {
                    shape = result.value._shape
                } else {
                    if (result.value._shape.length != shape.length || !result.value._shape.every((n, i) => n == (<number[]>shape)[i])) throw "Shape Error"
                }

                if (data_n) { if (result.kind == 'num') { data_n = data_n.concat(result.value._data) } else { data_n = null } }
                
                if (data_c) { if (result.kind == 'char') { data_c = data_c.concat(result.value._data) } else { data_c = null } }

                if (result.kind == 'box') {
                    data = data.concat(result.value._data)
                }
            }

            if (shape == null) return Functions.makeEmpty()

            if (data_n) {
                return { kind: 'num', value: new MultiArray([w.value._shape[0], ...shape], data_n)}
            }

            if (data_c) {
                return { kind: 'char', value: new MultiArray([w.value._shape[0], ...shape], data_c)}
            }

            return Functions.fromMultiArray(new MultiArray([w.value._shape[0], ...shape], data))
        }, null ]
    },
    '.sum': ([alpha1, alpha2]) => {
        if (alpha2 == null) throw "Function at .for is not infix"
        return [ (w) => {
            
            let data_n = 0

            for (let index = 0; index < w.value._data.length; index++) {
                const result = alpha2(Functions.chooseScalar(index), Functions.chooseScalar(w.value._data[index]))

                if (!(result.kind == 'num' && result.value.rank == 0)) {
                    throw "Domain Error"
                }

                data_n += result.value._data[0]
            }

            return Functions.makeScalar(data_n)
        }, (a, w) => {
            if (a.kind != 'num') throw "Domain Error"
            if (a.value.rank != 0) throw "Rank Error"

            const step = a.value._data[0] ?? 1

            let data_n = 0

            for (let index = 0; index < w.value._data.length; index++) {
                const result = alpha2(Functions.chooseScalar(step ** index), Functions.chooseScalar(w.value._data[index]))

                if (!(result.kind == 'num' && result.value.rank == 0)) {
                    throw "Domain Error"
                }

                data_n += result.value._data[0]
            }

            return Functions.makeScalar(data_n)
        }]
    }
}

const builtin_dyads: DyadMap = {
    '•': ([alpha1, alpha2], [omega1, omega2]) => {
        if (alpha1 == null) throw "Left function at • is not prefix"
        return [
            (w) => { if (omega1 == null) throw "Right function at • is not prefix"; return alpha1(omega1(w)) },
            (a, w) => { if (omega2 == null) throw "Right function at • is not infix"; return alpha1(omega2(a, w))}
        ]
    },
    '°': ([alpha1, alpha2], [omega1, omega2]) => {
        if (omega1 == null) throw "Right function at ° is not prefix"
        return [
            (w) => { if (alpha1 == null) throw "Left function at ° is not prefix"; return alpha1(omega1(w)) },
            (a, w) => { if (alpha2 == null) throw "Left function at ° is not infix"; return alpha2(omega1(a), omega1(w)) }
        ]
    },
    '→': ([alpha1, alpha2], [omega1, omega2]) => {
        if (omega2 == null) throw "Right function at → is not infix"
        if (alpha1 == null) throw "Left function at → is not prefix"
        return [
            (w) => omega2(alpha1(w), w),
            (a, w) => omega2(alpha1(a), w)
        ]
    },
    '←': ([alpha1, alpha2], [omega1, omega2]) => {
        if (alpha2 == null) throw "Left function at ← is not infix"
        if (omega1 == null) throw "Right function at ← is not prefix"
        return [
            (w) => alpha2(w, omega1(w)),
            (a, w) => alpha2(a, omega1(w))
        ]
    },
    '↑': ([alpha1, alpha2], [omega1, omega2]) => {
        return [
            (w) => {
                if (alpha1 == null) throw "Left function at ↑ is not prefix"
                if (omega1 == null) throw "Right function at ↑ is not prefix"

                const n_ = omega1(w)
                if (n_.kind != 'num') throw "Domain Error"
                if (n_.value.rank != 0) throw "Rank Error"
            
                const n = n_.value._data[0] ?? 0

                let result = w
                for (let i = 0; i < n; ++i) { result = alpha1(result) }
                return result
            },
            (a, w) => {
                if (alpha2 == null) throw "Left function at ↑ is not infix"
                if (omega2 == null) throw "Right function at ↑ is not infix"
                const n_ = omega2(a, w)
                if (n_.kind != 'num') throw "Domain Error"
                if (n_.value.rank != 0) throw "Rank Error"
                const n = n_.value._data[0] ?? 0
                let result = w
                for (let i = 0; i < n; ++i) { result = alpha2(a, result) }
                return result
            },
        ]
    },
    '¤': ([alpha1, alpha2], [omega1, omega2]) => {
        throw "Can't find under for the function"
    },
    '@': ([alpha1, alpha2], [omega1, omega2]) => {
        if (alpha1 == null) "Left function at @ is not prefix"
        if (omega2 == null) "Right function at @ is not prefix"
        return [ alpha1, omega2 ]
    },
}

export function pretty_value(v: Value): string {
    return pretty_value_(v).join('\n')
}

function evaluate_func(e: Expr, self: FuncDesc, globals: ValueMap, funcs: FuncMap): FuncDesc {
    switch (e.kind) {        
        case ExprKind.Func: {
            if (e.name == 'λ') return self

            let v = builtin_functions[e.name]
            if (v === undefined) v = funcs[e.name]
            if (v === undefined) throw new SaliteError(`Name Error: Undefined name ${e.name}`)
            return v
        }
        case ExprKind.Monad: {
            const alpha = evaluate_func(e.alpha, self, globals, funcs)

            const monad = builtin_monads[e.mod]
            if (!monad) throw new SaliteError(`Name Error: Undefined name ${e.mod}`)

            return monad(alpha)
        }
        case ExprKind.Dyad: {

            if (e.mod === '¤' && e.omega.kind == ExprKind.Func) {
                const undo = builtin_functions_undo[e.omega.name]
                const do_f = builtin_functions[e.omega.name]
                if (!do_f) throw new SaliteError(`Name Error: Undefined name ${e.omega.name}`)
                const [do1, do2] = do_f
                if (undo) {
                    const [undo1, undo2] = undo
                    const [alpha1, alpha2] = evaluate_func(e.alpha, self, globals, funcs)
                    if (alpha1 == null) throw "Left function at ¤ is not prefix";
                    return [
                        (w) => {
                            if (undo1 === null) throw "Can't find undo for function"
                            const g = undo1(w)
                            if (!do1) throw "Function is not prefix"
                            return g(alpha1(do1(w)))
                        },
                        (a, w) => {
                            if (!undo2) throw "Can't find undo for function"
                            return undo2(alpha1)(a, w)
                            // const g = undo2(a, w, alpha1)
                            // if (!do2) throw "Function is not infix"
                            // return g(alpha1(do2(a, w)))
                        }
                    ]
                }
            }

            const alpha = evaluate_func(e.alpha, self, globals, funcs)
            const omega = evaluate_func(e.omega, self, globals, funcs)

            const dyad = builtin_dyads[e.mod]
            if (!dyad) throw new SaliteError(`Name Error: Undefined name ${e.mod}`)

            return dyad(alpha, omega)
        }
        case ExprKind.Fork: {
            const [alpha1,alpha2] = evaluate_func(e.alpha, self, globals, funcs)
            const [omega1,omega2] = evaluate_func(e.omega, self, globals, funcs)
            const [_3, infix] = evaluate_func(e.infix, self, globals, funcs)

            if (infix == null) {
                throw new SaliteArityError(2, 'middle of fork')
            }

            return [(w) => {
                if (alpha1 == null) throw new SaliteArityError(1, 'left of fork')
                if (omega1 == null) throw new SaliteArityError(1, 'right of fork')
                return infix(alpha1(w), omega1(w))
            }, (a, w) => {
                if (alpha2 == null) throw new SaliteArityError(2, 'left of fork')
                if (omega2 == null) throw new SaliteArityError(2, 'right of fork')
                return infix(alpha2(a, w), omega2(a, w))
            }]
        }
        case ExprKind.Train: {
            const [alpha1,_] = evaluate_func(e.alpha, self, globals, funcs)
            const [omega1,omega2] = evaluate_func(e.omega, self, globals, funcs)

            if (alpha1 == null) throw new SaliteArityError(1, 'left of atop')
            return [
                (w) => { if (omega1 == null) throw new SaliteArityError(1, 'right of atop'); return alpha1(omega1(w)) },
                (a, w) => { if (omega2 == null) throw new SaliteArityError(2, 'right of atop'); return alpha1(omega2(a, w))}
            ]
        }
        case ExprKind.Defn: {
            const rec: FuncDesc = [
                (w) => evaluate(e.fn, rec, { 'α': Functions.makeEmpty(), 'ω': w, ...globals}, funcs),
                (a, w) => evaluate(e.fn, rec, { 'α': a, 'ω': w, ...globals}, funcs)
            ]
            return rec
        }
        default: {
            const val = evaluate(e, self, globals, funcs)
            return [() => val, () => val]
        }
    }
}

function evaluate(e: Expr, self: FuncDesc, globals: ValueMap, funcs: FuncMap): Value {
    switch (e.kind) {
        case ExprKind.Number:
            return Functions.makeScalar(e.value)

        case ExprKind.String:
            if (e.value.length == 1) {
                return Functions.makeChar(e.value)    
            }

            return Functions.makeString(e.value)
        
        case ExprKind.Id: {
            let v = globals[e.value]
            if (v === undefined) throw new SaliteError(`Name Error: Undefined name ${e.value}`)
            return v
        }

        case ExprKind.Vector: {
            if (e.value.length == 0) {
                return Functions.makeEmpty()
            }

            if (e.vkind == 'num') {
                const vals = e.value.map(e => (<{value: number}>e).value)
                return Functions.makeArray(vals)
            }

            let vals = e.value.map(e => evaluate(e, self, globals, funcs))
            let kind = vals.map(v => v.kind).reduce((acc, x) => acc == x ? acc : 'box')
            let scalars = vals.every(v => v.value.rank == 0)

            if (kind == 'num' && scalars) {
                return Functions.makeArray(vals.map(v => <number>v.value._data[0]))
            } else if (kind == 'char' && scalars) {
                return Functions.makeArray(vals.map(v => <string>v.value._data[0]))
            }

            return Functions.makeArray(vals)
        }
        

        case ExprKind.Prefix: {
            let func = evaluate_func(e.func, self, globals, funcs)[0]
            if (func === null) throw new SaliteArityError(1)

            let omega = evaluate(e.omega, self, globals, funcs)

            let result = func(omega)
            return result
        }

        case ExprKind.Infix: {
            // if (e.func.kind == ExprKind.Func) {
            //     switch (e.func.name) {
            //     case '⊣': 
            //         return evaluate(e.alpha, globals, funcs, monads, dyads)
            //     case '⊢': 
            //         return evaluate(e.omega, globals, funcs, monads, dyads)
            //     }
            // }

            let func = evaluate_func(e.func, self, globals, funcs)[1]
            if (func === null) throw new SaliteArityError(2)

            let alpha = evaluate(e.alpha, self, globals, funcs)
            let omega = evaluate(e.omega, self, globals, funcs)

            let result = func(alpha, omega)
            return result
        }

        default:
            console.log(e)
            throw `Value Error: Not a value - ${pretty_expr(e)}`
    }
}

export function run(expr: string, globals: ValueMap): Value {
    let ast = parse(expr)

    let funcs: FuncMap = {}

    for (const name in ast.funcs) {
        const fast = ast.funcs[name]
        const desc = evaluate_func(fast, [null, null], globals, funcs)
        funcs[name] = desc
    }

    for (const name in ast.vars) {
        const val = evaluate(ast.vars[name], [null, null], globals, funcs)
        globals[name] = val
    }

    let result = evaluate(ast.expr, [null, null], globals, funcs)

    return result
}

export function tokens(expr: string): { kind: string, text: string }[] | null {
    const table: { [kind: number]: string | undefined } = {
        [TokenType.Func]: 'func',
        [TokenType.Monad]: 'monad',
        [TokenType.Dyad]: 'dyad',
        [TokenType.Number]: 'const',
        [TokenType.Empty]: 'const',
        [TokenType.String]: 'string',
        [TokenType.Error]: 'error',
        [TokenType.Comment]: 'comment',
    }

    try {
        const tks = tokenize(expr, true)
        let code = []
        let col = 0
        for (const tk of tks) {
            if (tk.col === undefined) continue
            
            const start = tk.col[0]
            const end = tk.col[1]

            const start_text = expr.slice(col, start)

            if (start_text.length > 0) {
                code.push({ kind: 'none', text: expr.slice(col, start) })
            }
            
            const end_kind = table[tk.kind] ?? 'none'

            code.push({ kind: end_kind, text: expr.slice(start, end) })

            col = end
        }
        return code
    } catch {
        return null
    }
}

export const symbol_overstrike = {
    '√': '-/',
    '∧': '/\\',
    '∨': '\\/',
    '≤': '<_',
    '≥': '>_',
    '≠': '=/',
    ':≠': ':=/',
    'ι': 'ii',
    'ρ': 'pp',
    'φ': 'o|',
    'μ': 'uu',
    'ε': 'ee',
    ':ε': ':ee',
    '⊣': '-|',
    '⊢': '|-',
    '¢': 'c|',
    ':¢': ':c|',
    'δ': 'dd',
    ':δ': ':dd',
    '¨': '::',
    '´': '``',
    '§': 'ss',
    '•': '..',
    '°': 'oo',
    '¤': 'ox',
    '→': '->',
    '←': '<-',
    '↑': '|^',
    '∞': '8_',
    'π': 'pi',
    'α': 'aa',
    'λ': 'll',
    'ω': 'ww',
    '¬': '--',
    'ø': 'o/',
}

// ΓΞΔΠΣΘΛΨΩ @!&|
export const symbol_names = {
    functions: {
        '+': ['Id', 'Add'],                    // Id --- ArithIn
        '-': ['Negation', 'Subtract'],         // ArithPre --- ArithIn
        '*': ['Sign', 'Multiply'],
        '%': ['Reciprocal', 'Divide'],
        '^': ['Exponential', 'Power'],
        ':%': ['Absolute', 'Modulus'],
        '√': ['Square Root', 'Root'],
        ':^': ['Natural Log', 'Logarithm'],
        ':-': ['Floor', 'Minimun'],
        ':+': ['Ceil', 'Maximum'],

        '∧': ['Grade Up' , 'And'],        // num-1 --- ArithIn
        '∨': ['Grade Down' , 'Or'],       // num-1 --- ArithIn
        '~': ['Not', 'Windows' ],         // ArithPre --- any

        '≤': [null, 'Less Equals'],        // --- Comp
        '<': ['Enclose', 'Less Than'],     // box-0 --- Comp
        '≥': [null, 'greater Equals'],     // --- Comp
        '>': ['Merge', 'greater Than'],    // box --- Comp
        '=': ['Length', 'Equals'],         // num-0 --- MatchComp
        '≠': ['Rank', 'Not Equals'],       // num-0 --- MatchComp
        ':=': ['Count', 'Match'],          // num-0 --- num-0
        ':≠': ['Depth' , 'Not Match'],         //       --- num-0

        ';': ['Deshape', 'Join'],          // a -> a-1 --- a -> a -> a
        ':;': ['Solo', 'Couple'],          // a -> a   --- a -> b -> c

        'ι': ['Range', 'Indexof'],         // num-1 --- num-1
        'ρ': ['Shape', 'Reshape'],         // num-1 --- any
        'φ': ['Reverse', 'Rotate'],        // any   --- any
        'μ': ['Group Indices', 'Group'],   // box   --- box

        'ε': ['Mark Firsts', 'Membership'],
        ':ε': ['Unique', 'Find'],

        '$': ['Indices', 'Replicate'],

        '⊣': ['Id', 'Left'],
        '⊢': ['Id', 'Right'],

        '¢': ['First', 'Pick'],
        ':¢': ['First Cell', 'Select'],

        ':<': [null, 'Take'],
        ':>': [null, 'Drop'],
        

        'δ': ['Format', 'Format'],
        ':δ': ['Parse', 'Parse Radix'],
        '!': ['Assert', 'Assert'],
    },
    monads: {
        '/':  'Fold',
        '\\': 'Scan',
        '¨': 'Each',
        '`': 'Cells',
        '´': 'Table',
        '§': 'Self/Swap',
    },
    dyads: {
        '•': 'Atop',
        '°': 'Over',
        '¤': 'Under',
        '→': 'Bind Right',
        '←': 'Bind Left',
        '↑': 'Repeat',
        '@': 'Choose',
    }
}

// (:+/+(+/2→*)) 1→φ→* [2,2,1]
// (+\=←' ')→μ 'Turok era um indio normal'
// ¢;/(δ•=;¢)¨(0→;(+\≠.^))→μ '11133'

// (ι•=φ¨<) 'rotate'

// :ε→(⊣:;=¨•(ιμ⊢)) 'mississipi'
// (:ε:;(=¨:ε→ι→μ)) 'mississipi'

// ¢+/(<+\→*•=¨:ε) 'mississippi'

// (<:≤§¨ι•(1→+)•=) 'abcde'

// (∧/0==:%{=¨:ε→ι→μ¢;/ω}) ['sus', 'su', 'ssus']

// :ε→{α:;α($=)¨<ω} 'mississippi'

// ' abc' ({φ∧\φαεω} ~→$ ⊢) 'atypica bb bb  ' 
// 'atypica bb bb  ' (∧\¤φ•ε ~→$⊣) ' abc'

// {(∧\¤φ ' '→=ω) ~→$ ω} 'When the  '


// [' ', ','] <→((1¢⊣)↑(¢→ε)¨) 'this space will comma'

// 'sauce' {¢;/α(:¢;((=α)→:≥¨1→:≥))•(+\•:εμ⊢)ω} 'Remove the sauce on the fsaucelosauceosaucer'

/* Rule 110
Decode :: {+/ω*2^φι=ω},
table :: [0, 1, 1, 1, 0, 1, 1, 0],
Step :: {0;(table :¢§ Decode` 3 ~ ω);0},

> :¢←' #'¨ (ι20) ({Step ω}↑⊣)¨ < (20ρ[0]);1;0
*/

/*
Sort_up :: ∧→:¢,
Sort_down :: ∨→:¢,
Decode :: {+/ ω * (10?α) ^ φ ι=ω},
Encode :: 1:>(φ φ→{(α;1):%:-%\ω;α}),
*/