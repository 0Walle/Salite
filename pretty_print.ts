import { NumberArray, BoolArray, StringArray, Iota, FunctionArray } from './src/functions_core.ts';
import { MArray, Value } from "./src/types.ts";

function isNil(y: Value) {
	return (typeof y == 'object' && y.isNil());
}

function isArray(y: Value): y is MArray<Value> {
	return (typeof y == 'object' && y.count > 0);
}

function padBottom(ss: string[], height: number): string[] {
    const width = ss[0].length;
    const r = Array(height);
    for (let i = 0; i < height; i++) {
        if (i < ss.length) r[i] = ss[i].padEnd(width);
        else r[i] = ' '.repeat(width);
    }
    return r;
}

export function padLeft(ss: string[], width: number): string[] {
    const r = Array(ss.length);
    for (let i = 0; i < ss.length; i++) {
        r[i] = ss[i].padStart(width);
    }
    return r;
}

function concatLeft(a: string[], b: string[]): string[] {
    const height = Math.max(a.length, b.length);
    a = padBottom(a, height);
    b = padBottom(b, height);
    const r = Array(height);
    for (let i = 0; i < height; i++) {
        r[i] = a[i] + ' ' + b[i];
    }
    return r;
}

function frame(ss: string[], deco = '─') {
    const len = ss[0].length;
    return [
        `┌${deco}`.padEnd(len+4),
        `│ ${ss[0]}`,
        ...ss.slice(1).map(x => '  ' + x + '  '),
        `${' '.repeat(len+3)}┘`
    ]
}

function smallFrame(ss: string[]) {
    const len = ss[0].length;
    return [
        `┌`.padEnd(len+4),
        ...ss.map(x => '  ' + x + '  '),
        `${' '.repeat(len+3)}┘`
    ]
}

function _prettyString(v: StringArray): string[] {
    if (v.shape.length == 1) return [`"${v.toString()}"`];

    const lines = v.toStrings();

    return lines.map((line, i) => 
        (i > 0 ? ' ' : '"') + 
        line.replaceAll('\n', '¶') +
        ( i == lines.length - 1 ? '"' : ' ')
    )
}

function _prettyNumbers(v: MArray<number>): string[] {
    const r = v.shape.length;

	if (r == 1) {
		const ss = Array(v.count);
		for (let i = 0; i < v.count; i++) {
            ss[i] = simpleValue(v.pick(i));
		}
		return [ `[ ${ss.join(' ')} ]` ]
	}

	if (r == 2) {
        const rows = v.shape[0];
        const stride = v.shape[1];
        const maxCols = Array(stride).fill(0);
        const lines = [];

		for (let i = 0; i < rows; i++) {
			const row = [];
			for (let j = 0; j < stride; j++) {
				const n = v.pick(i*stride+j);
				const s = simpleValue(n);
				row.push(s)
				if (s.length > maxCols[j]) maxCols[j] = s.length;
			}
			lines.push(row);
		}

		const padded = [];
		for (let i = 0; i < rows; i++) {
			for (let j = 0; j < stride; j++) {
				lines[i][j] = lines[i][j].padStart(maxCols[j]);
			}
			padded.push(lines[i].join(' '));
		}

        return frame(padded)
    }

	return ['ERR']
}

function _prettyRank2(eachString: string[][], rows: number, cols: number, spacing = 0): string[] {
    const maxCols = Array(cols).fill(0);
    for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
            const s = eachString[i*cols+j];
            if (s[0].length > maxCols[j]) maxCols[j] = s[0].length;
        }
    }
    
    let lines: string[] = [];
    for (let i = 0; i < rows; i++) {
        let row = padLeft(eachString[i*cols], maxCols[0]+spacing);
        for (let j = 1; j < cols; j++) {
            row = concatLeft(row, padLeft(eachString[i*cols+j], maxCols[j]+spacing));
        }
        lines = lines.concat(row);
        if (i < rows-1) for (let _ = 0; _ < spacing; _++) lines.push("");
    }
    return lines;
}

export function prettyArray(v: MArray<Value>): string[] {
    if (v == undefined) return ['ERR']

    if (v.isNil()) return ['ø']

    if (v instanceof FunctionArray) {
        return [`ƒ${v.name}`];
    }

    const r = v.shape.length;

    if (r == 0) {
        return smallFrame(prettyValue(v.pick(0)));
    }

    if (v instanceof StringArray) {
        return _prettyString(v).map(s => s.replaceAll('\n', '¶'));
    }

	if ((v instanceof NumberArray || v instanceof Iota || v instanceof BoolArray) && r <= 2) {
        return _prettyNumbers(v);
    }

	const eachString = new Array<string[]>(v.count);
	let maxHeight = 0;
	let maxWidth = 0;
    let isString = true;
	for (let i = 0; i < v.count; i++) {
        const vs = v.pick(i);
        if (typeof vs != 'string') isString = false;
		eachString[i] = prettyValue(vs);
		if (eachString[i].length > maxHeight)
			maxHeight = eachString[i].length;
		if (eachString[i][0].length > maxWidth)
            maxWidth = eachString[i][0].length;
	}

    if (isString) {
        return _prettyString(new StringArray(v.shape, eachString.map(ss => ss[0][1]))).map(s => s.replaceAll('\n', '¶'))
    }

    if (r == 1) {
		if (maxHeight == 1) return [
            `[ ${eachString.map(ss => ss.join(' ')).join(' ')} ]`
        ]

        let row = eachString[0]
        for (let i = 1; i < v.count; i++) {
            row = concatLeft(row, eachString[i]);
        }
        
        return frame(row);
    }

    if (r == 2 && maxHeight == 1) {
        const rows = v.shape[0];
        const stride = v.shape[1];
        const maxCols = Array(stride).fill(0);
        const lines = [];
		for (let i = 0; i < rows; i++) {
			const row = [];
			for (let j = 0; j < stride; j++) {
				// const n = v.pick(i*stride+j);
				// const s = _prettyScalar(n)[0];
                const s = eachString[i*stride+j][0]
				row.push(s)
				if (s.length > maxCols[j]) maxCols[j] = s.length;
			}
			lines.push(row);
		}

		const padded = [];
		for (let i = 0; i < rows; i++) {
			for (let j = 0; j < stride; j++) {
                lines[i][j] = lines[i][j].padStart(maxCols[j]);
			}
			padded.push(lines[i].join(' '));
		}

        return frame(padded)
    }

    let finalRows: string[] | undefined = undefined;
    
    if (r == 2) {
        finalRows = _prettyRank2(eachString, v.shape[0], v.shape[1]);
    }

    if (r == 3) {
        const rows = v.shape[1];
        const cols = v.shape[2];
        const stride = rows * cols;
        let len = 0;
        finalRows = []
        for (let i = 0; i < v.shape[0]; i++) {
            const chunk = _prettyRank2(eachString.slice(i * stride, i * stride + stride), rows, cols)
            if (chunk[0].length > len) len = chunk[0].length;
            finalRows = finalRows.concat(chunk);
            finalRows.push('');
        }
        finalRows.pop();
        finalRows[0] = finalRows[0].padEnd(len);
    }

    if (r == 4) {
        const rows = v.shape[2];
        const cols = v.shape[3];
        const stride = rows * cols;
        const rows2 = v.shape[0];
        const cols2 = v.shape[1];
        const count = rows2 * cols2;
        const inner: string[][] = [];
        for (let i = 0; i < count; i++) {
            inner.push(_prettyRank2(eachString.slice(i * stride, i * stride + stride), rows, cols));
        }
        finalRows = _prettyRank2(inner, rows2, cols2, 1);
    }

    if (finalRows) {
        const len = finalRows[0].length;
        return [
            `┌~${v.shape.join(' ')}`.padEnd(len+4),
            `╵ ${finalRows[0]}  `,
            ...finalRows.slice(1).map(ss => '  ' + ss + '  '),
            `${' '.repeat(len+3)}┘`
        ]
    }

    return [
        `┌~${v.shape.join(' ')}`.padEnd(maxWidth+4),
        `╵ ${eachString[0][0]}  `,
        ...eachString[0].slice(1).map(s => '  ' + s + '  '),
        ...eachString.slice(1).flatMap(s => s.map(s => '  ' + s + '  ').join('\n')),
        `${' '.repeat(maxWidth+3)}┘`
    ]
}

export function prettyValue(v: Value): string[] {
	switch (typeof v) {
		case 'number':
			if (isNaN(v)) return [`nan`]
			if (!isFinite(v)) return v < 0 ? [`¬∞`] : [`∞`]
			if (v < 0) return [`¬${String(-v)}`]
			return [String(v)]
        case 'boolean':
			if (v) return [`1`]
            return [`0`]
		case 'string':
			return [`'${v}'`]
		case 'object': {
            return prettyArray(v);
		}
	}
    return [`ERR`]
}

export function simpleValue(s: Value): string {
    switch (typeof s) {
        case 'number': 
            if (isNaN(s)) return `nan`
            if (!isFinite(s)) return s < 0 ? `¬∞` : `∞`
            if (s < 0) return `¬${String(-s)}`
            return String(s)
        case 'boolean': 
            return s ? `1` : `0`;
        case 'string':
            return `${s}`
        case 'object':
            return simpleArray(s)
    }
}

function simpleArray(v: MArray<Value>): string {
    if (v == undefined) return 'ERR'

    if (v.isNil()) return 'ø'

    if (v instanceof FunctionArray) return `ƒ${v.name}`;

	const eachString = new Array<string>(v.count);
	for (let i = 0; i < v.count; i++) {
		eachString[i] = simpleValue(v.pick(i));
	}

    return eachString.join('');
}

export function printLines(v: Value, separator = '\n'): string {
    if (v == undefined) return 'ERR';

    if (!isArray(v)) return simpleValue(v);
    if (v.isNil()) return '';
    if (v instanceof FunctionArray) return `ƒ${v.name}`;

    const eachString = [];
    for (let i = 0; i < v.count; i++) {
        const c = v.pick(i);
        eachString.push(isNil(c) ? '' : simpleValue(c));
    }
    
	return eachString.join(separator);
}