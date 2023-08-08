// deno-lint-ignore-file no-cond-assign
export enum TokenType {
    Number, String, Empty, FuncVal, Char,
    Noun, Verb, Monad, Dyad,
    RParen, LParen, RBrack, LBrack, ListStart, ListEnd, 
    Sep, Strand,
    Define, Guard, Mutate, 
    Comment, 
    Error, 
}

export class Token {
    value: number | string | undefined;
    col: [number, number];

    constructor(public kind: TokenType, col: number, len?: number, v?: number | string) {
        this.value = v
        this.col = [col, col + (len ?? 1)]
    }

    static Number(n: number, col: number, len: number) { return new Token(TokenType.Number, col, len, n) }
    static Noun(n: string, col: number, len: number) { return new Token(TokenType.Noun, col, len, n) }
    static String(n: string, col: number, len: number) { return new Token(TokenType.String, col, len, n) }
    static Char(n: string, col: number, len: number) { return new Token(TokenType.Char, col, len, n) }
    static Verb(n: string, col: number, len: number) { return new Token(TokenType.Verb, col, len, n) }
    static FuncVal(n: string, col: number, len: number) { return new Token(TokenType.FuncVal, col, len, n) }
    static Monad(n: string, col: number, len: number) { return new Token(TokenType.Monad, col, len, n) }
    static Dyad(n: string, col: number, len: number) { return new Token(TokenType.Dyad, col, len, n) }
}

const num_re = /^(?:(¬?)([0-9]+(?:\.[0-9]+)?))/
const value_re = /^([a-z][a-z_]*)/
const string_re = /^'(.[^']*)'/
const string_re2 = /^"((?:\\.|[^"])+)"/
const func_re = /^(λ|:?[+\-×÷%^√*±@;~$≤<>≥=≠≡!?&ριφεμδηζ¢Ø«»¥◄►∧∨⌈⌊\|↑↓↕∩]|:?[A-Z][A-Za-z_]*)/

const monad_re = /^([/\\¨`´˝˜§¯]|\.[A-Za-z_]+)/
const dyad_re = /^([•°¤←®→ⁿ↔Δ]|\.[A-Za-z_]+\.)/

function escapeString(s: string) {
    return s
        .replaceAll('¶', '\n')
        .replaceAll('¨', '"');
}

export function tokenize(text: string, quiet = false): Token[] {
    let match: RegExpMatchArray | null
    const tokens: Token[] = []

    let col = 0
    const nlIsSep: boolean[] = [true];

    const advance = (n: number, tk?: Token) => {
        if (tk) tokens.push(tk);
        col += n;
        text = text.slice(n);
    }

    while (text.length > 0) {
        if (text[0] == '#') {
            let end = text.indexOf('\n');
            if (end == -1) end = text.length;
            if (quiet) tokens.push(new Token(TokenType.Comment, col, end));
            text = text.slice(end);
            col += end;
            continue
        }

        if (text[0] == ' ' || text[0] == '\r' || text[0] == '\t' || text[0] == '\n') {
            if (text[0] == '\n' && nlIsSep[nlIsSep.length-1]) tokens.push(new Token(TokenType.Sep, col));
            advance(1);
        } else if (text[0] == '{') { nlIsSep.push(true); advance(1, new Token(TokenType.LBrack, col))
        } else if (text[0] == '}') { nlIsSep.pop(); advance(1, new Token(TokenType.RBrack, col))
        } else if (text[0] == '[') { nlIsSep.push(false); advance(1, new Token(TokenType.ListStart, col))
        } else if (text[0] == ']') { nlIsSep.pop(); advance(1, new Token(TokenType.ListEnd, col))
        } else if (text[0] == '(') { advance(1, new Token(TokenType.LParen, col))
        } else if (text[0] == ')') { advance(1, new Token(TokenType.RParen, col))
        } else if (text[0] == ',') { advance(1, new Token(TokenType.Sep, col))
        } else if (text[0] == '◊') { advance(1, new Token(TokenType.Guard, col))
        } else if (text[0] == '‼') { advance(1, new Token(TokenType.Mutate, col))
        } else if (text[0] == 'π') { advance(1, Token.Number(Math.PI, col, 1))
        } else if (text[0] == 'τ') { advance(1, Token.Number(Math.PI*2, col, 1))
        } else if (text[0] == '∞') { advance(1, Token.Number(Infinity, col, 1))
        } else if (text[0] == 'ø') { advance(1, new Token(TokenType.Empty, col))
        } else if (text[0] == 'α') { advance(1, Token.Noun('α', col, 1))
        } else if (text[0] == 'ω') { advance(1, Token.Noun('ω', col, 1))
        } else if (text[0] == '¶') { advance(1, Token.Char('\n', col, 1))
        } else if (text[0] == 'ƒ') {
            if (match = text.slice(1).match(func_re)) {
                tokens.push(Token.FuncVal(match[0], col, match[0].length+1))
                col += match[0].length+1
                text = text.slice(match[0].length+1)
            } else if (quiet) {
                tokens.push(new Token(TokenType.Error, col))
                col += 1
                text = text.slice(1)
            } else {
                throw `Invalid Token '${text}'`
            }
        } else if (text[0] == ':' && text[1] == ':') {
            tokens.push(new Token(TokenType.Define, col, 2))
            col += 2
            text = text.slice(2)
        } else if (match = text.match(value_re)) {
            const name = match[1]
            tokens.push(Token.Noun(name, col, match[0].length))
            col += match[0].length
            text = text.slice(match[0].length)
        } else if (match = text.match(num_re)) {
            let num = parseFloat(match[2])
            if (match[1] == '¬') num = -num 
            tokens.push(Token.Number(num, col, match[0].length))

            col += match[0].length
            text = text.slice(match[0].length)
        } else if (match = text.match(string_re)) {
            if (match[1].length == 1) {
                tokens.push(Token.Char(match[1], col, match[0].length))    
            } else {
                tokens.push(Token.String(escapeString(match[1]), col, match[0].length))
            }
            col += match[0].length
            text = text.slice(match[0].length)
        } else if (match = text.match(string_re2)) {
            tokens.push(Token.String(escapeString(match[1]), col, match[0].length))
            col += match[0].length
            text = text.slice(match[0].length)
        } else if (match = text.match(func_re)) {
            tokens.push(Token.Verb(match[0], col, match[0].length))
            col += match[0].length
            text = text.slice(match[0].length)
        } else if (match = text.match(dyad_re)) {
            tokens.push(Token.Dyad(match[0], col, match[0].length))
            col += match[0].length
            text = text.slice(match[0].length)
        } else if (match = text.match(monad_re)) {
            tokens.push(Token.Monad(match[0], col, match[0].length))
            col += match[0].length
            text = text.slice(match[0].length)
        } else if (text[0] == ':') { advance(1, new Token(TokenType.Strand, col))
        } else {
            if (quiet) {
                tokens.push(new Token(TokenType.Error, col))
                col += 1
                text = text.slice(1)
            } else {
                throw `Invalid Token '${text}'`
            }
            
            // throw `Invalid Token '${text}'`
        }
    }

    return tokens
}

export enum ExprKind {
    Number, Noun, String, Prefix, Infix, Verb, Monad, Dyad, Fork, Train, List, Defn, Guard, VerbNoun
}

export type Expr
    = { kind: ExprKind.Number, value: number }
    | { kind: ExprKind.List, value: Expr[], vkind: 'num' | 'char' | 'other' }
    | { kind: ExprKind.Noun, value: string }
    | { kind: ExprKind.String, value: string }
    | { kind: ExprKind.Prefix, func: Expr, omega: Expr }
    | { kind: ExprKind.Infix, func: Expr, alpha: Expr, omega: Expr }
    | { kind: ExprKind.Verb, name: string }
    | { kind: ExprKind.VerbNoun, name: string }
    | { kind: ExprKind.Monad, mod: string, alpha: Expr }
    | { kind: ExprKind.Dyad, mod: string, alpha: Expr, omega: Expr }
    | { kind: ExprKind.Fork, infix: Expr, alpha: Expr, omega: Expr }
    | { kind: ExprKind.Train, alpha: Expr, omega: Expr }
    | { kind: ExprKind.Defn, fn: Stmt[] }

export type Stmt
    = { kind: 2, span: [number, number], names: string[], value: Expr }
    | { kind: 4, span: [number, number], name: string, value: Expr | undefined, mutator: Expr }
    | { kind: 3, span: [number, number], name: string, value: Expr }
    | { kind: 1, span: [number, number], expr: Expr, fall: Expr }
    | { kind: 0, span: [number, number], expr: Expr }

type PCtx = { code: Token[], start: number }

function peek(ctx: PCtx, n = 0): Token | undefined {
    return ctx.code[ctx.start+n];
}

function parseStatement(ctx: PCtx): Stmt | null {
    if (ctx.start == ctx.code.length) throw "Unexpected end of input on Statement";

    if (peek(ctx)?.kind === TokenType.Verb && peek(ctx,1)?.kind === TokenType.Define) {
        const funcName = peek(ctx) as Token;
        const span = funcName.col;
        span[1] = peek(ctx,1)?.col[1] ?? span[1];
        ctx.start += 2;
        const func = parseExpr(ctx);
        if (func == null) return null;
        if (!is_func(func)) throw `Invalid code, expected function`;
        return { kind: 3, span: span, name: funcName.value as string, value: func };
    }

    const back = ctx.start;
    const names = Array<string>();
    const span = ctx.code[ctx.start].col;
    while (peek(ctx)?.kind === TokenType.Noun) {
        names.push(ctx.code[ctx.start].value as string);
        ctx.start += 1;
    }

    if (names.length == 1 && peek(ctx)?.kind === TokenType.Mutate) {
        ctx.start += 1;
        span[1] = peek(ctx)?.col[1] ?? span[1];
        const mutator = parsePart(ctx);
        if (mutator == null) return null;
        if (!is_func(mutator)) throw `Invalid code, expected function`;

        const val = parseExpr(ctx);
        if (val == null) return { kind: 4, span, name: names[0], value: undefined, mutator };
        if (is_func(val)) throw `Invalid code, expected value`;

        return { kind: 4, span, name: names[0], value: val, mutator };
    }

    if (names.length > 0 && peek(ctx)?.kind === TokenType.Define) {
        ctx.start += 1;
        span[1] = peek(ctx)?.col[1] ?? span[1];
        const val = parseExpr(ctx);
        if (val == null) return null;
        if (is_func(val)) throw `Invalid code, expected value`;
        return { kind: 2, span, names: names, value: val };
    }

    ctx.start = back;
    const expr = parseExpr(ctx);
    if (expr == null) throw "Invalid code, expected expression in statement";

    if (peek(ctx)?.kind === TokenType.Guard) {
        span[1] = peek(ctx,1)?.col[1] ?? span[1];
        ctx.start += 1;
        const fall = parseExpr(ctx);
        if (fall == null) throw "Invalid code, expected expression to return";

        return { kind: 1, span, expr: expr, fall: fall };
    }

    span[1] = peek(ctx,-1)?.col[1] ?? span[1];
    return { kind: 0, span, expr: expr };
}

function parseOperand(ctx: PCtx): Expr | null {
    if (peek(ctx)?.kind == TokenType.LParen) {
        ctx.start += 1;
        const r = parseExpr(ctx);
        if (r == null) return null;
        if (peek(ctx)?.kind != TokenType.RParen) throw "Invalid code, expected )";
        ctx.start += 1;
        return r;
    }

    const tk = peek(ctx);
    ctx.start += 1;

    switch (tk?.kind) {
        case TokenType.Number:
            return { kind: ExprKind.Number, value: tk.value as number }
        case TokenType.Noun:
            return { kind: ExprKind.Noun, value: tk.value as string }
        case TokenType.String:
            if ((tk.value as string).length == 1) {
                return { kind: ExprKind.List, value: [{ kind: ExprKind.String, value: tk.value as string }], vkind: 'other' }    
            }
            return { kind: ExprKind.String, value: tk.value as string }
        case TokenType.Char:
            return { kind: ExprKind.String, value: tk.value as string }
        case TokenType.FuncVal:
            return { kind: ExprKind.VerbNoun, name: tk.value as string }
        case TokenType.Empty:
            return { kind: ExprKind.List, value: [], vkind: 'other' }
        case TokenType.Verb:
            return { kind: ExprKind.Verb, name: tk.value as string }
        case TokenType.LBrack: {
            while (peek(ctx)?.kind === TokenType.Sep) { ctx.start += 1 }
                
            const exprs = []
            while (true) {
                const stmt = parseStatement(ctx);
                if (stmt === null) throw "Invalid code in defn";
                // if (is_func(stmt)) throw "Invalid code in defn, unexpected function";

                exprs.push(stmt);

                // if (ctx.code[start]?.kind === TokenType.RBrack) break

                while (peek(ctx)?.kind === TokenType.Sep) { ctx.start += 1 }
                if (peek(ctx)?.kind === TokenType.RBrack) break
            }
            ctx.start += 1;
            return { kind: ExprKind.Defn, fn: exprs }
        }
        case TokenType.ListStart: {
            const exprs = []

            let expr;
            while (true) {
                expr = parseExpr(ctx);
                if (expr === null) throw `Invalid Code at ${ctx.code[ctx.start].col}`
                if (is_func(expr)) throw "List value can't be a function"

                exprs.push(expr)
                if (peek(ctx)?.kind == TokenType.ListEnd) break;

                if (peek(ctx)?.kind != TokenType.Sep) throw "Invalid Code, expected separator"
                ctx.start += 1
            }
            ctx.start += 1;

            let vkind: 'other' | 'num' | 'char' = 'other'
            if (exprs.every(e => e.kind == ExprKind.Number)) {
                vkind = 'num'
            }
            
            return { kind: ExprKind.List, value: exprs, vkind }
        }
    }
    ctx.start -= 1;
    return null;
}

function parsePart(ctx: PCtx): Expr | null {
    if (ctx.start >= ctx.code.length) return null;

    let r = parseOperand(ctx);
    if (r == null) return null;
    const strand: Expr[] = [r];
    while (peek(ctx)?.kind == TokenType.Strand) {
        ctx.start += 1;
        r = parseOperand(ctx);
        if (r == null) throw "Invalid code, expected expression at strand";
        strand.push(r);
    }
    if (strand.length > 1) r = { kind: ExprKind.List, value: strand, vkind: 'other' }

    while (true) {
        const top = peek(ctx)
        
        if (top?.kind == TokenType.Monad) {
            if (r == null) throw "Invalid code, expected argument for monad";
            ctx.start += 1;
            r = { kind: ExprKind.Monad, mod: top.value as string, alpha: r };
            continue;
        } 
        
        if (top?.kind == TokenType.Dyad) {
            if (r == null) throw `Invalid code, expected left argument for dyad`;
            ctx.start += 1;
            const omega = parseOperand(ctx);
            if (omega === null) throw "Invalid code, expected right argument for dyad";

            r = { kind: ExprKind.Dyad, mod: top.value as string, alpha: r, omega: omega };
            continue;
        }
        
        break;
    }

    return r;
}

function parsePhrase(parts: Expr[]): Expr | undefined {
    while (parts.length > 1) {
        const z = parts.pop();
        if (z == undefined) continue;

        const y = parts.pop();
        if (y == undefined) continue;

        if (!is_func(y)) throw `Syntax Error, expected function aplication`;

        const x = parts[parts.length-1];

        if (is_func(z)) {
            if (x == undefined) {
                parts.push({ kind: ExprKind.Train, alpha: y, omega: z });
                continue;
            }
            parts.pop();
            parts.push({ kind: ExprKind.Fork, alpha: x, infix: y, omega: z });
            continue;
        }

        if (x && !is_func(x)) {
            parts.pop();
            parts.push({ kind: ExprKind.Infix, alpha: x, func: y, omega: z });
            continue;
        }

        parts.push({ kind: ExprKind.Prefix, func: y, omega: z });
    }

    return parts[0];
}

function parseExpr(ctx: PCtx): Expr | null {
    if (ctx.start == ctx.code.length) throw "Unexpected end of input Expr";

    const parts: Expr[] = [];

    while (true) {
        const r = parsePart(ctx);
        if (r == null) break;
        parts.push(r);
    }

    const r = parsePhrase(parts);
    if (r == undefined) return null;
    return r;
}

function parseBlock(ctx: PCtx, terminate: (tk: TokenType | undefined, start: number) => boolean): Stmt[] {
    while (peek(ctx)?.kind === TokenType.Sep) {
        ctx.start += 1;
    }
            
    const body: Stmt[] = []
    while (true) {
        const stmt = parseStatement(ctx);
        if (stmt === null) throw "Invalid code in block";
        // if (is_func(stmt)) throw "Invalid code in block, unexpected function";

        body.push(stmt);

        // if (terminate(ctx.code[start]?.kind)) break

        while (peek(ctx)?.kind === TokenType.Sep) { ctx.start += 1 }
        if (terminate(peek(ctx)?.kind, ctx.start)) break;
    }

    ctx.start += 1;
    return body;
}

export function parse(text: string) {
    const tks = tokenize(text);
    const ctx = { code: tks, start: 0 };

    const exprs = parseBlock(ctx, (_, s) => s >= ctx.code.length);

    return exprs;
}

function is_func(e: Expr): boolean {
    if (e.kind == ExprKind.Verb) return true
    if (e.kind == ExprKind.Monad) return true
    if (e.kind == ExprKind.Dyad) return true
    if (e.kind == ExprKind.Fork) return true
    if (e.kind == ExprKind.Train) return true
    if (e.kind == ExprKind.Defn) return true
    return false
}