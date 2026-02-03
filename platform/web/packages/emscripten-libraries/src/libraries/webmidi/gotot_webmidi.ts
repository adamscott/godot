/**************************************************************************/
/*  gotot_webmidi.ts                                                      */
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

import type { CCharArrayPointer, CFunctionPointer, CInt, CUintPointer } from "@godotengine/emscripten-utils/types";
import {
	GodotEventListeners,
	GodotRuntime,
	GodotWebMidi,
	HEAPU8,
	addToLibrary,
	autoAddDeps,
} from "#/external/index.js";

type WebMIDIOpenMIDIInputsCallback = (
	pConnectedInputNamesPtr: CCharArrayPointer,
	pConnectedInputNamesSize: CInt,
) => void;
type WebMIDIOpenMIDIInputsOnMIDIMessageCallback = (
	pDeviceIndex: CInt,
	pStatus: CInt,
	pDataPtr: CUintPointer,
	pDataLength: CInt,
) => void;

export const _GodotWebMidi = {
	$GodotWebMidi__deps: ["$GodotRuntime"],
	$GodotWebMidi: {
		abortControllers: [] as AbortController[],
		isListening: false,
	},

	godot_js_webmidi_open_midi_inputs__deps: ["$GodotWebMidi"],
	godot_js_webmidi_open_midi_inputs__proxy: "sync",
	godot_js_webmidi_open_midi_inputs__sig: "ipppi",
	godot_js_webmidi_open_midi_inputs: (
		pSetInputNamesCallbackPtr: CFunctionPointer<WebMIDIOpenMIDIInputsCallback>,
		pOnMidiMessageCallbackPtr: CFunctionPointer<WebMIDIOpenMIDIInputsOnMIDIMessageCallback>,
		pDataBufferPtr: CUintPointer,
		pDataBufferLength: CInt,
	): CInt => {
		if (GodotWebMidi.isListening) {
			return GodotRuntime.CIntError.OK;
		}
		if (!("requestMIDIAccess" in navigator)) {
			return GodotRuntime.CIntError.ERR_UNAVAILABLE;
		}

		const setInputNamesCallback = GodotRuntime.getFunction(pSetInputNamesCallbackPtr);
		const onMidiMessageCallback = GodotRuntime.getFunction(pOnMidiMessageCallbackPtr);

		GodotWebMidi.isListening = true;
		navigator
			.requestMIDIAccess()
			.then((pMidi) => {
				const inputs = [...Array.from(pMidi.inputs.values())];
				const inputNames = inputs.map((pInput) => pInput.name ?? "");

				const inputNamesPtr = GodotRuntime.allocStringArray(inputNames);
				setInputNamesCallback(inputNamesPtr, GodotRuntime.asCInt(inputNames.length));
				GodotRuntime.freeStringArray(inputNamesPtr, inputNames.length);

				for (const [i, input] of inputs.entries()) {
					const abortController = new AbortController();
					GodotWebMidi.abortControllers.push(abortController);

					GodotEventListeners.add(
						input,
						"midimessage",
						(pEvent: MIDIMessageEvent) => {
							if (pEvent.data == null) {
								// TODO: Handle edge case.
								return;
							}

							const status = pEvent.data[0];
							const data = pEvent.data.slice(1);
							const size = data.length;

							if (size > pDataBufferLength) {
								GodotRuntime.error("MIDI message data length exceeds the buffer size.");
								return;
							}
							HEAPU8.set(data, pDataBufferPtr);

							onMidiMessageCallback(
								GodotRuntime.asCInt(i),
								GodotRuntime.asCInt(status),
								pDataBufferPtr,
								GodotRuntime.asCInt(data.length),
							);
						},
						{ signal: abortController.signal },
					);
				}
			})
			.catch((pError: unknown) => {
				GodotRuntime.error("Error while requesting WebMIDI access:", pError);
			});

		// OK.
		return GodotRuntime.CIntError.OK;
	},

	godot_js_webmidi_close_midi_inputs__proxy: "sync",
	godot_js_webmidi_close_midi_inputs__sig: "v",
	godot_js_webmidi_close_midi_inputs: (): void => {
		for (const abortController of GodotWebMidi.abortControllers) {
			abortController.abort();
		}
		GodotWebMidi.abortControllers = [];
		GodotWebMidi.isListening = false;
	},
};

autoAddDeps(_GodotWebMidi, "$GodotWebMidi");
addToLibrary(_GodotWebMidi);
