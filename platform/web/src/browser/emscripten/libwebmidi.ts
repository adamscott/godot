/**************************************************************************/
/*  libwebmidi.ts                                                         */
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
import "+browser/types/extensions/midiinputmap_maplike.ts";

// __emscripten_import_global_const_start
import { addToLibrary, autoAddDeps, HEAPU8 } from "./emscripten_lib.ts";
import { GodotRuntime } from "./runtime.ts";
import { GodotEventListeners } from "./os.ts";
// __emscripten_import_global_const_end

import {
	CCharArrayPointer,
	CInt,
	CUintPointer,
	CVoidPointer,
} from "./emscripten_lib.ts";

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

// __emscripten_declare_global_const_start
export declare const GodotWebMidi: typeof _GodotWebMidi.$GodotWebMidi;
// __emscripten_declare_global_const_end
const _GodotWebMidi = {
	$GodotWebMidi__deps: ["$GodotRuntime"],
	$GodotWebMidi: {
		abortControllers: [] as AbortController[],
		isListening: false,
	},

	godot_js_webmidi_open_midi_inputs__deps: ["$GodotWebMidi"],
	godot_js_webmidi_open_midi_inputs__proxy: "sync",
	godot_js_webmidi_open_midi_inputs__sig: "ipppi",
	godot_js_webmidi_open_midi_inputs: (
		pSetInputNamesCallbackPtr: CVoidPointer,
		pOnMidiMessageCallbackPtr: CVoidPointer,
		pDataBufferPtr: CUintPointer,
		pDataBufferLength: CInt,
	): CInt => {
		if (GodotWebMidi.isListening) {
			// OK.
			return 0 as CInt;
		}
		if (!("requestMIDIAccess" in navigator)) {
			// ERR_UNAVAILABLE.
			return 2 as CInt;
		}

		const setInputNamesCallback = GodotRuntime.getFunction<
			WebMIDIOpenMIDIInputsCallback
		>(pSetInputNamesCallbackPtr);
		const onMidiMessageCallback = GodotRuntime.getFunction<
			WebMIDIOpenMIDIInputsOnMIDIMessageCallback
		>(pOnMidiMessageCallbackPtr);

		GodotWebMidi.isListening = true;
		navigator.requestMIDIAccess().then((pMidi) => {
			const inputs = [...Array.from(pMidi.inputs.values())];
			const inputNames = inputs.map((pInput) => pInput.name ?? "");

			const inputNamesPtr = GodotRuntime.allocStringArray(inputNames);
			setInputNamesCallback(inputNamesPtr, inputNames.length as CInt);
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
							GodotRuntime.error(
								"MIDI message data length exceeds the buffer size.",
							);
							return;
						}
						HEAPU8.set(data, pDataBufferPtr);

						onMidiMessageCallback(
							i as CInt,
							status as CInt,
							pDataBufferPtr,
							data.length as CInt,
						);
					},
					{ signal: abortController.signal },
				);
			}
		});

		// OK.
		return 0 as CInt;
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
