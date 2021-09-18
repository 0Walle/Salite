const _same_shape = (x, y)=>{
    return x.length == y.length && x.every((n, i)=>y[i] == n
    );
};
class MultiArray {
    _shape;
    _strides;
    _data;
    constructor(shape, data, strides){
        if (data.length == 0) {
            this._shape = [];
            this._strides = [];
            this._data = [];
            return;
        }
        this._shape = shape;
        this._data = data;
        if (strides) {
            this._strides = strides;
        } else if (shape.length == 0) {
            this._strides = [];
        } else if (shape.length == 1) {
            this._strides = [
                1
            ];
        } else {
            this._strides = shape.map((_, i)=>shape.slice(i + 1).reduce((a, b)=>a * b
                , 1)
            );
        }
    }
    static from(iter) {
        let data = Array.from(iter);
        return new MultiArray([
            data.length
        ], data);
    }
    static same_shape(a, b) {
        return _same_shape(a._shape, b._shape);
    }
    static zip(s, t, f) {
        if (s._data.length == 0) return new MultiArray([], []);
        if (t._data.length == 0) return new MultiArray([], []);
        let [gt, lt] = s._shape.length > t._shape.length ? [
            s,
            t
        ] : [
            t,
            s
        ];
        if (lt.rank != 0 && !_same_shape(lt._shape, gt._shape.slice(-lt.rank))) throw "Shape Error";
        const lt_len = lt._data.length;
        const gt_len = gt._data.length;
        let data = Array(gt_len);
        const stride = lt.rank == 0 ? 0 : 1 / gt._strides[lt.rank - 1];
        if (s == gt) {
            for(let i = 0; i < gt_len; i++){
                data[i] = f(s._data[i], t._data[Math.floor(i * stride)]);
            }
        } else {
            for(let i = 0; i < gt_len; i++){
                data[i] = f(s._data[Math.floor(i * stride)], t._data[i]);
            }
        }
        return new MultiArray(gt._shape, data, gt._strides);
    }
    get rank() {
        return this._shape.length;
    }
    get length() {
        return this._shape[0];
    }
    map(f) {
        const new_data = new Array(this._data.length);
        const len = this._data.length;
        for(let i = 0; i < len; i++){
            new_data[i] = f(this._data[i]);
        }
        return new MultiArray(this._shape, new_data, this._strides);
    }
    reduce(f) {
        const last = this._shape[this._shape.length - 1];
        const new_shape = this._shape.slice(0, -1);
        const new_count = new_shape.reduce((a, b)=>a * b
        , 1);
        const new_data = Array(new_count);
        for(let i = 0; i < this._data.length; i++){
            const j = Math.floor(i / last);
            if (new_data[j] === undefined) {
                new_data[j] = this._data[i];
                continue;
            }
            new_data[j] = f(new_data[j], this._data[i]);
        }
        return new MultiArray(new_shape, new_data);
    }
    reduceWith(f, init) {
        const last = this._shape[this._shape.length - 1];
        const new_shape = this._shape.slice(0, -1);
        const new_count = new_shape.reduce((a, b)=>a * b
        );
        const new_data = Array(new_count);
        for(let i = 0; i < this._data.length; i++){
            const j = Math.floor(i / last);
            if (new_data[j] === undefined) {
                new_data[j] = init;
            }
            new_data[j] = f(new_data[j], this._data[i]);
        }
        return new MultiArray(new_shape, new_data);
    }
    match(other, equals) {
        if (!_same_shape(this._shape, other._shape)) {
            return false;
        }
        return this._data.every((n, i)=>equals(other._data[i], n)
        );
    }
    solo() {
        return new MultiArray([
            1,
            ...this._shape
        ], this._data);
    }
    concat(that) {
        let a = this._shape.length > 0 ? this._shape : [
            1
        ];
        let b = that._shape.length > 0 ? that._shape : [
            1
        ];
        if (a.length == b.length) {
        } else if (a.length == b.length + 1) {
            b = [
                1,
                ...b
            ];
        } else if (a.length + 1 == b.length) {
            a = [
                1,
                ...a
            ];
        } else {
            throw "Shape Error";
        }
        const this_first = a[0];
        const this_rest = a.slice(1);
        const that_first = b[0];
        const that_rest = b.slice(1);
        if (!_same_shape(this_rest, that_rest)) throw "Shape Error";
        const new_data = this._data.concat(that._data);
        const new_shape = [
            this_first + that_first,
            ...this_rest
        ];
        return new MultiArray(new_shape, new_data);
    }
    couple(other) {
        if (!_same_shape(this._shape, other._shape)) throw "Shape Error";
        return new MultiArray([
            2,
            ...this._shape
        ], this._data.concat(other._data));
    }
    deshape() {
        return new MultiArray([
            this._data.length
        ], this._data);
    }
    reshape(shape) {
        const length = Math.floor(shape.reduce((a, b)=>a * b
        , 1));
        if (isNaN(length)) throw "Length Error";
        if (length < 0) throw "Length Error";
        if (length > this._data.length) {
            let times = Math.floor(length / this._data.length);
            let slice = length % this._data.length;
            let new_data = [].concat(...Array(times).fill(this._data));
            new_data = new_data.concat(this._data.slice(0, slice));
            return new MultiArray(shape, new_data);
        }
        if (length == 0) {
            return new MultiArray([], []);
        }
        if (length == this._data.length) {
            return new MultiArray(shape, this._data);
        }
        return new MultiArray(shape, this._data.slice(0, length));
    }
    firstAxisToArray() {
        const shape = this._shape.slice(1);
        const stride = this._strides[0];
        if (stride == undefined) return [
            {
                start: 0,
                end: this._data.length,
                shape: this._shape
            }
        ];
        let result = [];
        let i = 0;
        while(i < this._data.length){
            result.push({
                shape: shape,
                start: i,
                end: i + stride
            });
            i += stride;
        }
        return result;
    }
    get(index) {
        if (index.length != this._shape.length) throw "Length Error";
        const i = index.map((x, i)=>(x < 0 ? this._shape[i] + x : x) * this._strides[i]
        ).reduce((a, b)=>a + b
        );
        if (i >= this._data.length) throw "Index Error";
        return this._data[i];
    }
    getFirst(index) {
        if (this.rank == 0) {
            throw "Rank Error";
        }
        const len = this._shape[0];
        if (index < 0) index = len + index;
        if (index < 0 || index >= len) throw "Lenght Error";
        if (this.rank == 1) {
            return {
                start: index,
                end: index + 1,
                shape: []
            };
        }
        const shape = this._shape.slice(1);
        const stride = this._strides[0];
        return {
            start: index * stride,
            end: (index + 1) * stride,
            shape
        };
    }
    slice(s) {
        return new MultiArray(s.shape, this._data.slice(s.start, s.end));
    }
    select(cells) {
        if (this.length == undefined) throw "Rank Error";
        if (cells.length == 0) return new MultiArray([], []);
        let new_data = [];
        let shape = this._shape.slice(1);
        for(let i = 0; i < cells.length; i++){
            let cell = cells[i];
            if (cell < 0) cell = this.length + cell;
            if (cell >= this.length) throw "Lenght Error";
            if (cell < 0) throw "Lenght Error";
            new_data = new_data.concat(this._data.slice(cell * this._strides[0], (cell + 1) * this._strides[0]));
        }
        return new MultiArray([
            cells.length,
            ...shape
        ], new_data);
    }
}
function makeScalar(v) {
    return new MultiArray([], [
        v
    ]);
}
function makeArray(arr) {
    if (arr.length == 0) {
        return new MultiArray([], []);
    }
    return new MultiArray([
        arr.length
    ], arr);
}
function makeEmpty() {
    return new MultiArray([], []);
}
function makeString(str) {
    const a = Array.from(str);
    return new MultiArray([
        a.length
    ], a);
}
function makeArithPrefix(num) {
    const rec = (x)=>{
        return x.map((w)=>{
            switch(typeof w){
                case "number":
                    return num(w);
                case "string":
                    throw "Domain Error";
                case "object":
                    return rec(w);
            }
        });
    };
    return rec;
}
function makeArithInfix(num) {
    const rec = (x, y)=>{
        return MultiArray.zip(x, y, (a, b)=>{
            let s = typeof a;
            let t = typeof b;
            if (s === 'string' || t === 'string') throw "Invalid type character at arithmetic function";
            if (s === 'number' && t === 'number') return num(a, b);
            let c = makeBox(a);
            let d = makeBox(b);
            return rec(c, d);
        });
    };
    return rec;
}
const add = makeArithInfix((x, y)=>x + y
);
const neg = makeArithPrefix((x)=>-x
);
const sub = makeArithInfix((x, y)=>x - y
);
const sign = makeArithPrefix(Math.sign);
const mult = makeArithInfix((x, y)=>x * y
);
const recp = makeArithPrefix((x)=>1 / x
);
const div = makeArithInfix((x, y)=>x / y
);
const exp = makeArithPrefix(Math.exp);
const pow = makeArithInfix((x, y)=>x ** y
);
const ln = makeArithPrefix(Math.log);
const root = makeArithInfix((x, y)=>y ** (1 / x)
);
const sqrt = makeArithPrefix(Math.sqrt);
const log = makeArithInfix((x, y)=>Math.log(y) / Math.log(x)
);
const abs = makeArithPrefix(Math.abs);
const mod = makeArithInfix((x, y)=>x == 0 ? y : y % x
);
const floor = makeArithPrefix(Math.floor);
const min = makeArithInfix((x, y)=>Math.min(x, y)
);
const ceil = makeArithPrefix(Math.ceil);
const max = makeArithInfix((x, y)=>Math.max(x, y)
);
const and = makeArithInfix((x, y)=>x & y
);
const or = makeArithInfix((x, y)=>x | y
);
const not = makeArithPrefix((x)=>1 - x
);
const length = (x)=>{
    if (x._data.length == 0) return makeScalar(0);
    return makeScalar(x._shape[0] ?? 1);
};
const rank = (x)=>makeScalar(x._shape.length)
;
const shape1 = (x)=>makeArray(x._shape)
;
const count = (x)=>makeScalar(x._data.length)
;
function cmp_scalar_le(x, y) {
    let s = typeof x, t = typeof y;
    return +(s != t ? s <= t : x <= y);
}
function cmp_scalar_ge(x, y) {
    let s = typeof x, t = typeof y;
    return +(s != t ? s >= t : x >= y);
}
function cmp_scalar_eq(x, y) {
    let s = typeof x, t = typeof y;
    if (s != t) return 0;
    if (s == 'object') return +match_values(x, y);
    return +(x == y);
}
const cmp_lt = (x, y)=>{
    return MultiArray.zip(x, y, (x, y)=>1 - cmp_scalar_ge(x, y)
    );
};
const cmp_le = (x, y)=>{
    return MultiArray.zip(x, y, cmp_scalar_le);
};
const cmp_ge = (x, y)=>{
    return MultiArray.zip(x, y, cmp_scalar_ge);
};
const cmp_gt = (x, y)=>{
    return MultiArray.zip(x, y, (x, y)=>1 - cmp_scalar_le(x, y)
    );
};
const cmp_eq = (x, y)=>{
    return MultiArray.zip(x, y, cmp_scalar_eq);
};
const cmp_ne = (x, y)=>{
    return MultiArray.zip(x, y, (x, y)=>1 - cmp_scalar_eq(x, y)
    );
};
function match_values(a, b) {
    return a.match(b, (x, y)=>!!cmp_scalar_eq(x, y)
    );
}
const match = (x, y)=>makeScalar(+match_values(x, y))
;
const not_match = (x, y)=>makeScalar(+!match_values(x, y))
;
const id = (x)=>x
;
const left = (x, y)=>x
;
const right = (x, y)=>y
;
const join = (x, y)=>{
    if (x._data.length == 0) return y;
    if (y._data.length == 0) return x;
    return x.concat(y);
};
const couple = (x, y)=>{
    return x.couple(y);
};
const deshape = (x)=>x.deshape()
;
const reshape = (x, y)=>{
    if (x.rank > 1) throw "Rank Error";
    let shape = x._data.map(Number);
    return y.reshape(shape);
};
const iota = (x)=>{
    if (x.rank > 1) throw "Rank Error";
    let shape = x._data.map(Number);
    const length = Math.floor(shape.reduce((a, b)=>a * b
    ));
    if (isNaN(length)) throw "Length Error";
    if (length < 0) throw "Length Error";
    if (length == 0) return makeEmpty();
    const data = Array(length).fill(0).map((_, i)=>i
    );
    return new MultiArray(shape, data).reshape(shape);
};
function takeScalar(x) {
    if (x.rank != 0) throw "Rank Error";
    const n = x._data[0];
    if (typeof n != 'number') throw "Domain Error";
    return n;
}
function takeNumbers(x) {
    if (x.rank != 1) throw "Rank Error";
    const n = x._data.map(Number);
    if (n.some(isNaN)) throw "Domain Error";
    return n;
}
function gen_iota(len, f) {
    return Array(len).fill(undefined).map((_, i)=>f(i)
    );
}
const reverse = (v)=>{
    const len = v.length;
    if (len === undefined) return v;
    const slices = gen_iota(len, (i)=>len - 1 - i
    );
    return v.select(slices);
};
const rotate = (x, y)=>{
    const n = takeScalar(x);
    const len = y.length;
    if (len === undefined) return y;
    let rotated_slices;
    if (n > 0) {
        rotated_slices = Array(len).fill(0).map((_, i)=>(i + n % len) % len
        );
    } else {
        rotated_slices = Array(len).fill(0).map((_, i)=>(i + (len - n % len)) % len
        );
    }
    const rotated = y.select(rotated_slices);
    return rotated;
};
const transpose = (v)=>{
    if (v.rank < 2) return v;
    console.log(v._strides);
    const first = v._shape[0];
    const tail = v._strides[0];
    const data = new Array(v._data.length);
    let k = 0;
    for(let j = 0; j < tail; j++){
        for(let i = 0; i < first; i++){
            data[k++] = v._data[i * tail + j];
        }
    }
    return new MultiArray([
        ...v._shape.slice(1),
        first
    ], data);
};
const take = (x, y)=>{
    const n = takeScalar(x);
    const len = y.length;
    if (len === undefined) return y;
    if (n >= 0) {
        return y.select(gen_iota(n, (i)=>i
        ));
    }
    return y.select(gen_iota(-n, (i)=>len + n + i
    ));
};
const drop = (x, y)=>{
    const n = takeScalar(x);
    const len = y.length;
    if (len === undefined) return y;
    if (n >= 0) {
        return y.select(gen_iota(len - n, (i)=>i + n
        ));
    }
    return y.select(gen_iota(len + n, (i)=>i
    ));
};
const first = (x)=>{
    if (!x._data[0]) return makeEmpty();
    return makeBox(x._data[0]);
};
const first_cell = (y)=>{
    const first = y.slice(y.getFirst(0));
    if (first.rank == 0) return makeBox(first._data[0]);
    return first;
};
const pick = (x, y)=>{
    if (x.rank == 0) {
        const n = takeScalar(x);
        return makeBox(y._data[n]);
    }
    try {
        let n = takeNumbers(x);
        return makeBox(y.get(n));
    } catch  {
        const result = x.map((i)=>pick(makeBox(i), y)._data[0]
        );
        return result;
    }
};
const pick_indexes = (a, w)=>{
    const j = w._data;
    if (a.rank == 0) {
        const n = takeScalar(a);
        return [
            n
        ];
    }
    try {
        let n = takeNumbers(a);
        if (n.length != w._shape.length) throw "Length Error";
        const i = n.map((x, i)=>(x < 0 ? w._shape[i] + x : x) * w._strides[i]
        ).reduce((a, b)=>a + b
        );
        if (i >= w._data.length) throw "Index Error";
        return [
            i
        ];
    } catch  {
        const result = a.map((i)=>pick_indexes(makeBox(i), w)
        )._data.flat();
        return result;
    }
};
const select = (x, y)=>{
    if (y.rank == 0) throw "Rank Error";
    if (x.rank == 0) {
        let n = takeScalar(x);
        const slice = y.getFirst(n ?? 0);
        return y.slice(slice);
    }
    let n = takeNumbers(x.deshape());
    return y.select(n).reshape([
        ...x._shape,
        ...y._shape.slice(1)
    ]);
};
const membership = (y, x)=>{
    const __final = y.map((a)=>{
        for (const val of x._data){
            if (cmp_scalar_eq(val, a)) return 1;
        }
        return 0;
    });
    return __final;
};
const indexof = (x, y)=>{
    const __final = y.map((a)=>{
        for(let i = 0; i < x._data.length; ++i){
            if (cmp_scalar_eq(x._data[i], a)) return i;
        }
        return x._data.length;
    });
    return __final;
};
const indices = (x)=>{
    const n = takeNumbers(x);
    const data = n.flatMap((n, i)=>Array(n).fill(i)
    );
    return makeArray(data);
};
const replicate = (x, y)=>{
    const indices_list = takeNumbers(x);
    if (y.length !== indices_list.length) throw "Lenght Error";
    const indices = indices_list.flatMap((n, i)=>Array(n).fill(i)
    );
    return y.select(indices);
};
const mark_firsts = (x)=>{
    if (x.rank != 1) throw "Shape Error";
    const uniques = new Set();
    const data = x.map((n)=>uniques.has(n) ? 0 : (uniques.add(n), 1)
    );
    return data;
};
const unique = (x)=>{
    if (x.rank != 1) throw "Shape Error";
    const uniques = [];
    const has = (v)=>uniques.some((u)=>cmp_scalar_eq(u, v)
        )
    ;
    const data = x._data.filter((n)=>has(n) ? false : (uniques.push(n), true)
    );
    return makeArray(data);
};
const group = (x, y)=>{
    const groups = takeNumbers(x);
    let data = [];
    for(let i = 0; i < groups.length; i++){
        const n = groups[i];
        if (n < 0) continue;
        const slice = i;
        if (data[n] == undefined) {
            data[n] = [
                slice
            ];
        } else {
            data[n].push(slice);
        }
    }
    if (data.length == 0) return makeEmpty();
    for(let i1 = 0; i1 < data.length; i1++){
        if (data[i1] == undefined) data[i1] = [];
    }
    const boxes = data.map((slices)=>y.select(slices)
    );
    return new MultiArray([
        data.length
    ], boxes);
};
const group_indices = (x)=>{
    const groups = takeNumbers(x);
    const data = [];
    groups.forEach((n, i)=>{
        if (n < 0) return;
        if (data[n] == undefined) data[n] = [];
        data[n].push(i);
    });
    for(let i = 0; i < data.length; i++){
        if (data[i] == undefined) data[i] = [];
    }
    return makeArray(data.map((x)=>makeArray(x)
    ));
};
const find = (pat, x)=>{
    if (x.rank == 0) throw "Rank Error";
    if (pat.rank == 0) {
        return cmp_eq(pat, x);
    }
    if (pat.rank != x.rank) throw "Rank Error";
    const pat_len = pat.length ?? 0;
    const x_len = x.length ?? 0;
    if (pat_len > x_len) return makeEmpty();
    if (pat_len == x_len) {
        if (match_values(pat, x)) {
            return makeArray([
                1
            ].concat(new Array(x_len - 1).fill(0)));
        } else {
            return makeArray(new Array(x_len).fill(0));
        }
    }
    const pat_cells = pat.firstAxisToArray();
    const cells = x.firstAxisToArray();
    const result = new Array(x_len).fill(0);
    for(let i = 0; i < x_len - pat_len + 1; i++){
        let got = 1;
        for(let j = 0; j < pat_cells.length; j++){
            const pat_c = pat.slice(pat_cells[j]);
            const x_c = x.slice(cells[i + j]);
            if (false == match_values(pat_c, x_c)) {
                got = 0;
                break;
            }
        }
        result[i] = got;
    }
    return makeArray(result);
};
const enclose = (x)=>{
    return new MultiArray([], [
        x
    ]);
};
function makeBox(v) {
    return typeof v == 'object' ? v : makeScalar(v);
}
function unwrapBox(v) {
    if (v.rank == 0) return v._data[0];
    return v;
}
const merge = (x)=>{
    if (x.rank == 0) return x;
    let first = makeBox(x._data[0]);
    const result = x._data.map(makeBox).reduce((acc, v)=>{
        if (!MultiArray.same_shape(first, v)) throw "Shape Error";
        return acc.concat(v);
    });
    return result.reshape([
        ...x._shape,
        ...first._shape
    ]);
};
const windows = (n, x)=>{
    if (x.rank == 0) return x;
    const len = takeScalar(n);
    if (len <= 0) throw "Value Error";
    if (len >= x._shape[0]) throw "Value Error";
    let windows = [];
    const span = x._shape[0] - len + 1;
    for(let i = 0; i < span; i++){
        let a = x.getFirst(i);
        let b = x.getFirst(i + len - 1);
        windows.push({
            start: a.start,
            end: b.end,
            shape: [
                len,
                ...a.shape
            ]
        });
    }
    let data = [];
    for(let i1 = 0; i1 < windows.length; i1++){
        const slice = windows[i1];
        data = data.concat(x._data.slice(slice.start, slice.end));
    }
    return new MultiArray([
        windows.length,
        ...windows[0].shape
    ], data);
};
const solo = (x)=>{
    return x.reshape([
        1,
        ...x._shape
    ]);
};
function scalar_depth(v) {
    let s = typeof v;
    if (s == 'object') return value_depth(v);
    return 0;
}
function value_depth(v) {
    if (v.rank == 0) return 0;
    return 1 + Math.max(...v._data.map(scalar_depth));
}
const depth = (x)=>{
    return makeScalar(value_depth(x));
};
function compare_values(a, b) {
    if (!cmp_scalar_le(a, b)) return 1;
    if (!cmp_scalar_ge(a, b)) return -1;
    return 0;
}
const grade_up = (x)=>{
    const slices = x.firstAxisToArray();
    const sliced = slices.map((s)=>x.slice(s)
    );
    const indices = slices.map((_, i)=>i
    ).sort((a, b)=>{
        return compare_values(sliced[a], sliced[b]);
    });
    return makeArray(indices);
};
const grade_down = (x)=>{
    const slices = x.firstAxisToArray();
    const sliced = slices.map((s)=>x.slice(s)
    );
    const indices = slices.map((_, i)=>i
    ).sort((a, b)=>{
        return compare_values(sliced[a], sliced[b]) * -1;
    });
    return makeArray(indices);
};
const under_indices = (x)=>{
    const indices = takeNumbers(x);
    const data = [];
    indices.forEach((n)=>{
        if (n < 0) return;
        if (data[n] == undefined) data[n] = 0;
        data[n] += 1;
    });
    for(let i = 0; i < data.length; i++){
        if (data[i] == undefined) data[i] = 0;
    }
    return makeArray(data);
};
function underBoxPrefix(f) {
    return (v)=>unwrapBox(f(makeBox(v)))
    ;
}
function underBoxInfix(f) {
    return (a, b)=>unwrapBox(f(makeBox(a), makeBox(b)))
    ;
}
const reduce = (f)=>(w)=>{
        if (w.length == undefined) return w;
        const result = w.map(makeBox).reduce(f);
        if (result.rank == 0) return result._data[0];
        return result;
    }
;
const each = (f)=>(w)=>{
        let data = [];
        for(let index = 0; index < w._data.length; index++){
            const result = underBoxPrefix(f)(w._data[index]);
            data.push(result);
        }
        return new MultiArray(w._shape, data, w._strides);
    }
;
const cellsPrefix = (f)=>(w)=>{
        const cells = w.firstAxisToArray();
        let data = [];
        let shape = null;
        for (const slice of cells){
            const cell = f(w.slice(slice));
            if (shape == null) {
                shape = cell._shape;
            } else if (cell._shape.length != shape.length || !cell._shape.every((n, i)=>n == shape[i]
            )) {
                throw "Shape Error";
            }
            data = data.concat(cell._data);
        }
        if (w.length == undefined || shape == null) return makeEmpty();
        return new MultiArray([
            w.length,
            ...shape
        ], data);
    }
;
const cellsInfix = (f)=>(a, w)=>{
        if (a.length != w.length) throw "Length Error";
        const a_arr = a.firstAxisToArray();
        const w_arr = w.firstAxisToArray();
        let data = [];
        let shape = null;
        for(let i = 0; i < a_arr.length; i++){
            const x = a.slice(a_arr[i]);
            const y = w.slice(w_arr[i]);
            const result = f(x, y);
            if (shape == null) {
                shape = result._shape;
            } else if (result._shape.length != shape.length || !result._shape.every((n, i)=>n == shape[i]
            )) {
                throw "Shape Error";
            }
            data = data.concat(result._data);
        }
        if (shape == null) return makeEmpty();
        return new MultiArray([
            a_arr.length,
            ...shape
        ], data);
    }
;
const table = (f)=>(a, w)=>{
        const a_arr = a.firstAxisToArray();
        const w_arr = w.firstAxisToArray();
        let data = [];
        for (const a_slice of a_arr){
            for (const w_slice of w_arr){
                const x = a.slice(a_slice);
                const y = w.slice(w_slice);
                const result = unwrapBox(f(x, y));
                data.push(result);
            }
        }
        return new MultiArray([
            a_arr.length,
            w_arr.length
        ], data);
    }
;
var TokenType;
(function(TokenType) {
    TokenType[TokenType["Func"] = 0] = "Func";
    TokenType[TokenType["Monad"] = 1] = "Monad";
    TokenType[TokenType["Dyad"] = 2] = "Dyad";
    TokenType[TokenType["RParen"] = 3] = "RParen";
    TokenType[TokenType["LParen"] = 4] = "LParen";
    TokenType[TokenType["RBrack"] = 5] = "RBrack";
    TokenType[TokenType["LBrack"] = 6] = "LBrack";
    TokenType[TokenType["Number"] = 7] = "Number";
    TokenType[TokenType["Id"] = 8] = "Id";
    TokenType[TokenType["String"] = 9] = "String";
    TokenType[TokenType["ListStart"] = 10] = "ListStart";
    TokenType[TokenType["ListEnd"] = 11] = "ListEnd";
    TokenType[TokenType["Sep"] = 12] = "Sep";
    TokenType[TokenType["Empty"] = 13] = "Empty";
    TokenType[TokenType["Error"] = 14] = "Error";
    TokenType[TokenType["Define"] = 15] = "Define";
    TokenType[TokenType["Comment"] = 16] = "Comment";
    TokenType[TokenType["Pipe"] = 17] = "Pipe";
})(TokenType || (TokenType = {
}));
class Token {
    kind;
    value;
    col;
    constructor(kind1, v){
        this.kind = kind1;
        this.value = v;
    }
    static Number(n) {
        return new Token(TokenType.Number, n);
    }
    static Id(n) {
        return new Token(TokenType.Id, n);
    }
    static String(n) {
        return new Token(TokenType.String, n);
    }
    static Func(n) {
        return new Token(TokenType.Func, n);
    }
    static Monad(n) {
        return new Token(TokenType.Monad, n);
    }
    static Dyad(n) {
        return new Token(TokenType.Dyad, n);
    }
    static RParen() {
        return new Token(TokenType.RParen);
    }
    static LParen() {
        return new Token(TokenType.LParen);
    }
    static RBrack() {
        return new Token(TokenType.RBrack);
    }
    static LBrack() {
        return new Token(TokenType.LBrack);
    }
    static Pipe() {
        return new Token(TokenType.Pipe);
    }
    static ListStart() {
        return new Token(TokenType.ListStart);
    }
    static ListEnd() {
        return new Token(TokenType.ListEnd);
    }
    static Sep() {
        return new Token(TokenType.Sep);
    }
    static Empty() {
        return new Token(TokenType.Empty);
    }
    static Error() {
        return new Token(TokenType.Error);
    }
    static Comment() {
        return new Token(TokenType.Comment);
    }
    static Define() {
        return new Token(TokenType.Define);
    }
    span(col, len) {
        this.col = [
            col,
            col + len
        ];
        return this;
    }
}
const num_re = /^(?:(¬?)([0-9]+(?:\.[0-9]+)?))/;
const value_re = /^([a-z][a-z_]*)/;
const string_re = /^'((?:\\.|[^'])+)'/;
const func_re = /^([+\-*%^;~$≤<>≥=≠ριφεμδ¢∧∨λ√⊣⊢!?]|:[+\-*%^;~$≤<>≥=≠ριφεμδ¢∧∨]|[A-Z][a-z_]*)/;
const monad_re = /^([\\/¨`´§]|\.[a-z][a-z_]*)/;
const dyad_re = /^([•°←↑→@¤]|\.[A-Z][a-z_]*)/;
function tokenize(text, quiet = false) {
    let match;
    let tokens = [];
    let col = 0;
    while(text.length > 0){
        if (text[0] == ' ' || text[0] == '\n' || text[0] == '\t') {
            text = text.slice(1);
            col += 1;
        } else if (text[0] == '#') {
            let end = text.indexOf('\n');
            if (end == -1) {
                if (quiet) tokens.push(Token.Comment().span(col, text.length));
                col += text.length;
                text = '';
                continue;
            }
            if (quiet) tokens.push(Token.Comment().span(col, end));
            text = text.slice(end);
            col += end;
        } else if (text[0] == '(') {
            tokens.push(Token.LParen().span(col, 1));
            col += 1;
            text = text.slice(1);
        } else if (text[0] == ')') {
            tokens.push(Token.RParen().span(col, 1));
            col += 1;
            text = text.slice(1);
        } else if (text[0] == '{') {
            tokens.push(Token.LBrack().span(col, 1));
            col += 1;
            text = text.slice(1);
        } else if (text[0] == '}') {
            tokens.push(Token.RBrack().span(col, 1));
            col += 1;
            text = text.slice(1);
        } else if (text[0] == '[') {
            tokens.push(Token.ListStart().span(col, 1));
            col += 1;
            text = text.slice(1);
        } else if (text[0] == ']') {
            tokens.push(Token.ListEnd().span(col, 1));
            col += 1;
            text = text.slice(1);
        } else if (text[0] == ',') {
            tokens.push(Token.Sep().span(col, 1));
            col += 1;
            text = text.slice(1);
        } else if (text[0] == '|') {
            tokens.push(Token.Pipe().span(col, 1));
            col += 1;
            text = text.slice(1);
        } else if (text[0] == 'π') {
            tokens.push(Token.Number(Math.PI).span(col, 1));
            col += 1;
            text = text.slice(1);
        } else if (text[0] == '∞') {
            tokens.push(Token.Number(Infinity).span(col, 1));
            col += 1;
            text = text.slice(1);
        } else if (text[0] == 'ø') {
            tokens.push(Token.Empty().span(col, 1));
            col += 1;
            text = text.slice(1);
        } else if (text[0] == 'α') {
            tokens.push(Token.Id('α').span(col, 1));
            col += 1;
            text = text.slice(1);
        } else if (text[0] == 'ω') {
            tokens.push(Token.Id('ω').span(col, 1));
            col += 1;
            text = text.slice(1);
        } else if (text[0] == ':' && text[1] == ':') {
            tokens.push(Token.Define().span(col, 2));
            col += 2;
            text = text.slice(2);
        } else if (match = text.match(value_re)) {
            let name = match[1];
            tokens.push(Token.Id(name).span(col, match[0].length));
            col += match[0].length;
            text = text.slice(match[0].length);
        } else if (match = text.match(num_re)) {
            let num = parseFloat(match[2]);
            if (match[1] == '¬') num = -num;
            tokens.push(Token.Number(num).span(col, match[0].length));
            col += match[0].length;
            text = text.slice(match[0].length);
        } else if (match = text.match(string_re)) {
            tokens.push(Token.String(match[1]).span(col, match[0].length));
            col += match[0].length;
            text = text.slice(match[0].length);
        } else if (match = text.match(func_re)) {
            tokens.push(Token.Func(match[0]).span(col, match[0].length));
            col += match[0].length;
            text = text.slice(match[0].length);
        } else if (match = text.match(monad_re)) {
            tokens.push(Token.Monad(match[0]).span(col, match[0].length));
            col += match[0].length;
            text = text.slice(match[0].length);
        } else if (match = text.match(dyad_re)) {
            tokens.push(Token.Dyad(match[0]).span(col, match[0].length));
            col += match[0].length;
            text = text.slice(match[0].length);
        } else {
            if (quiet) {
                tokens.push(Token.Error().span(col, 1));
                col += 1;
                text = text.slice(1);
            } else {
                throw `Invalid Token '${text}'`;
            }
        }
    }
    return tokens;
}
var ExprKind;
(function(ExprKind) {
    ExprKind[ExprKind["Number"] = 0] = "Number";
    ExprKind[ExprKind["Id"] = 1] = "Id";
    ExprKind[ExprKind["String"] = 2] = "String";
    ExprKind[ExprKind["Prefix"] = 3] = "Prefix";
    ExprKind[ExprKind["Infix"] = 4] = "Infix";
    ExprKind[ExprKind["Func"] = 5] = "Func";
    ExprKind[ExprKind["Monad"] = 6] = "Monad";
    ExprKind[ExprKind["Dyad"] = 7] = "Dyad";
    ExprKind[ExprKind["Fork"] = 8] = "Fork";
    ExprKind[ExprKind["Train"] = 9] = "Train";
    ExprKind[ExprKind["Vector"] = 10] = "Vector";
    ExprKind[ExprKind["Defn"] = 11] = "Defn";
    ExprKind[ExprKind["Decl"] = 12] = "Decl";
    ExprKind[ExprKind["Guard"] = 13] = "Guard";
})(ExprKind || (ExprKind = {
}));
function Expr_Number(n) {
    return {
        kind: ExprKind.Number,
        value: n
    };
}
function Expr_String(n) {
    return {
        kind: ExprKind.String,
        value: n
    };
}
function Expr_Id(n) {
    return {
        kind: ExprKind.Id,
        value: n
    };
}
function Expr_Func(n) {
    return {
        kind: ExprKind.Func,
        name: n
    };
}
function pretty_expr(e) {
    switch(e.kind){
        case ExprKind.Number:
            if (e.value < 0) {
                return `¬${-e.value}`;
            }
            return `${e.value}`;
        case ExprKind.String:
            return `'${e.value}'`;
        case ExprKind.Id:
            return e.value;
        case ExprKind.Vector:
            return `${e.value.map(pretty_expr).join(', ')}`;
        case ExprKind.Prefix:
            return `(${pretty_expr(e.func)}) ${pretty_expr(e.omega)}`;
        case ExprKind.Infix:
            return `(${pretty_expr(e.alpha)}) (${pretty_expr(e.func)}) ${pretty_expr(e.omega)}`;
        case ExprKind.Func:
            return `${e.name}`;
        case ExprKind.Fork:
            return `${pretty_expr(e.alpha)}${pretty_expr(e.infix)}${pretty_expr(e.omega)}`;
        case ExprKind.Train:
            return `${pretty_expr(e.alpha)}${pretty_expr(e.omega)}`;
        case ExprKind.Monad:
            return `${pretty_expr(e.alpha)}${e.mod}`;
        case ExprKind.Dyad:
            return `${pretty_expr(e.alpha)}${e.mod}(${pretty_expr(e.omega)})`;
        case ExprKind.Defn:
            return `{${e.fn.map(pretty_expr).join(', ')}}`;
        case ExprKind.Decl:
            return `${e.name} :: ${pretty_expr(e.value)}`;
        case ExprKind.Guard:
            return `${pretty_expr(e.expr)} | ${pretty_expr(e.fall)}`;
    }
}
function is_func(e) {
    if (e.kind == ExprKind.Func) return true;
    if (e.kind == ExprKind.Monad) return true;
    if (e.kind == ExprKind.Dyad) return true;
    if (e.kind == ExprKind.Fork) return true;
    if (e.kind == ExprKind.Train) return true;
    if (e.kind == ExprKind.Defn) return true;
    return false;
}
function parse_try_def_or_guard(ctx) {
    if (ctx.code.length == 0) return null;
    let [tk, ...tail] = ctx.code;
    switch(tk.kind){
        case TokenType.Id:
        case TokenType.Func:
            {
                const [is_def, ...tail_] = tail;
                if (is_def.kind != TokenType.Define) break;
                ctx.code = tail_;
                const expr = parse_expr(ctx);
                if (expr == null) throw "Invalid code, expected expression";
                if (tk.kind == TokenType.Func != is_func(expr)) {
                    throw `Invalid code, expected ${tk.kind == TokenType.Func ? 'function' : 'value'}`;
                }
                return {
                    kind: ExprKind.Decl,
                    is_func: tk.kind == TokenType.Func,
                    name: tk.value,
                    value: expr
                };
            }
    }
    let expr = parse_expr(ctx);
    if (expr == null) return null;
    [tk, ...tail] = ctx.code;
    if (tk?.kind == TokenType.Pipe) {
        ctx.code = tail;
        const fall = parse_expr(ctx);
        if (fall == null) throw "Invalid code, expected expression";
        expr = {
            kind: ExprKind.Guard,
            expr: expr,
            fall: fall
        };
    }
    return expr;
}
function parse_try_func_or_subj(ctx) {
    if (ctx.code.length == 0) return null;
    const [tk, ...tail] = ctx.code;
    switch(tk.kind){
        case TokenType.Number:
            ctx.code = tail;
            return Expr_Number(tk.value);
        case TokenType.Id:
            ctx.code = tail;
            return Expr_Id(tk.value);
        case TokenType.String:
            ctx.code = tail;
            return Expr_String(tk.value);
        case TokenType.Empty:
            ctx.code = tail;
            return {
                kind: ExprKind.Vector,
                value: [],
                vkind: 'other'
            };
        case TokenType.LParen:
            {
                ctx.code = tail;
                let expr = parse_expr(ctx);
                if (ctx.code[0].kind != TokenType.RParen) throw "Invalid code, expected )";
                ctx.code = ctx.code.slice(1);
                if (expr?.kind == ExprKind.Train) {
                    return {
                        kind: ExprKind.Dyad,
                        mod: '•',
                        alpha: expr.alpha,
                        omega: expr.omega
                    };
                }
                return expr;
            }
        case TokenType.ListStart:
            {
                ctx.code = tail;
                let exprs = [];
                while(true){
                    const expr = parse_expr(ctx);
                    if (expr === null) throw "Invalid Code, invalid expression";
                    exprs.push(expr);
                    if (ctx.code[0].kind == TokenType.ListEnd) break;
                    if (ctx.code[0].kind != TokenType.Sep) throw "Invalid Code, expected separator";
                    ctx.code = ctx.code.slice(1);
                }
                ctx.code = ctx.code.slice(1);
                let vkind = 'other';
                if (exprs.every((e)=>e.kind == ExprKind.Number
                )) {
                    vkind = 'num';
                }
                return {
                    kind: ExprKind.Vector,
                    value: exprs,
                    vkind: vkind
                };
            }
        case TokenType.Func:
            ctx.code = tail;
            return Expr_Func(tk.value);
        case TokenType.LBrack:
            {
                ctx.code = tail;
                let exprs = [];
                while(true){
                    let expr = parse_try_def_or_guard(ctx);
                    if (expr === null) throw "Invalid code in defn";
                    if (is_func(expr)) {
                        throw "Invalid code in defn";
                    }
                    exprs.push(expr);
                    if (ctx.code[0].kind == TokenType.RBrack) break;
                    if (ctx.code[0].kind != TokenType.Sep) throw "Invalid Code, expected separator";
                    ctx.code = ctx.code.slice(1);
                }
                ctx.code = ctx.code.slice(1);
                return {
                    kind: ExprKind.Defn,
                    fn: exprs
                };
            }
        default:
            return null;
    }
}
function parse_try_subj(ctx) {
    if (ctx.code.length == 0) return null;
    const [tk, ...tail] = ctx.code;
    switch(tk.kind){
        case TokenType.Number:
            ctx.code = tail;
            return Expr_Number(tk.value);
        case TokenType.Id:
            ctx.code = tail;
            return Expr_Id(tk.value);
        case TokenType.String:
            ctx.code = tail;
            return Expr_String(tk.value);
        case TokenType.Empty:
            ctx.code = tail;
            return {
                kind: ExprKind.Vector,
                value: [],
                vkind: 'other'
            };
        case TokenType.LParen:
            {
                const backtrack = ctx.code;
                ctx.code = tail;
                let expr = parse_expr(ctx);
                if (ctx.code[0].kind != TokenType.RParen) throw "Invalid code, expected )";
                ctx.code = ctx.code.slice(1);
                if (expr && is_func(expr)) {
                    ctx.code = backtrack;
                    return null;
                }
                return expr;
            }
        case TokenType.ListStart:
            {
                ctx.code = tail;
                let exprs = [];
                while(true){
                    const expr = parse_expr(ctx);
                    if (expr === null) throw "Invalid Code, invalid expression";
                    if (is_func(expr)) throw "Invalid Code, invalid expression";
                    exprs.push(expr);
                    if (ctx.code[0].kind == TokenType.ListEnd) break;
                    if (ctx.code[0].kind != TokenType.Sep) throw "Invalid Code, expected separator";
                    ctx.code = ctx.code.slice(1);
                }
                ctx.code = ctx.code.slice(1);
                let vkind = 'other';
                if (exprs.every((e)=>e.kind == ExprKind.Number
                )) {
                    vkind = 'num';
                }
                return {
                    kind: ExprKind.Vector,
                    value: exprs,
                    vkind
                };
            }
        default:
            return null;
    }
}
function parse_derv(ctx, first) {
    let result = first ?? parse_try_func_or_subj(ctx);
    loop: while(true){
        let top = ctx.code[0];
        switch(top?.kind){
            case TokenType.Monad:
                {
                    if (result == null) throw "Invalid code, expected function argument for monad";
                    ctx.code.shift();
                    result = {
                        kind: ExprKind.Monad,
                        mod: top.value,
                        alpha: result
                    };
                    break;
                }
            case TokenType.Dyad:
                {
                    if (result == null) throw `Invalid code, expected left argument for dyad at ${top.col}`;
                    ctx.code.shift();
                    let omega = parse_try_func_or_subj(ctx);
                    if (omega == null) throw "Invalid code, expected right argument for dyad";
                    result = {
                        kind: ExprKind.Dyad,
                        mod: top.value,
                        alpha: result,
                        omega: omega
                    };
                    break;
                }
            default: break loop;
        }
    }
    if (result === null) {
        return null;
    }
    if (!is_func(result)) throw `Invalid code, expected function found ${result.kind}`;
    return result;
}
function parse_expr(ctx) {
    if (ctx.code.length == 0) {
        return null;
    }
    if (ctx.code[0].kind == TokenType.RParen || ctx.code[0].kind == TokenType.Sep || ctx.code[0].kind == TokenType.Pipe || ctx.code[0].kind == TokenType.ListEnd) {
        return null;
    }
    let alpha = parse_try_subj(ctx);
    let func;
    if (alpha && ctx.code.length > 0 && (ctx.code[0].kind == TokenType.Dyad || ctx.code[0].kind == TokenType.Monad)) {
        func = parse_derv(ctx, alpha);
        alpha = null;
    } else {
        func = parse_derv(ctx);
    }
    if (func === null) {
        return alpha;
    }
    let omega = parse_expr(ctx);
    if (!omega) {
        if (alpha) throw `Invalid code, no right argument in function`;
        return func;
    }
    if (alpha) {
        if (is_func(omega)) {
            return {
                kind: ExprKind.Fork,
                alpha: alpha,
                infix: func,
                omega: omega
            };
        }
        return {
            kind: ExprKind.Infix,
            func,
            alpha,
            omega
        };
    }
    if (omega.kind == ExprKind.Train) {
        return {
            kind: ExprKind.Fork,
            alpha: func,
            infix: omega.alpha,
            omega: omega.omega
        };
    }
    if (is_func(omega)) {
        return {
            kind: ExprKind.Train,
            alpha: func,
            omega: omega
        };
    }
    return {
        kind: ExprKind.Prefix,
        func,
        omega
    };
}
function parse(text) {
    let tk = tokenize(text);
    let ctx = {
        code: tk
    };
    let exprs = [];
    while(true){
        const expr = parse_try_def_or_guard(ctx);
        if (expr == null) throw "Invalid code";
        exprs.push(expr);
        if (ctx.code.length == 0) break;
        if (ctx.code[0].kind != TokenType.Sep) throw "Invalid code, expected separator";
        ctx.code.shift();
    }
    return exprs;
}
class SaliteError extends Error {
    span;
    constructor(message, col1){
        super(message);
        this.name = "Evaluation Error";
        this.span = col1;
    }
}
class SaliteArityError extends SaliteError {
    at;
    expected;
    constructor(expected1, at1, col2){
        let _a = expected1 == 1 ? 'prefix' : 'infix';
        let message1 = `Arity Error: Function is not ${_a}`;
        if (at1) {
            message1 = `Arity Error: Function at ${at1} is not ${_a}`;
        }
        super(message1, col2);
        this.name = "Arity Error";
        this.at = at1;
        this.expected = expected1;
    }
}
function pretty_value_(v) {
    if (v == undefined) return [
        'ERR'
    ];
    if (v._data.length == 0) return [
        'ø'
    ];
    if (v.rank == 0) {
        let single = v._data[0];
        switch(typeof single){
            case 'number':
                {
                    let s = `nan`;
                    if (isNaN(single)) return [
                        s
                    ];
                    if (!isFinite(single)) s = single < 0 ? `¬∞` : `∞`;
                    if (single < 0) return [
                        `¬${String(-single)}`
                    ];
                    return [
                        String(single)
                    ];
                }
            case 'string':
                return [
                    `'${single}'`
                ];
            case 'object':
                {
                    let string = pretty_value_(makeBox(single));
                    let len = string[0].length;
                    return [
                        `┌`.padEnd(len + 4),
                        `  ${string[0]}  `,
                        ...string.slice(1).map((s)=>'  ' + s + '  '
                        ),
                        `${' '.repeat(len + 3)}┘`
                    ];
                }
        }
    }
    if (v._data.every((v)=>typeof v == 'string'
    )) {
        if (v.rank == 1) return [
            `'${v._data.join('')}'`
        ];
        let i = 0;
        let last = v._strides[v._strides.length - 2];
        let strings = [];
        while(i < v._data.length){
            if (i != 0 && v._strides.slice(0, -2).some((n)=>i % n == 0
            )) strings.push("");
            strings.push(v._data.slice(i, i + last).join(''));
            i += last;
        }
        return strings.map((s, i)=>(i > 0 ? ' ' : '"') + s + (i == strings.length - 1 ? '"' : ' ')
        );
    }
    let strings = v._data.map((v)=>pretty_value_(makeBox(v))
    );
    if (v.rank == 1) {
        let sizes = strings.map((ss)=>[
                ss[0].length,
                ss.length
            ]
        );
        let max_height = Math.max(...sizes.map((b)=>b[1]
        ));
        if (max_height == 1) return [
            `⟨ ${strings.map((ss)=>ss.join(' ')
            ).join(' ')} ⟩`
        ];
        let layers = [];
        for(let i = 0; i < max_height; i++){
            let layer = strings.map((ss, j)=>ss[i] ?? ' '.repeat(sizes[j][0])
            );
            layers.push(layer.join(' '));
        }
        const len = layers[0].length;
        return [
            `┌─`.padEnd(len + 4),
            `│ ${layers[0]}  `,
            ...layers.slice(1).map((ss)=>'  ' + ss + '  '
            ),
            `${' '.repeat(len + 3)}┘`
        ];
    }
    let max_hei = Math.max(...strings.map((ss)=>ss.length
    ));
    if (v.rank == 2 && max_hei == 1) {
        let i = 0;
        let last = v._strides[v._strides.length - 2];
        let strings = [];
        let col_max = Array(last).fill(0);
        while(i < v._data.length){
            if (i != 0 && v._strides.slice(0, -2).some((n)=>i % n == 0
            )) strings.push([
                ""
            ]);
            const row_string = v._data.slice(i, i + last).map((n)=>pretty_value_(makeBox(n))[0]
            );
            row_string.forEach((s, i)=>{
                if (s.length > col_max[i]) col_max[i] = s.length;
            });
            strings.push(row_string);
            i += last;
        }
        const padded = strings.map((s)=>s.map((s, i)=>s.padStart(col_max[i])
            ).join(' ')
        );
        return [
            `┌─`.padEnd(padded[0].length + 4),
            `│ ${padded[0]}  `,
            ...padded.slice(1).map((x)=>'  ' + x + '  '
            ),
            `${' '.repeat(padded[0].length + 3)}┘`
        ];
    }
    let len = Math.max(...strings.map((ss)=>ss[0].length
    ));
    return [
        `┌~${v._shape.join(' ')}`.padEnd(len + 4),
        `╵ ${strings[0][0]}  `,
        ...strings[0].slice(1).map((s)=>'  ' + s + '  '
        ),
        ...strings.slice(1).flatMap((s)=>s.map((s)=>'  ' + s + '  '
            ).join('\n')
        ),
        `${' '.repeat(len + 3)}┘`
    ];
}
const builtin_functions = {
    '+': [
        id,
        add
    ],
    '-': [
        neg,
        sub
    ],
    '*': [
        sign,
        mult
    ],
    '%': [
        recp,
        div
    ],
    '^': [
        exp,
        pow
    ],
    '√': [
        sqrt,
        root
    ],
    ':%': [
        abs,
        mod
    ],
    ':^': [
        ln,
        log
    ],
    ':-': [
        floor,
        min
    ],
    ':+': [
        ceil,
        max
    ],
    '∧': [
        grade_up,
        and
    ],
    '∨': [
        grade_down,
        or
    ],
    '~': [
        not,
        windows
    ],
    '≤': [
        null,
        cmp_le
    ],
    '<': [
        enclose,
        cmp_lt
    ],
    '≥': [
        null,
        cmp_ge
    ],
    '>': [
        merge,
        cmp_gt
    ],
    '=': [
        length,
        cmp_eq
    ],
    '≠': [
        rank,
        cmp_ne
    ],
    ':=': [
        count,
        match
    ],
    ':≠': [
        depth,
        not_match
    ],
    ';': [
        deshape,
        join
    ],
    ':;': [
        solo,
        couple
    ],
    'ι': [
        iota,
        indexof
    ],
    'ρ': [
        shape1,
        reshape
    ],
    'φ': [
        reverse,
        rotate
    ],
    ':φ': [
        transpose,
        null
    ],
    'μ': [
        group_indices,
        group
    ],
    'ε': [
        mark_firsts,
        membership
    ],
    ':ε': [
        unique,
        find
    ],
    '$': [
        indices,
        replicate
    ],
    '⊣': [
        id,
        left
    ],
    '⊢': [
        id,
        right
    ],
    '¢': [
        first,
        pick
    ],
    ':¢': [
        first_cell,
        select
    ],
    ':<': [
        null,
        take
    ],
    ':>': [
        null,
        drop
    ],
    'δ': [
        (w)=>makeString(pretty_value1(w))
        ,
        (op, w)=>{
            let n = takeScalar(op);
            switch(n){
                case 0:
                    return makeScalar(String.fromCharCode(Number(w._data[0])));
                default:
                    return makeString(pretty_value1(w));
            }
        }
    ],
    ':δ': [
        (w)=>{
            return makeScalar(parseFloat(w._data.map(String).join('')));
        },
        (op, w)=>{
            let str = w._data.map(String).join('');
            let n = takeScalar(op);
            switch(n){
                case 0:
                    return makeScalar(str.charCodeAt(0));
                case 1:
                    return makeScalar(parseInt(str));
                default:
                    return makeScalar(parseInt(str, n));
            }
        }
    ],
    'Shout': [
        (w)=>(alert(pretty_value1(w)), w)
        ,
        null
    ],
    '!': [
        (w)=>{
            if (w._data[0] == undefined) throw "Error";
            const val = w._data[0];
            if (typeof val == 'number' && val == 0) {
                throw "Error";
            }
            return w;
        },
        null
    ],
    'Type': [
        (w)=>w.map((x)=>({
                    s: ' ',
                    n: 0,
                    o: makeEmpty()
                })[(typeof x)[0]]
            )
        ,
        null
    ],
    '?': [
        null,
        (a, w)=>{
            if (w._data[0] == undefined) return a;
            return w;
        }
    ]
};
const builtin_functions_undo = {
    '+': [
        ()=>id
        ,
        (f)=>(a, w)=>sub(f(w), a)
    ],
    '⊣': [
        ()=>id
        ,
        null
    ],
    '⊢': [
        ()=>id
        ,
        null
    ],
    '-': [
        ()=>neg
        ,
        (f)=>(a, w)=>add(f(w), a)
    ],
    '~': [
        ()=>not
        ,
        null
    ],
    'φ': [
        ()=>reverse
        ,
        (f)=>(a, w)=>rotate(neg(a), f(w))
    ],
    ':φ': [
        ()=>transpose
        ,
        null
    ],
    '%': [
        ()=>recp
        ,
        (f)=>(a, w)=>div(f(w), a)
    ],
    '^': [
        ()=>ln
        ,
        (f)=>(a, w)=>log(a, f(w))
    ],
    '√': [
        ()=>(x)=>mult(x, makeScalar(2))
        ,
        (f)=>(a, w)=>pow(f(w), a)
    ],
    ':^': [
        ()=>exp
        ,
        (f)=>(a, w)=>pow(a, f(w))
    ],
    '<': [
        ()=>first
        ,
        null
    ],
    ';': [
        (before)=>(x)=>reshape(shape1(before), x)
        ,
        null
    ],
    ':;': [
        ()=>first_cell
        ,
        null
    ],
    'ρ': [
        (before)=>(x)=>reshape(x, before)
        ,
        (f)=>(_, w)=>reshape(shape1(w), f(w))
    ],
    '¢': [
        (before)=>(x)=>{
                const new_data = [
                    ...before._data
                ];
                if (x.rank != 0) throw "Rank Error";
                new_data[0] = x._data[0];
                return new MultiArray(before._shape, new_data, before._strides);
            }
        ,
        (f)=>(a, w)=>{
                const j = w._data;
                pick_indexes(a, w).forEach((i)=>{
                    j[i] = unwrapBox(f(makeBox(w._data[i])));
                });
                return new MultiArray(w._shape, j, w._strides);
            }
    ],
    ':¢': [
        (before)=>(x)=>{
                const new_data = [
                    ...before._data
                ];
                if (x._shape.length != before._shape.length - 1) throw "Shape Error";
                if (before._shape.slice(1).every((n, i)=>n == x._shape[i]
                ) == false) throw "Shape Error";
                const vals = x._data;
                for(let index = 0; index < vals.length; index++){
                    new_data[index] = vals[index];
                }
                return new MultiArray(before._shape, new_data, before._strides);
            }
        ,
        (f)=>(a, w)=>{
                const j = w._data;
                if (w.rank == 0) throw "Rank Error";
                const select = (slice)=>{
                    const value = f(w.slice(slice));
                    if (slice.shape.length != value.rank && !slice.shape.every((n, i)=>n == value._shape[i]
                    )) throw "Shape Error";
                    for(let i = slice.start, k = 0; i < slice.end; i++){
                        j[i] = value._data[k++];
                    }
                };
                if (a.rank == 0) {
                    let n = takeScalar(a);
                    const slice = w.getFirst(n ?? 0);
                    select(slice);
                    return new MultiArray(w._shape, j, w._strides);
                }
                let n = takeNumbers(a.deshape());
                n.forEach((i)=>select(w.getFirst(i))
                );
                return new MultiArray(w._shape, j, w._strides);
            }
    ],
    '$': [
        ()=>under_indices
        ,
        (f)=>(a, w)=>{
                const indices = takeNumbers(a);
                if (indices.length != w.length) throw "Length Error";
                const cells = w.firstAxisToArray().map((s)=>w.slice(s)
                );
                let data = [];
                for(let i = 0; i < indices.length; i++){
                    const n = indices[i];
                    if (n == 0) {
                        data = data.concat(cells[i]._data);
                    } else {
                        const result = f(makeBox(cells[i]));
                        if (result.rank != w.rank - 1) throw "Rank Error";
                        if (!result._shape.every((n, i)=>n == w._shape[i + 1]
                        )) throw "Shape Error";
                        data = data.concat(result._data);
                    }
                }
                return new MultiArray(w._shape, data, w._strides);
            }
    ],
    ':<': [
        null,
        (f)=>(a, w)=>{
                const n = takeScalar(a);
                if (n >= 0) {
                    return join(f(take(a, w)), drop(a, w));
                }
                return join(drop(a, w), f(take(a, w)));
            }
    ],
    ':>': [
        null,
        (f)=>(a, w)=>{
                const n = takeScalar(a);
                if (n >= 0) {
                    return join(take(a, w), f(drop(a, w)));
                }
                return join(f(drop(a, w)), take(a, w));
            }
    ]
};
const builtin_monads = {
    '/': ([alpha1, alpha2])=>{
        if (alpha2 == null) throw "An error";
        return [
            reduce(alpha2),
            null
        ];
    },
    '\\': ([alpha1, alpha2])=>{
        if (alpha2 == null) throw "An error";
        return [
            (w)=>{
                const slices = w.firstAxisToArray();
                const new_cells = [
                    w.slice(slices[0])
                ];
                slices.slice(1).forEach((slice, i)=>{
                    const a_ = makeBox(new_cells[i]);
                    const w_ = w.slice(slice);
                    let val = alpha2(a_, w_);
                    if (val.rank == 0) val = val._data[0];
                    new_cells.push(val);
                });
                return makeArray(new_cells);
            },
            null
        ];
    },
    '§': ([alpha1, alpha2])=>{
        if (alpha2 == null) throw "An error";
        return [
            (w)=>alpha2(w, w)
            ,
            (a, w)=>alpha2(w, a)
        ];
    },
    '¨': ([alpha1, alpha2])=>{
        return [
            (w)=>{
                if (alpha1 == null) throw "Function at ¨ is not prefix";
                return each(alpha1)(w);
            },
            (a, w)=>{
                if (alpha2 == null) throw "Function at ¨ is not infix";
                return MultiArray.zip(a, w, underBoxInfix(alpha2));
            }
        ];
    },
    '´': ([alpha1, alpha2])=>{
        return [
            (w)=>{
                if (alpha1 == null) throw "Function at ´ is not prefix";
                return each(alpha1)(w);
            },
            (a, w)=>{
                if (alpha2 == null) throw "Function at ´ is not infix";
                return table(alpha2)(a, w);
            }
        ];
    },
    '`': ([alpha1, alpha2])=>{
        return [
            (w)=>{
                if (alpha1 == null) throw "Function at ` is not prefix";
                return cellsPrefix(alpha1)(w);
            },
            (a, w)=>{
                if (alpha2 == null) throw "Function at ` is not infix";
                if (a.rank == 0) return cellsPrefix((w)=>alpha2(a, w)
                )(w);
                if (w.rank == 0) return cellsPrefix((a)=>alpha2(a, w)
                )(a);
                return cellsInfix(alpha2)(a, w);
            }
        ];
    }
};
const builtin_dyads = {
    '•': ([alpha1, alpha2], [omega1, omega2])=>{
        if (alpha1 == null) throw "Left function at • is not prefix";
        return [
            (w)=>{
                if (omega1 == null) throw "Right function at • is not prefix";
                return alpha1(omega1(w));
            },
            (a, w)=>{
                if (omega2 == null) throw "Right function at • is not infix";
                return alpha1(omega2(a, w));
            }
        ];
    },
    '°': ([alpha1, alpha2], [omega1, omega2])=>{
        if (omega1 == null) throw "Right function at ° is not prefix";
        return [
            (w)=>{
                if (alpha1 == null) throw "Left function at ° is not prefix";
                return alpha1(omega1(w));
            },
            (a, w)=>{
                if (alpha2 == null) throw "Left function at ° is not infix";
                return alpha2(omega1(a), omega1(w));
            }
        ];
    },
    '→': ([alpha1, alpha2], [omega1, omega2])=>{
        if (omega2 == null) throw "Right function at → is not infix";
        if (alpha1 == null) throw "Left function at → is not prefix";
        return [
            (w)=>omega2(alpha1(w), w)
            ,
            (a, w)=>omega2(alpha1(a), w)
        ];
    },
    '←': ([alpha1, alpha2], [omega1, omega2])=>{
        if (alpha2 == null) throw "Left function at ← is not infix";
        if (omega1 == null) throw "Right function at ← is not prefix";
        return [
            (w)=>alpha2(w, omega1(w))
            ,
            (a, w)=>alpha2(a, omega1(w))
        ];
    },
    '↑': ([alpha1, alpha2], [omega1, omega2])=>{
        return [
            (w)=>{
                if (alpha1 == null) throw "Left function at ↑ is not prefix";
                if (omega1 == null) throw "Right function at ↑ is not prefix";
                const n = takeScalar(omega1(w));
                let result = w;
                for(let i = 0; i < n; ++i){
                    result = alpha1(result);
                }
                return result;
            },
            (a, w)=>{
                if (alpha2 == null) throw "Left function at ↑ is not infix";
                if (omega2 == null) throw "Right function at ↑ is not infix";
                const n = takeScalar(omega2(a, w));
                let result = w;
                for(let i = 0; i < n; ++i){
                    result = alpha2(a, result);
                }
                return result;
            }, 
        ];
    },
    '¤': ([alpha1, alpha2], [omega1, omega2])=>{
        throw "Can't find under for the function";
    },
    '@': ([alpha1, alpha2], [omega1, omega2])=>{
        if (alpha1 == null) "Left function at @ is not prefix";
        if (omega2 == null) "Right function at @ is not prefix";
        return [
            alpha1,
            omega2
        ];
    }
};
function pretty_value1(v) {
    return pretty_value_(v).join('\n');
}
function evaluate_func(e, self, context_alpha, context_omega, globals, funcs) {
    switch(e.kind){
        case ExprKind.Func:
            {
                if (e.name == 'λ') return self;
                let v = builtin_functions[e.name];
                if (v === undefined) v = funcs[e.name];
                if (v === undefined) throw new SaliteError(`Name Error: Undefined name ${e.name}`);
                return v;
            }
        case ExprKind.Monad:
            {
                const alpha = evaluate_func(e.alpha, self, context_alpha, context_omega, globals, funcs);
                const monad = builtin_monads[e.mod];
                if (!monad) throw new SaliteError(`Name Error: Undefined name ${e.mod}`);
                return monad(alpha);
            }
        case ExprKind.Dyad:
            {
                if (e.mod === '¤' && e.omega.kind == ExprKind.Func) {
                    const undo = builtin_functions_undo[e.omega.name];
                    const do_f = builtin_functions[e.omega.name];
                    if (!do_f) throw new SaliteError(`Name Error: Undefined name ${e.omega.name}`);
                    const [do1, do2] = do_f;
                    if (undo) {
                        const [undo1, undo2] = undo;
                        const [alpha1, alpha2] = evaluate_func(e.alpha, self, context_alpha, context_omega, globals, funcs);
                        if (alpha1 == null) throw "Left function at ¤ is not prefix";
                        return [
                            (w)=>{
                                if (undo1 === null) throw "Can't find undo for function";
                                const g = undo1(w);
                                if (!do1) throw "Function is not prefix";
                                return g(alpha1(do1(w)));
                            },
                            (a, w)=>{
                                if (!undo2) throw "Can't find undo for function";
                                return undo2(alpha1)(a, w);
                            }
                        ];
                    }
                }
                const alpha = evaluate_func(e.alpha, self, context_alpha, context_omega, globals, funcs);
                const omega = evaluate_func(e.omega, self, context_alpha, context_omega, globals, funcs);
                const dyad = builtin_dyads[e.mod];
                if (!dyad) throw new SaliteError(`Name Error: Undefined name ${e.mod}`);
                return dyad(alpha, omega);
            }
        case ExprKind.Fork:
            {
                const [alpha1, alpha2] = evaluate_func(e.alpha, self, context_alpha, context_omega, globals, funcs);
                const [omega1, omega2] = evaluate_func(e.omega, self, context_alpha, context_omega, globals, funcs);
                const [_3, infix] = evaluate_func(e.infix, self, context_alpha, context_omega, globals, funcs);
                if (infix == null) {
                    throw new SaliteArityError(2, 'middle of fork');
                }
                return [
                    (w)=>{
                        if (alpha1 == null) throw new SaliteArityError(1, 'left of fork');
                        if (omega1 == null) throw new SaliteArityError(1, 'right of fork');
                        return infix(alpha1(w), omega1(w));
                    },
                    (a, w)=>{
                        if (alpha2 == null) throw new SaliteArityError(2, 'left of fork');
                        if (omega2 == null) throw new SaliteArityError(2, 'right of fork');
                        return infix(alpha2(a, w), omega2(a, w));
                    }
                ];
            }
        case ExprKind.Train:
            {
                const [alpha1, _] = evaluate_func(e.alpha, self, context_alpha, context_omega, globals, funcs);
                const [omega1, omega2] = evaluate_func(e.omega, self, context_alpha, context_omega, globals, funcs);
                if (alpha1 == null) throw new SaliteArityError(1, 'left of atop');
                return [
                    (w)=>{
                        if (omega1 == null) throw new SaliteArityError(1, 'right of atop');
                        return alpha1(omega1(w));
                    },
                    (a, w)=>{
                        if (omega2 == null) throw new SaliteArityError(2, 'right of atop');
                        return alpha1(omega2(a, w));
                    }
                ];
            }
        case ExprKind.Defn:
            {
                const last = e.fn[e.fn.length - 1];
                const make_the_things = (a, w)=>{
                    const locals = {
                        ...globals
                    };
                    const locals_funcs = {
                        ...funcs
                    };
                    for(let i = 0; i < e.fn.length - 1; i++){
                        const def_or_guard = e.fn[i];
                        switch(def_or_guard.kind){
                            case ExprKind.Decl:
                                {
                                    if (def_or_guard.is_func) {
                                        const val = evaluate_func(def_or_guard.value, rec, a, w, locals, locals_funcs);
                                        locals_funcs[def_or_guard.name] = val;
                                    } else {
                                        const val = evaluate(def_or_guard.value, rec, a, w, locals, locals_funcs);
                                        locals[def_or_guard.name] = val;
                                    }
                                    break;
                                }
                            case ExprKind.Guard:
                                {
                                    const val = evaluate(def_or_guard.expr, rec, a, w, locals, locals_funcs);
                                    if (val._data.length == 0) {
                                        return evaluate(def_or_guard.fall, rec, a, w, locals, locals_funcs);
                                    }
                                    if (val.rank == 0 && !val._data[0]) {
                                        return evaluate(def_or_guard.fall, rec, a, w, locals, locals_funcs);
                                    }
                                    break;
                                }
                            default:
                                evaluate(def_or_guard, rec, a, w, locals, locals_funcs);
                        }
                    }
                    return evaluate(last, rec, a, w, locals, locals_funcs);
                };
                const rec = [
                    (w)=>make_the_things(makeEmpty(), w)
                    ,
                    (a, w)=>make_the_things(a, w)
                ];
                return rec;
            }
        default:
            {
                const val = evaluate(e, self, context_alpha, context_omega, globals, funcs);
                return [
                    ()=>val
                    ,
                    ()=>val
                ];
            }
    }
}
function evaluate(e, self, context_alpha, context_omega, globals, funcs) {
    switch(e.kind){
        case ExprKind.Number:
            return makeScalar(e.value);
        case ExprKind.String:
            if (e.value.length == 1) {
                return makeScalar(e.value);
            }
            return makeString(e.value);
        case ExprKind.Id:
            {
                if (e.value == 'α') return context_alpha;
                if (e.value == 'ω') return context_omega;
                let v = globals[e.value];
                if (v === undefined) throw new SaliteError(`Name Error: Undefined name ${e.value}`);
                return v;
            }
        case ExprKind.Vector:
            {
                if (e.value.length == 0) {
                    return makeEmpty();
                }
                let vals = e.value.map((e)=>unwrapBox(evaluate(e, self, context_alpha, context_omega, globals, funcs))
                );
                return makeArray(vals);
            }
        case ExprKind.Prefix:
            {
                let func = evaluate_func(e.func, self, context_alpha, context_omega, globals, funcs)[0];
                if (func === null) throw new SaliteArityError(1);
                let omega = evaluate(e.omega, self, context_alpha, context_omega, globals, funcs);
                let result = func(omega);
                return result;
            }
        case ExprKind.Infix:
            {
                let func = evaluate_func(e.func, self, context_alpha, context_omega, globals, funcs)[1];
                if (func === null) throw new SaliteArityError(2);
                let alpha = evaluate(e.alpha, self, context_alpha, context_omega, globals, funcs);
                let omega = evaluate(e.omega, self, context_alpha, context_omega, globals, funcs);
                let result = func(alpha, omega);
                return result;
            }
        default:
            console.log(e);
            throw `Value Error: Not a value - ${pretty_expr(e)}`;
    }
}
function run1(expr, globals, foreign) {
    let stmts = parse(expr);
    let funcs = {
    };
    for(const f in foreign){
        funcs[f] = [
            foreign[f],
            foreign[f]
        ];
    }
    let locals = {
        ...globals
    };
    let self_ = [
        null,
        null
    ];
    let alpha = makeEmpty();
    let omega = makeEmpty();
    for(let i = 0; i < stmts.length - 1; i++){
        const def_or_guard = stmts[i];
        switch(def_or_guard.kind){
            case ExprKind.Decl:
                {
                    if (def_or_guard.is_func) {
                        const val = evaluate_func(def_or_guard.value, self_, alpha, omega, locals, funcs);
                        funcs[def_or_guard.name] = val;
                    } else {
                        const val = evaluate(def_or_guard.value, self_, alpha, omega, locals, funcs);
                        locals[def_or_guard.name] = val;
                    }
                    break;
                }
            case ExprKind.Guard:
                {
                    const val = evaluate(def_or_guard.expr, self_, alpha, omega, locals, funcs);
                    if (val._data.length == 0) {
                        return evaluate(def_or_guard.fall, self_, alpha, omega, locals, funcs);
                    }
                    if (val.rank == 0 && !val._data[0]) {
                        return evaluate(def_or_guard.fall, self_, alpha, omega, locals, funcs);
                    }
                    break;
                }
            default:
                evaluate(def_or_guard, self_, alpha, omega, locals, funcs);
        }
    }
    const last_result = evaluate(stmts[stmts.length - 1], self_, alpha, omega, locals, funcs);
    return last_result;
}
const Cast1 = {
    number: (n)=>makeScalar(n)
    ,
    string: (s)=>makeString(s)
};
function tokens1(expr) {
    const table = {
        [TokenType.Func]: 'func',
        [TokenType.Monad]: 'monad',
        [TokenType.Dyad]: 'dyad',
        [TokenType.Number]: 'const',
        [TokenType.Empty]: 'const',
        [TokenType.String]: 'string',
        [TokenType.Error]: 'error',
        [TokenType.Comment]: 'comment',
        [TokenType.Define]: 'control',
        [TokenType.Pipe]: 'control'
    };
    try {
        const tks = tokenize(expr, true);
        let code = [];
        let col = 0;
        for (const tk of tks){
            if (tk.col === undefined) continue;
            const start = tk.col[0];
            const end = tk.col[1];
            const start_text = expr.slice(col, start);
            if (start_text.length > 0) {
                code.push({
                    kind: 'none',
                    text: expr.slice(col, start)
                });
            }
            const end_kind = table[tk.kind] ?? 'none';
            code.push({
                kind: end_kind,
                text: expr.slice(start, end)
            });
            col = end;
        }
        return code;
    } catch  {
        return null;
    }
}
const symbol_overstrike1 = {
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
    'ø': 'o/'
};
const symbol_names1 = {
    functions: {
        '+': [
            'Id',
            'Add'
        ],
        '-': [
            'Negation',
            'Subtract'
        ],
        '*': [
            'Sign',
            'Multiply'
        ],
        '%': [
            'Reciprocal',
            'Divide'
        ],
        '^': [
            'Exponential',
            'Power'
        ],
        ':%': [
            'Absolute',
            'Modulus'
        ],
        '√': [
            'Square Root',
            'Root'
        ],
        ':^': [
            'Natural Log',
            'Logarithm'
        ],
        ':-': [
            'Floor',
            'Minimun'
        ],
        ':+': [
            'Ceil',
            'Maximum'
        ],
        '∧': [
            'Grade Up',
            'And'
        ],
        '∨': [
            'Grade Down',
            'Or'
        ],
        '~': [
            'Not',
            'Windows'
        ],
        '≤': [
            null,
            'Less Equals'
        ],
        '<': [
            'Enclose',
            'Less Than'
        ],
        '≥': [
            null,
            'greater Equals'
        ],
        '>': [
            'Merge',
            'greater Than'
        ],
        '=': [
            'Length',
            'Equals'
        ],
        '≠': [
            'Rank',
            'Not Equals'
        ],
        ':=': [
            'Count',
            'Match'
        ],
        ':≠': [
            'Depth',
            'Not Match'
        ],
        ';': [
            'Deshape',
            'Join'
        ],
        ':;': [
            'Solo',
            'Couple'
        ],
        'ι': [
            'Range',
            'Indexof'
        ],
        'ρ': [
            'Shape',
            'Reshape'
        ],
        'φ': [
            'Reverse',
            'Rotate'
        ],
        ':φ': [
            'Transpose',
            null
        ],
        'μ': [
            'Group Indices',
            'Group'
        ],
        'ε': [
            'Mark Firsts',
            'Membership'
        ],
        ':ε': [
            'Unique',
            'Find'
        ],
        '$': [
            'Indices',
            'Replicate'
        ],
        '⊣': [
            'Id',
            'Left'
        ],
        '⊢': [
            'Id',
            'Right'
        ],
        '¢': [
            'First',
            'Pick'
        ],
        ':¢': [
            'First Cell',
            'Select'
        ],
        ':<': [
            null,
            'Take'
        ],
        ':>': [
            null,
            'Drop'
        ],
        'δ': [
            'Format',
            'Format'
        ],
        ':δ': [
            'Parse',
            'Parse Radix'
        ],
        '!': [
            'Assert',
            'Assert'
        ]
    },
    monads: {
        '/': 'Fold',
        '\\': 'Scan',
        '¨': 'Each',
        '`': 'Cells',
        '´': 'Table',
        '§': 'Self/Swap'
    },
    dyads: {
        '•': 'Atop',
        '°': 'Over',
        '¤': 'Under',
        '→': 'Bind Right',
        '←': 'Bind Left',
        '↑': 'Repeat',
        '@': 'Choose'
    }
};
export { pretty_value1 as pretty_value };
export { run1 as run };
export { Cast1 as Cast,  };
export { tokens1 as tokens };
export { symbol_overstrike1 as symbol_overstrike,  };
export { symbol_names1 as symbol_names };
