import * as Functions from "./functions.ts"
import {
    builtin_functions, builtin_dyads, builtin_monads, builtin_functions_under
} from "./functions.ts"
import { DataArray, Nil } from './array.ts';
import { FunctionArray } from "./functions_core.ts";
import * as Core from "./functions_core.ts";
import { Value, FuncDesc, Dyad, Monad } from "./types.ts";

import * as Spec from "./spec.ts";

/** 
 * 00	CONST I	 : → i¢consts
 * 01	DEFN I	 : → i¢blocks
 * 02	VAR  D I : → y
 * 03	VARP D I : → v
 * 06	POP 	 : y → 
 * 07	RET 	 : y → y
 * 08	GUARD 	 : y c → c? {y} : {}
 * 0A	LIST N	 : x0..xm → [x0..xm]
 * 0B	LISTP N	 : v0..vm → [v0..vm]
 * 10	FN1	     : y f → (F y)
 * 11	FN2	     : y f x → (x F y)
 * 12	TRAIN 	 : h g → (G H)
 * 13	FORK 	 : h g f → (F G H)
 * 14	MOND I	 : f → (F.r)
 * 15	DYAD I	 : g f → (F.r.G)
 * 20	SETV 	 : x v → (v :: x)
 * 21	SETF 	 : f v → (V :: F)
 * 40	SWAP 	 : y x → x y
 * 41	DUP 	 : y → y y
 * @param bytecode bytecode
 * @param codep start
 * @returns js Code
 */
function genJs(bytecode: number[], codep: number): string {
    let sizeM = 1;
    let rTop = 0;
    const rVar = (n: number) => { (sizeM = Math.max(sizeM,n+1)); return "v"+n };
    const rPsh = (val: string) => `${rVar(rTop++)} = ${val};`;
    const rPop = () => rVar(--rTop);
    const num = () => bytecode[codep++];

    let r = '';
    loop: while (true) {
        r += "\n";
        // r += `l = ${codep};`;
        switch (bytecode[codep++]) {
        case 0x00: /* CONST */ { r += rPsh(`C[${num()}]`); break; }
        case 0x01: /* DEFN  */ { r += rPsh(`makedefn(D[${num()}](e))`); break; }
        case 0x02: /* VAR   */ { r += rPsh(`getv(e${'.p'.repeat(num())}, ${num()})`); break; }
        case 0x03: /* VARP  */ { r += rPsh(`{e: e${'.p'.repeat(num())}, p: ${num()}}`); break; }
        // case 0x04: /* VARF  */ { r += rPsh(`getf(e${'.p'.repeat(num())}, ${num()})`); break; }
        case 0x06: /* POP   */ { rTop--; r += `l = ${codep};`; break; }
        case 0x07: /* RET   */ { r += `l = ${codep};return v0;`; break loop; }
        case 0x08: /* GUARD */ { const c=rPop(); r += `if (tobool(${c})) {`; break; }
        case 0x09: /* GUAR2 */ { rTop--; r += `return v0;}`; break; }
        case 0x0A: /* LIST  */ {
            const n = num();
            rTop -= n;
            r += rPsh("mlist(["+(new Array(n).fill(undefined).map((_,i)=>rVar(rTop+i)).join(","))+"])");
            break; 
        }
        case 0x0B: /* LISTP */ {
            const n = num();
            rTop -= n;
            r += rPsh("["+(new Array(n).fill(undefined).map((_,i)=>rVar(rTop+i)).join(","))+"]");
            break; 
        }
        case 0x10: /* FN1   */ { const           f=rPop(), y=rPop(); r += rPsh(`call(${f}, ${y})`); break; }
        case 0x11: /* FN2   */ { const x=rPop(), f=rPop(), y=rPop(); r += rPsh(`call(${f}, ${y}, ${x})`); break; }
        case 0x12: /* TRAIN */ { const           g=rPop(), h=rPop(); r += rPsh(`train2(${g}, ${h})`); break; }
        case 0x13: /* FORK  */ { const f=rPop(), g=rPop(), h=rPop(); r += rPsh(`train3(${f}, ${g}, ${h})`); break; }
        case 0x14: /* MOND  */ { const           m=num(), f=rPop(); r += rPsh(`monads[${m}](${f})`); break; }
        case 0x15: /* DYAD  */ { const f=rPop(), m=num(), g=rPop(); r += rPsh(`dyads[${m}](${f}, ${g})`); break; }
        
        case 0x20: /* SETV   */ { r += rPsh(`setv(${rPop()}, ${rPop()})`); break; }
        // case 0x21: /* SETF   */ { r += rPsh(`setf(${rPop()}, ${rPop()})`); break; }
        }
    }

    r = "let l=0; try { \n"+r+"} catch (e) { throw e; }";

    return "let "+new Array(sizeM).fill(undefined).map((_,i)=>rVar(i)).join(',')+";"+r;
}

const toFuncDesc = (f: Value): FuncDesc => {
    if (f instanceof FunctionArray) return f.func;
    return [ () => f ];
}
const makedefn = (f: BlockFn) => {
    return new FunctionArray([ f ])
}
const train2 = (f:FunctionArray, g:FunctionArray) => {
    return new FunctionArray(Functions.atop(f.func, g.func))
}
const train3 = (f: Value, g:FunctionArray, h:FunctionArray): FunctionArray => {
    const [f1] = toFuncDesc(f);
    const [g1] = g.func;
    const [h1] = h.func;

    return new FunctionArray([
        (y, x?) => g1(h1(y, x), f1(y, x)),
    ])
}
const call = (f: FunctionArray, y: Value, x?: Value) => {
    const [f1] = f.func;
    return f1(y,x);
}
const mlist = (vs: Value[]) => {
    if (vs.length == 0) return Nil;
    const t = typeof vs[0];
    const fill = t == 'number' ? 0 : Nil;
    return new DataArray([vs.length], vs, fill)
}
const setv = (frame: { e: Value[], p: number }|{ e: Value[], p: number }[], val: Value) => {
    if (Array.isArray(frame)) {
        if (!Core.isList(val)) throw `Expected list in declaration`;
        if (Functions.length(val) != frame.length) throw `Expected ${frame.length} items in declaration`;
        for (let i = 0; i < frame.length; i++) {
            const n = frame[i];
            n.e[n.p] = val.pick(i);
        }
        return val;
    }

    frame.e[frame.p] = val;
    return val;
}
const getv = (frame: Value[], index: number) => {
    return frame[index];
}

const m1 = (m: Monad, name: string) => (f: Value) => {
    return new FunctionArray(m(toFuncDesc(f)), `F${name}`)
}

const m2 = (m: Dyad, name: string) => (f: Value, g: Value) => {
    const unchecked = m(toFuncDesc(f), toFuncDesc(g));
    
    test: if (name == '¤' && g instanceof FunctionArray) {
        const under = builtin_functions_under[g.name];
        if (under == null) break test;
        const [ug1, ug2] = under;
        const [f1, _] = toFuncDesc(f);

        return new FunctionArray([(y,x?)=> {
            if (x == undefined) {
                if (ug1 == undefined) return unchecked[0](y);
                return ug1(f1)(y);
            }
            if (ug2 == undefined) return unchecked[0](y, x);
            return ug2(f1)(x, y);
        }], `F${name}${g.name}`)
    }

    return new FunctionArray(unchecked, `F${name}G`)
}

export const runtime1: Value[] = [];
const runtimeConts: Map<string, number> = new Map()
for (const gl of Spec.GLYPHS) {
    const f=builtin_functions[gl];
    if (f==undefined) throw `Undefined builtin ${gl}`;
    runtimeConts.set(gl, runtime1.length);
    runtime1.push(new Core.FunctionArray(f, gl));
}

const monads1 = [
    m1(builtin_monads['§'] as Monad, '§'),
    m1(builtin_monads['/'] as Monad, '/'),
    m1(builtin_monads['¯'] as Monad, '¯'),
    m1(builtin_monads['˜'] as Monad, '˜'),
    m1(builtin_monads['¨'] as Monad, '¨'),
    m1(builtin_monads['˝'] as Monad, '˝'),
    m1(builtin_monads['`'] as Monad, '`'),
    m1(builtin_monads['\\'] as Monad, '\\'),
];
const dyads1 = [
    m2(builtin_dyads['•'] as Dyad, '•'),
    m2(builtin_dyads['°'] as Dyad, '°'),
    m2(builtin_dyads['↔'] as Dyad, '↔'),
    m2(builtin_dyads['¤'] as Dyad, '¤'),
    m2(builtin_dyads['→'] as Dyad, '→'),
    m2(builtin_dyads['←'] as Dyad, '←'),
    m2(builtin_dyads['ⁿ'] as Dyad, 'ⁿ'),
    m2(builtin_dyads['®'] as Dyad, '®'),
    m2(builtin_dyads['Δ'] as Dyad, 'Δ'),
];


interface VarMap extends Array<Value> { p: VarMap | null; }
type Block = [number, number];
type BlockFn = (y: Value, x?: Value) => Value;
type Defn = (parent: VarMap | null) => BlockFn;

function compileBlock(B: number[], codep: number, C: Value[], D: Defn[], L: number[]): Defn {
    let c = genJs(B, codep);

    c = `const fn = (y, x) => {\nconst e = []; e.p = oe;e[0]=makedefn(fn);e[1]=y;e[2]=x ?? Nil;\n${c}};\nreturn fn;\n`;
    
    const f = Function(
        `'use strict'; return (C,D,L,call,getv,setv,mlist,train2,train3,monads,dyads,makedefn,Nil,tobool) => oe => {${c}};`
    )()(C,D,L,call,getv,setv,mlist,train2,train3,monads1,dyads1,makedefn,Nil,Functions._toBool)

    return f;
}

export function run(B: number[], Cx: (string|number)[], D: Block[], locations: number[], variables: Value[]): [Value, VarMap] {
    const C = Cx.map(x => 
          (typeof x == 'string') ? ( x.length == 1 ? x : Core.StringArray.from(x))
        : x);

    //@ts-expect-error Defined below
    const globals: VarMap = variables;
    globals.p = null;

    const runtime = runtime1.concat(C);
    const blocks: Defn[] = [];
    for (const [codep, _] of D) {
        blocks.push(compileBlock(B, codep, runtime, blocks, locations))
    }

    try {
        const result = blocks[0](globals)(Nil, Nil);
        return [result, globals];
    } catch (er) {
        throw er;
    }
}

export const castings = {
    fromNumber: (n: number) => n,
    fromString: (s: string) => s.length > 0 ? Core.StringArray.from(s) : Nil,
    nil: () => Nil,
    fromList: (a: Value[]) => a.length > 0 ? new DataArray([a.length], a) : Nil,
    func: (f: BlockFn) => makedefn(f),
    toBool: (v: Value) => Functions._toBool(v),
    toNumber: (v: Value) => Core.isNumber(v) ? v : null,
    toList: (v: Value) => Core.isList(v) ? Array(v.count).fill(null).map((_,i)=>v.pick(i)) : null
}