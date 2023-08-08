import * as esbuild from 'esbuild'

await esbuild.build({
  entryPoints: ['./src/salite.js'],
  bundle: true,
  format: 'esm',
  treeShaking: true,
  banner: {
    js: '// deno-fmt-ignore-file\n// deno-lint-ignore-file'
  },
  outfile: './_site/js/salite.web.js',
})

await esbuild.build({
  entryPoints: ['./pretty_print.js'],
  bundle: true,
  format: 'esm',
  treeShaking: true,
  banner: {
    js: '// deno-fmt-ignore-file\n// deno-lint-ignore-file'
  },
  outfile: './_site/js/salite.pretty.js',
})