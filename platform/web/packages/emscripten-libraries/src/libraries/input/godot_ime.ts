/**************************************************************************/
/*  godot_ime.ts                                                          */
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

import type { CCharPointer, CPointer } from "@godotengine/emscripten-utils/types";

import { getModifiers } from "./utils";

export const GodotIMECompositionType = Object.freeze({
	start: 0,
	update: 1,
	end: 2,
});

export const _GodotIME = {
	$GodotIME__deps: ["$GodotRuntime", "$GodotEventListeners"],
	$GodotIME__postset: "GodotOS.atExit(async () => { GodotIME.clear(); });",
	$GodotIME: {
		imeElement: null as HTMLDivElement | null,
		_active: false,
		focusTimerIntervalId: -1,

		initialize: (
			pIMECallback: (
				pCompositionType: (typeof GodotIMECompositionType)[keyof typeof GodotIMECompositionType],
				pStringPtr: CPointer | null,
			) => void,
			pKeyCallback: (pPressed: boolean, pRepeat: boolean, pModifiers: number) => void,
			pCodePtr: CCharPointer,
			pKeyPtr: CCharPointer,
		): void => {
			const keyEventCallback = (pPressed: boolean, pEvent: KeyboardEvent): void => {
				const modifiers = GodotIME.getModifiers(pEvent);
				GodotRuntime.stringToHeap(pEvent.code, pCodePtr, 32);
				GodotRuntime.stringToHeap(pEvent.key, pKeyPtr, 32);
				pKeyCallback(pPressed, pEvent.repeat, modifiers);
				pEvent.preventDefault();
			};

			const imeEventCallback = (pEvent: CompositionEvent): void => {
				if (GodotIME.imeElement == null) {
					return;
				}
				switch (pEvent.type) {
					case "compositionstart":
						pIMECallback(0, null);
						GodotIME.imeElement.innerHTML = "";
						break;
					case "compositionupdate":
						{
							const stringPtr = GodotRuntime.allocString(pEvent.data);
							pIMECallback(1, stringPtr);
							GodotRuntime.free(stringPtr);
						}
						break;
					case "compositionend":
						{
							const stringPtr = GodotRuntime.allocString(pEvent.data);
							pIMECallback(2, stringPtr);
							GodotRuntime.free(stringPtr);
							GodotIME.imeElement.innerHTML = "";
						}
						break;
					default:
					// Do nothing.
				}
			};

			const imeElement = document.createElement("div");
			imeElement.className = "ime";
			imeElement.style.background = "none";
			imeElement.style.opacity = "0";
			imeElement.style.position = "fixed";
			imeElement.style.textAlign = "left";
			imeElement.style.fontSize = "1px";
			imeElement.style.left = "0px";
			imeElement.style.top = "0px";
			imeElement.style.width = "100%";
			imeElement.style.height = "40px";
			imeElement.style.pointerEvents = "none";
			imeElement.style.display = "none";
			imeElement.contentEditable = "true";

			GodotEventListeners.add(imeElement, "compositionstart", imeEventCallback, false);
			GodotEventListeners.add(imeElement, "compositionupdate", imeEventCallback, false);
			GodotEventListeners.add(imeElement, "compositionend", imeEventCallback, false);
			GodotEventListeners.add(imeElement, "keydown", keyEventCallback.bind(null, true), false);
			GodotEventListeners.add(imeElement, "keyup", keyEventCallback.bind(null, false), false);

			imeElement.addEventListener("blur", () => {
				imeElement.style.display = "none";
				GodotConfig.canvas?.focus();
				GodotIME._active = false;
			});

			GodotConfig.canvas?.parentElement?.appendChild(imeElement);
			GodotIME.imeElement = imeElement;
		},

		getModifiers,

		setActive: (pActive: boolean): void => {
			const clearFocusTimerInterval = (): void => {
				clearInterval(GodotIME.focusTimerIntervalId);
				GodotIME.focusTimerIntervalId = -1;
			};

			const focusTimer = (): void => {
				if (GodotIME.imeElement == null) {
					clearFocusTimerInterval();
					return;
				}
				GodotIME.imeElement.focus();
			};

			if (GodotIME.focusTimerIntervalId > -1) {
				clearFocusTimerInterval();
			}

			if (GodotIME.imeElement == null) {
				return;
			}

			GodotIME._active = pActive;
			if (pActive) {
				GodotIME.imeElement.style.display = "block";
				GodotIME.focusTimerIntervalId = setInterval(focusTimer, 100);
			} else {
				GodotIME.imeElement.style.display = "none";
				GodotConfig.canvas?.focus();
			}
		},

		getActive: (): boolean => {
			return GodotIME._active;
		},

		setPosition: (pX: number, pY: number): void => {
			if (GodotIME.imeElement == null) {
				return;
			}
			const canvas = GodotConfig.canvas;
			if (canvas == null) {
				return;
			}

			const rect = canvas.getBoundingClientRect();
			const rectWidth = canvas.width / rect.width;
			const rectHeight = canvas.height / rect.height;
			const clX = pX / rectWidth + rect.x;
			const clY = pY / rectHeight + rect.y;

			GodotIME.imeElement.style.left = `${clX}px`;
			GodotIME.imeElement.style.top = `${clY}px`;
		},

		clear: function () {
			if (GodotIME.imeElement == null) {
				return;
			}
			if (GodotIME.focusTimerIntervalId > -1) {
				clearInterval(GodotIME.focusTimerIntervalId);
				GodotIME.focusTimerIntervalId = -1;
			}
			GodotIME.imeElement.remove();
			GodotIME.imeElement = null;
		},
	},
};
autoAddDeps(_GodotIME, "$GodotIME");
addToLibrary(_GodotIME);
