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

// __emscripten_import_global_const_start
import {
	addToLibrary,
	autoAddDeps,
	FS,
	HEAP8,
	IDBFS,
} from "./emscripten_lib.ts";
import { GodotRuntime } from "./runtime.ts";
// __emscripten_import_global_const_end

import { CPointer } from "./emscripten_lib.ts";

import { AnyFunction } from "+shared/types/aliases.ts";
import { ConfigOptions } from "+browser/types/config.ts";

export type IDHandlerId = number;

// __emscripten_declare_global_const_start
export declare const IDHandler: typeof _IDHandler.$IDHandler;
// __emscripten_declare_global_const_end
const _IDHandler = {
	$IDHandler: {
		_lastId: 0 as IDHandlerId,
		_references: {} as Record<number, unknown>,

		get: <T extends unknown>(pId: IDHandlerId): T | null => {
			return IDHandler._references[pId] as T | null;
		},

		add: (pData: unknown): number => {
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

// __emscripten_declare_global_const_start
export declare const GodotConfig: typeof _GodotConfig.$GodotConfig;
// __emscripten_declare_global_const_end
const _GodotConfig = {
	// TODO: Rename Module to GodotEngine
	$GodotConfig__postset: 'Module["initConfig"] = GodotConfig.init_config;',
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
			GodotConfig.canvas = null as unknown as HTMLCanvasElement;
			GodotConfig.locale = "en";
			GodotConfig.canvasResizePolicy = 2;
			GodotConfig.virtualKeyboard = false;
			GodotConfig.persistentDrops = false;
			GodotConfig.onExecute = null;
			GodotConfig.onExit = null;
		},
	},

	godot_js_config_canvas_id_get__proxy: "sync",
	godot_js_config_canvas_id_get__sig: "vpi",
	godot_js_config_canvas_id_get: (pPtr: CPointer, pMaxSize: number): void => {
		if (GodotConfig.canvas == null) {
			throw new Error("Canvas is null.");
		}
		GodotRuntime.stringToHeap(`#${GodotConfig.canvas.id}`, pPtr, pMaxSize);
	},

	godot_js_config_locale_get__proxy: "sync",
	godot_js_config_locale_get__sig: "vpi",
	godot_js_config_locale_get: (pPtr: CPointer, pMaxSize: number): void => {
		GodotRuntime.stringToHeap(GodotConfig.locale, pPtr, pMaxSize);
	},
};
autoAddDeps(_GodotConfig, "$GodotConfig");
addToLibrary(_GodotConfig);

// __emscripten_declare_global_const_start
export declare const GodotFS: typeof _GodotFS.$GodotFS;
// __emscripten_declare_global_const_end
const _GodotFS = {
	$GodotFS__deps: ["$FS", "$IDBFS", "$GodotRuntime"],
	$GodotFS__postset: [
		'Module["initFS"] = GodotFS.init;',
		'Module["copyToFS"] = GodotFS.copy_to_fs;',
	].join(""),
	$GodotFS: {
		ENOENT: 44,
		_idbfs: false,
		_syncing: false,
		_mountPoints: [] as string[],

		isPersistent: (): boolean => {
			return GodotFS._idbfs;
		},

		// Initialize godot file system, setting up persistent paths.
		// Returns a promise that resolves when the FS is ready.
		// We keep track of mount_points, so that we can properly close the IDBFS
		// since emscripten is not doing it by itself. (emscripten GH#12516).
		initialize: (pPersistentPaths: string[]): Promise<Error | null> => {
			GodotFS._idbfs = false;
			if (!Array.isArray(pPersistentPaths)) {
				throw new Error("Persistent paths must be an array.");
			}
			if (pPersistentPaths.length === 0) {
				return Promise.resolve(null);
			}
			GodotFS._mountPoints = pPersistentPaths.slice();

			const createRecursive = (pDirectory: string): void => {
				try {
					FS.stat(pDirectory);
				} catch (error) {
					if (
						(error as (typeof FS.ErrnoError) | null)?.errno !==
						GodotFS.ENOENT
					) {
						GodotRuntime.error(error);
					}
					FS.mkdirTree(pDirectory);
				}
			};

			for (const mountPoint of GodotFS._mountPoints) {
				createRecursive(mountPoint);
				FS.mount(IDBFS, {}, mountPoint);
			}

			return new Promise((pResolve, _pReject) => {
				FS.syncfs(true, (errorCode) => {
					if (errorCode != null) {
						GodotFS._mountPoints = [];
						GodotFS._idbfs = false;
						GodotRuntime.print(
							`IndexedDB not available: ${errorCode.message}`,
						);
					} else {
						GodotFS._idbfs = true;
					}
					pResolve(errorCode);
				});
			});
		},

		clear: (): void => {
			for (const mountPoint of GodotFS._mountPoints) {
				try {
					FS.unmount(mountPoint);
				} catch (error) {
					GodotRuntime.print("Already unmounted", error);
				}
				if (GodotFS._idbfs != null && IDBFS.dbs[mountPoint]) {
					IDBFS.dbs[mountPoint].close();
					delete IDBFS.dbs[mountPoint];
				}
			}
			GodotFS._mountPoints = [];
			GodotFS._idbfs = false;
			GodotFS._syncing = false;
		},

		sync: (): Promise<Error | null> => {
			if (GodotFS._syncing) {
				GodotRuntime.error("Already syncing.");
				return Promise.resolve(null);
			}
			GodotFS._syncing = true;
			return new Promise((pResolve, _pReject) => {
				FS.syncfs(false, (error) => {
					if (error != null) {
						GodotRuntime.error(
							"Failed to save IDB file system:",
							error,
						);
					}
					GodotFS._syncing = false;
					pResolve(error);
				});
			});
		},

		copyToFS: (pPath: string, pBuffer: ArrayBufferLike): void => {
			const idx = pPath.lastIndexOf("/");
			let dir = "/";
			if (idx > 0) {
				dir = pPath.slice(0, idx);
			}
			try {
				FS.stat(dir);
			} catch (error) {
				if (
					(error as (typeof FS.ErrnoError) | null)?.errno !==
					GodotFS.ENOENT
				) {
					GodotRuntime.error(error);
				}
				FS.mkdirTree(dir);
			}
			FS.writeFile(pPath, new Uint8Array(pBuffer));
		},
	},
};
autoAddDeps(_GodotFS, "$GodotFS");
addToLibrary(_GodotFS);

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

// __emscripten_declare_global_const_start
export declare const GodotOS: typeof _GodotOS.$GodotOS;
// __emscripten_declare_global_const_end
const _GodotOS = {
	$GodotOS__deps: ["$GodotRuntime", "$GodotConfig", "$GodotFS"],
	$GodotOS__postset: [
		'Module["request_quit"] = function() { GodotOS.request_quit() };',
		'Module["onExit"] = GodotOS.cleanup;',
		"GodotOS._fs_sync_promise = Promise.resolve();",
	].join(""),
	$GodotOS: {
		requestQuit: () => { },
		_asyncCallbacks: [] as Array<() => Promise<void>>,
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
				GodotOS._asyncCallbacks.map((pAsyncCallback) =>
					pAsyncCallback()
				),
			);
			await GodotFS.sync();
			// Always deferred.
			setTimeout(() => pCallback(), 0);
		},

		getCurrentOS: (): GodotOSOS => {
			const userAgent = navigator.userAgent;
			let operatingSystem: GodotOSOS = "Unknown";
			if (userAgent.indexOf("Android") >= 0) {
				operatingSystem = "Android";
			} else if (userAgent.indexOf("Linux") >= 0) {
				operatingSystem = "Linux";
			} else if (
				(userAgent.indexOf("iPhone") !== -1) ||
				(userAgent.indexOf("iPad") !== -1) ||
				(userAgent.indexOf("iPod") !== -1)
			) {
				operatingSystem = "iOS";
			} else if (userAgent.indexOf("Macintosh") >= 0) {
				operatingSystem = "macOS";
			} else if (userAgent.indexOf("Windows") >= 0) {
				operatingSystem = "Windows";
			} else if (userAgent.indexOf("FreeBSD") >= 0) {
				operatingSystem = "FreeBSD";
			} else if (userAgent.indexOf("NetBSD") >= 0) {
				operatingSystem = "NetBSD";
			} else if (userAgent.indexOf("OpenBSD") >= 0) {
				operatingSystem = "OpenBSD";
			} else if (userAgent.indexOf("Haiku") >= 0) {
				operatingSystem = "Haiku";
			} else if (userAgent.indexOf("CrOS") >= 0) {
				operatingSystem = "ChromeOS";
			}
			return operatingSystem;
		},
	},

	godot_js_os_finish_async__proxy: "sync",
	godot_js_os_finish_async__sig: "vp",
	godot_js_os_finish_async: (pCallbackPtr: CPointer): void => {
		const callback = GodotRuntime.getFunction<() => void>(pCallbackPtr);
		GodotOS.finishAsync(() => callback());
	},

	godot_js_os_request_quit_cb__proxy: "sync",
	godot_js_os_request_quit_cb__sig: "vp",
	godot_js_os_request_quit_cb: (pCallbackPtr: CPointer): void => {
		const callback = GodotRuntime.getFunction<() => void>(pCallbackPtr);
		GodotOS.requestQuit = callback;
	},

	godot_js_os_fs_is_persistent__proxy: "sync",
	godot_js_os_fs_is_persistent__sig: "i",
	godot_js_os_fs_is_persistent: (): number => {
		return Number(GodotFS.isPersistent());
	},

	godot_js_os_fs_sync__proxy: "sync",
	godot_js_os_fs_sync__sig: "vp",
	godot_js_os_fs_sync: (pCallbackPtr: CPointer): void => {
		const callback = GodotRuntime.getFunction<() => void>(pCallbackPtr);
		GodotOS._fsSyncPromise = GodotFS.sync();
		GodotOS._fsSyncPromise.then((_error): void => {
			callback();
		});
	},

	godot_js_os_has_feature__proxy: "sync",
	godot_js_os_has_feature__sig: "ip",
	godot_js_os_has_feature: (pFeaturePtr: CPointer): number => {
		const feature = GodotRuntime.parseString(pFeaturePtr);
		if (feature === "web_android") {
			return Number(GodotOS.getCurrentOS() === "Android");
		}
		if (feature === "web_ios") {
			return Number(GodotOS.getCurrentOS() === "iOS");
		}
		if (feature === "web_macos") {
			return Number(GodotOS.getCurrentOS() === "macOS");
		}
		if (feature === "web_windows") {
			return Number(GodotOS.getCurrentOS() === "Windows");
		}
		if (feature === "web_linuxbsd") {
			switch (GodotOS.getCurrentOS()) {
				case "Linux":
				case "FreeBSD":
				case "OpenBSD":
				case "NetBSD":
				case "Haiku":
				case "ChromeOS":
					return 1;

				case "Unknown": {
					const userAgent = navigator.userAgent;
					return Number(userAgent.indexOf("X11") >= 0);
				}

				default:
					return 0;
			}
		}
		return 0;
	},

	godot_js_os_execute__proxy: "sync",
	godot_js_os_execute__sig: "ip",
	godot_js_os_execute: (pJsonPtr: CPointer): number => {
		const jsonRaw = GodotRuntime.parseString(pJsonPtr);
		const args = JSON.parse(jsonRaw);
		if (GodotConfig.onExecute) {
			GodotConfig.onExecute(args);
			return 0;
		}
		return 1;
	},

	godot_js_os_shell_open__proxy: "sync",
	godot_js_os_shell_open__sig: "vp",
	godot_js_os_shell_open: (pUriPtr: CPointer): void => {
		globalThis.open(GodotRuntime.parseString(pUriPtr), "_blank");
	},

	godot_js_os_hw_concurrency_get__proxy: "sync",
	godot_js_os_hw_concurrency_get__sig: "i",
	godot_js_os_hw_concurrency_get: (): number => {
		// TODO Godot core needs fixing to avoid spawning too many threads (> 24).
		const concurrency = navigator.hardwareConcurrency || 1;
		return concurrency < 2 ? concurrency : 2;
	},

	godot_js_os_download_buffer__proxy: "sync",
	godot_js_os_download_buffer__sig: "vpipp",
	godot_js_os_download_buffer: (
		pBufferPtr: CPointer,
		pBufferSize: number,
		pBufferNamePtr: CPointer,
		pBufferMimePtr: CPointer,
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

class Handler {
	target: EventTarget;
	event: string;
	method: AnyFunction;
	capture: Parameters<EventTarget["addEventListener"]>[2];

	constructor(
		pTarget: typeof this.target,
		pEvent: typeof this.event,
		pMethod: typeof this.method,
		pCapture?: typeof this.capture,
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
		pCapture?: typeof this.capture,
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

// __emscripten_declare_global_const_start
export declare const GodotEventListeners:
	typeof _GodotEventListeners.$GodotEventListeners;
// __emscripten_declare_global_const_end
const _GodotEventListeners = {
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
			capture?: InstanceType<typeof Handler>["capture"],
		) => {
			return (
				GodotEventListeners.handlers.findIndex(function (pHandler) {
					return pHandler.isSame(target, event, method, capture);
				}) !== -1
			);
		},

		add: (
			target: InstanceType<typeof Handler>["target"],
			event: InstanceType<typeof Handler>["event"],
			method: InstanceType<typeof Handler>["method"],
			capture?: InstanceType<typeof Handler>["capture"],
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
autoAddDeps(_GodotEventListeners, "$GodotEventListeners");
addToLibrary(_GodotEventListeners);

// __emscripten_declare_global_const_start
export declare const GodotPWA: typeof _GodotPWA.$GodotPWA;
// __emscripten_declare_global_const_end
const _GodotPWA = {
	$GodotPWA__deps: ["$GodotRuntime", "$GodotEventListeners"],
	$GodotPWA: {
		hasUpdate: false,

		updateState: (
			pCallback: () => void,
			pRegistration: ServiceWorkerRegistration | null,
		): void => {
			if (pRegistration == null || !pRegistration.active) {
				return;
			}
			if (pRegistration.waiting) {
				GodotPWA.hasUpdate = true;
				pCallback();
			}
			GodotEventListeners.add(pRegistration, "updatefound", () => {
				const installing = pRegistration.installing!;
				GodotEventListeners.add(installing, "statechange", () => {
					if (installing.state === "installed") {
						GodotPWA.hasUpdate = true;
						pCallback();
					}
				});
			});
		},
	},

	godot_js_pwa_cb__proxy: "sync",
	godot_js_pwa_cb__sig: "vp",
	godot_js_pwa_cb: (pUpdateCallbackPtr: CPointer): void => {
		if ("serviceWorker" in navigator) {
			try {
				const callback = GodotRuntime.getFunction<() => void>(
					pUpdateCallbackPtr,
				);
				navigator.serviceWorker.getRegistration().then(
					(pRegistration) => {
						GodotPWA.updateState(
							callback,
							pRegistration ?? null,
						);
					},
				);
			} catch (error) {
				GodotRuntime.error("Failed to assign PWA callback", error);
			}
		}
	},

	godot_js_pwa_update__proxy: "sync",
	godot_js_pwa_update__sig: "i",
	godot_js_pwa_update: (): number => {
		if ("serviceWorker" in navigator && GodotPWA.hasUpdate) {
			try {
				navigator.serviceWorker.getRegistration().then(
					(pRegistration): void => {
						if (pRegistration == null || !pRegistration.waiting) {
							return;
						}
						pRegistration.waiting.postMessage("update");
					},
				);
			} catch (error) {
				GodotRuntime.error(error);
				return 1;
			}
			return 0;
		}
		return 1;
	},
};
autoAddDeps(_GodotPWA, "$GodotPWA");
addToLibrary(_GodotPWA);
