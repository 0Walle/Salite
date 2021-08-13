const _same_shape = (x, y)=>{
    return x.length == y.length && x.every((n, i)=>y[i] == n
    );
};
class MultiArray {
    _shape;
    _strides;
    _data;
    constructor(shape1, data, strides){
        if (data.length == 0) {
            this._shape = [];
            this._strides = [];
            this._data = [];
            return;
        }
        this._shape = shape1;
        this._data = data;
        if (strides) {
            this._strides = strides;
        } else if (shape1.length == 0) {
            this._strides = [];
        } else if (shape1.length == 1) {
            this._strides = [
                1
            ];
        } else {
            this._strides = shape1.map((_, i)=>shape1.slice(i + 1).reduce((a, b)=>a * b
                , 1)
            );
        }
    }
    static from(iter) {
        let data1 = Array.from(iter);
        return new MultiArray([
            data1.length
        ], data1);
    }
    static same_shape(a, b) {
        return _same_shape(a._shape, b._shape);
    }
    static zip(s, t, f) {
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
        let data1 = Array(gt_len);
        const stride = lt.rank == 0 ? 0 : 1 / gt._strides[lt.rank - 1];
        if (s == gt) {
            for(let i = 0; i < gt_len; i++){
                data1[i] = f(s._data[i], t._data[Math.floor(i * stride)]);
            }
        } else {
            for(let i = 0; i < gt_len; i++){
                data1[i] = f(s._data[Math.floor(i * stride)], t._data[i]);
            }
        }
        return new MultiArray(gt._shape, data1, gt._strides);
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
        const shape2 = this._shape.slice(1);
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
                shape: shape2,
                start: i,
                end: i + stride
            });
            i += stride;
        }
        return result;
    }
    get(index) {
        if (index.length != this._shape.length) throw "Length Error";
        const i = index.map((x, i1)=>(x < 0 ? this._shape[i1] + x : x) * this._strides[i1]
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
        const shape2 = this._shape.slice(1);
        const stride = this._strides[0];
        return {
            start: index * stride,
            end: (index + 1) * stride,
            shape: shape2
        };
    }
    slice(s) {
        return new MultiArray(s.shape, this._data.slice(s.start, s.end));
    }
    select(slices) {
        if (slices.length == 0) return new MultiArray([], []);
        let new_data = [];
        let shape2 = slices[0].shape;
        for(let i = 0; i < slices.length; i++){
            const slice = slices[i];
            new_data = new_data.concat(this._data.slice(slice.start, slice.end));
        }
        return new MultiArray([
            slices.length,
            ...shape2
        ], new_data);
    }
}
function fromMultiArray(m) {
    switch(typeof m._data[0]){
        case "number":
            return {
                kind: 'num',
                value: m
            };
        case "string":
            return {
                kind: 'char',
                value: m
            };
        case "object":
            return {
                kind: 'box',
                value: m
            };
        default:
            return {
                kind: 'box',
                value: new MultiArray([], [])
            };
    }
}
function fromMultiArrayUnwrap(m) {
    switch(typeof m._data[0]){
        case "number":
            return {
                kind: 'num',
                value: m
            };
        case "string":
            return {
                kind: 'char',
                value: m
            };
        case "object":
            if (m.rank == 0) return m._data[0] ?? makeEmpty();
            return {
                kind: 'box',
                value: m
            };
        default:
            return {
                kind: 'box',
                value: new MultiArray([], [])
            };
    }
}
function makeChar(ch) {
    return {
        kind: 'char',
        value: new MultiArray([], [
            ch
        ])
    };
}
function makeScalar(n) {
    return {
        kind: 'num',
        value: new MultiArray([], [
            n
        ])
    };
}
function chooseScalar(v) {
    switch(typeof v){
        case "number":
            return {
                kind: 'num',
                value: new MultiArray([], [
                    v
                ])
            };
        case "string":
            return {
                kind: 'char',
                value: new MultiArray([], [
                    v
                ])
            };
        case "object":
            return v;
        default:
            throw "Really Bad Error";
    }
}
function makeArray(arr, empty = 'box') {
    if (arr.length == 0) {
        return {
            kind: empty,
            value: new MultiArray([], [])
        };
    }
    switch(typeof arr[0]){
        case "number":
            return {
                kind: 'num',
                value: new MultiArray([
                    arr.length
                ], arr)
            };
        case "string":
            return {
                kind: 'char',
                value: new MultiArray([
                    arr.length
                ], arr)
            };
        case "object":
            return {
                kind: 'box',
                value: new MultiArray([
                    arr.length
                ], arr)
            };
    }
}
function makeEmpty(kind = 'box') {
    return {
        kind: kind,
        value: new MultiArray([], [])
    };
}
function makeString(str) {
    const a = Array.from(str);
    return {
        kind: 'char',
        value: new MultiArray([
            a.length
        ], a)
    };
}
function throwErr(err) {
    return (_)=>{
        throw new Error(err);
    };
}
function makeArithPrefix(num) {
    const rec = (x)=>{
        switch(x.kind){
            case "num":
                return num(x.value);
            case "char":
                return throwErr("Domain Error")(x);
            case "box":
                return fromMultiArray(x.value.map(makeArithPrefix(num)));
        }
    };
    return rec;
}
function makeArithInfix(num) {
    const rec = (x, y)=>{
        if (x.kind != y.kind) return throwErr(`Domain Error: ${x.kind} ≠ ${y.kind}`)(x);
        switch(x.kind){
            case "num":
                return fromMultiArray(MultiArray.zip(x.value, y.value, num));
            case "char":
                return throwErr("Domain Error")(x);
            case "box":
                return fromMultiArray(MultiArray.zip(x.value, y.value, makeArithInfix(num)));
        }
    };
    return rec;
}
function makeSameKind(f) {
    return (x, y)=>{
        if (x.kind != y.kind) return throwErr("Domain Error")(x);
        return fromMultiArray(f(x.value, y.value));
    };
}
const add = makeArithInfix((x, y)=>x + y
);
const neg = makeArithPrefix((v)=>fromMultiArray(v.map((x)=>-x
    ))
);
const sub = makeArithInfix((x, y)=>x - y
);
const sign = makeArithPrefix((v)=>fromMultiArray(v.map((x)=>Math.sign(x)
    ))
);
const mult = makeArithInfix((x, y)=>x * y
);
const recp = makeArithPrefix((v)=>fromMultiArray(v.map((x)=>1 / x
    ))
);
const div = makeArithInfix((x, y)=>x / y
);
const exp = makeArithPrefix((v)=>fromMultiArray(v.map((x)=>Math.exp(x)
    ))
);
const pow = makeArithInfix((x, y)=>x ** y
);
const ln = makeArithPrefix((v)=>fromMultiArray(v.map((x)=>Math.log(x)
    ))
);
const root = makeArithInfix((x, y)=>y ** (1 / x)
);
const sqrt = makeArithPrefix((v)=>fromMultiArray(v.map((x)=>Math.sqrt(x)
    ))
);
const log = makeArithInfix((x, y)=>Math.log(y) / Math.log(x)
);
const abs = makeArithPrefix((v)=>fromMultiArray(v.map((x)=>Math.abs(x)
    ))
);
const mod = makeArithInfix((x, y)=>x == 0 ? y : y % x
);
const floor = makeArithPrefix((v)=>fromMultiArray(v.map((x)=>Math.floor(x)
    ))
);
const min = makeArithInfix((x, y)=>Math.min(x, y)
);
const ceil = makeArithPrefix((v)=>fromMultiArray(v.map((x)=>Math.ceil(x)
    ))
);
const max = makeArithInfix((x, y)=>Math.max(x, y)
);
const and = makeArithInfix((x, y)=>x & y
);
const or = makeArithInfix((x, y)=>x | y
);
const not = makeArithPrefix((v)=>fromMultiArray(v.map((x)=>1 - x
    ))
);
const length = (x)=>{
    if (x.value._data.length == 0) return makeScalar(0);
    return makeScalar(x.value._shape[0] ?? 1);
};
const rank = (x)=>makeScalar(x.value._shape.length)
;
const shape2 = (x)=>makeArray(x.value._shape)
;
const count = (x)=>makeScalar(x.value._data.length)
;
const cmp_lt = (x, y)=>{
    if (x.kind != y.kind) return throwErr("Domain Error")(x);
    if (x.value.rank != y.value.rank) return throwErr("Rank Error")(x);
    switch(x.kind){
        case "num":
            return fromMultiArray(MultiArray.zip(x.value, y.value, (x1, y1)=>+(x1 < y1)
            ));
        case "char":
            {
                if (x.value.rank == 1) {
                    return makeScalar(+(x.value._data.join('') < y.value._data.join('')));
                }
                return fromMultiArray(MultiArray.zip(x.value, y.value, (x1, y1)=>+(x1 < y1)
                ));
            }
        case "box":
            {
                return fromMultiArray(MultiArray.zip(x.value, y.value, (x1, y1)=>cmp_lt(x1, y1)
                ));
            }
    }
};
const cmp_le = (x, y)=>{
    if (x.kind != y.kind) return throwErr("Domain Error")(x);
    if (x.value.rank != y.value.rank) return throwErr("Rank Error")(x);
    switch(x.kind){
        case "num":
            return fromMultiArray(MultiArray.zip(x.value, y.value, (x1, y1)=>+(x1 <= y1)
            ));
        case "char":
            {
                if (x.value.rank == 1) {
                    return makeScalar(+(x.value._data.join('') <= y.value._data.join('')));
                }
                return fromMultiArray(MultiArray.zip(x.value, y.value, (x1, y1)=>+(x1 <= y1)
                ));
            }
        case "box":
            {
                return fromMultiArray(MultiArray.zip(x.value, y.value, (x1, y1)=>cmp_le(x1, y1)
                ));
            }
    }
};
const cmp_ge = (x, y)=>{
    if (x.kind != y.kind) return throwErr("Domain Error")(x);
    if (x.value.rank != y.value.rank) return throwErr("Rank Error")(x);
    switch(x.kind){
        case "num":
            return fromMultiArray(MultiArray.zip(x.value, y.value, (x1, y1)=>+(x1 >= y1)
            ));
        case "char":
            {
                if (x.value.rank == 1) {
                    return makeScalar(+(x.value._data.join('') >= y.value._data.join('')));
                }
                return fromMultiArray(MultiArray.zip(x.value, y.value, (x1, y1)=>+(x1 >= y1)
                ));
            }
        case "box":
            {
                return fromMultiArray(MultiArray.zip(x.value, y.value, (x1, y1)=>cmp_ge(x1, y1)
                ));
            }
    }
};
const cmp_gt = (x, y)=>{
    if (x.kind != y.kind) return throwErr("Domain Error")(x);
    if (x.value.rank != y.value.rank) return throwErr("Rank Error")(x);
    switch(x.kind){
        case "num":
            return fromMultiArray(MultiArray.zip(x.value, y.value, (x1, y1)=>+(x1 > y1)
            ));
        case "char":
            {
                if (x.value.rank == 1) {
                    return makeScalar(+(x.value._data.join('') > y.value._data.join('')));
                }
                return fromMultiArray(MultiArray.zip(x.value, y.value, (x1, y1)=>+(x1 > y1)
                ));
            }
        case "box":
            {
                return fromMultiArray(MultiArray.zip(x.value, y.value, (x1, y1)=>cmp_gt(x1, y1)
                ));
            }
    }
};
const cmp_eq = (x, y)=>{
    if (x.kind != y.kind) return throwErr("Domain Error")(x);
    switch(x.kind){
        case "num":
            return fromMultiArray(MultiArray.zip(x.value, y.value, (x1, y1)=>+(x1 == y1)
            ));
        case "char":
            return fromMultiArray(MultiArray.zip(x.value, y.value, (x1, y1)=>+(x1 == y1)
            ));
        case "box":
            return fromMultiArray(MultiArray.zip(x.value, y.value, (x1, y1)=>+match_values(x1, y1)
            ));
    }
};
const cmp_ne = (x, y)=>{
    if (x.kind != y.kind) return throwErr("Domain Error")(x);
    switch(x.kind){
        case "num":
            return fromMultiArray(MultiArray.zip(x.value, y.value, (x1, y1)=>+(x1 != y1)
            ));
        case "char":
            return fromMultiArray(MultiArray.zip(x.value, y.value, (x1, y1)=>+(x1 != y1)
            ));
        case "box":
            return fromMultiArray(MultiArray.zip(x.value, y.value, (x1, y1)=>+!match_values(x1, y1)
            ));
    }
};
function match_values(a, b) {
    if (a.kind != b.kind) return false;
    switch(a.kind){
        case 'num':
            return a.value.match(b.value, (x, y)=>x == y
            );
        case 'char':
            return a.value.match(b.value, (x, y)=>x == y
            );
        case 'box':
            return a.value.match(b.value, match_values);
    }
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
    if (x.value._data.length == 0) return y;
    if (y.value._data.length == 0) return x;
    return makeSameKind((x1, y1)=>x1.concat(y1)
    )(x, y);
};
const couple = (x, y)=>{
    if (x.kind == y.kind) {
        return fromMultiArray(x.value.couple(y.value));
    }
    if (!MultiArray.same_shape(x.value, y.value)) throw "Shape Error";
    const a = x.value.firstAxisToArray().map((slice)=>fromMultiArrayUnwrap(x.value.slice(slice))
    );
    const b = y.value.firstAxisToArray().map((slice)=>fromMultiArrayUnwrap(y.value.slice(slice))
    );
    return fromMultiArray(new MultiArray([
        2,
        ...x.value._shape
    ], a.concat(b)));
};
const deshape = (x)=>({
        kind: x.kind,
        value: x.value.deshape()
    })
;
const reshape = (x, y)=>{
    if (x.kind != 'num') throw "Domain Error";
    return {
        kind: y.kind,
        value: y.value.reshape(x.value._data)
    };
};
const iota = (x)=>{
    if (x.kind != 'num') throw "Domain Error";
    const length1 = Math.floor(x.value._data.reduce((a, b)=>a * b
    ));
    if (length1 < 0) throw "Length Error";
    if (length1 == 0) return makeEmpty('num');
    const data1 = Array(length1).fill(0).map((_, i)=>i
    );
    return {
        kind: 'num',
        value: new MultiArray(x.value._data, data1).reshape(x.value._data)
    };
};
const reverse = (v)=>{
    if (v.value.rank == 0) return v;
    const slices = v.value.firstAxisToArray();
    const __final = v.value.select(slices.reverse());
    return {
        kind: v.kind,
        value: __final
    };
};
const rotate = (x, y)=>{
    if (x.kind != 'num') throw "Domain Error";
    if (x.value.rank != 0) throw "Rank Error";
    const n = x.value._data[0];
    if (y.value.rank == 0) return y;
    if (n > 0) {
        const slices = y.value.firstAxisToArray();
        const removed = slices.splice(0, n % slices.length);
        const rotated_slices = [
            ...slices,
            ...removed
        ];
        const rotated = y.value.select(rotated_slices);
        return {
            kind: y.kind,
            value: rotated
        };
    } else {
        const slices = y.value.firstAxisToArray();
        const removed = slices.splice(0, (slices.length + n) % slices.length);
        const rotated_slices = [
            ...slices,
            ...removed
        ];
        const rotated = y.value.select(rotated_slices);
        return {
            kind: y.kind,
            value: rotated
        };
    }
};
const take = (x, y)=>{
    if (x.kind != 'num') throw "Domain Error";
    const n = x.value._data[0];
    const slices = y.value.firstAxisToArray();
    if (n > 0) {
        const __final = y.value.select(slices.slice(0, n));
        return {
            kind: y.kind,
            value: __final
        };
    }
    const __final = y.value.select(slices.slice(slices.length + n));
    return {
        kind: y.kind,
        value: __final
    };
};
const drop = (x, y)=>{
    if (x.kind != 'num') throw "Domain Error";
    const n = x.value._data[0];
    const slices = y.value.firstAxisToArray();
    if (n > 0) {
        const __final = y.value.select(slices.slice(n));
        return {
            kind: y.kind,
            value: __final
        };
    }
    const __final = y.value.select(slices.slice(0, n));
    return {
        kind: y.kind,
        value: __final
    };
};
const first = (x)=>{
    const val = chooseScalar(x.value._data[0]);
    return val;
};
const first_cell = (y)=>{
    const __final = y.value.getFirst(0);
    return {
        kind: y.kind,
        value: y.value.slice(__final)
    };
};
const pick = (x, y)=>{
    if (x.kind == 'box') {
        const result = x.value.map((i)=>pick(i, y).value._data[0]
        );
        return {
            kind: y.kind,
            value: result
        };
    }
    if (x.kind != 'num') throw "Domain Error";
    if (x.value.rank == 0) {
        const val = y.value._data[x.value._data[0]];
        return chooseScalar(val);
    }
    const val = y.value.get(x.value._data);
    return chooseScalar(val);
};
const select = (x, y)=>{
    if (x.kind != 'num') throw "Domain Error";
    if (y.value.rank == 0) throw "Rank Error";
    if (x.value.rank == 0) {
        const slice = y.value.getFirst(x.value._data[0] ?? 0);
        return {
            kind: y.kind,
            value: y.value.slice(slice)
        };
    }
    if (x.value.rank != 1) throw "Rank Error";
    const slices = x.value._data.map((i)=>y.value.getFirst(i)
    );
    return {
        kind: y.kind,
        value: y.value.select(slices)
    };
};
const membership = (y, x)=>{
    if (x.kind != y.kind) throw "Domain Error";
    const __final = y.value.map((a)=>{
        for (const val of x.value._data){
            if (val == a) return 1;
        }
        return 0;
    });
    return {
        kind: 'num',
        value: __final
    };
};
const indexof = (x, y)=>{
    if (x.kind != y.kind) throw "Domain Error";
    const __final = y.value.map((a)=>{
        for(let i = 0; i < x.value._data.length; ++i){
            if (x.value._data[i] == a) return i;
        }
        return x.value._data.length;
    });
    return {
        kind: 'num',
        value: __final
    };
};
const indices = (x)=>{
    if (x.kind != 'num') throw "Domain Error";
    if (x.value.rank != 1) throw "Shape Error";
    const data1 = x.value._data.flatMap((n, i)=>Array(n).fill(i)
    );
    return makeArray(data1);
};
const replicate = (x, y)=>{
    if (x.kind != 'num') throw "Domain Error";
    if (x.value.rank != 1) throw "Shape Error";
    const indices_list = x.value._data;
    if (y.value.length !== indices_list.length) throw "Lenght Error";
    const indices1 = indices_list.flatMap((n, i)=>Array(n).fill(i)
    );
    const slices = indices1.map((i)=>y.value.getFirst(i)
    );
    const __final = y.value.select(slices);
    return {
        kind: y.kind,
        value: __final
    };
};
const mark_firsts = (x)=>{
    if (x.value.rank != 1) throw "Shape Error";
    const uniques = new Set();
    const data1 = x.value.map((n)=>uniques.has(n) ? 0 : (uniques.add(n), 1)
    );
    return {
        kind: 'num',
        value: data1
    };
};
const unique = (x)=>{
    if (x.value.rank != 1) throw "Shape Error";
    switch(x.kind){
        case 'num':
            {
                const uniques = new Set();
                const data1 = x.value._data.filter((n)=>uniques.has(n) ? false : (uniques.add(n), true)
                );
                return makeArray(data1);
            }
        case 'char':
            {
                const uniques = new Set();
                const data1 = x.value._data.filter((n)=>uniques.has(n) ? false : (uniques.add(n), true)
                );
                return makeArray(data1);
            }
        case 'box':
            {
                const uniques = [];
                const has = (v)=>uniques.some((u)=>match_values(u, v)
                    )
                ;
                const data1 = x.value._data.filter((n)=>has(n) ? false : (uniques.push(n), true)
                );
                return makeArray(data1);
            }
    }
};
const group = (x, y)=>{
    if (x.kind != 'num') throw "Domain Error";
    if (x.value.rank != 1) throw "Shape Error";
    let data1 = [];
    for(let i = 0; i < x.value._data.length; i++){
        const n = x.value._data[i];
        if (n < 0) continue;
        const slice = y.value.getFirst(i);
        if (data1[n] == undefined) {
            data1[n] = [
                slice
            ];
        } else {
            data1[n].push(slice);
        }
    }
    if (data1.length == 0) return makeEmpty();
    for(let i1 = 0; i1 < data1.length; i1++){
        if (data1[i1] == undefined) data1[i1] = [];
    }
    const boxes = data1.map((slices)=>({
            kind: y.kind,
            value: y.value.select(slices)
        })
    );
    return {
        kind: 'box',
        value: new MultiArray([
            data1.length
        ], boxes)
    };
};
const group_indices = (x)=>{
    if (x.kind != 'num') throw "Domain Error";
    if (x.value.rank != 1) throw "Shape Error";
    const data1 = [];
    x.value._data.forEach((n, i)=>{
        if (n < 0) return;
        if (data1[n] == undefined) data1[n] = [];
        data1[n].push(i);
    });
    for(let i = 0; i < data1.length; i++){
        if (data1[i] == undefined) data1[i] = [];
    }
    return makeArray(data1.map((x1)=>makeArray(x1)
    ));
};
const find = (pat, x)=>{
    if (pat.kind != x.kind) throw "Domain Error";
    if (x.value.rank == 0) throw "Rank Error";
    if (pat.value.rank == 0) {
        return cmp_eq(pat, x);
    }
    if (pat.value.rank != x.value.rank) throw "Rank Error";
    const pat_len = pat.value.length ?? 0;
    const x_len = x.value.length ?? 0;
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
    const pat_cells = pat.value.firstAxisToArray();
    const cells = x.value.firstAxisToArray();
    const result = new Array(x_len).fill(0);
    for(let i = 0; i < x_len - pat_len; i++){
        let got = 1;
        for(let j = 0; j < pat_cells.length; j++){
            const pat_c = fromMultiArray(pat.value.slice(pat_cells[j]));
            const x_c = fromMultiArray(x.value.slice(cells[i + j]));
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
    return {
        kind: 'box',
        value: new MultiArray([], [
            x
        ])
    };
};
const merge = (x)=>{
    if (x.kind != "box") throw "Domain Error";
    let first1 = x.value._data[0];
    const result = x.value._data.reduce((acc, v)=>{
        if (acc.kind != v.kind) throw "Domain Error";
        if (!MultiArray.same_shape(first1.value, v.value)) throw "Shape Error";
        return fromMultiArray(acc.value.concat(v.value));
    });
    return fromMultiArray(result.value.reshape([
        ...x.value._shape,
        ...first1.value._shape
    ]));
};
const windows = (n, x)=>{
    if (n.kind != "num") throw "Domain Error";
    if (n.value.rank != 0) throw "Rank Error";
    if (x.value.rank == 0) throw "Rank Error";
    const len = n.value._data[0];
    if (len <= 0) throw "Value Error";
    if (len >= x.value._shape[0]) throw "Value Error";
    let windows1 = [];
    const span = x.value._shape[0] - len + 1;
    for(let i = 0; i < span; i++){
        let a = x.value.getFirst(i);
        let b = x.value.getFirst(i + len - 1);
        windows1.push({
            start: a.start,
            end: b.end,
            shape: [
                len,
                ...a.shape
            ]
        });
    }
    let data1 = [];
    for(let i1 = 0; i1 < windows1.length; i1++){
        const slice = windows1[i1];
        data1 = data1.concat(x.value._data.slice(slice.start, slice.end));
    }
    return {
        kind: x.kind,
        value: new MultiArray([
            windows1.length,
            ...windows1[0].shape
        ], data1)
    };
};
const solo = (x)=>{
    return {
        kind: x.kind,
        value: x.value.reshape([
            1,
            ...x.value._shape
        ])
    };
};
function value_depth(v) {
    if (v.kind != 'box') return 0;
    return 1 + Math.max(...v.value._data.map(value_depth));
}
const depth = (x)=>{
    return makeScalar(value_depth(x));
};
function compare_values(a, b) {
    const gt = cmp_gt(a, b);
    if (gt.kind != 'num') throw "Domain Error compare" + gt.kind;
    if (gt.value.rank != 0) throw "Rank Error";
    if (gt.value._data[0] != 0) return 1;
    const lt = cmp_lt(a, b);
    if (lt.kind != 'num') throw "Domain Error compare";
    if (lt.value.rank != 0) throw "Rank Error";
    if (lt.value._data[0] != 0) return -1;
    return 0;
}
const grade_up = (x)=>{
    const slices = x.value.firstAxisToArray();
    const sliced = slices.map((s)=>x.value.slice(s)
    );
    switch(x.kind){
        case "num":
            if (x.value.rank == 1) {
                const indices1 = slices.map((_, i)=>i
                ).sort((a, b)=>{
                    return sliced[a]._data[0] - sliced[b]._data[0];
                });
                return makeArray(indices1);
            }
            throw "Rank Error";
        case "char":
            {
                if (x.value.rank == 1) {
                    const strings = sliced.map((s)=>s._data.join('')
                    );
                    const indices1 = slices.map((_, i)=>i
                    ).sort((a, b)=>{
                        if (strings[a] > strings[b]) return 1;
                        if (strings[a] < strings[b]) return -1;
                        return 0;
                    });
                    return makeArray(indices1);
                }
                throw "Rank Error";
            }
        case "box":
            {
                if (x.value.rank == 1) {
                    const indices1 = slices.map((_, i)=>i
                    ).sort((a, b)=>{
                        return compare_values(sliced[a]._data[0], sliced[b]._data[0]);
                    });
                    return makeArray(indices1);
                }
                throw "Rank Error";
            }
    }
};
const grade_down = (x)=>{
    const slices = x.value.firstAxisToArray();
    const sliced = slices.map((s)=>x.value.slice(s)
    );
    switch(x.kind){
        case "num":
            if (x.value.rank == 1) {
                const indices1 = slices.map((_, i)=>i
                ).sort((a, b)=>{
                    return (sliced[a]._data[0] - sliced[b]._data[0]) * -1;
                });
                return makeArray(indices1);
            }
            throw "Rank Error";
        case "char":
            {
                if (x.value.rank == 1) {
                    const strings = sliced.map((s)=>s._data.join('')
                    );
                    const indices1 = slices.map((_, i)=>i
                    ).sort((a, b)=>{
                        if (strings[a] > strings[b]) return -1;
                        if (strings[a] < strings[b]) return 1;
                        return 0;
                    });
                    return makeArray(indices1);
                }
                throw "Rank Error";
            }
        case "box":
            {
                if (x.value.rank == 1) {
                    const indices1 = slices.map((_, i)=>i
                    ).sort((a, b)=>{
                        return compare_values(sliced[a]._data[0], sliced[b]._data[0]) * -1;
                    });
                    return makeArray(indices1);
                }
                throw "Rank Error";
            }
    }
};
const under_indices = (x)=>{
    if (x.kind != 'num') throw "Domain Error";
    if (x.value.rank != 1) throw "Shape Error";
    const data1 = [];
    x.value._data.forEach((n)=>{
        if (n < 0) return;
        if (data1[n] == undefined) data1[n] = 0;
        data1[n] += 1;
    });
    for(let i = 0; i < data1.length; i++){
        if (data1[i] == undefined) data1[i] = 0;
    }
    return makeArray(data1);
};
const reduce = (f)=>(w)=>{
        if (w.value.length == undefined) return w;
        switch(w.kind){
            case "num":
                const reduced = w.value.map(makeScalar).reduce(f);
                console.log(reduced);
                return fromMultiArray(w.value.reduce((a, b)=>{
                    const x = makeScalar(a);
                    const y = makeScalar(b);
                    return f(x, y).value._data[0];
                }));
            case "char":
                return fromMultiArray(w.value.reduce((a, b)=>{
                    const x = makeChar(a);
                    const y = makeChar(b);
                    return f(x, y).value._data[0];
                }));
            case "box":
                return fromMultiArray(w.value.reduce(f));
        }
    }
;
{
    const a = MultiArray.from([
        1,
        2,
        3,
        4,
        5,
        6
    ]).reshape([
        2,
        3
    ]);
    const r = a.reduce((a1, b)=>a1 + b
    );
    console.log(r);
}var TokenType;
(function(TokenType1) {
    TokenType1[TokenType1["Func"] = 0] = "Func";
    TokenType1[TokenType1["Monad"] = 1] = "Monad";
    TokenType1[TokenType1["Dyad"] = 2] = "Dyad";
    TokenType1[TokenType1["RParen"] = 3] = "RParen";
    TokenType1[TokenType1["LParen"] = 4] = "LParen";
    TokenType1[TokenType1["RBrack"] = 5] = "RBrack";
    TokenType1[TokenType1["LBrack"] = 6] = "LBrack";
    TokenType1[TokenType1["Number"] = 7] = "Number";
    TokenType1[TokenType1["Id"] = 8] = "Id";
    TokenType1[TokenType1["String"] = 9] = "String";
    TokenType1[TokenType1["ListStart"] = 10] = "ListStart";
    TokenType1[TokenType1["ListEnd"] = 11] = "ListEnd";
    TokenType1[TokenType1["Sep"] = 12] = "Sep";
    TokenType1[TokenType1["Empty"] = 13] = "Empty";
    TokenType1[TokenType1["Error"] = 14] = "Error";
    TokenType1[TokenType1["Define"] = 15] = "Define";
    TokenType1[TokenType1["Comment"] = 16] = "Comment";
})(TokenType || (TokenType = {
}));
class Token {
    kind;
    value;
    col;
    constructor(kind, v){
        this.kind = kind;
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
    let match1;
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
        } else if (match1 = text.match(value_re)) {
            let name = match1[1];
            tokens.push(Token.Id(name).span(col, match1[0].length));
            col += match1[0].length;
            text = text.slice(match1[0].length);
        } else if (match1 = text.match(num_re)) {
            let num = parseFloat(match1[2]);
            if (match1[1] == '¬') num = -num;
            tokens.push(Token.Number(num).span(col, match1[0].length));
            col += match1[0].length;
            text = text.slice(match1[0].length);
        } else if (match1 = text.match(string_re)) {
            tokens.push(Token.String(match1[1]).span(col, match1[0].length));
            col += match1[0].length;
            text = text.slice(match1[0].length);
        } else if (match1 = text.match(func_re)) {
            tokens.push(Token.Func(match1[0]).span(col, match1[0].length));
            col += match1[0].length;
            text = text.slice(match1[0].length);
        } else if (match1 = text.match(monad_re)) {
            tokens.push(Token.Monad(match1[0]).span(col, match1[0].length));
            col += match1[0].length;
            text = text.slice(match1[0].length);
        } else if (match1 = text.match(dyad_re)) {
            tokens.push(Token.Dyad(match1[0]).span(col, match1[0].length));
            col += match1[0].length;
            text = text.slice(match1[0].length);
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
(function(ExprKind1) {
    ExprKind1[ExprKind1["Number"] = 0] = "Number";
    ExprKind1[ExprKind1["Id"] = 1] = "Id";
    ExprKind1[ExprKind1["String"] = 2] = "String";
    ExprKind1[ExprKind1["Prefix"] = 3] = "Prefix";
    ExprKind1[ExprKind1["Infix"] = 4] = "Infix";
    ExprKind1[ExprKind1["Func"] = 5] = "Func";
    ExprKind1[ExprKind1["Monad"] = 6] = "Monad";
    ExprKind1[ExprKind1["Dyad"] = 7] = "Dyad";
    ExprKind1[ExprKind1["Fork"] = 8] = "Fork";
    ExprKind1[ExprKind1["Train"] = 9] = "Train";
    ExprKind1[ExprKind1["Vector"] = 10] = "Vector";
    ExprKind1[ExprKind1["Defn"] = 11] = "Defn";
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
            return `{${pretty_expr(e.fn)}}`;
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
                let expr = parse_expr(ctx);
                if (ctx.code[0].kind != TokenType.RBrack) throw "Invalid code, expected }";
                ctx.code = ctx.code.slice(1);
                if (expr === null) throw "Invalid code in defn";
                if (is_func(expr)) {
                    throw "Invalid code in defn";
                }
                return {
                    kind: ExprKind.Defn,
                    fn: expr
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
function parse_derv(ctx, first1) {
    let result = first1 ?? parse_try_func_or_subj(ctx);
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
    if (!is_func(result)) throw `Invalid code, expected function`;
    return result;
}
function parse_expr(ctx) {
    if (ctx.code.length == 0) {
        return null;
    }
    if (ctx.code[0].kind == TokenType.RParen || ctx.code[0].kind == TokenType.Sep || ctx.code[0].kind == TokenType.ListEnd) {
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
    let defs = {
    };
    let funcs = {
    };
    let ctx = {
        code: tk
    };
    while(ctx.code.length > 2 && ctx.code[1].kind == TokenType.Define){
        let name = ctx.code[0];
        ctx.code = ctx.code.slice(2);
        let r = parse_expr(ctx);
        if (r == null) throw "Error in definition";
        if (name.kind == TokenType.Id && !is_func(r)) {
            defs[name.value] = r;
        } else if (name.kind == TokenType.Func && is_func(r)) {
            funcs[name.value] = r;
        } else {
            throw "Error in definition";
        }
        if (!(ctx.code.length > 0 && ctx.code[0].kind == TokenType.Sep)) throw "Invalid code";
        ctx.code = ctx.code.slice(1);
    }
    let r = parse_expr(ctx);
    if (r === null) {
        throw "Parse Error";
    }
    return {
        expr: r,
        vars: defs,
        funcs: funcs
    };
}
class SaliteError extends Error {
    span;
    constructor(message, col){
        super(message);
        this.name = "Evaluation Error";
        this.span = col;
    }
}
class SaliteArityError extends SaliteError {
    at;
    expected;
    constructor(expected, at, col1){
        let _a = expected == 1 ? 'prefix' : 'infix';
        let message1 = `Arity Error: Function is not ${_a}`;
        if (at) {
            message1 = `Arity Error: Function at ${at} is not ${_a}`;
        }
        super(message1, col1);
        this.name = "Arity Error";
        this.at = at;
        this.expected = expected;
    }
}
function pretty_value_(v1) {
    if (v1 == undefined) return [
        'ERR'
    ];
    if (v1.value._data.length == 0) return [
        'ø'
    ];
    switch(v1.kind){
        case "num":
            {
                if (v1.value.rank == 0) return [
                    `${v1.value._data[0]}`
                ];
                if (v1.value.rank == 1) {
                    return [
                        `[ ${v1.value._data.map((n)=>String(n)
                        ).join(' ')} ]`
                    ];
                }
                let i = 0;
                let last = v1.value._strides[v1.value._strides.length - 2];
                let strings = [];
                let col_max = Array(last).fill(0);
                while(i < v1.value._data.length){
                    if (i != 0 && v1.value._strides.slice(0, -2).some((n)=>i % n == 0
                    )) strings.push([
                        ""
                    ]);
                    const row_string = v1.value._data.slice(i, i + last).map((n)=>String(n)
                    );
                    row_string.forEach((s, i1)=>{
                        if (s.length > col_max[i1]) col_max[i1] = s.length;
                    });
                    strings.push(row_string);
                    i += last;
                }
                const padded = strings.map((s)=>s.map((s1, i1)=>s1.padStart(col_max[i1])
                    ).join(' ')
                );
                return [
                    `┌─`.padEnd(padded[0].length + 4),
                    `╵ ${padded[0]}`,
                    ...padded.slice(1).map((x)=>'  ' + x
                    ),
                    `${' '.repeat(padded[0].length + 3)}┘`
                ];
            }
        case "char":
            {
                if (v1.value.rank == 0) return [
                    `'${v1.value._data[0]}'`
                ];
                if (v1.value.rank == 1) return [
                    `'${v1.value._data.join('')}'`
                ];
                let i = 0;
                let last = v1.value._strides[v1.value._strides.length - 2];
                let strings = [];
                while(i < v1.value._data.length){
                    if (i != 0 && v1.value._strides.slice(0, -2).some((n)=>i % n == 0
                    )) strings.push("");
                    strings.push(v1.value._data.slice(i, i + last).join(''));
                    i += last;
                }
                return strings.map((s, i1)=>(i1 > 0 ? ' ' : '"') + s + (i1 == strings.length - 1 ? '"' : ' ')
                );
            }
        case "box":
            {
                let strings = v1.value._data.map(pretty_value_);
                let len = Math.max(...strings.map((ss)=>ss[0].length
                ));
                let hei = Math.max(...strings.map((ss)=>ss.length
                ));
                if (hei == 1 && v1.value.rank == 1) {
                    return [
                        `⟨ ${strings.map((ss)=>ss.join(' ')
                        ).join(' ')} ⟩`
                    ];
                }
                if (v1.value.rank == 2 && hei == 1) {
                    let new_strings = [];
                    let last = v1.value._shape[1];
                    let first1 = v1.value._shape[0];
                    const them = strings.map((s)=>s[0].padEnd(len)
                    );
                    for(let i = 0; i < first1; i++){
                        const element = them.slice(i * last, (i + 1) * last).join(' ');
                        new_strings.push(element);
                    }
                    len = new_strings[0].length;
                    return [
                        `┌~${v1.value._shape.join(' ')}`.padEnd(len + 3),
                        `╵ ${new_strings[0]}`,
                        ...new_strings.slice(1).map((s)=>'  ' + s
                        ),
                        `${' '.repeat(len + 3)}┘`
                    ];
                }
                if (v1.value.rank == 0) {
                    return [
                        `┌∙`.padEnd(len + 4),
                        `╵ ${strings[0][0]}`,
                        ...strings[0].slice(1).map((s)=>'  ' + s
                        ),
                        `${' '.repeat(len + 3)}┘`
                    ];
                }
                return [
                    `┌~${v1.value._shape.join(' ')}`.padEnd(len + 4),
                    `╵ ${strings[0][0]}`,
                    ...strings[0].slice(1).map((s)=>'  ' + s
                    ),
                    ...strings.slice(1).flatMap((s)=>s.map((s1)=>'  ' + s1
                        ).join('\n')
                    ),
                    `${' '.repeat(len + 3)}┘`
                ];
            }
    }
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
        shape2,
        reshape
    ],
    'φ': [
        reverse,
        rotate
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
    'Box': [
        (x)=>{
            return fromMultiArray(x.value.map(chooseScalar));
        },
        null
    ],
    'δ': [
        (w)=>makeString(pretty_value1(w))
        ,
        (op, w)=>{
            if (op.kind != 'num') throw "Domain Error";
            let n = op.value._data[0];
            switch(n){
                case 0:
                    if (w.kind != 'num') throw "Domain Error";
                    return makeChar(String.fromCharCode(w.value._data[0]));
                default:
                    return makeString(pretty_value1(w));
            }
        }
    ],
    ':δ': [
        (w)=>{
            if (w.kind != 'char') throw "Domain Error";
            return makeScalar(parseFloat(w.value._data.join('')));
        },
        (op, w)=>{
            if (w.kind != 'char') throw "Domain Error";
            if (op.kind != 'num') throw "Domain Error";
            let str = w.value._data.join('');
            let n = op.value._data[0];
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
            if (w.value._data[0] == undefined) throw "Error";
            const val = w.value._data[0];
            if (typeof val == 'number' && val == 0) {
                throw "Error";
            }
            return w;
        },
        null
    ],
    'Fill': [
        null,
        (a, w)=>{
            if (a.kind != 'num') throw "Domain Error";
            if (a.value.rank != 0) throw "Rank Error";
            const n = Math.floor(a.value._data[0]);
            if (n < 0) throw "Lenght Error";
            const span = w.value._shape[0] ?? 1;
            const spanned = Math.max(n - span, 0);
            const stride = w.value._strides[0] ?? 1;
            const filler = new Array(spanned * stride);
            const new_shape = [
                n,
                ...w.value._shape.slice(1)
            ];
            switch(w.kind){
                case 'num':
                    return {
                        kind: 'num',
                        value: new MultiArray(new_shape, w.value._data.concat(filler.fill(0)))
                    };
                case 'char':
                    return {
                        kind: 'char',
                        value: new MultiArray(new_shape, w.value._data.concat(filler.fill(' ')))
                    };
                case 'box':
                    return {
                        kind: 'box',
                        value: new MultiArray(new_shape, w.value._data.concat(filler.fill(makeEmpty())))
                    };
            }
        }
    ],
    '?': [
        null,
        (a, w)=>{
            if (w.value._data[0] == undefined) return a;
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
        (before)=>(x)=>reshape(shape2(before), x)
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
        (f)=>(_, w)=>reshape(shape2(w), f(w))
    ],
    '¢': [
        (before)=>(x)=>{
                const new_data = [
                    ...before.value._data
                ];
                if (x.kind != before.kind) throw "Domain Error";
                if (x.value.rank != 0) throw "Rank Error";
                new_data[0] = x.value._data[0];
                return fromMultiArray(new MultiArray(before.value._shape, new_data, before.value._strides));
            }
        ,
        null
    ],
    ':¢': [
        (before)=>(x)=>{
                const new_data = [
                    ...before.value._data
                ];
                if (x.kind != before.kind) throw "Domain Error";
                if (x.value._shape.length != before.value._shape.length - 1) throw "Shape Error";
                if (before.value._shape.slice(1).every((n, i)=>n == x.value._shape[i]
                ) == false) throw "Shape Error";
                const vals = x.value._data;
                for(let index = 0; index < vals.length; index++){
                    new_data[index] = vals[index];
                }
                return fromMultiArray(new MultiArray(before.value._shape, new_data, before.value._strides));
            }
        ,
        null
    ],
    '$': [
        ()=>under_indices
        ,
        (f)=>(a, w)=>{
                if (a.kind != 'num') throw "Domain Error";
                if (a.value.rank != 1) throw "Rank Error";
                const indices1 = a.value._data;
                if (indices1.length != w.value.length) throw "Length Error";
                const cells = w.value.firstAxisToArray().map((s)=>w.value.slice(s)
                );
                let data1 = [];
                for(let i = 0; i < indices1.length; i++){
                    const n = indices1[i];
                    if (n == 0) {
                        data1 = data1.concat(cells[i]._data);
                    } else {
                        const result = f(fromMultiArray(cells[i]));
                        if (result.kind != w.kind) throw "Domain Error";
                        if (result.value.rank != w.value.rank - 1) throw "Rank Error";
                        if (!result.value._shape.every((n1, i1)=>n1 == w.value._shape[i1 + 1]
                        )) throw "Shape Error";
                        data1 = data1.concat(result.value._data);
                    }
                }
                return {
                    kind: w.kind,
                    value: new MultiArray(w.value._shape, data1, w.value._strides)
                };
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
                const slices = w.value.firstAxisToArray();
                const new_cells = [
                    w.value.slice(slices[0])
                ];
                slices.slice(1).forEach((slice, i)=>{
                    const a_ = new_cells[i];
                    const w_ = w.value.slice(slice);
                    const val = alpha2({
                        kind: w.kind,
                        value: a_
                    }, {
                        kind: w.kind,
                        value: w_
                    });
                    if (val.kind != w.kind) throw "Domain Error";
                    new_cells.push(val.value);
                });
                return fromMultiArray(new_cells.reduce((a, b)=>a.concat(b)
                ));
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
    '.pair': ([alpha1, alpha2])=>{
        if (alpha2 == null) throw "An error";
        return [
            (w)=>{
                switch(w.kind){
                    case 'num':
                        {
                            const cells = w.value._data.slice(1).map((c, i)=>alpha2(makeScalar(w.value._data[i]), makeScalar(c))
                            );
                            if (cells[0].value.rank == 0) {
                                return makeArray(cells.map((v1)=>v1.value._data[0]
                                ));
                            }
                            return makeArray(cells);
                        }
                    case 'char':
                        {
                            const cells = w.value._data.slice(1).map((c, i)=>alpha2(makeChar(w.value._data[i]), makeChar(c))
                            );
                            if (cells[0].value.rank == 0) {
                                return makeArray(cells.map((v1)=>v1.value._data[0]
                                ));
                            }
                            return makeArray(cells);
                        }
                    case 'box':
                        {
                            const cells = w.value._data.slice(1).map((c, i)=>alpha2(w.value._data[i], c)
                            );
                            if (cells[0].value.rank == 0) {
                                return makeArray(cells.map((v1)=>v1.value._data[0]
                                ));
                            }
                            return makeArray(cells);
                        }
                }
            },
            null
        ];
    },
    '¨': ([alpha1, alpha2])=>{
        return [
            (w)=>{
                if (alpha1 == null) throw "Function at ¨ is not prefix";
                let data1 = [];
                let data_n = [];
                let data_c = [];
                for(let index = 0; index < w.value._data.length; index++){
                    const result = alpha1(chooseScalar(w.value._data[index]));
                    if (data_n) {
                        if (result.kind == 'num' && result.value.rank == 0) {
                            data_n.push(result.value._data[0]);
                        } else {
                            data_n = null;
                        }
                    }
                    if (data_c) {
                        if (result.kind == 'char' && result.value.rank == 0) {
                            data_c.push(result.value._data[0]);
                        } else {
                            data_c = null;
                        }
                    }
                    data1.push(result);
                }
                if (data_n) {
                    return {
                        kind: 'num',
                        value: new MultiArray(w.value._shape, data_n, w.value._strides)
                    };
                }
                if (data_c) {
                    return {
                        kind: 'char',
                        value: new MultiArray(w.value._shape, data_c, w.value._strides)
                    };
                }
                return fromMultiArray(new MultiArray(w.value._shape, data1, w.value._strides));
            },
            (a, w)=>{
                if (alpha2 == null) throw "Function at ¨ is not infix";
                const a_arr = a.value;
                const w_arr = w.value;
                const zipped = MultiArray.zip(a_arr, w_arr, (a1, w1)=>alpha2(chooseScalar(a1), chooseScalar(w1))
                );
                let kind1 = zipped._data.map((v1)=>v1.kind
                ).reduce((acc, x)=>acc == x ? acc : 'box'
                );
                let scalars = zipped._data.every((v1)=>v1.value.rank == 0
                );
                if (kind1 == 'num' && scalars) {
                    return fromMultiArray(zipped.map((v1)=>v1.value._data[0]
                    ));
                } else if (kind1 == 'char' && scalars) {
                    return fromMultiArray(zipped.map((v1)=>v1.value._data[0]
                    ));
                }
                return fromMultiArray(zipped);
            }
        ];
    },
    '´': ([alpha1, alpha2])=>{
        return [
            (w)=>{
                if (alpha1 == null) throw "Function at .¨ is not prefix";
                const vals = w.value._data.map((n)=>alpha1(chooseScalar(n))
                );
                let kind1 = vals.map((v1)=>v1.kind
                ).reduce((acc, x)=>acc == x ? acc : 'box'
                );
                let scalars = vals.every((v1)=>v1.value.rank == 0
                );
                if (kind1 == 'num' && scalars) {
                    return makeArray(vals.map((v1)=>v1.value._data[0]
                    ));
                } else if (kind1 == 'char' && scalars) {
                    return makeArray(vals.map((v1)=>v1.value._data[0]
                    ));
                }
                return fromMultiArray(new MultiArray(w.value._shape, vals, w.value._strides));
            },
            (a, w)=>{
                if (alpha2 == null) throw "Function at .¨ is not infix";
                const a_arr = a.value.firstAxisToArray();
                const w_arr = w.value.firstAxisToArray();
                let data1 = [];
                let data_n = [];
                for (const a_slice of a_arr){
                    for (const w_slice of w_arr){
                        const x = fromMultiArrayUnwrap(a.value.slice(a_slice));
                        const y = fromMultiArrayUnwrap(w.value.slice(w_slice));
                        const result = alpha2(x, y);
                        if (data_n) {
                            if (result.kind == 'num' && result.value.rank == 0) {
                                data_n.push(result.value._data[0]);
                            } else {
                                data_n = null;
                            }
                        }
                        data1.push(result);
                    }
                }
                if (data_n) {
                    return {
                        kind: 'num',
                        value: new MultiArray([
                            a_arr.length,
                            w_arr.length
                        ], data_n)
                    };
                }
                return {
                    kind: 'box',
                    value: new MultiArray([
                        a_arr.length,
                        w_arr.length
                    ], data1)
                };
            }
        ];
    },
    '`': ([alpha1, alpha2])=>{
        return [
            (w)=>{
                if (alpha1 == null) throw "Function at ` is not prefix";
                let data1 = [];
                let data_n = [];
                let data_c = [];
                let shape3 = null;
                for(let index = 0; index < w.value._shape[0]; index++){
                    const slice = w.value.getFirst(index);
                    const result = alpha1(fromMultiArray(w.value.slice(slice)));
                    if (shape3 == null) {
                        shape3 = result.value._shape;
                    } else {
                        if (result.value._shape.length != shape3.length || !result.value._shape.every((n, i)=>n == shape3[i]
                        )) throw "Shape Error";
                    }
                    if (data_n) {
                        if (result.kind == 'num') {
                            data_n = data_n.concat(result.value._data);
                        } else {
                            data_n = null;
                        }
                    }
                    if (data_c) {
                        if (result.kind == 'char') {
                            data_c = data_c.concat(result.value._data);
                        } else {
                            data_c = null;
                        }
                    }
                    if (result.kind == 'box') {
                        data1 = data1.concat(result.value._data);
                    }
                }
                if (shape3 == null) return makeEmpty();
                if (data_n) {
                    return {
                        kind: 'num',
                        value: new MultiArray([
                            w.value._shape[0],
                            ...shape3
                        ], data_n)
                    };
                }
                if (data_c) {
                    return {
                        kind: 'char',
                        value: new MultiArray([
                            w.value._shape[0],
                            ...shape3
                        ], data_c)
                    };
                }
                return fromMultiArray(new MultiArray([
                    w.value._shape[0],
                    ...shape3
                ], data1));
            },
            null
        ];
    },
    '.sum': ([alpha1, alpha2])=>{
        if (alpha2 == null) throw "Function at .for is not infix";
        return [
            (w)=>{
                let data_n = 0;
                for(let index = 0; index < w.value._data.length; index++){
                    const result = alpha2(chooseScalar(index), chooseScalar(w.value._data[index]));
                    if (!(result.kind == 'num' && result.value.rank == 0)) {
                        throw "Domain Error";
                    }
                    data_n += result.value._data[0];
                }
                return makeScalar(data_n);
            },
            (a, w)=>{
                if (a.kind != 'num') throw "Domain Error";
                if (a.value.rank != 0) throw "Rank Error";
                const step = a.value._data[0] ?? 1;
                let data_n = 0;
                for(let index = 0; index < w.value._data.length; index++){
                    const result = alpha2(chooseScalar(step ** index), chooseScalar(w.value._data[index]));
                    if (!(result.kind == 'num' && result.value.rank == 0)) {
                        throw "Domain Error";
                    }
                    data_n += result.value._data[0];
                }
                return makeScalar(data_n);
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
                const n_ = omega1(w);
                if (n_.kind != 'num') throw "Domain Error";
                if (n_.value.rank != 0) throw "Rank Error";
                const n = n_.value._data[0] ?? 0;
                let result = w;
                for(let i = 0; i < n; ++i){
                    result = alpha1(result);
                }
                return result;
            },
            (a, w)=>{
                if (alpha2 == null) throw "Left function at ↑ is not infix";
                if (omega2 == null) throw "Right function at ↑ is not infix";
                const n_ = omega2(a, w);
                if (n_.kind != 'num') throw "Domain Error";
                if (n_.value.rank != 0) throw "Rank Error";
                const n = n_.value._data[0] ?? 0;
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
function pretty_value1(v1) {
    return pretty_value_(v1).join('\n');
}
function evaluate_func(e, self, globals, funcs) {
    switch(e.kind){
        case ExprKind.Func:
            {
                if (e.name == 'λ') return self;
                let v1 = builtin_functions[e.name];
                if (v1 === undefined) v1 = funcs[e.name];
                if (v1 === undefined) throw new SaliteError(`Name Error: Undefined name ${e.name}`);
                return v1;
            }
        case ExprKind.Monad:
            {
                const alpha = evaluate_func(e.alpha, self, globals, funcs);
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
                        const [alpha1, alpha2] = evaluate_func(e.alpha, self, globals, funcs);
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
                const alpha = evaluate_func(e.alpha, self, globals, funcs);
                const omega = evaluate_func(e.omega, self, globals, funcs);
                const dyad = builtin_dyads[e.mod];
                if (!dyad) throw new SaliteError(`Name Error: Undefined name ${e.mod}`);
                return dyad(alpha, omega);
            }
        case ExprKind.Fork:
            {
                const [alpha1, alpha2] = evaluate_func(e.alpha, self, globals, funcs);
                const [omega1, omega2] = evaluate_func(e.omega, self, globals, funcs);
                const [_3, infix] = evaluate_func(e.infix, self, globals, funcs);
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
                const [alpha1, _] = evaluate_func(e.alpha, self, globals, funcs);
                const [omega1, omega2] = evaluate_func(e.omega, self, globals, funcs);
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
                const rec = [
                    (w)=>evaluate(e.fn, rec, {
                            'α': makeEmpty(),
                            'ω': w,
                            ...globals
                        }, funcs)
                    ,
                    (a, w)=>evaluate(e.fn, rec, {
                            'α': a,
                            'ω': w,
                            ...globals
                        }, funcs)
                ];
                return rec;
            }
        default:
            {
                const val = evaluate(e, self, globals, funcs);
                return [
                    ()=>val
                    ,
                    ()=>val
                ];
            }
    }
}
function evaluate(e, self, globals, funcs) {
    switch(e.kind){
        case ExprKind.Number:
            return makeScalar(e.value);
        case ExprKind.String:
            if (e.value.length == 1) {
                return makeChar(e.value);
            }
            return makeString(e.value);
        case ExprKind.Id:
            {
                let v1 = globals[e.value];
                if (v1 === undefined) throw new SaliteError(`Name Error: Undefined name ${e.value}`);
                return v1;
            }
        case ExprKind.Vector:
            {
                if (e.value.length == 0) {
                    return makeEmpty();
                }
                if (e.vkind == 'num') {
                    const vals = e.value.map((e1)=>e1.value
                    );
                    return makeArray(vals);
                }
                let vals = e.value.map((e1)=>evaluate(e1, self, globals, funcs)
                );
                let kind1 = vals.map((v1)=>v1.kind
                ).reduce((acc, x)=>acc == x ? acc : 'box'
                );
                let scalars = vals.every((v1)=>v1.value.rank == 0
                );
                if (kind1 == 'num' && scalars) {
                    return makeArray(vals.map((v1)=>v1.value._data[0]
                    ));
                } else if (kind1 == 'char' && scalars) {
                    return makeArray(vals.map((v1)=>v1.value._data[0]
                    ));
                }
                return makeArray(vals);
            }
        case ExprKind.Prefix:
            {
                let func = evaluate_func(e.func, self, globals, funcs)[0];
                if (func === null) throw new SaliteArityError(1);
                let omega = evaluate(e.omega, self, globals, funcs);
                let result = func(omega);
                return result;
            }
        case ExprKind.Infix:
            {
                let func = evaluate_func(e.func, self, globals, funcs)[1];
                if (func === null) throw new SaliteArityError(2);
                let alpha = evaluate(e.alpha, self, globals, funcs);
                let omega = evaluate(e.omega, self, globals, funcs);
                let result = func(alpha, omega);
                return result;
            }
        default:
            console.log(e);
            throw `Value Error: Not a value - ${pretty_expr(e)}`;
    }
}
function run1(expr, globals) {
    let ast = parse(expr);
    let funcs = {
    };
    for(const name in ast.funcs){
        const fast = ast.funcs[name];
        const desc = evaluate_func(fast, [
            null,
            null
        ], globals, funcs);
        funcs[name] = desc;
    }
    for(const name1 in ast.vars){
        const val = evaluate(ast.vars[name1], [
            null,
            null
        ], globals, funcs);
        globals[name1] = val;
    }
    let result = evaluate(ast.expr, [
        null,
        null
    ], globals, funcs);
    return result;
}
function tokens1(expr) {
    const table = {
        [TokenType.Func]: 'func',
        [TokenType.Monad]: 'monad',
        [TokenType.Dyad]: 'dyad',
        [TokenType.Number]: 'const',
        [TokenType.Empty]: 'const',
        [TokenType.String]: 'string',
        [TokenType.Error]: 'error',
        [TokenType.Comment]: 'comment'
    };
    try {
        const tks = tokenize(expr, true);
        let code = [];
        let col2 = 0;
        for (const tk of tks){
            if (tk.col === undefined) continue;
            const start = tk.col[0];
            const end = tk.col[1];
            const start_text = expr.slice(col2, start);
            if (start_text.length > 0) {
                code.push({
                    kind: 'none',
                    text: expr.slice(col2, start)
                });
            }
            const end_kind = table[tk.kind] ?? 'none';
            code.push({
                kind: end_kind,
                text: expr.slice(start, end)
            });
            col2 = end;
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
export { tokens1 as tokens };
export { symbol_overstrike1 as symbol_overstrike,  };
export { symbol_names1 as symbol_names };
