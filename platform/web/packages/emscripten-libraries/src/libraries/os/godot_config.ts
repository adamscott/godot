/**************************************************************************/
/*  godot_config.ts                                                       */
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

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- No way around this rule. */

import type { ConfigOptions } from "@godotengine/utils/types";

import type { CCharPointer, CInt } from "@godotengine/emscripten-utils/types";

import { GodotConfigPostsetFnString } from "./postset.nocheck.js";

export const _GodotConfig = {
	// TODO: Rename Module to GodotEngine
	$GodotConfig__postset: GodotConfigPostsetFnString,
	$GodotConfig__deps: ["$GodotRuntime"],
	$GodotConfig: {
		canvas: null as unknown as HTMLCanvasElement,
		locale: "en",
		// Adaptative.
		canvasResizePolicy: 2,
		virtualKeyboard: false,
		persistentDrops: false,
		onExecute: null as ((pArgs: Record<string, unknown>) => void) | null,
		onExit: null as ((pExitCode: number) => void) | null,

		initialize: (pOptions: Partial<ConfigOptions>): void => {
			const {
				canvas,
				canvasResizePolicy,
				locale,
				virtualKeyboard,
				persistentDrops,
				focusCanvas,
				onExecute,
				onExit,
			} = pOptions;

			if (canvas == null) {
				throw new Error("Supplied canvas is null.");
			}
			GodotConfig.canvas = canvas;
			GodotConfig.canvasResizePolicy = canvasResizePolicy ?? GodotConfig.canvasResizePolicy;
			GodotConfig.locale = locale ?? GodotConfig.locale;
			GodotConfig.virtualKeyboard = virtualKeyboard ?? GodotConfig.virtualKeyboard;
			GodotConfig.persistentDrops = persistentDrops ?? GodotConfig.persistentDrops;
			GodotConfig.onExecute = onExecute ?? GodotConfig.onExecute;
			GodotConfig.onExit = onExit ?? GodotConfig.onExit;
			if (focusCanvas != null) {
				GodotConfig.canvas.focus();
			}
		},

		locateFile: (pFile: string): string => {
			// @ts-expect-error TODO: Replace module for ESM engine module.
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call -- TODO: Fix this.
			return Module.locateFile(pFile);
		},

		clear: (): void => {
			GodotConfig.canvas = null as unknown as HTMLCanvasElement;
			GodotConfig.locale = "en";
			GodotConfig.canvasResizePolicy = 2;
			GodotConfig.virtualKeyboard = false;
			GodotConfig.persistentDrops = false;
			GodotConfig.onExecute = null;
			GodotConfig.onExit = null;
		},
	},

	godot_js_config_locale_get__proxy: "sync",
	godot_js_config_locale_get__sig: "vpi",
	godot_js_config_locale_get: (pPtr: CCharPointer, pMaxSize: CInt): void => {
		GodotRuntime.stringToHeap(GodotConfig.locale, pPtr, pMaxSize);
	},

	godot_js_config_canvas_id_get__proxy: "sync",
	godot_js_config_canvas_id_get__sig: "vpi",
	godot_js_config_canvas_id_get: (pPtr: CCharPointer, pMaxSize: CInt): void => {
		GodotRuntime.stringToHeap(`#${GodotConfig.canvas.id}`, pPtr, pMaxSize);
	},
};

autoAddDeps(_GodotConfig, "$GodotConfig");
addToLibrary(_GodotConfig);
