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
import { dirname, join, resolve } from "jsr:@std/path";
import { parseArgs } from "node:util";

import browserslist from "npm:browserslist";
import * as esbuild from "npm:esbuild";
import { resolveToEsbuildTarget } from "npm:esbuild-plugin-browserslist";
import { sassPlugin } from "npm:esbuild-sass-plugin";

import { denoPlugins } from "jsr:@luca/esbuild-deno-loader";

import { errorAndExit } from "+deno/os.ts";

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
	},
): Promise<Record<string, string>> {
	const prefixEntryPoint = (entryPoint: string): string => `./${entryPoint}`;

	const { target, sourceMap } = settings;

	const result = await esbuild.build({
		plugins: [...denoPlugins()],
		entryPoints: entryPoints.map(prefixEntryPoint),
		entryNames: "[name]-[hash]",
		metafile: true,
		outdir: distDir,
		bundle: true,
		splitting: true,
		sourcemap: sourceMap,
		target,
		format: "esm",
	});

	const targetFileRegExp = /^\/?([^/]+?)-[A-Z\d]{8}\.(.+?)$/m;
	const importMap: Record<string, string> = {};
	const outputFilePaths = Object.keys(result.metafile.outputs);
	for (const outFilePath of outputFilePaths) {
		const outFileName = outFilePath.substring(distDir.length);
		const targetFileMatch = outFileName.match(targetFileRegExp);
		if (targetFileMatch == null) {
			errorAndExit(
				"Could not generate target name of the out file name.",
			);
		}
		const targetFileName = `${targetFileMatch[1]}.${targetFileMatch[2]}`;
		importMap[targetFileName] = outFileName;
	}

	return importMap;
}

export async function buildCssTarget(
	distDir: string,
	entryPoints: string[],
	settings: {
		target: string | string[];
		sourceMap: boolean;
	},
): Promise<Record<string, string>> {
	const prefixEntryPoint = (entryPoint: string): string => `./${entryPoint}`;

	const { target = defaultTarget, sourceMap = false } = settings;

	const result = await esbuild.build({
		plugins: [sassPlugin()],
		entryPoints: entryPoints.map(prefixEntryPoint),
		entryNames: "[name]-[hash]",
		metafile: true,
		outdir: distDir,
		bundle: true,
		sourcemap: sourceMap,
		target,
	});

	const targetFileRegExp = /^\/?([^/]+?)-[A-Z\d]{8}\.(.+?)$/m;
	const importMap: Record<string, string> = {};
	const outputFilePaths = Object.keys(result.metafile.outputs);
	for (const outFilePath of outputFilePaths) {
		const outFileName = outFilePath.substring(distDir.length);
		const targetFileMatch = outFileName.match(targetFileRegExp);
		if (targetFileMatch == null) {
			errorAndExit(
				"Could not generate target name of the out file name.",
			);
		}
		const targetFileName = `${targetFileMatch[1]}.${targetFileMatch[2]}`;
		importMap[targetFileName] = outFileName;
	}

	return importMap;
}

export async function buildShell(
	directory: string,
	options: {
		target?: string | string[];
		sourceMap?: boolean;
	} = {},
): Promise<Record<string, string>> {
	const { target = [], sourceMap = false } = options;
	const shellEntryPoint = "misc/dist/html/src/entry/shell.ts";
	const engineEntryPoint = "platform/web/src/browser/entry/engine.ts";

	const importMap = {};

	Object.assign(
		importMap,
		await buildJavaScriptTarget(directory, [
			shellEntryPoint,
			engineEntryPoint,
		], {
			target,
			sourceMap,
		}),
	);

	Object.assign(
		importMap,
		await buildCssTarget(directory, [
			"misc/dist/html/assets/scss/main/shell.scss",
		], { target, sourceMap }),
	);

	return importMap;
}

export async function buildEditor(
	directory: string,
	options: {
		target?: string | string[];
		sourceMap?: boolean;
	} = {},
): Promise<Record<string, string>> {
	const { target = defaultTarget, sourceMap = false } = options;
	const editorEntryPoint = "misc/dist/html/src/entry/editor.ts";
	const engineEntryPoint = "platform/web/src/browser/entry/engine.ts";

	const importMap = {};

	Object.assign(
		importMap,
		await buildJavaScriptTarget(directory, [
			editorEntryPoint,
			engineEntryPoint,
		], {
			target,
			sourceMap,
		}),
	);

	Object.assign(
		importMap,
		await buildCssTarget(directory, [
			"misc/dist/html/assets/scss/main/editor.scss",
		], { target, sourceMap }),
	);

	return importMap;
}

export async function buildServiceWorker(
	directory: string,
	options: {
		target?: string | string[];
		sourceMap?: boolean;
	} = {},
): Promise<Record<string, string>> {
	const { target = defaultTarget, sourceMap = false } = options;
	const serviceWorkerEntryPoint =
		"misc/dist/html/src/entry/service-worker.ts";

	return await buildJavaScriptTarget(
		directory,
		[serviceWorkerEntryPoint],
		{
			target,
			sourceMap,
		},
	);
}

export async function buildEmscriptenLibraries(
	directory: string,
	options: { target?: string | string[]; sourceMap?: boolean } = {},
): Promise<void> {
	const { target = defaultTarget, sourceMap = false } = options;
	const emscriptenLibrariesEntryPoint =
		"platform/web/src/browser/entry/emscripten.ts";

	await buildJavaScriptTarget(
		directory,
		[emscriptenLibrariesEntryPoint],
		{
			target,
			sourceMap,
		},
	);
}

async function main() {
	const args = parseArgs({
		allowPositionals: true,
		options: {
			target: {
				type: "string",
				default: "",
			},
			"source-map": {
				type: "boolean",
				default: false,
			},
			clear: {
				type: "boolean",
				default: false,
			},
		},
	});

	if (args.positionals.length !== 1) {
		errorAndExit("Invalid number of positional arguments.");
	}

	const target = args.values.target;
	const sourceMap = args.values["source-map"];
	const clear = args.values.clear;

	let directory = "platform/web/dist/";
	const buildTarget = args.positionals[0].toLowerCase();
	switch (buildTarget) {
		case "shell":
			directory += "shell/";
			break;
		case "editor":
			directory += "editor/";
			break;
		case "emscripten":
			directory += "emscripten/";
			break;
		default:
			errorAndExit("Invalid build target.");
	}

	if (clear) {
		await clearDirectory(directory);
	}

	if (buildTarget === "emscripten") {
		await buildEmscriptenLibraries(directory, { target, sourceMap });
		Deno.exit(0);
	}

	const importMap = {};
	switch (buildTarget) {
		case "shell":
			Object.assign(
				importMap,
				await buildShell(directory, { target, sourceMap }),
			);
			break;
		case "editor":
			Object.assign(
				importMap,
				await buildEditor(directory, { target, sourceMap }),
			);
			break;
		default:
			errorAndExit("Invalid build target.");
	}
	Object.assign(
		importMap,
		await buildServiceWorker(directory, { target, sourceMap }),
	);
	await Deno.writeTextFile(
		join(directory, "importmap.json"),
		JSON.stringify(importMap),
	);
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
		Deno.exit(0);
	} catch (err) {
		errorAndExit(err);
	} finally {
		esbuild.stop();
	}
}
