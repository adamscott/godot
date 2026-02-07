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

import { chdir, cwd } from "node:process";
import { buildGlobalDTs } from "#/builder/index.js";
import { isFile } from "@godotengine/utils-node/fs";
import { program } from "@commander-js/extra-typings";
import { resolve } from "node:path";

program
	.name("emscripten-builder-externalglobaldts")
	.description("CLI to compile an external_global.d.ts file.")
	.option("-o, --out <path>", "Path of the output file. (relative to cwd)", "./src/types/external_global.d.ts")
	.option("-c, --tsconfig <path>", "Path of the tsconfig.json file. (relative to cwd)", "./tsconfig.json")
	.option("-d, --cwd <path>", "Working directory (cwd).")
	.argument("<module...>", "Modules to import externals from.")
	.action(async (pModules, pOptions) => {
		const cwdArg = pOptions.cwd;
		if (cwdArg != null) {
			chdir(cwdArg);
		}

		if (!(await isFile(resolve(cwd(), "package.json")))) {
			// eslint-disable-next-line no-console -- We're in a node env.
			console.error(`Did not find package.json in the cwd ("${cwd()}"), cannot run.`);
		}

		const projectRootPath = cwd();
		const tsConfigPath = resolve(projectRootPath, pOptions.tsconfig);
		const targetFilePath = resolve(projectRootPath, pOptions.out);

		await buildGlobalDTs(tsConfigPath, targetFilePath, pModules);
	});

program.parse();
