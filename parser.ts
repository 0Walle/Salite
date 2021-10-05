export enum TokenType {
    Func, Monad, Dyad, RParen, LParen, RBrack, LBrack, Number, Id, String, ListStart, ListEnd, Sep, Empty, Error, Define, Comment, Pipe
}

export class Token {
    value: number | string | undefined;
    col: [number, number] | undefined;

    constructor(public kind: TokenType, v?: number | string) {
        this.value = v
    }

    static Number(n: number) { return new Token(TokenType.Number, n) }
    static Id(n: string) { return new Token(TokenType.Id, n) }
    static String(n: string) { return new Token(TokenType.String, n) }
    static Func(n: string) { return new Token(TokenType.Func, n) }
    static Monad(n: string) { return new Token(TokenType.Monad, n) }
    static Dyad(n: string) { return new Token(TokenType.Dyad, n) }

    static RParen() { return new Token(TokenType.RParen) }
    static LParen() { return new Token(TokenType.LParen) }

    static RBrack() { return new Token(TokenType.RBrack) }
    static LBrack() { return new Token(TokenType.LBrack) }

    static Pipe() { return new Token(TokenType.Pipe) }

    static ListStart() { return new Token(TokenType.ListStart) }
    static ListEnd() { return new Token(TokenType.ListEnd) }
    static Sep() { return new Token(TokenType.Sep) }
    
    static Empty() { return new Token(TokenType.Empty) }

    static Error() { return new Token(TokenType.Error) }
    static Comment() { return new Token(TokenType.Comment) }

    static Define() { return new Token(TokenType.Define) }

    span(col: number, len: number) {
        this.col = [col, col + len]
        return this
    }
}

const num_re = /^(?:(¬?)([0-9]+(?:\.[0-9]+)?))/
const value_re = /^([a-z][a-z_]*)/
const string_re = /^'((?:\\.|[^'])+)'/
const func_re = /^([+\-*%^;~$≤<>≥=≠ριφεμδ¢∧∨λ√⊣⊢!?]|:[+\-*%^;~$≤<>≥=≠ριφεμδ¢∧∨]|[A-Z][a-z_]*)/

const monad_re = /^([\\/¨`´§]|\.[a-z][a-z_]*)/
const dyad_re = /^([•°←↑→↓@¤]|\.[A-Z][a-z_]*)/

export function tokenize(text: string, quiet = false): Token[] {

    let match: RegExpMatchArray | null
    let tokens: Token[] = []

    let col = 0

    while (text.length > 0) {
        
        if (text[0] == ' ' || text[0] == '\n' || text[0] == '\t') {
            text = text.slice(1)
            col += 1
        } else if (text[0] == '#') {
            let end = text.indexOf('\n')
            if (end == -1) {
                if (quiet) tokens.push(Token.Comment().span(col, text.length))
                col += text.length
                text = ''
                continue
            }
            if (quiet) tokens.push(Token.Comment().span(col, end))
            text = text.slice(end)
            col += end
        } else if (text[0] == '(') {
            tokens.push(Token.LParen().span(col, 1))
            col += 1
            text = text.slice(1)
        } else if (text[0] == ')') {
            tokens.push(Token.RParen().span(col, 1))
            col += 1
            text = text.slice(1)
        } else if (text[0] == '{') {
            tokens.push(Token.LBrack().span(col, 1))
            col += 1
            text = text.slice(1)
        } else if (text[0] == '}') {
            tokens.push(Token.RBrack().span(col, 1))
            col += 1
            text = text.slice(1)
        } else if (text[0] == '[') {
            tokens.push(Token.ListStart().span(col, 1))
            col += 1
            text = text.slice(1)
        } else if (text[0] == ']') {
            tokens.push(Token.ListEnd().span(col, 1))
            col += 1
            text = text.slice(1)
        } else if (text[0] == ',') {
            tokens.push(Token.Sep().span(col, 1))
            col += 1
            text = text.slice(1)
        } else if (text[0] == '|') {
            tokens.push(Token.Pipe().span(col, 1))
            col += 1
            text = text.slice(1)
        } else if (text[0] == 'π') {
            tokens.push(Token.Number(Math.PI).span(col, 1))
            col += 1
            text = text.slice(1)
        } else if (text[0] == '∞') {
            tokens.push(Token.Number(Infinity).span(col, 1))
            col += 1
            text = text.slice(1)
        } else if (text[0] == 'ø') {
            tokens.push(Token.Empty().span(col, 1))
            col += 1
            text = text.slice(1)
        } else if (text[0] == 'α') {
            tokens.push(Token.Id('α').span(col, 1))
            col += 1
            text = text.slice(1)
        } else if (text[0] == 'ω') {
            tokens.push(Token.Id('ω').span(col, 1))
            col += 1
            text = text.slice(1)
        } else if (text[0] == ':' && text[1] == ':') {
            tokens.push(Token.Define().span(col, 2))
            col += 2
            text = text.slice(2)
        } else if (match = text.match(value_re)) {
            let name = match[1]
            tokens.push(Token.Id(name).span(col, match[0].length))
            col += match[0].length
            text = text.slice(match[0].length)
        } else if (match = text.match(num_re)) {
            let num = parseFloat(match[2])
            if (match[1] == '¬') num = -num 
            tokens.push(Token.Number(num).span(col, match[0].length))

            col += match[0].length
            text = text.slice(match[0].length)
        } else if (match = text.match(string_re)) {
            tokens.push(Token.String(match[1]).span(col, match[0].length))
            col += match[0].length
            text = text.slice(match[0].length)
        } else if (match = text.match(func_re)) {
            tokens.push(Token.Func(match[0]).span(col, match[0].length))
            col += match[0].length
            text = text.slice(match[0].length)
        } else if (match = text.match(monad_re)) {
            tokens.push(Token.Monad(match[0]).span(col, match[0].length))
            col += match[0].length
            text = text.slice(match[0].length)
        } else if (match = text.match(dyad_re)) {
            tokens.push(Token.Dyad(match[0]).span(col, match[0].length))
            col += match[0].length
            text = text.slice(match[0].length)
        } else {
            if (quiet) {
                tokens.push(Token.Error().span(col, 1))
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
    Number, Id, String, Prefix, Infix, Func, Monad, Dyad, Fork, Train, Vector, Defn, Decl, Guard
}

export type Expr
    = { kind: ExprKind.Number, value: number }
    | { kind: ExprKind.Vector, value: Expr[], vkind: 'num' | 'char' | 'other' }
    | { kind: ExprKind.Id, value: string }
    | { kind: ExprKind.String, value: string }
    | { kind: ExprKind.Prefix, func: Expr, omega: Expr }
    | { kind: ExprKind.Infix, func: Expr, alpha: Expr, omega: Expr }
    | { kind: ExprKind.Func, name: string }
    | { kind: ExprKind.Monad, mod: string, alpha: Expr }
    | { kind: ExprKind.Dyad, mod: string, alpha: Expr, omega: Expr }
    | { kind: ExprKind.Fork, infix: Expr, alpha: Expr, omega: Expr }
    | { kind: ExprKind.Train, alpha: Expr, omega: Expr }
    | { kind: ExprKind.Defn, fn: Expr[] }
    | { kind: ExprKind.Decl, name: string, is_func: boolean, value: Expr }
    | { kind: ExprKind.Guard, expr: Expr, fall: Expr }

// type Expr = {
//     arity: 0 | 1 | 2,
//     role: 0 | 1 | 2 | 3,
//     value: number | string | Expr,
//     alpha: Expr | null,
//     omega: Expr | null,
// }

function Expr_Number(n: number): Expr {
    return { kind: ExprKind.Number, value: n }
}

function Expr_String(n: string): Expr {
    return { kind: ExprKind.String, value: n }
}

function Expr_Id(n: string): Expr {
    return { kind: ExprKind.Id, value: n }
}

function Expr_Func(n: string): Expr {
    return { kind: ExprKind.Func, name: n }
}

export function pretty_expr(e: Expr): string {
    // const paren = (a: Expr, arity: 0 | 1 | 2) => (s: string) => a.arity > arity ? `(${s})` : s

    switch (e.kind) {
        case ExprKind.Number:
            if (e.value < 0) {
                return `¬${-e.value}`
            }
            return `${e.value}`
        case ExprKind.String:
            return `'${e.value}'`
        case ExprKind.Id:
            return e.value
        case ExprKind.Vector:
            return `${e.value.map(pretty_expr).join(', ')}`
        
        case ExprKind.Prefix:

            return `(${pretty_expr(e.func)}) ${pretty_expr(e.omega)}`
        case ExprKind.Infix:

            return `(${pretty_expr(e.alpha)}) (${pretty_expr(e.func)}) ${pretty_expr(e.omega)}`

        case ExprKind.Func:
            return `${e.name}`

        case ExprKind.Fork:
            return `${pretty_expr(e.alpha)}${pretty_expr(e.infix)}${pretty_expr(e.omega)}`

        case ExprKind.Train:
            return `${pretty_expr(e.alpha)}${pretty_expr(e.omega)}`

        case ExprKind.Monad:
            return `${pretty_expr(e.alpha)}${e.mod}`
            
        case ExprKind.Dyad:
            return `${pretty_expr(e.alpha)}${e.mod}(${pretty_expr(e.omega)})`

        case ExprKind.Defn:
            return `{${e.fn.map(pretty_expr).join(', ')}}`
        
        case ExprKind.Decl:
            return `${e.name} :: ${pretty_expr(e.value)}`

        case ExprKind.Guard:
            return `${pretty_expr(e.expr)} | ${pretty_expr(e.fall)}`
    }
}

type PCtx = { code: Token[] }

function is_func(e: Expr): boolean {
    if (e.kind == ExprKind.Func) return true
    if (e.kind == ExprKind.Monad) return true
    if (e.kind == ExprKind.Dyad) return true
    if (e.kind == ExprKind.Fork) return true
    if (e.kind == ExprKind.Train) return true
    if (e.kind == ExprKind.Defn) return true
    return false
}

function parse_try_def_or_guard(ctx: PCtx): Expr | null {
    if (ctx.code.length == 0) return null

    let [tk, ...tail] = ctx.code

    switch (tk.kind) {
        case TokenType.Id:
        case TokenType.Func: {
            const [is_def, ...tail_] = tail

            if (is_def.kind != TokenType.Define) break

            ctx.code = tail_

            const expr = parse_expr(ctx)

            if (expr == null) throw "Invalid code, expected expression"

            if ((tk.kind == TokenType.Func) != is_func(expr)) {
                throw `Invalid code, expected ${tk.kind == TokenType.Func ? 'function' : 'value'}`
            }

            return { kind: ExprKind.Decl, is_func: tk.kind == TokenType.Func, name: <string>tk.value, value: expr }
        }
    }

    let expr = parse_expr(ctx)
    if (expr == null) return null

    ;[tk, ...tail] = ctx.code

    if (tk?.kind == TokenType.Pipe) {
        ctx.code = tail

        const fall = parse_expr(ctx)
        if (fall == null) throw "Invalid code, expected expression"

        expr = { kind: ExprKind.Guard, expr: expr, fall: fall }
    }
    
    return expr
}

function parse_try_func_or_subj(ctx: PCtx): Expr | null {
    if (ctx.code.length == 0) return null

    const [tk, ...tail] = ctx.code

    switch (tk.kind) {
        case TokenType.Number:
            ctx.code = tail
            return Expr_Number(<number>tk.value)
        case TokenType.Id:
            ctx.code = tail
            return Expr_Id(<string>tk.value)
        case TokenType.String:
            ctx.code = tail
            return Expr_String(<string>tk.value)
        case TokenType.Empty:
            ctx.code = tail
            return { kind: ExprKind.Vector, value: [], vkind: 'other' }
        case TokenType.LParen: {
            ctx.code = tail
            let expr = parse_expr(ctx)
            if (ctx.code[0].kind != TokenType.RParen) throw "Invalid code, expected )"
            ctx.code = ctx.code.slice(1)

            if (expr?.kind == ExprKind.Train) {
                return { kind: ExprKind.Dyad, mod: '•', alpha: expr.alpha, omega: expr.omega }
            }

            return expr
        }
        case TokenType.ListStart: {
            ctx.code = tail
            let exprs = []
            
            while (true) {
                const expr = parse_expr(ctx)

                if (expr === null) throw "Invalid Code, invalid expression"

                exprs.push(expr)
                if (ctx.code[0].kind == TokenType.ListEnd) break

                if (ctx.code[0].kind != TokenType.Sep) throw "Invalid Code, expected separator"
                ctx.code = ctx.code.slice(1)
            }
            ctx.code = ctx.code.slice(1)

            let vkind: 'other' | 'num' | 'char' = 'other'
            if (exprs.every(e => e.kind == ExprKind.Number)) {
                vkind = 'num'
            }
            
            return { kind: ExprKind.Vector, value: exprs, vkind: vkind }
        }
        case TokenType.Func:
            ctx.code = tail
            return Expr_Func(<string>tk.value)
        case TokenType.LBrack: {
            ctx.code = tail

            let exprs = []

            while (true) {

                let expr = parse_try_def_or_guard(ctx)

                if (expr === null) throw "Invalid code in defn"
                if (is_func(expr)) { throw "Invalid code in defn" }

                exprs.push(expr)

                if (ctx.code[0].kind == TokenType.RBrack) break

                if (ctx.code[0].kind != TokenType.Sep) throw "Invalid Code, expected separator"
                // if (ctx.code[0].kind != TokenType.RBrack) throw "Invalid code, expected }"
                ctx.code = ctx.code.slice(1)
            }
            
            ctx.code = ctx.code.slice(1)


            return { kind: ExprKind.Defn, fn: exprs } 
        }
        default:
            // console.log("Found ", tk)
            return null
    }
}

function parse_try_subj(ctx: PCtx): Expr | null {
    if (ctx.code.length == 0) return null

    const [tk, ...tail] = ctx.code

    switch (tk.kind) {
        case TokenType.Number:
            ctx.code = tail
            return Expr_Number(<number>tk.value)
        case TokenType.Id:
            ctx.code = tail
            return Expr_Id(<string>tk.value)
        case TokenType.String:
            ctx.code = tail
            return Expr_String(<string>tk.value)
        case TokenType.Empty:
            ctx.code = tail
            return { kind: ExprKind.Vector, value: [], vkind: 'other' }
        case TokenType.LParen: {
            const backtrack = ctx.code
            ctx.code = tail
            let expr = parse_expr(ctx)            
            if (ctx.code[0].kind != TokenType.RParen) throw "Invalid code, expected )"
            ctx.code = ctx.code.slice(1)

            if (expr && is_func(expr)) {
                ctx.code = backtrack
                return null
            }

            return expr
        }
        case TokenType.ListStart: {
            ctx.code = tail
            let exprs = []
            
            while (true) {
                const expr = parse_expr(ctx)

                if (expr === null) throw "Invalid Code, invalid expression"

                if (is_func(expr)) throw "Invalid Code, invalid expression"

                exprs.push(expr)
                if (ctx.code[0].kind == TokenType.ListEnd) break

                if (ctx.code[0].kind != TokenType.Sep) throw "Invalid Code, expected separator"
                ctx.code = ctx.code.slice(1)
            }
            ctx.code = ctx.code.slice(1)

            let vkind: 'other' | 'num' | 'char' = 'other'
            if (exprs.every(e => e.kind == ExprKind.Number)) {
                vkind = 'num'
            }
            
            return { kind: ExprKind.Vector, value: exprs, vkind }
        }
        default:
            // console.log("Found ", tk)
            return null
    }
}

function parse_derv(ctx: PCtx, first?: Expr): Expr | null {
    let result = first ?? parse_try_func_or_subj(ctx)

    loop: while (true) {
        
        let top = ctx.code[0]
        
        switch (top?.kind) {
            case TokenType.Monad: {
                if (result == null) throw "Invalid code, expected function argument for monad"

                ctx.code.shift()

                result = { kind: ExprKind.Monad, mod: <string>top.value, alpha: result }
                break
            }
            case TokenType.Dyad: {
                if (result == null) throw `Invalid code, expected left argument for dyad at ${top.col}`
                ctx.code.shift()

                let omega = parse_try_func_or_subj(ctx)

                if (omega == null) throw "Invalid code, expected right argument for dyad"

                result = { kind: ExprKind.Dyad, mod: <string>top.value, alpha: result, omega: omega }
                break
            }
            default:
                break loop
        }
    }

    if (result === null) {
        return null
        // if (ctx.code[0] != undefined) {
        //     throw new Error(`Parse Error: Invalid code, expected a function at ${ctx.code[0].col ?? '??'}`)
        // }
        
        // throw new Error(`Invalid code, expected function :: ${result}, ${ctx.code}`)
    }

    if (!is_func(result)) throw `Invalid code, expected function found ${result.kind}`

    return result
}

function parse_expr(ctx: PCtx): Expr | null {
    if (ctx.code.length == 0) {
        return null
    }

    if (ctx.code[0].kind == TokenType.RParen || ctx.code[0].kind == TokenType.Sep || ctx.code[0].kind == TokenType.Pipe || ctx.code[0].kind == TokenType.ListEnd) {
        return null
    }

    let alpha = parse_try_subj(ctx)

    let func: Expr | null
    if (alpha && (ctx.code.length > 0 && (ctx.code[0].kind == TokenType.Dyad || ctx.code[0].kind == TokenType.Monad))) {
        func = parse_derv(ctx, alpha)
        alpha = null
    } else {
        func = parse_derv(ctx)
    }

    if (func === null) {
        return alpha
    }

    let omega = parse_expr(ctx)

    if (!omega) {
        if (alpha) throw `Invalid code, no right argument in function`
        return func
    }

    if (alpha) {
        if (is_func(omega)) {
            return { kind: ExprKind.Fork, alpha: alpha, infix: func, omega: omega }
        }

        return { kind: ExprKind.Infix, func, alpha, omega }
    }

    if (omega.kind == ExprKind.Train) {
        return { kind: ExprKind.Fork, alpha: func, infix: omega.alpha, omega: omega.omega }
    }

    if (is_func(omega)) {
        return { kind: ExprKind.Train, alpha: func, omega: omega }
    }

    return { kind: ExprKind.Prefix, func, omega }
}

// export function parse(text: string): {expr: Expr, vars: { [name: string]: Expr }, funcs: { [name: string]: Expr } } {
export function parse(text: string): Expr[] {
    let tk = tokenize(text)

    let ctx = { code: tk }

    let exprs = []
    while (true) {

        const expr = parse_try_def_or_guard(ctx)

        if (expr == null) throw "Invalid code"

        exprs.push(expr)

        if (ctx.code.length == 0) break

        if (ctx.code[0].kind != TokenType.Sep) throw "Invalid code, expected separator"
        ctx.code.shift()
    }

    return exprs

    // while (ctx.code.length > 2 && ctx.code[1].kind == TokenType.Define) {
    //     let name = ctx.code[0]
    //     ctx.code = ctx.code.slice(2)
    //     let r = parse_expr(ctx)

    //     if (r == null) throw "Error in definition"
        
    //     if (name.kind == TokenType.Id && !is_func(r)) {
    //         defs[<string>name.value] = r
    //     } else if (name.kind == TokenType.Func && is_func(r)) {
    //         funcs[<string>name.value] = r
    //     } else {
    //         throw "Error in definition"
    //     }
        
    //     if (!(ctx.code.length > 0 && ctx.code[0].kind == TokenType.Sep))
    //         throw "Invalid code"

    //     ctx.code = ctx.code.slice(1)
    // }

    // let r = parse_expr(ctx)

    // if (r === null) {
    //     throw "Parse Error"
    // }

    // return { expr: r, vars: defs, funcs: funcs }
}