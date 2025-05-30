/**************************************************************************/
/*  shell.ts                                                              */
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

import { Engine, init as engineInit } from "#/entry/engine.ts";
import type { ShellConfig } from "#/shell/types.ts";
import { fetchWithRetry } from "+shared/utils/fetch";

class Shell extends EventTarget {
	engine: Engine | null = null;

	constructor() {
		super();
	}
}

async function getConfig(): Promise<ShellConfig> {
	const configRaw = await fetchWithRetry<string>(
		"config.json",
		(response) => {
			return response.text();
		},
		{
			retry: {
				maxAttempts: 3,
			},
		},
	);
	if (configRaw == null) {
		throw new Error("Could not fetch config.");
	}
	return JSON.parse(configRaw) as ShellConfig;
}

export async function init() {
	const shell = new Shell();
	const config = getConfig();
	const engine = await engineInit({});
}
