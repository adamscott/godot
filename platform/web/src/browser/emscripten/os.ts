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

import "./lib.ts";
import "./runtime.ts";

import type { ConfigOptions } from "+browser/types/config.ts";

type IDHandlerId = number;
type IDHandlerReference = unknown;
declare global {
	const IDHandler: typeof _IDHandler.$IDHandler;
}
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

declare global {
	const GodotConfig: typeof _GodotConfig.$GodotConfig;
}
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
		GodotRuntime.stringToHeap(`#${GodotConfig.canvas.id}`, pPtr, pPtrMax);
	},

	godot_js_config_locale_get__proxy: "sync",
	godot_js_config_locale_get__sig: "vpp",
	godot_js_config_locale_get: (pPtr: number, pPtrMax: number): void => {
		GodotRuntime.stringToHeap(GodotConfig.locale, pPtr, pPtrMax);
	},
};
autoAddDeps(_GodotConfig, "$GodotConfig");
addToLibrary(_GodotConfig);

declare global {
	const GodotFS: typeof _GodotFS.$GodotFS;
}
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
		init: async (pPersistentPaths: string[]): Promise<Error | null> => {
			GodotFS._idbfs = false;
			if (!Array.isArray(pPersistentPaths)) {
				throw new Error("Persistent paths must be an array.");
			}
			if (pPersistentPaths.length === 0) {
				return null;
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
						GodotRuntime.error(err);
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

		deinit: (): void => {
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

		sync: async (): Promise<Error | null> => {
			if (GodotFS._syncing) {
				GodotRuntime.error("Already syncing.");
				return null;
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

		copyToFs: (pPath: string, pBuffer: ArrayBufferLike): void => {
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
// autoAddDeps(_GodotFS, "$GodotFS");
addToLibrary(_GodotFS);

declare global {
	const GodotOS: typeof _GodotOS.$GodotOS;
}
const _GodotOS = {
	$GodotOS__deps: ["$GodotRuntime", "$GodotConfig", "$GodotFS"],
	$GodotOS__postset: [
		'Module["request_quit"] = function() { GodotOS.request_quit() };',
		'Module["onExit"] = GodotOS.cleanup;',
		"GodotOS._fs_sync_promise = Promise.resolve();",
	].join(""),
	$GodotOS: {
		requestQuit: () => {},
		_asyncCallbacks: [] as Array<() => Promise<void>>,
		_fsSyncPromise: null as unknown as Promise<Error | null>,

		atExit: (pPromiseCallback: () => Promise<void>): void => {
			GodotOS._asyncCallbacks.push(pPromiseCallback);
		},

		cleanup: (pExitCode: number): void => {
			const callback = GodotConfig.onExit;
			GodotFS.deinit();
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
	},

	godot_js_os_finish_async__proxy: "sync",
	godot_js_os_finish_async__sig: "vp",
	godot_js_os_finish_async: (pCallbackPtr: number): void => {
		const callback = GodotRuntime.getFunc(pCallbackPtr);
		GodotOS.finishAsync(callback);
	},

	godot_js_os_request_quit_cb__proxy: "sync",
	godot_js_os_request_quit_cb__sig: "vp",
	godot_js_os_request_quit_cb: (pCallbackPtr: number): void => {
		GodotOS.requestQuit = GodotRuntime.getFunc(pCallbackPtr);
	},

	godot_js_os_fs_is_persistent__proxy: "sync",
	godot_js_os_fs_is_persistent__sig: "i",
	godot_js_os_fs_is_persistent: (): number => {
		return Number(GodotFS.isPersistent());
	},

	godot_js_os_fs_sync__proxy: "sync",
	godot_js_os_fs_sync__sig: "vp",
	godot_js_os_fs_sync: (pCallbackPtr: number): void => {
		const callback = GodotRuntime.getFunc(pCallbackPtr);
		GodotOS._fsSyncPromise = GodotFS.sync();
		GodotOS._fsSyncPromise.then((_error): void => {
			callback();
		});
	},

	godot_js_os_has_feature__proxy: "sync",
	godot_js_os_has_feature__sig: "ip",
	godot_js_os_has_feature: (pFeaturePtr: number): number => {
		const feature = GodotRuntime.parseString(pFeaturePtr);
		const userAgent = navigator.userAgent;
		if (feature === "web_macos") {
			return (userAgent.indexOf("Mac") !== -1) ? 1 : 0;
		}
		if (feature === "web_windows") {
			return (userAgent.indexOf("Windows") !== -1) ? 1 : 0;
		}
		if (feature === "web_android") {
			return (userAgent.indexOf("Android") !== -1) ? 1 : 0;
		}
		if (feature === "web_ios") {
			return ((userAgent.indexOf("iPhone") !== -1) ||
					(userAgent.indexOf("iPad") !== -1) ||
					(userAgent.indexOf("iPod") !== -1))
				? 1
				: 0;
		}
		if (feature === "web_linuxbsd") {
			return ((userAgent.indexOf("CrOS") !== -1) ||
					(userAgent.indexOf("BSD") !== -1) ||
					(userAgent.indexOf("Linux") !== -1) ||
					(userAgent.indexOf("X11") !== -1))
				? 1
				: 0;
		}
		return 0;
	},

	godot_js_os_execute__proxy: "sync",
	godot_js_os_execute__sig: "ip",
	godot_js_os_execute: (pJsonPtr: number): number => {
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
	godot_js_os_shell_open: (pUriPtr: number): void => {
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
		pBufferPtr: number,
		pBufferSize: number,
		pBufferNamePtr: number,
		pBufferMimePtr: number,
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
	method: (...args: unknown[]) => unknown;
	capture: boolean | undefined;

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

declare global {
	const GodotEventListeners: typeof _GodotEventListeners.$GodotEventListeners;
}
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
addToLibrary(_GodotEventListeners);

declare global {
	const GodotPWA: typeof _GodotPWA.$GodotPWA;
}
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
	godot_js_pwa_cb: (pUpdateCallbackPtr: number): void => {
		if ("serviceWorker" in navigator) {
			try {
				const callback = GodotRuntime.getFunc(pUpdateCallbackPtr);
				navigator.serviceWorker.getRegistration().then(
					(pRegistration) => {
						GodotPWA.updateState(callback, pRegistration ?? null);
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
