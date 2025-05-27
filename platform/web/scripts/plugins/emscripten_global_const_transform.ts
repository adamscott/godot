/**************************************************************************/
/*  emscripten_global_const_transform.ts                                  */
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

import "+deno/lib.ts";

import * as esbuild from "npm:esbuild";

import { dirname } from "jsr:@std/path";

export function emscriptenGlobalConstTransformPlugin(): esbuild.Plugin {
	return {
		name: "emscripten-global-const-transform-plugin",
		setup: (pBuild) => {
			const onTsLoad: Parameters<esbuild.PluginBuild["onLoad"]>[1] =
				async (pArgs) => {
					let fileContents = await Deno.readTextFile(pArgs.path);

					fileContents = fileContents.replaceAll(
						/^\/\/ __emscripten_import_global_const_start\n(.+?)\n^\/\/ __emscripten_import_global_const_end/gms,
						(_pSubstring, pGroupOne: string): string => {
							return new Array(pGroupOne.split("\n").length + 2)
								.map((_) => "\n").join("");
						},
					);

					fileContents = fileContents.replaceAll(
						/^\/\/ __emscripten_declare_global_const_start\n(.+?)\n^\/\/ __emscripten_declare_global_const_end/gms,
						(_pSubstring, pGroupOne: string): string => {
							return "declare global {\n" + pGroupOne + "\n}\n";
						},
					);

					return {
						contents: fileContents,
						loader: "ts",
						resolveDir: dirname(pArgs.path),
					};
				};

			for (const onLoadNamespace of ["file", "http", "https"]) {
				pBuild.onLoad(
					{
						// platform/web/src/browser/**.ts
						filter: /\/platform\/web\/src\/browser\/.+?\.ts$/,
						namespace: onLoadNamespace,
					},
					onTsLoad,
				);
			}
		},
	};
}
