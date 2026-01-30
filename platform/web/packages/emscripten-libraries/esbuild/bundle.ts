/**************************************************************************/
/*  bundle.ts                                                             */
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

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import esbuild from "esbuild";
import browserslist from "browserslist";
import { esbuildPluginBrowserslist } from "esbuild-plugin-browserslist";
import { esbuildPluginUseMacro } from "use-macro";

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const ESBUILD_DIR_PATH = dirname(SCRIPT_PATH);
const PACKAGE_DIR_PATH = resolve(ESBUILD_DIR_PATH, "..");
const BUNDLE_JS_PATH = resolve(PACKAGE_DIR_PATH, "dist/bundle.js");
const LIBRARIES_JS_PATH = resolve(PACKAGE_DIR_PATH, "dist/godot-emscripten-libraries.js");

async function main(): Promise<void> {
	await esbuild.build({
		entryPoints: [BUNDLE_JS_PATH],
		bundle: true,
		format: "esm",
		outfile: LIBRARIES_JS_PATH,
		plugins: [
			esbuildPluginUseMacro(),
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
}

try {
	await main();
} catch (eError) {
	// eslint-disable-next-line no-console -- Not for the public, prints out the error.
	console.error("Error while bundling emscripten libraries:", eError);
}
