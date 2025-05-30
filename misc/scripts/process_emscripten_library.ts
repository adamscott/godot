/**************************************************************************/
/*  process_emscripten_library.ts                                         */
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

import { exists } from "@std/fs";
import { dirname, resolve } from "@std/path";

import { parseArgs } from "node:util";

import { errorAndExit, which } from "+deno/os";

interface ParseFileOptions {
	file: string;
	emscriptenPath: string;
	emscriptenSettings: string;
	output?: string;
}
export async function parseFile(options: ParseFileOptions) {
	const { file, emscriptenPath, emscriptenSettings, output = "" } = options;

	if (!(await exists(file))) {
		errorAndExit(`"${file}" doesn't exist.`);
	}

	const fileContents = new TextDecoder().decode(await Deno.readFile(file));

	const { loadDefaultSettings, addToCompileTimeContext } = await import(resolve(emscriptenPath, "src/utility.mjs"));
	loadDefaultSettings();
	const { processMacros, preprocess } = await import(resolve(emscriptenPath, "src/parseTools.mjs"));

	const settingsContents = new TextDecoder().decode(await Deno.readFile(emscriptenSettings));
	const settingsJson = JSON.parse(settingsContents);
	addToCompileTimeContext(settingsJson);

	const processedMacrosFileContents = processMacros(fileContents, file);

	const preprocessedFile = await Deno.makeTempFile({ prefix: "godot_preprocess_emscripten" });
	await Deno.writeTextFile(preprocessedFile, processedMacrosFileContents);
	let preprocessedFileContents;
	try {
		preprocessedFileContents = preprocess(preprocessedFile);
	} catch (err) {
		console.error(err);
		errorAndExit(
			`\nEmscripten's \`preprocess()\` failed. It often means that there's a definition missing in "${emscriptenSettings}".`,
		);
	}

	await Deno.remove(preprocessedFile);

	if (output.length === 0) {
		console.log(preprocessedFileContents);
	} else {
		await Deno.writeTextFile(output, preprocessedFileContents);
	}
	Deno.exit(0);
}

async function main() {
	const emccPath = await which("emcc");
	if (emccPath == null) {
		throw new Error("Did not find `emcc`. Has emscripten added to the path?");
	}
	const emscriptenPath = dirname(emccPath);

	const args = parseArgs({
		allowPositionals: true,
		options: {
			output: {
				type: "string",
				default: "",
			},
		},
	});

	let output = args.values.output;
	if (output === "") {
		output = resolve(output);
	}
	await parseFile({
		file: String(args.positionals[0]),
		emscriptenSettings: String(args.positionals[1]),
		emscriptenPath,
		output,
	});
}

if (import.meta.main) {
	try {
		await main();
	} catch (err) {
		errorAndExit(err);
	}
}
