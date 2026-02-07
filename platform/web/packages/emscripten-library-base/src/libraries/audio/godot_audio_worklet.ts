/**************************************************************************/
/*  godot_audio_worklet.ts                                                */
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

import type {
	CFloatPointer,
	CFunctionPointer,
	CInt,
	CIntArrayPointer,
	CIntPointer,
	CPointer,
} from "@godotengine/emscripten-utils/types";

import { RingBuffer, type RingBufferInCallback, type RingBufferOutCallback } from "./ring_buffer.js";

type AudioWorkletStateAddOnOutCallback = (pPosition: CInt, pFrames: CInt) => void;
type AudioWorkletStateAddOnInCallback = (pPosition: CInt, pFrames: CInt) => void;

export const _GodotAudioWorklet = {
	$GodotAudioWorklet__deps: ["$GodotAudio", "$GodotConfig", "$GodotEventListeners"] as const,
	$GodotAudioWorklet: {
		promise: null as Promise<void> | null,
		worklet: null as AudioWorkletNode | null,
		ringBuffer: null as RingBuffer | null,
		RingBuffer,

		create: (pChannels: number): void => {
			const context = GodotAudio.context;
			if (context == null) {
				return;
			}
			const path = GodotConfig.locateFile("godot.audio.worklet.js");
			GodotAudioWorklet.promise = context.audioWorklet.addModule(path).then(() => {
				GodotAudioWorklet.worklet = new AudioWorkletNode(context, "godot-processor", {
					outputChannelCount: [pChannels],
				});
			});
			GodotAudio.driver = GodotAudioWorklet;
		},

		start: (pInBuffer: Float32Array, pOutBuffer: Float32Array, pState: Int32Array): void => {
			GodotAudioWorklet.promise
				?.then(() => {
					const context = GodotAudio.context;
					if (context == null) {
						throw new Error("`GodotAudio.context` is null or undefined.");
					}
					const node = GodotAudioWorklet.worklet;
					if (node == null) {
						return;
					}
					node.connect(context.destination);
					node.port.postMessage({
						cmd: "start",
						data: [pState, pInBuffer, pOutBuffer],
					});
					GodotEventListeners.add(node.port, "message", (pEvent: MessageEvent) => {
						GodotRuntime.error(pEvent.data);
					});
				})
				.catch((pError: unknown) => {
					GodotRuntime.error("Error while starting GodotAudioWorklet:", pError);
				});
		},

		startNoThreads: (
			pOutBufferPtr: CFloatPointer,
			pOutBufferSize: number,
			pOutCallback: RingBufferOutCallback,
			pInBufferPtr: CFloatPointer,
			pInBufferSize: number,
			pInCallback: RingBufferInCallback,
		): void => {
			GodotAudioWorklet.ringBuffer = new GodotAudioWorklet.RingBuffer(
				pOutBufferPtr,
				pOutBufferSize,
				pOutCallback,
				pInBufferPtr,
				pInBufferSize,
				pInCallback,
			);
			GodotAudioWorklet.promise
				?.then(() => {
					const context = GodotAudio.context;
					if (context == null) {
						return;
					}
					const node = GodotAudioWorklet.worklet;
					if (node == null) {
						return;
					}
					const buffer = GodotRuntime.heapSlice(HEAPF32, pOutBufferPtr, pOutBufferSize);
					node.connect(context.destination);
					node.port.postMessage({
						cmd: "start_nothreads",
						data: [buffer, pInBufferSize],
					});

					GodotEventListeners.add(node.port, "message", (pEvent: MessageEvent) => {
						const ringBuffer = GodotAudioWorklet.ringBuffer;
						if (ringBuffer == null) {
							return;
						}
						const worklet = GodotAudioWorklet.worklet;
						if (worklet == null) {
							return;
						}
						switch (pEvent.data.cmd) {
							case "read":
								{
									const read = pEvent.data.data as unknown;
									if (typeof read !== "number") {
										throw new TypeError('`read` is not a `"number"`.');
									}
									ringBuffer.consumed(read, worklet.port);
								}
								break;
							case "input":
								{
									const buffer = pEvent.data.data as unknown;
									if (buffer == null) {
										throw new TypeError("`buffer` is null or undefined.");
									}
									if (!(buffer instanceof Float32Array)) {
										throw new TypeError("`buffer` is not a `Float32Array`");
									}
									if (buffer.length > pInBufferSize) {
										GodotRuntime.error("Input chunk is too big.");
										return;
									}
									ringBuffer.receive(buffer);
								}
								break;
							default:
								GodotRuntime.error(pEvent.data);
						}
					});
				})
				.catch((pError: unknown) => {
					GodotRuntime.error("Error while running GodotAudioWorklet promise:", pError);
				});
		},

		getNode: (): AudioWorkletNode | null => {
			return GodotAudioWorklet.worklet;
		},

		close: async (): Promise<void> => {
			if (GodotAudioWorklet.promise == null) {
				return;
			}

			try {
				await GodotAudioWorklet.promise;
				const worklet = GodotAudioWorklet.worklet;
				if (worklet == null) {
					GodotAudioWorklet.promise = null;
					return;
				}
				worklet.port.postMessage({
					cmd: "stop",
					data: null,
				});
				GodotEventListeners.remove(worklet.port, "message");
				GodotAudioWorklet.worklet = null;
				GodotAudioWorklet.promise = null;
			} catch (pError) {
				GodotRuntime.error(pError);
			}
		},
	},

	godot_audio_worklet_create__proxy: "sync",
	godot_audio_worklet_create__sig: "ii",
	godot_audio_worklet_create: (pChannels: CInt): CInt => {
		try {
			GodotAudioWorklet.create(pChannels);
		} catch (pError) {
			GodotRuntime.error("Error starting AudioDriverWorklet", pError);
			return GodotRuntime.CIntError.FAILED;
		}
		return GodotRuntime.CIntError.OK;
	},

	godot_audio_worklet_start__proxy: "sync",
	godot_audio_worklet_start__sig: "vpipip",
	godot_audio_worklet_start: (
		pInBufferPtr: CFloatPointer,
		pInBufferSize: CInt,
		pOutBufferPtr: CFloatPointer,
		pOutBufferSize: CInt,
		pStatePtr: CIntArrayPointer,
	): void => {
		const outBuffer = GodotRuntime.heapSub(HEAPF32, pOutBufferPtr, pOutBufferSize);
		const inBuffer = GodotRuntime.heapSub(HEAPF32, pInBufferPtr, pInBufferSize);
		const state = GodotRuntime.heapSub(HEAP32, pStatePtr, 4);
		GodotAudioWorklet.start(inBuffer, outBuffer, state);
	},

	godot_audio_worklet_start_no_threads__proxy: "sync",
	godot_audio_worklet_start_no_threads__sig: "vpippip",
	godot_audio_worklet_start_no_threads: (
		pOutBufferPtr: CFloatPointer,
		pOutBufferSize: CInt,
		pOutCallbackPtr: CFunctionPointer<AudioWorkletStateAddOnOutCallback>,
		pInBufferPtr: CFloatPointer,
		pInBufferSize: CInt,
		pInCallbackPtr: CFunctionPointer<AudioWorkletStateAddOnInCallback>,
	): void => {
		const outCallback = GodotRuntime.getFunction(pOutCallbackPtr);
		const inCallback = GodotRuntime.getFunction(pInCallbackPtr);
		GodotAudioWorklet.startNoThreads(
			pOutBufferPtr,
			pOutBufferSize,
			(pPosition, pFrames) => {
				outCallback(GodotRuntime.asCInt(pPosition), GodotRuntime.asCInt(pFrames));
			},
			pInBufferPtr,
			pInBufferSize,
			(pPosition, pFrames) => {
				inCallback(GodotRuntime.asCInt(pPosition), GodotRuntime.asCInt(pFrames));
			},
		);
	},

	godot_audio_worklet_state_wait__sig: "ipiii",
	godot_audio_worklet_state_wait: (pStatePtr: CIntPointer, pIndex: CInt, pExpected: CInt, pTimeout: CInt): CInt => {
		Atomics.wait(HEAP32, (pStatePtr >> 2) + pIndex, pExpected, pTimeout);
		return GodotRuntime.asCInt(Atomics.load(HEAP32, (pStatePtr >> 2) + pIndex));
	},

	godot_audio_worklet_state_add__sig: "ipii",
	godot_audio_worklet_state_add: (pStatePtr: CPointer, pIndex: CInt, pValue: CInt): CInt => {
		return GodotRuntime.asCInt(Atomics.add(HEAP32, (pStatePtr >> 2) + pIndex, pValue));
	},

	godot_audio_worklet_state_get__sig: "ipi",
	godot_audio_worklet_state_get: (pStatePtr: CPointer, pIdx: CInt): CInt => {
		return GodotRuntime.asCInt(Atomics.load(HEAP32, (pStatePtr >> 2) + pIdx));
	},
};
autoAddDeps(_GodotAudioWorklet, "$GodotAudioWorklet");
addToLibrary(_GodotAudioWorklet);
