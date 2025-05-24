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

import { dirname, join, resolve } from "jsr:@std/path";
import { parseArgs } from "node:util";

import browserslist from "npm:browserslist";
import * as esbuild from "npm:esbuild";
import { resolveToEsbuildTarget } from "npm:esbuild-plugin-browserslist";

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

export async function buildTarget(
	binDir: string,
	entryPoints: string[],
	options: {
		target?: string | string[];
		sourceMap?: boolean;
		clear?: boolean;
	} = {},
) {
	const prefixEntryPoint = (entryPoint: string): string => `./${entryPoint}`;

	const { target = defaultTarget, sourceMap = false, clear = false } =
		options;

	if (clear) {
		for await (const dirEntry of Deno.readDir(binDir)) {
			if (dirEntry.isDirectory) {
				continue;
			}
			await Deno.remove(join(binDir, dirEntry.name));
		}
	}

	const result = await esbuild.build({
		plugins: [...denoPlugins()],
		entryPoints: entryPoints.map(prefixEntryPoint),
		entryNames: "[name]-[hash]",
		metafile: true,
		outdir: binDir,
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
		const outFileName = outFilePath.substring(binDir.length);
		const targetFileMatch = outFileName.match(targetFileRegExp);
		if (targetFileMatch == null) {
			errorAndExit(
				"Could not generate target name of the out file name.",
			);
		}
		const targetFileName = `${targetFileMatch[1]}.${targetFileMatch[2]}`;
		importMap[targetFileName] = outFileName;
	}

	await Deno.writeTextFile(
		join(binDir, "importmap.json"),
		JSON.stringify(importMap),
	);
}

export async function buildBrowser(
	options: {
		target?: string | string[];
		sourceMap?: boolean;
		clear?: boolean;
	} = {},
) {
	const { target = "", sourceMap = false, clear = false } = options;
	const binBrowserDir = "platform/web/bin/browser/";
	const shellEntryPoint = "misc/dist/html/src/shell.ts";
	const engineEntryPoint = "platform/web/src/browser/entry/engine.ts";

	await buildTarget(binBrowserDir, [shellEntryPoint, engineEntryPoint], {
		target,
		sourceMap,
		clear,
	});
}

export async function buildServiceWorker(
	options: {
		target?: string | string[];
		sourceMap?: boolean;
		clear?: boolean;
	} = {},
) {
	const { target = "", sourceMap = false, clear = false } = options;
	const binServiceWorkerDir = "platform/web/bin/service-worker/";
	const serviceWorkerEntryPoint = "misc/dist/html/src/service-worker.ts";

	await buildTarget(binServiceWorkerDir, [serviceWorkerEntryPoint], {
		target,
		sourceMap,
		clear,
	});
}

async function main() {
	const args = parseArgs({
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
	const target = args.values.target;
	const sourceMap = args.values["source-map"];
	const clear = args.values.clear;
	await buildBrowser({ target, sourceMap, clear });
	await buildServiceWorker({ target, sourceMap, clear });
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
