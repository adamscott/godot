/**************************************************************************/
/*  godot_pwa.ts                                                          */
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

import type { CFunctionPointer, CInt } from "@godotengine/emscripten-utils/types";
import { GodotEventListeners, GodotPWA, GodotRuntime, addToLibrary, autoAddDeps } from "#/external/index.js";

type PWACbCallback = () => void;

export const _GodotPWA = {
	$GodotPWA__deps: ["$GodotRuntime", "$GodotEventListeners"],
	$GodotPWA: {
		hasUpdate: false,

		updateState: (pCallback: () => void, pRegistration: ServiceWorkerRegistration | null): void => {
			if (pRegistration?.active == null) {
				return;
			}
			if (pRegistration.waiting != null) {
				GodotPWA.hasUpdate = true;
				pCallback();
			}
			GodotEventListeners.add(pRegistration, "updatefound", () => {
				if (pRegistration.installing == null) {
					return;
				}
				const installing = pRegistration.installing;
				GodotEventListeners.add(installing, "statechange", () => {
					if (installing.state !== "installed") {
						return;
					}
					GodotPWA.hasUpdate = true;
					pCallback();
				});
			});
		},
	},

	godot_js_pwa_cb__proxy: "sync",
	godot_js_pwa_cb__sig: "vp",
	godot_js_pwa_cb: (pUpdateCallbackPtr: CFunctionPointer<PWACbCallback>): void => {
		if (!("serviceWorker" in navigator)) {
			return;
		}

		const callback = GodotRuntime.getFunction(pUpdateCallbackPtr);
		navigator.serviceWorker
			.getRegistration()
			.then((pRegistration) => {
				GodotPWA.updateState(callback, pRegistration ?? null);
			})
			.catch((pError: unknown) => {
				GodotRuntime.error("Failed to assign PWA callback:", pError);
			});
	},

	godot_js_pwa_update__proxy: "sync",
	godot_js_pwa_update__sig: "i",
	godot_js_pwa_update: (): CInt => {
		if (!("serviceWorker" in navigator) || !GodotPWA.hasUpdate) {
			return GodotRuntime.CIntError.FAILED;
		}

		try {
			navigator.serviceWorker
				.getRegistration()
				.then((pRegistration): void => {
					if (pRegistration?.waiting == null) {
						return;
					}
					pRegistration.waiting.postMessage("update");
				})
				.catch((pError: unknown) => {
					GodotRuntime.error("Failed to update PWA:", pError);
				});
		} catch (error) {
			GodotRuntime.error(error);
			return GodotRuntime.CIntError.FAILED;
		}
		return GodotRuntime.CIntError.OK;
	},
};

autoAddDeps(_GodotPWA, "$GodotPWA");
addToLibrary(_GodotPWA);
