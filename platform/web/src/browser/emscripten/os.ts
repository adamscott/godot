/**************************************************************************/
/*  os.ts                                                                 */
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

import "+browser/lib.ts";
import type { ConfigOptions } from "+browser/types/config.ts";
import { addToLibrary, autoAddDeps, Module } from "./emscripten.ts";

type IDHandlerId = number;
type IDHandlerReference = unknown;
declare const IDHandler: typeof _IDHandler.$IDHandler;
const _IDHandler = {
	$IDHandler: {
		_lastId: 0 as IDHandlerId,
		_references: {} as Record<number, IDHandlerReference>,

		get: (pId: IDHandlerId): IDHandlerReference => {
			return IDHandler._references[pId];
		},

		add: (pData: IDHandlerReference): number => {
			const id = ++IDHandler._lastId;
			IDHandler._references[id] = pData;
			return id;
		},

		remove: (pId: IDHandlerId): void => {
			delete IDHandler._references[pId];
		},
	},
};
autoAddDeps(_IDHandler, "$IDHandler");
addToLibrary(_IDHandler);

declare const GodotConfig: typeof _GodotConfig.$GodotConfig;
const _GodotConfig = {
	// TODO: Rename Module to GodotEngine
	$GodotConfig__postset: 'Module["initConfig"] = GodotConfig.init_config;',
	$GodotConfig__deps: ["$GodotRuntime"],
	$GodotConfig: {
		canvas: null as HTMLCanvasElement | null,
		locale: "en",
		// Adaptative.
		canvasResizePolicy: 2,
		virtualKeyboard: false,
		persistentDrops: false,
		onExecute: null as (() => void) | null,
		onExit: null as (() => void) | null,

		initConfig: (pOptions: Partial<ConfigOptions>): void => {
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
			GodotConfig.canvasResizePolicy = canvasResizePolicy ??
				GodotConfig.canvasResizePolicy;
			GodotConfig.locale = locale ?? GodotConfig.locale;
			GodotConfig.virtualKeyboard = virtualKeyboard ??
				GodotConfig.virtualKeyboard;
			GodotConfig.persistentDrops = persistentDrops ??
				GodotConfig.persistentDrops;
			GodotConfig.onExecute = onExecute ?? GodotConfig.onExecute;
			GodotConfig.onExit = onExit ?? GodotConfig.onExit;
			if (focusCanvas) {
				GodotConfig.canvas.focus();
			}
		},

		locateFile: (file: string): string => {
			// @ts-expect-error TODO: Replace module for ESM engine module.
			return Module["locateFile"](file);
		},

		clear: (): void => {
			GodotConfig.canvas = null;
			GodotConfig.locale = "en";
			GodotConfig.canvasResizePolicy = 2;
			GodotConfig.virtualKeyboard = false;
			GodotConfig.persistentDrops = false;
			GodotConfig.onExecute = null;
			GodotConfig.onExit = null;
		},
	},

	godot_js_config_canvas_id_get__proxy: "sync",
	godot_js_config_canvas_id_get__sig: "vpp",
	godot_js_config_canvas_id_get: (pPtr: number, pPtrMax: number): void => {
		if (GodotConfig.canvas == null) {
			throw new Error("Canvas is null.");
		}
		GodotRuntime.stringToHeap(
			`#${GodotConfig.canvas.id}`,
			pPtr,
			pPtrMax,
		);
	},

	godot_js_config_locale_get__proxy: "sync",
	godot_js_config_locale_get__sig: "vpp",
	godot_js_config_locale_get: (pPtr: number, pPtrMax: number): void => {
		GodotRuntime.stringToHeap(GodotConfig.locale, pPtr, pPtrMax);
	},
};
autoAddDeps(_GodotConfig, "$GodotConfig");
addToLibrary(_GodotConfig);

declare const GodotEventListeners:
	typeof _GodotEventListeners.$GodotEventListeners;
class Handler {
	target: EventTarget;
	event: string;
	method: (...args: unknown[]) => unknown;
	capture: boolean;

	constructor(
		pTarget: typeof this.target,
		pEvent: typeof this.event,
		pMethod: typeof this.method,
		pCapture: typeof this.capture,
	) {
		this.target = pTarget;
		this.event = pEvent;
		this.method = pMethod;
		this.capture = pCapture;
	}

	isSame(
		pTarget: typeof this.target,
		pEvent: typeof this.event,
		pMethod: typeof this.method,
		pCapture: typeof this.capture,
	): boolean {
		return this.target === pTarget && this.event === pEvent &&
			this.method === pMethod && this.capture === pCapture;
	}

	addTargetEventListnener(): void {
		this.target.addEventListener(this.event, this.method, this.capture);
	}

	removeTargetEventListener(): void {
		this.target.removeEventListener(this.event, this.method, this.capture);
	}
}

export const _GodotEventListeners = {
	$GodotEventListeners__deps: ["$GodotOS"],
	$GodotEventListeners__postset:
		"GodotOS.atexit(function(resolve, reject) { GodotEventListeners.clear(); resolve(); });",
	$GodotEventListeners: {
		handlers: [] as Handler[],
		Handler,

		has: (
			target: InstanceType<typeof Handler>["target"],
			event: InstanceType<typeof Handler>["event"],
			method: InstanceType<typeof Handler>["method"],
			capture: InstanceType<typeof Handler>["capture"],
		) => {
			return GodotEventListeners.handlers.findIndex(function (pHandler) {
				return pHandler.isSame(target, event, method, capture);
			}) !== -1;
		},

		add: (
			target: InstanceType<typeof Handler>["target"],
			event: InstanceType<typeof Handler>["event"],
			method: InstanceType<typeof Handler>["method"],
			capture: InstanceType<typeof Handler>["capture"],
		) => {
			if (GodotEventListeners.has(target, event, method, capture)) {
				return;
			}
			const handler = new Handler(target, event, method, capture);
			GodotEventListeners.handlers.push(handler);
			handler.addTargetEventListnener();
		},

		clear: () => {
			for (const handler of GodotEventListeners.handlers) {
				handler.removeTargetEventListener();
			}
			GodotEventListeners.handlers.length = 0;
		},
	},
};
addToLibrary(_GodotEventListeners);
