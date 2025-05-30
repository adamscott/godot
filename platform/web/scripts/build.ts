/**************************************************************************/
/*  build.ts                                                              */
/**************************************************************************/
/*                         This file is part of:                          */
/*                             GODOT ENGINE                               */
/*                        https://godotengine.org                         */
/**************************************************************************/
/* Copyright (c) 2014-present Godot Engine contributors (see AUTHORS.md). */
/* Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.                  */
/*                                                                        */
/* Permission is hereby granted, free of charge, to any person obtaining  */
/* a copy of this software and associated documentation files (the        */
/* "Software"), to deal in the Software without restriction, including    */
/* without limitation the rights to use, copy, modify, merge, publish,    */
/* distribute, sublicense, and/or sell copies of the Software, and to     */
/* permit persons to whom the Software is furnished to do so, subject to  */
/* the following conditions:                                              */
/*                                                                        */
/* The above copyright notice and this permission notice shall be         */
/* included in all copies or substantial portions of the Software.        */
/*                                                                        */
/* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,        */
/* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF     */
/* MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. */
/* IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY   */
/* CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,   */
/* TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE      */
/* SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.                 */
/**************************************************************************/

import { exists } from "jsr:@std/fs";
import { dirname, isAbsolute, join, relative, resolve } from "jsr:@std/path";

import browserslist from "npm:browserslist";
import * as esbuild from "npm:esbuild";
import { resolveToEsbuildTarget } from "npm:esbuild-plugin-browserslist";
import { sassPlugin } from "npm:esbuild-sass-plugin";
// @ts-types="npm:@types/yargs"
import yargs from "npm:yargs";

import {
	denoLoaderPlugin,
	denoResolverPlugin,
} from "jsr:@luca/esbuild-deno-loader";

import { errorAndExit } from "+deno/os";
import { emscriptenGlobalConstTransformPlugin } from "./plugins/emscripten_global_const_transform.ts";

const defaultTarget = resolveToEsbuildTarget(
	browserslist([
		"last 2 chrome major versions and last 1 year",
		"last 2 and_chr major versions and last 1 year",
		"last 2 safari major versions and last 1 year",
		"last 2 ios_saf major versions and last 1 year",
		"last 2 firefox major versions and last 1 year, firefox esr",
		"last 2 and_ff major versions and last 1 year",
		"last 2 edge major versions and last 1 year",
		"last 2 samsung major versions and last 1 year",
	]),
	{
		printUnknownTargets: false,
	},
);

export async function clearDirectory(directory: string): Promise<void> {
	if (!(await exists(directory))) {
		return;
	}

	for await (const dirEntry of Deno.readDir(directory)) {
		await Deno.remove(join(directory, dirEntry.name), { recursive: true });
	}
}

export async function buildJavaScriptTarget(
	distDir: string,
	entryPoints: string[],
	settings: {
		target: string | string[];
		sourceMap: boolean;
		minify: boolean;
		isEmscripten?: boolean;
		emscriptenFilter?: RegExp;
		entryNames?: string;
	},
): Promise<void> {
	const prefixEntryPoint = (entryPoint: string): string => `./${entryPoint}`;

	const {
		target,
		sourceMap,
		minify,
		isEmscripten = false,
		emscriptenFilter,
		entryNames,
	} = settings;

	await esbuild.build({
		plugins: [
			denoResolverPlugin(),
			...isEmscripten
				? [emscriptenGlobalConstTransformPlugin(
					emscriptenFilter,
				)]
				: [],
			denoLoaderPlugin(),
		],
		entryPoints: entryPoints.map(prefixEntryPoint),
		entryNames,
		minify,
		metafile: true,
		outdir: distDir,
		bundle: true,
		splitting: true,
		sourcemap: sourceMap,
		target,
		format: "esm",
	});
}

export async function buildCssTarget(
	distDir: string,
	entryPoints: string[],
	settings: {
		target: string | string[];
		sourceMap: boolean;
	},
): Promise<void> {
	const prefixEntryPoint = (entryPoint: string): string => `./${entryPoint}`;

	const { target = defaultTarget, sourceMap = false } = settings;

	await esbuild.build({
		plugins: [sassPlugin()],
		entryPoints: entryPoints.map(prefixEntryPoint),
		metafile: true,
		outdir: distDir,
		bundle: true,
		sourcemap: sourceMap,
		target,
	});
}

export async function buildShell(
	directory: string,
	options: {
		target?: string | string[];
		sourceMap?: boolean;
		minify?: boolean;
	} = {},
): Promise<void> {
	const { target = [], sourceMap = false, minify = false } = options;
	const shellEntryPoint = "misc/dist/html/src/entry/shell.ts";
	const engineEntryPoint = "platform/web/src/browser/entry/engine.ts";

	await buildJavaScriptTarget(directory, [
		shellEntryPoint,
		engineEntryPoint,
	], {
		target,
		sourceMap,
		minify,
	});
	await buildCssTarget(directory, [
		"misc/dist/html/assets/scss/main/shell.scss",
	], { target, sourceMap });
}

export async function buildEditor(
	directory: string,
	options: {
		target?: string | string[];
		sourceMap?: boolean;
		minify?: boolean;
	} = {},
): Promise<void> {
	const { target = defaultTarget, sourceMap = false, minify = false } =
		options;
	const editorEntryPoint = "misc/dist/html/src/entry/editor.ts";
	const engineEntryPoint = "platform/web/src/browser/entry/engine.ts";

	await buildJavaScriptTarget(directory, [
		editorEntryPoint,
		engineEntryPoint,
	], {
		target,
		sourceMap,
		minify,
	});

	await buildCssTarget(directory, [
		"misc/dist/html/assets/scss/main/editor.scss",
	], { target, sourceMap });
}

export async function buildServiceWorker(
	pDirectory: string,
	pOptions: {
		target?: string | string[];
		sourceMap?: boolean;
		minify?: boolean;
	} = {},
): Promise<void> {
	const { target = defaultTarget, sourceMap = false, minify = false } =
		pOptions;
	const serviceWorkerEntryPoint =
		"misc/dist/html/src/entry/service-worker.ts";

	await buildJavaScriptTarget(
		pDirectory,
		[serviceWorkerEntryPoint],
		{
			target,
			sourceMap,
			minify,
		},
	);
}

export async function buildEmscriptenLibraries(
	pTargetDirectory: string,
	pImportMapName: string,
	pEntryPoints: string[],
	pOptions: {
		target?: string | string[];
		sourceMap?: boolean;
		minify?: boolean;
	} = {},
): Promise<void> {
	const { target = defaultTarget, sourceMap = false, minify = false } =
		pOptions;

	const filter = new RegExp(
		[
			...pEntryPoints,
			// `dummy.ts` will be stripped out.
			"/platform/web/src/browser/dummy.ts",
		].map(
			(pEntryPoint) => {
				return dirname(pEntryPoint)
					.replaceAll("/", "\/")
					.replaceAll("\\", "\\\\")
					.replaceAll(".", "\.");
			},
		).reduce((pPreviousValue, pCurrentValue, pCurrentIndex, pArray) => {
			if (pCurrentIndex === 0) {
				return pPreviousValue + pCurrentValue;
			} else if (pCurrentIndex === pArray.length - 1) {
				return `${pPreviousValue}|${pCurrentValue})\/.+?\.ts$`;
			}
			return `${pPreviousValue}|${pCurrentValue}`;
		}, "(?:"),
	);

	await buildJavaScriptTarget(
		pTargetDirectory,
		pEntryPoints,
		{
			target,
			sourceMap,
			minify,
			isEmscripten: true,
			emscriptenFilter: filter,
			entryNames: pImportMapName,
		},
	);
}

async function main() {
	const y = yargs(Deno.args)
		.scriptName("deno run esbuild");

	const addBuildCommand = (pTarget: "shell" | "editor"): void => {
		y.command(
			pTarget,
			`build the ${pTarget}`,
			(pYargs) => {
				return pYargs
					.option("target", {
						description:
							"overrides the current default target property used by esbuild.",
						array: true,
						string: true,
						default: [],
					})
					.option("source-map", {
						boolean: true,
						default: false,
					})
					.option("minify", {
						boolean: true,
						default: false,
					})
					.option("clear", {
						boolean: true,
						default: false,
					});
			},
			async (pArgv) => {
				const directory = `platform/web/dist/${pTarget}/`;
				if (pArgv.clear) {
					await clearDirectory(directory);
				}
				await buildShell(directory, {
					target: pArgv.target,
					sourceMap: pArgv.sourceMap,
					minify: pArgv.minify,
				});
				await buildServiceWorker(directory, {
					target: pArgv.target,
					sourceMap: pArgv.sourceMap,
					minify: pArgv.minify,
				});
			},
		);
	};

	addBuildCommand("editor");
	addBuildCommand("shell");

	y
		.command(
			"emscripten <import-map-name> <files...>",
			"build an emscripten library",
			(pYargs) => {
				return pYargs
					.option("target", {
						description:
							"overrides the current default target property used by esbuild.",
						array: true,
						string: true,
						default: [],
					})
					.option("source-map", {
						boolean: true,
						default: false,
					})
					.option("minify", {
						boolean: true,
						default: false,
					})
					.option("clear", {
						boolean: true,
						default: false,
					})
					.positional("import-map-name", {
						description:
							"name of the import map (i.e. `importmap.<import-map-name>.json`)",
						type: "string",
					})
					.positional("files", {
						description: "an emscripten library",
						array: true,
						type: "string",
					});
			},
			async (pArgv) => {
				if (pArgv.importMapName == null) {
					console.error(
						"[ERROR]: <import-map-name> argument missing",
					);
					y.showHelp();
					return;
				}

				if (pArgv.files == null) {
					console.error("[ERROR]: <files...> argument missing");
					y.showHelp();
					return;
				}

				await buildEmscriptenLibraries(
					"platform/web/dist/emscripten/",
					pArgv.importMapName,
					pArgv.files.map((pFile) => relative(Deno.cwd(), pFile)),
					{
						target: pArgv.target,
						sourceMap: pArgv.sourceMap,
						minify: pArgv.minify,
					},
				);
			},
		)
		.demandCommand(1, "you need to specify a command.")
		.help("help")
		.alias("help", "h");

	await y.parse();
}

if (import.meta.main) {
	try {
		if (
			import.meta.filename == null ||
			Number(Deno.version.deno.split(".")[0]) < 2
		) {
			errorAndExit("Incompatible Deno version. Please use Deno >= 2.");
		}
		// platform/web/scripts/build.ts
		const rootDir = resolve(
			dirname(import.meta.filename),
			"..",
			"..",
			"..",
		);
		Deno.chdir(rootDir);
		await main();
		esbuild.stop();
	} catch (err) {
		esbuild.stop();
		errorAndExit(err);
	}
}
