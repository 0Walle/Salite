import * as Parser from "./parser.ts";
import * as Spec from "./spec.ts";

type ConstValue = number | string;

interface VarMap extends Map<string, number> {
    $parent: VarMap | null;
}

type Defn = { body: Parser.Stmt[], scope: VarMap, index: number }
type Block = [number, number]

function getVar(scope: VarMap, name: string): [number, number] | null {
    let f = 0;
    while (true) {
        if (scope.has(name)) return [f, scope.get(name) as number];
        if (scope.$parent == null) return null;
        scope = scope.$parent;
        f += 1;
    }
}


const runtimeConts: {[n:string]:number} = {}
for (const gl of Spec.GLYPHS) { runtimeConts[gl] = Spec.GLYPHS.indexOf(gl); }
const newConsts = Spec.GLYPHS.length;

function compileFunc(bytecode: number[], e: Parser.Expr, local: VarMap, C: ConstValue[], D: Defn[]) {
    switch (e.kind) {
        case Parser.ExprKind.Verb: {
            if (e.name in runtimeConts) {
                bytecode.push(0x00, runtimeConts[e.name]); break;
            }
            const ref = getVar(local, e.name);
            if (ref == null) throw `Undefined name ${e.name}`
            bytecode.push(0x02, ...ref); break;
        }
        case Parser.ExprKind.Train:
            compileFunc(bytecode, e.omega, local, C, D);
            compileFunc(bytecode, e.alpha, local, C, D);
            bytecode.push(0x12);
            break;
        case Parser.ExprKind.Fork:
            compileFunc(bytecode, e.omega, local, C, D);
            compileFunc(bytecode, e.infix, local, C, D);
            compileFunc(bytecode, e.alpha, local, C, D);
            bytecode.push(0x13);
            break;
        case Parser.ExprKind.Monad:
            compileFunc(bytecode, e.alpha, local, C, D);
            bytecode.push(0x14, Spec.monadsConsts[e.mod]);
            break;
        case Parser.ExprKind.Dyad:
            compileFunc(bytecode, e.omega, local, C, D);
            compileFunc(bytecode, e.alpha, local, C, D);
            bytecode.push(0x15, Spec.dyadsConsts[e.mod]);
            break;
        case Parser.ExprKind.Defn: 
            bytecode.push(0x01, D.length);
            D.push({ body: e.fn, scope: local, index: D.length });
            break;
        default: 
            compileValue(bytecode, e, local, C, D);
            break;
    }
}

function compileValue(bytecode: number[], e: Parser.Expr, local: VarMap, C: ConstValue[], D: Defn[]) {
    switch (e.kind) {
        case Parser.ExprKind.Number:
            bytecode.push(0x00, newConsts + C.length); C.push(e.value); break;
        case Parser.ExprKind.String:
            bytecode.push(0x00, newConsts + C.length);
            C.push(e.value);
            break;
        case Parser.ExprKind.Noun: {
            const ref = getVar(local, e.value);
            if (ref == null) throw `Undefined name ${e.value}`
            bytecode.push(0x02, ...ref); break;
        }
        case Parser.ExprKind.List:
            for (const v of e.value) compileValue(bytecode, v, local, C, D);
            bytecode.push(0x0A, e.value.length);
            break;
        
        case Parser.ExprKind.VerbNoun: {
            if (e.name in runtimeConts) {
                bytecode.push(0x00, runtimeConts[e.name]); break;
            }

            const ref = getVar(local, e.name);
            if (ref == null) throw `Undefined name ${e.name}`
            bytecode.push(0x02, ...ref); break;
        }
        case Parser.ExprKind.Prefix:
            compileValue(bytecode, e.omega, local, C, D);
            compileFunc(bytecode, e.func, local, C, D);
            bytecode.push(0x10);
            break;
        case Parser.ExprKind.Infix:
            compileValue(bytecode, e.omega, local, C, D);
            compileFunc(bytecode, e.func, local, C, D);
            compileValue(bytecode, e.alpha, local, C, D);
            bytecode.push(0x11);
            break;
        default:
            throw `Value Error: Not a value`
    }
}

function compileBlock(bytecode: number[], block: Parser.Stmt[], C: ConstValue[], D: Defn[], L: number[], parent: VarMap | null): Block {
    //@ts-ignore Assigned below
    const localScope: VarMap = new Map([['λ', 0],['ω', 1],['α', 2]]);
    localScope.$parent = parent;

    let localSize = 3;
    const start = bytecode.length;

    loop: for (let i = 0; i < block.length; i++) {
        const statement = block[i]
        switch (statement.kind) {
            case 4: {
                L.push(statement.span[0]);
                const ref = getVar(localScope, statement.name);
                if (ref == null) throw `Undefined name ${statement.name}`
                if (statement.value) {
                    compileValue(bytecode, statement.value, localScope, C, D);
                    compileFunc(bytecode, statement.mutator, localScope, C, D);
                    bytecode.push(0x02, ...ref);
                    bytecode.push(0x11);
                } else {
                    bytecode.push(0x02, ...ref);
                    compileFunc(bytecode, statement.mutator, localScope, C, D);
                    bytecode.push(0x10);
                }
                bytecode.push(0x03, ...ref);
                bytecode.push(0x20);
                break;
            }
            case 3:
                L.push(statement.span[0]);
                compileFunc(bytecode, statement.value, localScope, C, D);
                bytecode.push(0x03, 0, localSize);
                localScope.set(statement.name, localSize++);
                bytecode.push(0x20);
                break;
            case 2:
                L.push(statement.span[0]);
                compileValue(bytecode, statement.value, localScope, C, D);
                for (const name of statement.names) {
                    bytecode.push(0x03, 0, localSize);
                    localScope.set(name, localSize++);
                }
                if (statement.names.length > 1) bytecode.push(0x0B, statement.names.length);
                bytecode.push(0x20);
                break;
            case 1:
                if (i == block.length-1) throw "Guard at end of block"
                L.push(statement.span[0]);
                compileValue(bytecode, statement.expr, localScope, C, D);
                bytecode.push(0x08);
                compileValue(bytecode, statement.fall, localScope, C, D);
                bytecode.push(0x09);
                continue loop;
                // break;
            default:
                L.push(statement.span[0]);
                compileValue(bytecode, statement.expr, localScope, C, D);
        }
        if (i == block.length-1) { bytecode.push(0x07); }
        else bytecode.push(0x06);
    }

    return [start, localSize];
}

export function compileProgram(program: Parser.Stmt[], C: ConstValue[], foreign: [string, number][]): [ number[], ConstValue[], Block[], number[] ] {
    const blocks: Block[] = [];
    const bytecode: number[] = []
    const L: number[] = []
    
    //@ts-expect-error Assigned bellow
    const globals: VarMap = new Map(foreign)
    globals.$parent = null;
    const D: Defn[] = [{body: program, scope: globals, index: 0 }];
    
    // const mainBlock = compileBlock(bytecode, program, C, D, L, globals);
    
    // blocks[0] = mainBlock;

    let dp = 0;
    while (dp < D.length) {
        const defn = D[dp];
        if (defn == undefined) break;
        const block = compileBlock(bytecode, defn.body, C, D, L, defn.scope);
        blocks[defn.index] = block;
        dp+=1;
    }

    return [bytecode, C, blocks, L];
}

export function compile(input: string, runtime: ConstValue[], foreign: string[]) {
    const program = Parser.parse(input);
    return compileProgram(program, runtime, foreign.map((x, i) => [x, i]));
}

export function tokens(expr: string): { kind: string, text: string }[] | null {
    const table: { [kind: number]: string | undefined } = {
        [Parser.TokenType.Verb]: 'func',
        [Parser.TokenType.Monad]: 'monad',
        [Parser.TokenType.Dyad]: 'dyad',
        [Parser.TokenType.Number]: 'const',
        [Parser.TokenType.Empty]: 'const',
        [Parser.TokenType.FuncVal]: 'const',
        [Parser.TokenType.String]: 'string',
        [Parser.TokenType.Error]: 'error',
        [Parser.TokenType.Comment]: 'comment',
        [Parser.TokenType.Define]: 'control',
        [Parser.TokenType.Guard]: 'control',
        [Parser.TokenType.Strand]: 'control',
        [Parser.TokenType.Mutate]: 'control',
        [Parser.TokenType.Char]: 'const',
    }

    try {
        const tks = Parser.tokenize(expr, true)
        const code = []
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