const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const { mkdir, rename, rm, writeFile } = require('node:fs/promises');
const path = require('node:path');
const gulp = require('gulp');
const babel = require('gulp-babel');
const postcss = require('gulp-postcss');
const tailwind = require('@tailwindcss/postcss');

const execFileAsync = promisify(execFile);
const scripts = [
  'src/**/*.{ts,tsx}',
  '!src/**/*.d.ts',
  '!src/**/demo/**',
  '!src/**/__tests__/**',
  '!src/**/*.{test,spec}.{ts,tsx}',
];
const readyArtifact = path.join(__dirname, 'esm/.dev-ready');

function compileScripts(envName, destination) {
  return gulp
    .src(scripts)
    .pipe(babel({ envName }))
    .pipe(gulp.dest(destination));
}

function compileCJS() {
  return compileScripts('cjs', 'lib');
}

function compileESM() {
  return compileScripts('esm', 'esm');
}

function compileStyles() {
  return gulp
    .src('src/styles.css')
    .pipe(postcss([tailwind({ base: __dirname, optimize: true })]))
    .pipe(gulp.dest('lib'))
    .pipe(gulp.dest('esm'));
}

async function compileTypes() {
  const tsc = require.resolve('typescript/bin/tsc');
  for (const destination of ['lib', 'esm']) {
    try {
      await execFileAsync(process.execPath, [
        tsc,
        '-p',
        'tsconfig.build.json',
        '--declarationDir',
        destination,
      ], { cwd: __dirname });
    } catch (error) {
      if (error.stdout) process.stderr.write(error.stdout);
      if (error.stderr) process.stderr.write(error.stderr);
      throw error;
    }
  }
}

const buildScripts = gulp.parallel(compileCJS, compileESM);

async function invalidateReady() {
  await rm(readyArtifact, { force: true });
}

async function markReady() {
  await mkdir(path.dirname(readyArtifact), { recursive: true });
  const temporaryArtifact = `${readyArtifact}.tmp`;
  await writeFile(temporaryArtifact, process.env.MF_ZENS_DEV_SESSION || 'standalone');
  await rename(temporaryArtifact, readyArtifact);
}

function watch() {
  // One queue prevents readiness from observing mixed generations of JS, CSS, and types.
  // Register before the initial run so edits during that run schedule another pass.
  return gulp.watch(
    ['src/**/*.{ts,tsx,css}', 'typings.d.ts', '.babelrc.js', 'tsconfig*.json'],
    { ignoreInitial: false },
    gulp.series(
      invalidateReady,
      gulp.parallel(buildScripts, compileStyles, compileTypes),
      markReady,
    ),
  );
}

exports.styles = compileStyles;
exports.dev = watch;
exports.build = gulp.parallel(buildScripts, compileStyles);
exports.default = exports.build;
