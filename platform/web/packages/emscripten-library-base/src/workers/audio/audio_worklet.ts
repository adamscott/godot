/**************************************************************************/
/*  audio_worklet.ts                                                      */
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

import type { AudioWorkletProcessorConstructorOptions, Input, Output } from "./types.js";
import { type RingBuffer, RingBufferNonThreaded, RingBufferThreaded } from "./ring_buffer.js";
import type { GodotAudioWorkletPostMessage } from "#/shared/audio/index.js";

function hasInputOutputData(pInputOutput: Array<Input | Output>): boolean {
	return pInputOutput.length > 0 && pInputOutput[0].length > 0 && pInputOutput[0][0].length > 0;
}

function writeOutput(pOutput: Output, pSource: Float32Array): void {
	const channels = pOutput.length;
	for (let ch = 0; ch < channels; ch++) {
		for (let sample = 0; sample < pOutput[ch].length; sample++) {
			pOutput[ch][sample] = pSource[sample * channels + ch];
		}
	}
}

function readInput(pInput: Input, pSource: Float32Array): void {
	const channels = pInput.length;
	for (let ch = 0; ch < channels; ch++) {
		for (let sample = 0; sample < pInput[ch].length; sample++) {
			pSource[sample * channels + ch] = pInput[ch][sample];
		}
	}
}

class GodotProcessor extends AudioWorkletProcessor {
	hasThreadSupport: boolean;
	running: boolean;

	lock: Int32Array | null;
	notifier: Int32Array | null;

	output: RingBuffer | null;
	outputBuffer: Float32Array;
	input: RingBuffer | null;
	inputBuffer: Float32Array;

	constructor(_pOptions: AudioWorkletProcessorConstructorOptions) {
		super();
		this.hasThreadSupport = false;
		this.running = true;
		this.lock = null;
		this.notifier = null;
		this.output = null;
		this.outputBuffer = new Float32Array();
		this.input = null;
		this.inputBuffer = new Float32Array();
		this.port.addEventListener("message", (pEvent) => {
			this.parseMessage({
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- We trust the contents of the event data.
				command: pEvent.data.cmd,
				// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- We trust the contents of the event data.
				data: pEvent.data.data,
			});
		});
	}

	processNotify(): void {
		if (this.notifier == null) {
			return;
		}
		Atomics.add(this.notifier, 0, 1);
		Atomics.notify(this.notifier, 0);
	}

	parseMessage(pMessage: GodotAudioWorkletPostMessage): void {
		switch (pMessage.command) {
			case "start":
				{
					const data = pMessage.data;
					const state = data[0];
					let idx = 0;
					this.hasThreadSupport = true;
					/* eslint-disable no-plusplus, no-useless-assignment -- Easier to increment. */
					this.lock = state.subarray(idx, ++idx);
					this.notifier = state.subarray(idx, ++idx);
					const availableInput = state.subarray(idx, ++idx);
					const availableOutput = state.subarray(idx, ++idx);
					/* eslint-enable no-plusplus, no-useless-assignment */
					this.input = new RingBufferThreaded(data[1], availableInput);
					this.output = new RingBufferThreaded(data[2], availableOutput);
				}
				break;
			case "stop":
				this.running = false;
				this.output = null;
				this.input = null;
				this.lock = null;
				this.notifier = null;
				break;
			case "start_nothreads":
				{
					const data = pMessage.data;
					this.output = new RingBufferNonThreaded(data[0], data[0].length);
				}
				break;
			case "chunk":
				{
					const data = pMessage.data;
					if (this.output == null) {
						throw new Error("`this.output` is null.");
					}
					this.output.write(data);
				}
				break;
			case "read": {
				throw new Error('GodotProcessor was not expecting to receive a `"read"` command.');
			}
		}
	}

	process(pInputs: Input[], pOutputs: Output[], _pParameters: Record<string, Float32Array>): boolean {
		if (!this.running) {
			return false; // Stop processing.
		}
		if (this.input == null || this.output === null) {
			return true; // Not ready yet, keep processing.
		}
		if (hasInputOutputData(pInputs)) {
			const input = pInputs[0];
			const chunk = input[0].length * input.length;
			if (this.inputBuffer.length !== chunk) {
				this.inputBuffer = new Float32Array(chunk);
			}
			if (!this.hasThreadSupport) {
				readInput(input, this.inputBuffer);
				this.port.postMessage({ cmd: "input", data: this.inputBuffer });
			} else if (this.input.spaceLeft() >= chunk) {
				readInput(input, this.inputBuffer);
				this.input.write(this.inputBuffer);
			} else {
				// this.port.postMessage('Input buffer is full! Skipping input frame.'); // Uncomment this line to debug input buffer.
			}
		}
		if (hasInputOutputData(pOutputs)) {
			const output = pOutputs[0];
			const chunk = output[0].length * output.length;
			if (this.outputBuffer.length !== chunk) {
				this.outputBuffer = new Float32Array(chunk);
			}
			if (this.output.dataLeft() >= chunk) {
				this.output.read(this.outputBuffer);
				writeOutput(output, this.outputBuffer);
				if (!this.hasThreadSupport) {
					this.port.postMessage({ command: "read", data: chunk } satisfies GodotAudioWorkletPostMessage);
				}
			} else {
				// this.port.postMessage('Output buffer has not enough frames! Skipping output frame.'); // Uncomment this line to debug output buffer.
			}
		}
		this.processNotify();
		return true;
	}
}

registerProcessor("godot-processor", GodotProcessor);
