/**************************************************************************/
/*  index.ts                                                              */
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

import { basename, dirname, resolve } from "node:path";
import { chdir, cwd } from "node:process";
import { rm, writeFile } from "node:fs/promises";
import browserslist from "browserslist";
import esbuild from "esbuild";
import { esbuildPluginBrowserslist } from "esbuild-plugin-browserslist";
import { isFile } from "@godotengine/utils-node/fs";
import { program } from "@commander-js/extra-typings";

async function createPreBundleFile(pPreBundlePath: string, pImports: string[]): Promise<void> {
	const bundleContent = `${pImports
		.map((pImport) => {
			return `import "${pImport}";`.replaceAll("#", ".");
		})
		.join("\n")}\n`;
	await writeFile(pPreBundlePath, bundleContent, {
		encoding: "utf-8",
		flag: "w",
	});
}

program
	.name("emscripten-builder")
	.description("CLI to compile a emscripten library")
	.option("-n, --name <name>", "Name to give to the generated bundle file.")
	.option(
		"-o, --outdir <path>",
		"Path of the output directory (usually the one with compiled JS files in it).",
		"./dist/",
	)
	.option("-d, --cwd <path>", "Working directory.")
	.option(
		"-e, --external <module>",
		"External JS module. (repeatable)",
		(pValue, pPrevious) => {
			return pPrevious.concat([pValue]);
		},
		[] as string[],
	)
	.argument("<imports...>")
	.action(async (imports, options) => {
		const cwdArg = options.cwd;
		if (cwdArg != null) {
			chdir(cwdArg);
		}

		const packageJsonPath = resolve(cwd(), "package.json");
		if (!(await isFile(packageJsonPath))) {
			// eslint-disable-next-line no-console -- We're in a node env.
			console.error(`Did not find package.json in the cwd ("${cwd()}"), cannot run.`);
		}

		const packageDirName = basename(dirname(packageJsonPath));
		const name = options.name ?? packageDirName;
		const bundlePath = resolve(options.outdir, `${name}.js`);
		const preBundlePath = resolve(options.outdir, `${name}__pre-bundle.js`);

		await createPreBundleFile(preBundlePath, imports);

		await esbuild.build({
			entryPoints: [preBundlePath],
			bundle: true,
			format: "esm",
			outfile: bundlePath,
			external: options.external,
			treeShaking: true,
			// minify: true,
			sourcemap: true,
			plugins: [
				esbuildPluginBrowserslist(
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
				),
			],
		});

		await rm(preBundlePath);
	});

program.parse();
