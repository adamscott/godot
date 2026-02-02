/**************************************************************************/
/*  godot_os.ts                                                           */
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

import type { CCharPointer, CInt, CUintPointer, CFunctionPointer } from "@godotengine/emscripten-utils/types";

import { convertFunctionToIifeString as $convertFunctionToIifeString } from "@godotengine/utils" with { type: "macro" };

type OSFinishAsyncCallback = () => void;
type OSRequestQuitCbCallback = () => void;
type OSFSSyncCallback = () => void;

export type GodotOSOS =
	| "Android"
	| "Linux"
	| "iOS"
	| "macOS"
	| "Windows"
	| "ChromeOS"
	| "FreeBSD"
	| "NetBSD"
	| "OpenBSD"
	| "Haiku"
	| "Unknown";

export const _GodotOS = {
	$GodotOS__deps: ["$GodotRuntime", "$GodotConfig", "$GodotFS"],
	$GodotOS__postset: $convertFunctionToIifeString(() => {
		Module.request_quit = function () {
			GodotOS.requestQuit();
		};
		Module.onExit = GodotOS.cleanup;
		GodotOS._fsSyncPromise = Promise.resolve(null);
	}),
	$GodotOS: {
		requestQuit: () => {
			/* empty */
		},
		_asyncCallbacks: [] as Array<() => Promise<void>>,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Real value is set in postset.
		_fsSyncPromise: null as unknown as Promise<Error | null>,

		atExit: (pPromiseCallback: () => Promise<void>): void => {
			GodotOS._asyncCallbacks.push(pPromiseCallback);
		},

		cleanup: (pExitCode: number): void => {
			const callback = GodotConfig.onExit;
			GodotFS.clear();
			GodotConfig.clear();
			if (callback != null) {
				callback(pExitCode);
			}
		},

		finishAsync: async (pCallback: () => void): Promise<void> => {
			await GodotOS._fsSyncPromise;
			await Promise.all(
				GodotOS._asyncCallbacks.map(async (pAsyncCallback) => {
					await pAsyncCallback();
				}),
			);
			await GodotFS.sync();
			// Always deferred.
			setTimeout(() => {
				pCallback();
			}, 0);
		},

		getCurrentOS: (): GodotOSOS => {
			const userAgent = navigator.userAgent;
			let operatingSystem: GodotOSOS = "Unknown";
			if (userAgent.includes("Android")) {
				operatingSystem = "Android";
			} else if (userAgent.includes("Linux")) {
				operatingSystem = "Linux";
			} else if (userAgent.includes("iPhone") || userAgent.includes("iPad") || userAgent.includes("iPod")) {
				operatingSystem = "iOS";
			} else if (userAgent.includes("Macintosh")) {
				operatingSystem = "macOS";
			} else if (userAgent.includes("Windows")) {
				operatingSystem = "Windows";
			} else if (userAgent.includes("FreeBSD")) {
				operatingSystem = "FreeBSD";
			} else if (userAgent.includes("NetBSD")) {
				operatingSystem = "NetBSD";
			} else if (userAgent.includes("OpenBSD")) {
				operatingSystem = "OpenBSD";
			} else if (userAgent.includes("Haiku")) {
				operatingSystem = "Haiku";
			} else if (userAgent.includes("cross")) {
				operatingSystem = "ChromeOS";
			}
			return operatingSystem;
		},
	},

	godot_js_os_finish_async__proxy: "sync",
	godot_js_os_finish_async__sig: "vp",
	godot_js_os_finish_async: (pCallbackPtr: CFunctionPointer<OSFinishAsyncCallback>): void => {
		const callback = GodotRuntime.getFunction(pCallbackPtr);
		GodotOS.finishAsync(() => {
			callback();
		}).catch((pError: unknown) => {
			GodotRuntime.error("Error while running `godot_js_os_finish_async`:", pError);
		});
	},

	godot_js_os_request_quit_cb__proxy: "sync",
	godot_js_os_request_quit_cb__sig: "vp",
	godot_js_os_request_quit_cb: (pCallbackPtr: CFunctionPointer<OSRequestQuitCbCallback>): void => {
		const callback = GodotRuntime.getFunction(pCallbackPtr);
		GodotOS.requestQuit = callback;
	},

	godot_js_os_fs_is_persistent__proxy: "sync",
	godot_js_os_fs_is_persistent__sig: "i",
	godot_js_os_fs_is_persistent: (): CInt => {
		return GodotRuntime.asCIntBoolean(GodotFS.isPersistent());
	},

	godot_js_os_fs_sync__proxy: "sync",
	godot_js_os_fs_sync__sig: "vp",
	godot_js_os_fs_sync: (pCallbackPtr: CFunctionPointer<OSFSSyncCallback>): void => {
		const callback = GodotRuntime.getFunction(pCallbackPtr);
		GodotOS._fsSyncPromise = GodotFS.sync();
		GodotOS._fsSyncPromise
			.then(() => {
				callback();
			})
			.catch((pError: unknown) => {
				GodotRuntime.error("Error while running `godot_js_os_fs_sync`:", pError);
			});
	},

	godot_js_os_has_feature__proxy: "sync",
	godot_js_os_has_feature__sig: "ip",
	godot_js_os_has_feature: (pFeaturePtr: CCharPointer): CInt => {
		const feature = GodotRuntime.parseString(pFeaturePtr);
		if (feature === "web_android") {
			return GodotRuntime.asCIntBoolean(GodotOS.getCurrentOS() === "Android");
		}
		if (feature === "web_ios") {
			return GodotRuntime.asCIntBoolean(GodotOS.getCurrentOS() === "iOS");
		}
		if (feature === "web_macos") {
			return GodotRuntime.asCIntBoolean(GodotOS.getCurrentOS() === "macOS");
		}
		if (feature === "web_windows") {
			return GodotRuntime.asCIntBoolean(GodotOS.getCurrentOS() === "Windows");
		}
		if (feature === "web_linuxbsd") {
			switch (GodotOS.getCurrentOS()) {
				case "Linux":
				case "FreeBSD":
				case "OpenBSD":
				case "NetBSD":
				case "Haiku":
				case "ChromeOS":
					return GodotRuntime.CIntBoolean.TRUE;

				case "Unknown": {
					const userAgent = navigator.userAgent;
					if (!userAgent.includes("X11")) {
						return GodotRuntime.CIntBoolean.FALSE;
					}
					return GodotRuntime.CIntBoolean.TRUE;
				}

				default:
					return GodotRuntime.CIntBoolean.FALSE;
			}
		}

		return GodotRuntime.CIntBoolean.FALSE;
	},

	godot_js_os_execute__proxy: "sync",
	godot_js_os_execute__sig: "ip",
	godot_js_os_execute: (pJsonPtr: CCharPointer): CInt => {
		const jsonRaw = GodotRuntime.parseString(pJsonPtr);
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- We're trying to type JSON.
		const args = JSON.parse(jsonRaw) as Record<string, unknown>;
		if (GodotConfig.onExecute == null) {
			return GodotRuntime.CIntError.FAILED;
		}
		GodotConfig.onExecute(args);
		return GodotRuntime.CIntError.OK;
	},

	godot_js_os_shell_open__proxy: "sync",
	godot_js_os_shell_open__sig: "vp",
	godot_js_os_shell_open: (pUriPtr: CCharPointer): void => {
		globalThis.open(GodotRuntime.parseString(pUriPtr), "_blank");
	},

	godot_js_os_hw_concurrency_get__proxy: "sync",
	godot_js_os_hw_concurrency_get__sig: "i",
	godot_js_os_hw_concurrency_get: (): CInt => {
		// TODO Godot core needs fixing to avoid spawning too many threads (> 24).
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Property exists since 2022.
		const concurrency = navigator.hardwareConcurrency ?? 1;
		return GodotRuntime.asCInt(Math.min(concurrency, 2));
	},

	godot_js_os_download_buffer__proxy: "sync",
	godot_js_os_download_buffer__sig: "vpipp",
	godot_js_os_download_buffer: (
		pBufferPtr: CUintPointer,
		pBufferSize: CInt,
		pBufferNamePtr: CCharPointer,
		pBufferMimePtr: CCharPointer,
	): void => {
		const buffer = GodotRuntime.heapSlice(HEAP8, pBufferPtr, pBufferSize);
		const name = GodotRuntime.parseString(pBufferNamePtr);
		const mime = GodotRuntime.parseString(pBufferMimePtr);
		const blob = new Blob([buffer], { type: mime });
		const url = globalThis.URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = name;
		a.style.display = "none";
		document.body.appendChild(a);
		a.click();
		a.remove();
		globalThis.URL.revokeObjectURL(url);
	},
};
autoAddDeps(_GodotOS, "$GodotOS");
addToLibrary(_GodotOS);
