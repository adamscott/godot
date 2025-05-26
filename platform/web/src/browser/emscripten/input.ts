/**************************************************************************/
/*  input.ts                                                              */
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
import "./os.ts";

declare global {
	const GodotIME: typeof _GodotIME.$GodotIME;
}
const _GodotIME = {
	$GodotIME__deps: ["$GodotRuntime", "$GodotEventListeners"],
	$GodotIME__postset:
		"GodotOS.atexit(function(resolve, reject) { GodotIME.clear(); resolve(); });",
	$GodotIME: {
		imeElement: null as HTMLDivElement | null,
		active: false,
		focusTimerIntervalId: -1,

		init: (
			pIMECallback,
			pKeyCallback: (
				pPressed: boolean,
				pRepeat: boolean,
				pModifiers: number,
			) => void,
			pCode: number,
			pKey: number,
		): void => {
			const keyEventCallback = (
				pPressed: boolean,
				pEvent: KeyboardEvent,
			): void => {
				const modifiers = GodotIME.getModifiers(pEvent);
				GodotRuntime.stringToHeap(pEvent.code, pCode, 32);
				GodotRuntime.stringToHeap(pEvent.key, pKey, 32);
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
							const stringPtr = GodotRuntime.allocString(
								pEvent.data,
							);
							pIMECallback(1, stringPtr);
							GodotRuntime.free(stringPtr);
						}
						break;
					case "compositionend":
						{
							const stringPtr = GodotRuntime.allocString(
								pEvent.data,
							);
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

			GodotEventListeners.add(
				imeElement,
				"compositionstart",
				imeEventCallback,
				false,
			);
			GodotEventListeners.add(
				imeElement,
				"compositionupdate",
				imeEventCallback,
				false,
			);
			GodotEventListeners.add(
				imeElement,
				"compositionend",
				imeEventCallback,
				false,
			);
			GodotEventListeners.add(
				imeElement,
				"keydown",
				keyEventCallback.bind(null, true),
				false,
			);
			GodotEventListeners.add(
				imeElement,
				"keyup",
				keyEventCallback.bind(null, false),
				false,
			);

			imeElement.addEventListener("blur", () => {
				imeElement.style.display = "none";
				GodotConfig.canvas?.focus();
				GodotIME.active = false;
			});

			GodotConfig.canvas?.parentElement?.appendChild(imeElement);
			GodotIME.imeElement = imeElement;
		},

		getModifiers: (pEvent: KeyboardEvent): number => {
			return (Number(pEvent.shiftKey) << 0) +
				(Number(pEvent.altKey) << 1) + (Number(pEvent.ctrlKey) << 2) +
				(Number(pEvent.metaKey) << 3);
		},

		setIMEActive: (pActive: boolean): void => {
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

			GodotIME.active = pActive;
			if (pActive) {
				GodotIME.imeElement.style.display = "block";
				GodotIME.focusTimerIntervalId = setInterval(focusTimer, 100);
			} else {
				GodotIME.imeElement.style.display = "none";
				GodotConfig.canvas?.focus();
			}
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

export interface GamepadSample {
	standard: boolean;
	buttons: number[];
	axes: number[];
	connected: boolean;
}

declare global {
	const GodotInputGamepads: typeof _GodotInputGamepads.$GodotInputGamepads;
}
const _GodotInputGamepads = {
	$GodotInputGamepads__deps: ["$GodotRuntime", "$GodotEventListeners"],
	$GodotInputGamepads: {
		samples: [] as (GamepadSample | null)[],

		init: (
			pOnChange: (
				pPadIndex: number,
				pConnected: boolean,
				pIdPtr: number,
				pGuidPtr: number,
			) => void,
		): void => {
			GodotInputGamepads.samples = [];

			const addPad = (pPad: Gamepad): void => {
				const guid = GodotInputGamepads.getGUID(pPad);
				const idPtr = GodotRuntime.allocString(pPad.id);
				const guidPtr = GodotRuntime.allocString(guid);
				pOnChange(pPad.index, true, idPtr, guidPtr);
			};

			const pads = GodotInputGamepads.getGamepads();
			for (const pad of pads) {
				if (pad == null) {
					continue;
				}
				addPad(pad);
			}

			GodotEventListeners.add(
				globalThis,
				"gamepadconnected",
				(pEvent: GamepadEvent) => {
					if (pEvent.gamepad) {
						// TODO: continue.
					}
				},
			);
		},

		getGamepads: (): (Gamepad | null)[] => {
			try {
				// Will throw in iframe when permission is denied.
				// Will throw/warn in the future for insecure contexts.
				// See https://github.com/w3c/gamepad/pull/120
				const pads = navigator.getGamepads();
				if (pads) {
					return pads;
				}
				return [];
			} catch (_error) {
				return [];
			}
		},

		getSample: (pIndex: number): GamepadSample | null => {
			const samples = GodotInputGamepads.samples;
			return pIndex < samples.length ? samples[pIndex] : null;
		},

		getSamples: (): (GamepadSample | null)[] => {
			return GodotInputGamepads.samples;
		},

		sampleGamepads: (): number => {
			const gamepads = GodotInputGamepads.getGamepads();
			const samples: (GamepadSample | null)[] = [];
			let activeGamepads = 0;
			for (const gamepad of gamepads) {
				if (gamepad == null) {
					samples.push(null);
					continue;
				}

				const gamepadSample = {
					standard: gamepad.mapping === "standard",
					buttons: gamepad.buttons.map((gamepadButtons) =>
						gamepadButtons.value
					),
					axes: [...gamepad.axes],
					connected: gamepad.connected,
				} satisfies GamepadSample;

				samples.push(gamepadSample);
				activeGamepads += 1;
			}
			GodotInputGamepads.samples = samples;
			return activeGamepads;
		},
	},
};
