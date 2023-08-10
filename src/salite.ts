import * as VM from "./vm.ts";
import * as Compiler from "./compiler.ts";
import * as Types from "./types.ts";

export function execute(contents: string, globals: { [s: string]: Types.Value }): Types.Value {
    const compiledUnit = Compiler.compile(contents, [], Object.keys(globals));

    const [result, _] = VM.run(...compiledUnit, Object.values(globals));

    return result;
}

export function tokenize(contents: string) {
    return Compiler.tokens(contents);
}

export const symbolNames = {
    functions: {
        '+': ['Sum', 'Add'],
        '-': ['Negation', 'Subtract'],
        '×': ['Product', 'Multiply', 'xx'],
        '÷': ['Reciprocal', 'Divide', '//'],
        '^': ['Exponential', 'Power'],
        '%': ['Absolute', 'Modulus'],
        '√': ['Square Root', 'Root', '-/'],
        '⌊': ['Floor', 'Minimun', ':-'],
        '⌈': ['Ceil', 'Maximum', ':+'],
        '±': ['Sign', 'Absolute Difference', '+-'],

        '∧': ['Sort Up' , 'And', '/\\'],
        '∨': ['Sort Down' , 'Or', '\\/'],
        '~': ['Not', 'Without'],

        '≤': ['Grade Down', 'Less Equals', '<_'],
        '<': ['Enclose', 'Less Than'],
        '≥': ['Grade Up', 'Greater Equals', '>_'],
        '>': ['Merge', 'Greater Than'],
        '=': ['Length', 'Equals'],
        '≠': ['Rank', 'Not Equals', '=/'],
        '≡': ['Depth', 'Match', '=='],

        '¢': ['First', 'Pick', 'cc'],
        '@': ['First Cell', 'Select'],
        '↑': ['Prefixes', 'Take', '|>'],
        '↓': ['Suffixes', 'Drop', '|<'],
        'φ': ['Reverse', 'Rotate', 'qq'],
        'Ø': ['Transpose', null, 'O/'],

        
        'ρ': ['Shape', 'Reshape', 'pp'],
        '↕': ['Deshape', 'Windows', '||'],
        ';': ['Join', 'Join To'],
        ':;': ['Enlist', 'Pair'],
        '&': ['Solo', 'Couple'],
        
        'ι': ['Range', 'Index Of', 'ii'],
        ':ι': ['Range', 'Progressive Index Of', ':ii'],
        'ε': ['Occurrence Count', 'Member Of', 'ee'],
        ':ε': ['Mark Firsts', 'Find', ':ee'],
        '∩': ['Unique', 'Intersection', 'UU'],
        '¥': ['Step', 'Locate', 'yy'],
        '|': ['Cut', 'Split', 'yy'],
        
        '$': ['Indices', 'Replicate'],
        'δ': ['Strides', 'Represent', 'dd'],
        'μ': ['Group Indices', 'Group', 'uu'],

        '◄': ['Id', 'Left', '</'],
        '►': ['Id', 'Right', '/>'],

        'η': ['Parse', 'Parse Base', 'hh'],
        
        '!': ['Assert', 'Assert'],
        '?': ['Type', 'Or Else'],  
    },
    monads: {
        '§': ['Self/Swap', 'ss'],
        '/': ['Fold'],
        '\\':[ 'Scan'],
        '¨': ['Each', '::'],
        '˝': ['Table', '´´'],
        '`': ['Cells'],
        '¯': ['Const', '__'],
        '˜': ['Undo', '~~'],
    },
    dyads: {
        '•': ['Atop', '..'],
        '°': ['Over', 'oo'],
        '¤': ['Under', 'ox'],
        '→': ['Bind Right', '->'],
        '←': ['Bind Left', '<-'],
        '↔': ['Valences', '@@'],
        'ⁿ': ['Repeat', 'nn'],
        '®': ['Rank', '@r'],
        'Δ': ['While', 'DD'],
    }
}

export const Cast = VM.castings;

export const Nil = VM.castings.nil();