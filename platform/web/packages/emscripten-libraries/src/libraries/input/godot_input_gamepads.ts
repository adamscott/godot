/**************************************************************************/
/*  godot_input_gamepads.ts                                               */
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

import {
	GodotEventListeners,
	GodotInputGamepads,
	GodotOS,
	GodotRuntime,
	addToLibrary,
	autoAddDeps,
} from "#/external/index.js";

import type { CPointer } from "@godotengine/emscripten-utils/types";

export interface GodotInputGamepadSample {
	standard: boolean;
	buttons: number[];
	axes: number[];
	connected: boolean;
}

export const _GodotInputGamepads = {
	$GodotInputGamepads__deps: ["$GodotRuntime", "$GodotEventListeners"],
	$GodotInputGamepads: {
		samples: [] as Array<GodotInputGamepadSample | null>,

		initialize: (
			pOnChange: (pPadIndex: number, pConnected: boolean, pIdPtr?: CPointer, pGuidPtr?: CPointer) => void,
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

			GodotEventListeners.add(globalThis, "gamepadconnected", (pEvent: GamepadEvent) => {
				addPad(pEvent.gamepad);
			});

			GodotEventListeners.add(globalThis, "gamepaddisconnected", (pEvent: GamepadEvent) => {
				pOnChange(pEvent.gamepad.index, false);
			});
		},

		getGamepads: (): Array<Gamepad | null> => {
			try {
				// Will throw in iframe when permission is denied.
				// Will throw/warn in the future for insecure contexts.
				// See https://github.com/w3c/gamepad/pull/120
				return navigator.getGamepads();
			} catch (_eError: unknown) {
				return [];
			}
		},

		getSample: (pIndex: number): GodotInputGamepadSample | null => {
			const samples = GodotInputGamepads.samples;
			return pIndex < samples.length ? samples[pIndex] : null;
		},

		getSamples: (): Array<GodotInputGamepadSample | null> => {
			return GodotInputGamepads.samples;
		},

		sampleGamepads: (): number => {
			const gamepads = GodotInputGamepads.getGamepads();
			const samples: Array<GodotInputGamepadSample | null> = [];
			let activeGamepads = 0;
			for (const gamepad of gamepads) {
				if (gamepad == null) {
					samples.push(null);
					continue;
				}

				const gamepadSample = {
					standard: gamepad.mapping === "standard",
					buttons: gamepad.buttons.map((gamepadButtons) => gamepadButtons.value),
					axes: [...gamepad.axes],
					connected: gamepad.connected,
				} satisfies GodotInputGamepadSample;

				samples.push(gamepadSample);
				activeGamepads += 1;
			}
			GodotInputGamepads.samples = samples;
			return activeGamepads;
		},

		getGUID: (pGamepad: Gamepad): string => {
			if (pGamepad.mapping !== "") {
				return pGamepad.mapping;
			}
			const operatingSystem = GodotOS.getCurrentOS();
			const id = pGamepad.id;
			// Chrom* style: NAME (Vendor: xxxx Product: xxxx).
			// eslint-disable-next-line prefer-named-capture-group -- Both regex have two groups of chars.
			const chromiumRegExp = /vendor: ([0-9a-f]{4}) product: ([0-9a-f]{4})/iv;
			// Firefox/Safari style (Safari may remove leading zeroes).
			// eslint-disable-next-line prefer-named-capture-group -- Both regex have two groups of chars.
			const nonChromiumRegExp = /^([0-9a-f]+)-([0-9a-f]+)-/iv;
			let vendor = "";
			let product = "";

			let match = chromiumRegExp.exec(id);
			match ??= nonChromiumRegExp.exec(id);
			if (match != null) {
				vendor = match[1].padStart(4, "0");
				product = match[2].padStart(4, "0");
			}
			if (vendor === "" || product === "") {
				return `${operatingSystem}Unknown`;
			}
			return operatingSystem + vendor + product;
		},
	},
};

autoAddDeps(_GodotInputGamepads, "$GodotInputGamepads");
addToLibrary(_GodotInputGamepads);
