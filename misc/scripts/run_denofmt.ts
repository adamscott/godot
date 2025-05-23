/**************************************************************************/
/*  run_denofmt.ts                                                        */
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

import { exists } from "@std/fs/exists";
import { basename, dirname, extname, join, relative, resolve } from "@std/path";

import { parseArgs } from "node:util";

import { getDenoMajorVersion } from "+deno/utils.ts";
import { errorAndExit } from "+deno/os.ts";

if (import.meta.filename == null || getDenoMajorVersion() < 2) {
	errorAndExit("Incompatible Deno version.");
}
const root = resolve(dirname(import.meta.filename), "..", "..");

export function rootName(name: string): string {
	return name.split(".")[0];
}

export function withoutExtName(name: string): string {
	const ext = extname(name);
	const withoutExt = name.substring(0, name.length - ext.length);
	return withoutExt;
}

export async function runDenoLintOrFmt(
	task: "lint" | "fmt",
	file: string,
): Promise<boolean> {
	if (
		!file.endsWith("js") && !file.endsWith("ts") && !file.endsWith("cjs") &&
		!file.endsWith("cts") && !file.endsWith("mjs") && !file.endsWith("mts")
	) {
		return true;
	}

	const args = [task, file, "-c", join(root, "deno.jsonc")];
	const command = new Deno.Command(Deno.execPath(), {
		args,
	});
	const { success, stderr } = await command.output();
	if (success) {
		return true;
	}
	console.error(new TextDecoder().decode(stderr));
	return false;
}

export async function lintEmscriptenLibraryFile(
	file: string,
	settings: {
		verbose?: boolean;
		keepPreprocessed?: boolean;
	} = {},
) {
	const { verbose = false, keepPreprocessed = false } = settings;
	if (verbose) {
		console.log(`Linting emscripten library file "${file}"`);
	}

	const libraryDirectory = dirname(file);
	const directoryFiles = Deno.readDir(libraryDirectory);

	const fileExt = extname(file);
	const fileWithoutExt = withoutExtName(basename(file));
	const fileRoot = rootName(basename(file));
	const settingFiles = [];

	for await (const directoryFile of directoryFiles) {
		if (!directoryFile.isFile) {
			continue;
		}
		const directoryFileRoot = rootName(directoryFile.name);
		if (directoryFileRoot !== fileRoot) {
			continue;
		}
		if (
			directoryFile.name === `${directoryFileRoot}.lint_settings.json` ||
			(directoryFile.name.startsWith(
				`${directoryFileRoot}.lint_settings.`,
			) &&
				directoryFile.name.endsWith(".json"))
		) {
			settingFiles.push(join(libraryDirectory, directoryFile.name));
		}
	}

	if (settingFiles.length === 0) {
		if (verbose) {
			console.log("Did not find any settings file. Linting file as is.");
		}
		const success = (await runDenoLintOrFmt("lint", file)) &&
			(await runDenoLintOrFmt("fmt", file));
		Deno.exit(success ? 0 : 1);
	}

	for (const settingFile of settingFiles) {
		const baseSettingFile = basename(settingFile);
		try {
			const settingMiddlePart = baseSettingFile.substring(
				fileRoot.length,
				baseSettingFile.length - ".json".length,
			);
			const preprocessed = join(
				libraryDirectory,
				`${fileWithoutExt}.preprocessed${settingMiddlePart}${fileExt}`,
			);

			await new Promise(async (resolve, _reject) => {
				const preprocess_script = join(
					"misc",
					"scripts",
					"preprocess_emscripten_library.mjs",
				);
				const commandExec = Deno.execPath();
				const commandArgs = [
					preprocess_script,
					settingFile,
					file,
					"-o",
					preprocessed,
				];
				if (verbose) {
					const commandString = [commandExec, ...commandArgs].join(
						" ",
					);
					console.log(`Executing: ${commandString}`);
				}
				const command = new Deno.Command(commandExec, {
					args: commandArgs,
				});
				const { success, stderr } = await command.output();
				if (success) {
					resolve(undefined);
					return;
				}

				console.error(new TextDecoder().decode(stderr));
				Deno.exit(1);
			});

			const success = (await runDenoLintOrFmt("lint", preprocessed)) &&
				(await runDenoLintOrFmt("fmt", preprocessed));

			if (!keepPreprocessed) {
				await Deno.remove(preprocessed);
			}

			if (!success) {
				Deno.exit(1);
			}
		} catch (err) {
			console.error(err);
			Deno.exit(1);
		}
	}

	Deno.exit(0);
}

export async function lintAndFormat(
	fileName: string,
	options: {
		verbose?: boolean;
		keepPreprocessed?: boolean;
	} = {},
): Promise<void | never> {
	const { verbose = false, keepPreprocessed = false } = options;

	const relativeFileName = relative(root, fileName);
	if (relativeFileName.startsWith("..")) {
		throw new Error(`"${fileName}" is outside project root.`);
	}

	if (!(await exists(fileName, { isFile: true }))) {
		throw new Error(`"${fileName}" doesn't exist.`);
	}

	if (relativeFileName.startsWith(join("platform", "web", "js", "libs"))) {
		lintEmscriptenLibraryFile(fileName, {
			verbose,
			keepPreprocessed,
		});
		return;
	}

	const success = (await runDenoLintOrFmt("lint", fileName)) &&
		(await runDenoLintOrFmt("fmt", fileName));
	Deno.exit(success ? 0 : 1);
}

export function chdirToGodotRoot() {
	Deno.chdir(root);
}

async function main() {
	const args = parseArgs({
		allowPositionals: true,
		options: {
			verbose: {
				type: "boolean",
				default: false,
			},
			"keep-preprocessed": {
				type: "boolean",
				default: false,
			},
		},
	});

	if (args.positionals.length == 0) {
		errorAndExit("No file has been passed in parameters.");
	}

	const files = args.positionals;
	const verbose = args.values.verbose;
	const keepPreprocessed = args.values["keep-preprocessed"];
	for (const file of files) {
		await lintAndFormat(file, {
			verbose,
			keepPreprocessed,
		});
	}
}

if (import.meta.main) {
	try {
		chdirToGodotRoot();
		await main();
	} catch (err) {
		errorAndExit(err);
	}
}
