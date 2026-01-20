/**************************************************************************/
/*  vite.shell.config.ts                                                  */
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

import { execFileSync } from "node:child_process";
import * as fs from "node:fs/promises";
import { dirname, resolve as pathResolve } from "node:path";
import * as process from "node:process";
import { fileURLToPath } from "node:url";
import * as biome from "@biomejs/biome";
import { errorAndExit } from "@typescript/platform/node/os";
import * as cheerio from "cheerio";
import { defineConfig, type HtmlTagDescriptor, type IndexHtmlTransformResult, loadEnv, type Plugin } from "vite";

const __dirname = dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);

const __root = pathResolve(__dirname, "./src/html/main/shell/");
const __indexHtml = pathResolve(__root, "./index.html");
const __publicDir = pathResolve(__dirname, "./src/html/main/shell/public");

export default defineConfig(async (pConfigEnv) => {
	const { mode } = pConfigEnv;
	const env = loadEnv(mode, pathResolve(__dirname, "../.."), "");

	return {
		plugins: [injectExternalCSSFilesAsStyleTags()],
		root: __root,
		publicDir: __publicDir,
		build: {
			outDir: "./dist",
		},
		resolve: {
			alias: {
				"@html": pathResolve(__dirname, "src/html"),
				"@css": pathResolve(__dirname, "src/css"),
				"@typescript": pathResolve(__dirname, "src/typescript"),
			},
		},
	};
});

function injectExternalCSSFilesAsStyleTags(): Plugin {
	return {
		name: "inject-external-css-files-as-style-tags",
		apply: "build",
		transformIndexHtml: {
			order: "post",
			handler: async (pHtml, pContext): Promise<IndexHtmlTransformResult> => {
				const $ = cheerio.load(pHtml);
				const tags: HtmlTagDescriptor[] = [];
				const bundle = pContext.bundle;

				if (Object.keys(bundle).length === 0) {
					return [];
				}

				$("link").each((_pIndex, pElement) => {
					let href = pElement.attribs.href;
					if (href.startsWith("/")) {
						href = href.substring(1);
					}
					if (href in bundle) {
						const cssBundle = bundle[href];
						if (cssBundle.type !== "asset") {
							throw new Error(`Unexpected bundle of type \`${cssBundle.type}\` for \`${href}\``);
						}
						let source: string;
						if (typeof cssBundle.source === "string") {
							source = cssBundle.source;
						} else {
							const textDecoder = new TextDecoder();
							source = textDecoder.decode(cssBundle.source);
						}
						source = source.trim();
						tags.push({
							tag: "style",
							children: source,
							injectTo: "head",
						});
						$(pElement).remove();
					}
				});

				const biomeArgs = [
					"check",
					"--fix",
					`--stdin-file-path=${__indexHtml}`,
					`--config-path=${pathResolve(__dirname, "biome.json")}`,
				];
				return new Promise((pResolve, pReject) => {
					try {
						const checkedHtml = execFileSync("biome", biomeArgs, {
							encoding: "utf-8",
							input: $.html(),
						});
						pResolve({
							html: checkedHtml,
							tags,
						});
					} catch (eError) {
						const newError = new Error(`Error while running \`biome ${biomeArgs.join(" ")}\``);
						newError.cause = eError;
						pReject(newError);
					}
				});
			},
		},
	};
}
