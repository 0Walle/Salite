import { MultiArray } from "./multiarray"

type MonadicF<T, U> = (x: MultiArray<T>) => MultiArray<U>
type DyadicF<T, U, V> = (x: MultiArray<T>, y: MultiArray<U>) => MultiArray<V>
// type FuncExpr = {f1: MonadicF | undefined, f2: DyadicF | undefined}

const EMPTY = new MultiArray([])

namespace SaliteFunc {
	const _same_shape = (x: Multivec, y: Multivec) => {
		return x._shape.length == y._shape.length && x._shape.every((n, i) => y._shape[i] == n)
	}

	const _map = (f: (x: number) => number) => (x: Multivec) => x.applyMF(f)

	const _expand = (f: (x: number, y: number) => number) => (x: Multivec, y: Multivec) => {
		if (_same_shape(x, y)) {
			return new Multivec(x._kind, x._shape, x._data.map((xn, i) => f(xn, y._data[i])))
		}

		if (x._data.length == 1) {
			const num = x._data[0]

			return new Multivec(y._kind, y._shape, y._data.map(yn => f(num, yn)))
		}

		if (y._data.length == 1) {
			const num = y._data[0]

			return new Multivec(x._kind, x._shape, x._data.map(xn => f(xn, num)))
		}

		throw "Shape Error"
	}

	export const operator_zip = (f: DyadicF) => _expand((x, y) => f(Multivec.scalar(x), Multivec.scalar(y)).toNumber())

	export const neg: MonadicF = _map(n => -n)
	export const sign: MonadicF = _map(Math.sign)
	export const recp: MonadicF = _map(n => 1/n)
	export const exp: MonadicF = _map(Math.exp)
	export const ln: MonadicF = _map(Math.log)
	export const abs: MonadicF = _map(Math.abs)
	export const floor: MonadicF = _map(Math.floor)
	export const ceil: MonadicF = _map(Math.ceil)
	export const roll: MonadicF = _map(n => ~~(Math.random() * n))

	
	export const length: MonadicF = (x: Multivec) => Multivec.scalar(x._shape[0] ?? 1)
	export const rank: MonadicF = (x: Multivec) => Multivec.scalar(x._shape.length)
	export const shape: MonadicF = (x: Multivec) => x.shape()
	export const ravel: MonadicF = (x: Multivec) => x.ravel()

	export const first: MonadicF = (x: Multivec) => x.first()
	export const id: MonadicF = (x: Multivec) => x

	export const iota: MonadicF = (x: Multivec) => Multivec.iota(x._data)

	export const add: DyadicF = _expand((x, y) => x + y)
	export const sub: DyadicF = _expand((x, y) => x - y)
	export const mul: DyadicF = _expand((x, y) => x * y)
	export const div: DyadicF = _expand((x, y) => x / y)
	export const power: DyadicF = _expand((x, y) => x ** y)
	export const log: DyadicF = _expand((x, y) => Math.log(x) / Math.log(y))
	export const modulo: DyadicF = _expand((x, y) => y % x)
	export const min: DyadicF = _expand(Math.min)
	export const max: DyadicF = _expand(Math.max)

	export const cmp_le: DyadicF = _expand((x, y) => +(x <= y))
	export const cmp_lt: DyadicF = _expand((x, y) => +(x < y))
	export const cmp_ge: DyadicF = _expand((x, y) => +(x >= y))
	export const cmp_gt: DyadicF = _expand((x, y) => +(x > y))
	export const cmp_eq: DyadicF = _expand((x, y) => +(x == y))
	export const cmp_ne: DyadicF = _expand((x, y) => +(x != y))

	export const left: DyadicF = (x: Multivec, y: Multivec) => y
	export const right: DyadicF = (x: Multivec, y: Multivec) => x

	export const reshape: DyadicF = (sh: Multivec, y: Multivec) => new Multivec(y._kind, sh._data, y._data)

	export const join: DyadicF = (x: Multivec, y: Multivec) => {
		const data = [...x._data, ...y._data]
		return new Multivec(x._kind, [data.length], data)
	}

	export const membership: DyadicF = (set: Multivec, x: Multivec) =>
		x.applyMF(n => set._data.some(m => n == m) ? 1 : 0)
}

namespace Parser {

/*
::Grammar::	

Expr:
  subExpr
  FuncExpr
  _m1Expr
  <D>

_m1Expr:
  <M>
  <D> <sF>
  Operand <D>

Operand:
  <s>
  Derv

Derv:
  <F>
  Operand <M>
  Operand <D> <sF>

Fork:
  Derv
  Operand Derv Fork

FuncExpr:
  Fork
  Derv Fork

subExpr:
  Derv subExpr
  <s> Derv subExpr
*/

/*
::Holy Shit!!::

+	 	Conjugate 		Add
-	 	Negate 			Subtract
*	 	Sign 			Multiply
/	 	Reciprocal 		Divide
^	 	Exponential 	Power
:/	 	Square Root 	Root
:-	 	Floor 			Minimum
:^	 	Ceiling 		Maximum
:*						And*
:+		 				Or*
~	 	Not* 			Span*
%	 	Absolute Value 	Modulus
≤						Less Than or Equal to
<		Sort Down 		Less Than
>		Sort Up			Greater Than
≥						Greater Than or Equal to
=		Length* 		Equals
≠	 	Rank 			Not Equals
:=	 	Count			Match
:≠		 				Not Match
:<	 	Identity 		Left
:>	 	Identity 		Right
,		Deshape 		Join To
:,	 	    			Couple*
ρ		Shape       	Reshape
:≤		Prefixes* 		Take
:≥ 		Suffixes* 		Drop
ι	 	Range 			Index of
:ι	 	First 			Pick*
:ρ	  	First Cell* 	Select*
φ	  	Reverse 		Rotate
:φ	  	Transpose*
$	  	Indices 		Replicate
ε	  	Mark Firsts 	Member of
:ε	  	Unique		 	Find
μ	  	Group Indices* 	Group*

•						Atop
○	 					Over
.<  					Before
.>  					After
.@  					Choice
.~  	Swap
¨		Each
|		Fold
.|		Scan

*/
	export enum TokenType {
		Func, Monad, Dyad, RParen, LParen, RBrack, LBrack, Number, String
	}

	class Token {
		value: number | string | undefined;

		constructor(public kind: TokenType, v?: number | string) {
			this.value = v
		}

		static Number(n: number) { return new Token(TokenType.Number, n) }
		static String(n: string) { return new Token(TokenType.String, n) }
		static Func(n: string) { return new Token(TokenType.Func, n) }
		static Monad(n: string) { return new Token(TokenType.Monad, n) }
		static Dyad(n: string) { return new Token(TokenType.Dyad, n) }

		static RParen() { return new Token(TokenType.RParen) }
		static LParen() { return new Token(TokenType.LParen) }
	}

	const num_re = /^(?:(¬?)([0-9]+(?:\.[0-9]+)?))/
	const string_re = /^'((?:[^']|\\.)+)'/
	const func_re = /^([+\-*/^,~$%≤<>≥=≠ριφεμ]|:[+\-*/^,~$%≤<>≥=≠ριφεμA-Z])/

	const monad_re = /^([|¨]|\.[|¨!~])/
	const dyad_re = /^(•|\.[•<@>])/

	function tokenize(text: string): Token[] {

		let match: RegExpMatchArray | null
		let tokens: Token[] = []

		while (text.length > 0) {
			
			if (text[0] == ' ') {
				text = text.slice(1)
			} else if (text[0] == '(') {
				tokens.push(Token.LParen())
				text = text.slice(1)
			} else if (text[0] == ')') {
				tokens.push(Token.RParen())
				text = text.slice(1)
			} else if (match = text.match(num_re)) {
				let num = parseFloat(match[2])
				if (match[1] == '¬') num = -num 
				tokens.push(Token.Number(num))

				text = text.slice(match[0].length)
			} else if (match = text.match(string_re)) {				
				tokens.push(Token.String(match[1]))

				text = text.slice(match[0].length)
			} else if (match = text.match(func_re)) {
				tokens.push(Token.Func(match[0]))
				text = text.slice(match[0].length)
			} else if (match = text.match(monad_re)) {
				tokens.push(Token.Monad(match[0]))
				text = text.slice(match[0].length)
			} else if (match = text.match(dyad_re)) {
				tokens.push(Token.Dyad(match[0]))
				text = text.slice(match[0].length)
			} else {
				throw `Invalid Token '${text}'`
			}
		}

		return tokens
	}

	type Expr = {
		arity: 0 | 1 | 2,
		role: 0 | 1 | 2 | 3,
		value: number | string | Expr,
		alpha: Expr | null,
		omega: Expr | null,
	}

	function Expr_Subj(n: number | string | Expr): Expr {
		return { arity: 0, role: 0, value: n, alpha: null, omega: null }
	}

	function Expr_Func(n: string | Expr): Expr {
		return { arity: 0, role: 1, value: n, alpha: null, omega: null }
	}

	function Expr_DFunc(f: string | Expr, alpha: Expr, omega: Expr): Expr {
		return { arity: 2, role: 0, value: f, alpha: alpha, omega: omega }
	}

	function Expr_MFunc(f: string | Expr, omega: Expr): Expr {
		return { arity: 1, role: 0, value: f, alpha: null, omega: omega }
	}

	function pretty_expr(e: Expr): string {
		const paren = (a: Expr, arity: 0 | 1 | 2) => (s: string) => a.arity > arity ? `(${s})` : s

		switch (e.arity) {
			case 0:
				return e.role == 0 ? String(e.value) : `${e.value}`
			case 1:
				if (e.role == 1) {
					return `${pretty_expr(<Expr>e.alpha)}${e.value}`
				}
				return `${pretty_expr(<Expr>e.value)} ${pretty_expr(<Expr>e.omega)}`
			case 2:
				if (e.role == 0) {
					let alpha = paren(<Expr>e.alpha, 0)(`${pretty_expr(<Expr>e.alpha)}`)

					return `${alpha} ${typeof e.value == 'object' ? pretty_expr(e.value) : e.value } ${pretty_expr(<Expr>e.omega)}`
				}
				return `${pretty_expr(<Expr>e.alpha)}${e.value}${pretty_expr(<Expr>e.omega)}`
		}
	}

	type PCtx = { code: Token[] }

	// function parse_op(ctx: PCtx): Expr {
		
	// }

	// function parse_func(ctx: PCtx): Expr {
		
	// }

	// function parse_operand(ctx: PCtx): Expr {
	// 	// if (ctx.code[0] && ctx.code[0].kind == TokenType.Number) {
	// 	// 	let val = <number>ctx.code[0].value
	// 	// 	ctx.code = ctx.code.slice(1)
	// 	// 	return Expr_Subj(val)
	// 	// }

	// 	// return parse_derv(ctx)
	// }

	function parse_try_func_or_subj(ctx: PCtx): Expr | null {
		if (ctx.code.length == 0) return null

		const [tk, ...tail] = ctx.code

		switch (tk.kind) {
			case TokenType.Number:
				ctx.code = tail
				return Expr_Subj(<number>tk.value)
			case TokenType.String:
				ctx.code = tail
				return Expr_Subj(<string>tk.value)
			case TokenType.LParen: {
				ctx.code = tail
				let expr = parse_subj_expr(ctx)
				if (ctx.code[0].kind != TokenType.RParen) throw "Invalid code, expected )"
				ctx.code = ctx.code.slice(1)
				return expr
			}
			case TokenType.Func:
				ctx.code = tail
				return Expr_Func(<string>tk.value)
			default:
				console.log("Found ", tk)
				return null
		}
	}

	function parse_derv(ctx: PCtx): Expr {
		let result = parse_try_func_or_subj(ctx)

		loop: while (true) {
			
			let top = ctx.code[0]
			
			switch (top?.kind) {
				case TokenType.Monad: {
					if (result == null) throw "Invalid code, expected function argument for monad"

					ctx.code.shift()

					result = {arity: 1, role: 1, value: <string>top.value, alpha: result, omega: null}
					break
				}
				case TokenType.Dyad: {
					if (result == null) throw "Invalid code, expected left argument for dyad"
					ctx.code.shift()

					let omega = parse_try_func_or_subj(ctx)

					if (omega == null) throw "Invalid code, expected right argument for dyad"

					result = {arity: 2, role: 1, value: <string>top.value, alpha: result, omega: omega}
					break
				}
				default:
					break loop
			}
		}

		if (!result) throw "Invalid code, expected function"

		if (result.role != 1) throw "Invalid code, expected function"

		return result
	}

	function parse_subj_expr(ctx: PCtx): Expr {
		let alpha: Expr | undefined
		let omega: Expr

		if (ctx.code[0] && ctx.code[0].kind == TokenType.Number) {
			alpha = Expr_Subj(<number>ctx.code[0].value)

			ctx.code = ctx.code.slice(1)

			if (ctx.code.length == 0 || ctx.code[0].kind == TokenType.RParen) {
				return alpha
			}
		} if (ctx.code[0] && ctx.code[0].kind == TokenType.String) {			
			alpha = Expr_Subj(<string>ctx.code[0].value)

			ctx.code = ctx.code.slice(1)

			if (ctx.code.length == 0 || ctx.code[0].kind == TokenType.RParen) {
				return alpha
			}
		} else if (ctx.code[0] && ctx.code[0].kind == TokenType.LParen) {
			ctx.code = ctx.code.slice(1)
			alpha = parse_subj_expr(ctx)

			if (ctx.code[0].kind != TokenType.RParen) {
				throw "Wrong code"
			}

			ctx.code = ctx.code.slice(1)

			if (ctx.code.length == 0) {
				return alpha
			}
		}

		

		let func = parse_derv(ctx)

		omega = parse_subj_expr(ctx)

		if (alpha) {
			return Expr_DFunc(func, alpha, omega)	
		}
		return Expr_MFunc(func, omega)
	}
	
	const eval_table_mono: { [s: string]: MonadicF } = {
		'+': Salite.id,
		'-': Salite.neg,
		'*': Salite.sign,
		'/': Salite.recp,
		'^': Salite.exp,
		'%': Salite.abs,
		':-': Salite.floor,
		':^': Salite.ceil,

		'ρ': Salite.shape,
		',': Salite.ravel,
		'=': Salite.length,
		'≠': Salite.rank,

		'ι': Salite.iota,
	}

	const eval_table_duo: { [s: string]: DyadicF } = {
		'+': Salite.add,
		'-': Salite.sub,
		'*': Salite.mul,
		'/': Salite.div,
		'^': Salite.power,
		'%': Salite.modulo,
		':-': Salite.floor,
		':^': Salite.ceil,
		
		'ρ': Salite.reshape,
		',': Salite.join,
		'=': Salite.cmp_eq,
		'≠': Salite.cmp_ne,

		'≤': Salite.cmp_le,
		'<': Salite.cmp_lt,
		'>': Salite.cmp_gt,
		'≥': Salite.cmp_ge,
	}

	const eval_table_monad: { [s: string]: (f: FuncExpr) => FuncExpr } = {
		'|': (f: FuncExpr) => ({
			f1: (x: Multivec) => x.foldF((a: number, b: number) => {
				if (f.f2 == undefined) throw "Expected dyadic function in operator"
				return f.f2(Multivec.scalar(a), Multivec.scalar(b)).toNumber()
			}),
			f2: (a: Multivec, b: Multivec) => { throw "Not Implemented" }
		}),
		'¨': (f: FuncExpr) => ({
			f1: (x: Multivec) => x.applyMF((x: number) => {
				if (f.f1 == undefined) throw "Expected monadic function in operator"
				return f.f1(Multivec.scalar(x)).toNumber()
			}),
			f2: (a: Multivec, b: Multivec) => {
				if (f.f2 == undefined) throw "Expected dyadic function in operator"
				return Salite.operator_zip(f.f2)(a, b)
			}
		}),
		'.~': (f: FuncExpr) => ({
			f1: (x: Multivec) => {
				if (f.f2 == undefined) throw "Expected dyadic function in operator"
				return f.f2(x, x)
			},
			f2: (a: Multivec, b: Multivec) => {
				if (f.f2 == undefined) throw "Expected dyadic function in operator"
				return f.f2(b, a)
			}
		}),
	}

	function evaluate_func(root: Expr): FuncExpr {
		switch (root.arity) {
			case 0: {
				const f1 = eval_table_mono[`${root.value}`]
				const f2 = eval_table_duo[`${root.value}`]

				console.log(`PUSH-FUNC ${root.value}`)

				return {f1, f2}
			}
			case 1: {
				let func = evaluate_func(<Expr>root.alpha)
				let op = eval_table_monad[<string>root.value]

				console.log(`APPLY-MONAD ${root.value}`)

				return op(func)
			}
			default:
				throw "Not Impelemented"
			
		}
	}

	function evaluate(root: Expr) {

		let expr_stack: (Expr & {c: 0 | 1 | 2})[] = [{...root, c: root.arity}]
		let value_stack: Multivec[] = []

		loop: while (expr_stack.length > 0) {

			const expr = expr_stack.pop()

			if (expr == undefined) break

			// console.log(`Lets evaluate (${pretty_expr(expr)})`)
			// console.log(expr.role, expr.arity)

			if (expr.role == 0) {
				switch (expr.arity) {
					case 0:
						console.log(`PUSH-VAL ${<number>expr.value}`)

						if (typeof expr.value == 'number') {
							value_stack.push(Multivec.scalar(<number>expr.value))
						} else if (typeof expr.value == 'string') {
							value_stack.push(Multivec.string(<string>expr.value))
						}


						break
					case 1:
						expr_stack.push({...<Expr>expr.value, c: 1})
						expr_stack.push({...<Expr>expr.omega, c: 0})
						break
					case 2:
						expr_stack.push({...<Expr>expr.value, c: 2})
						expr_stack.push({...<Expr>expr.omega, c: 0})
						expr_stack.push({...<Expr>expr.alpha, c: 0})
						break
				}
			} else if (expr.role == 1 && expr.arity == 0) {
				let alpha: Multivec
				let omega: Multivec
				switch (expr.c) {
					case 1: {
						omega = <Multivec>value_stack.pop()
						const func = eval_table_mono[<string>expr.value]
						if (!func) throw `Undefined ${expr.value}`

						console.log(`CALL-M ${expr.value}`)
	
						value_stack.push(func(omega))
						break
					}
					case 2:
						omega = <Multivec>value_stack.pop()
						alpha = <Multivec>value_stack.pop()
						const func = eval_table_duo[`${expr.value}`]
						if (!func) throw `Undefined ${expr.value}`

						console.log(`CALL-D ${expr.value}`)

						value_stack.push(func(alpha, omega))
						break
				}
			} else if (expr.role == 1 && expr.arity == 1) {
				let func = evaluate_func(expr)
				if (expr.c == 1) {
					let omega = <Multivec>value_stack.pop()

					console.log(`CALL-M-POP`)

					value_stack.push((<MonadicF>func.f1)(omega))
				} else if (expr.c == 2) {
					let omega = <Multivec>value_stack.pop()
					let alpha = <Multivec>value_stack.pop()

					console.log(`CALL-D-POP`)
					value_stack.push((<DyadicF>func.f2)(alpha, omega))
				}
			}

		}

		const result = value_stack.pop()

		console.log(result?.toString())
	}


	export function test() {
		// let tk = tokenize("*|1+2+¬3")
		// let tk = tokenize("*|(1+2)+¬3")
		// let tk = tokenize("ι6")
		// let tk = tokenize("2 + 3")
		// let tk = tokenize("+| 2 + ι7")
		// let tk = tokenize("(3,4)ρι12")
		// let tk = tokenize("¬1^ι(3,4)")
		// let tk = tokenize("=(2,3)ρ(1,2,3,4,3,4)")
		let tk = tokenize("'<'='<>><'")

		let r = parse_subj_expr({ code: tk })

		console.log(pretty_expr(r))

		evaluate(r)
	}
}

let tests = [
	Multivec.scalar(5),
	Multivec.from([1, -2, 3]),
	Multivec.matrix(
		[ 1,-2, 3],
		[-4, 5,-6],
		[ 7,-8, 9],
	),
]

Parser.test()

// tests = tests.map((i) => Salite.mul(Multivec.scalar(-2), i))

// for (const test of tests) {
// 	console.log(test)
// }
// for (const test of tests) {
// 	console.log(String(test))
// }

// const i = Multivec.iota([10, 10])

// // i×¯1+2×2|i
// const result = Salite.mul(i, Salite.add(Multivec.scalar(-1) ,Salite.mul(Salite.modulo(i, Multivec.scalar(2)), Multivec.scalar(2) )))

// console.log(String(result))