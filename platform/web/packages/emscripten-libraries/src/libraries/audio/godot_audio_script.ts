/**************************************************************************/
/*  godot_audio_script.ts                                                 */
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

import { ErrorList } from "@godotengine/emscripten-utils/constants";
import {
	asCType,
	type CFloatPointer,
	type CFunctionPointer,
	type CInt,
	type CIntPointer,
} from "@godotengine/emscripten-utils/types";
import { throwIfNullish } from "@godotengine/utils/error";

type AudioScriptStartCallback = () => void;

export const _GodotAudioScript = {
	$GodotAudioScript__deps: ["$GodotAudio", "$GodotRuntime"],
	$GodotAudioScript: {
		script: null as ScriptProcessorNode | null,

		create: (pBufferLength: number, pChannelCount: number): number => {
			const context = GodotAudio.context;
			throwIfNullish(context, new Error("`GodotAudio.context` is null or undefined"));
			GodotAudioScript.script = context.createScriptProcessor(pBufferLength, 2, pChannelCount);
			GodotAudio.driver = GodotAudioScript;
			return GodotAudioScript.script.bufferSize;
		},

		start: (
			pInBufferPtr: CFloatPointer,
			pInBufferSize: number,
			pOutBufferPointer: CFloatPointer,
			pOutBufferSize: number,
			onProcess: () => void,
		): void => {
			const context = GodotAudio.context;
			if (context == null) {
				GodotRuntime.error("`GodotAudio.context` is null or undefined");
				return;
			}

			const script = GodotAudioScript.script;
			if (script == null) {
				GodotRuntime.error("Cannot add a listener to a null object.");
				return;
			}

			script.onaudioprocess = (pEvent) => {
				// Read input.
				const inBuffer = GodotRuntime.heapSub(HEAPF32, pInBufferPtr, pInBufferSize);
				const input = pEvent.inputBuffer;
				if (GodotAudio.input != null) {
					const inLength = input.getChannelData(0).length;
					for (let channel = 0; channel < 2; channel++) {
						const data = input.getChannelData(channel);
						for (let sample = 0; sample < inLength; sample++) {
							inBuffer[sample * 2 + channel] = data[sample];
						}
					}
				}

				// Let Godot process the input/output.
				onProcess();

				// Write the output.
				const outBuffer = GodotRuntime.heapSub(HEAPF32, pOutBufferPointer, pOutBufferSize);
				const output = pEvent.outputBuffer;
				const channels = output.numberOfChannels;
				for (let channel = 0; channel < channels; channel++) {
					const data = output.getChannelData(channel);
					// Loop through samples and assign computed values.
					for (let sample = 0; sample < data.length; sample++) {
						data[sample] = outBuffer[sample * channels + channel];
					}
				}
			};

			script.connect(context.destination);
		},

		getNode: (): ScriptProcessorNode | null => {
			return GodotAudioScript.script;
		},

		close: (): void => {
			const script = GodotAudioScript.script;
			if (script == null) {
				return;
			}
			script.disconnect();
			script.onaudioprocess = null;
			GodotAudioScript.script = null;
		},
	},

	godot_audio_script_create__proxy: "sync",
	godot_audio_script_create__sig: "ipi",
	godot_audio_script_create: (pBufferSizePtr: CIntPointer, pChannelCount: CInt): CInt => {
		const bufferLength = GodotRuntime.getHeapValue(pBufferSizePtr, "i32");
		try {
			const outLength = GodotAudioScript.create(bufferLength, pChannelCount);
			GodotRuntime.setHeapValue(pBufferSizePtr, asCType<CInt>(outLength), "i32");
		} catch (error) {
			GodotRuntime.error("Error starting AudioDriverScriptProcessor", error);
			return ErrorList.FAILED;
		}
		return ErrorList.OK;
	},

	godot_audio_script_start__proxy: "sync",
	godot_audio_script_start__sig: "vpipip",
	godot_audio_script_start: (
		pInBufferPtr: CFloatPointer,
		pInBufferSize: CInt,
		pOutBufferPtr: CFloatPointer,
		pOutBufferSize: CInt,
		pCallbackPtr: CFunctionPointer<AudioScriptStartCallback>,
	): void => {
		const onProcess = GodotRuntime.getFunction(pCallbackPtr);
		GodotAudioScript.start(pInBufferPtr, pInBufferSize, pOutBufferPtr, pOutBufferSize, onProcess);
	},
};

autoAddDeps(_GodotAudioScript, "$GodotAudioScript");
addToLibrary(_GodotAudioScript);
