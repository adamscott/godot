/**************************************************************************/
/*  sample.ts                                                             */
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

import { getNullishErrorString as $getNullishErrorString } from "@godotengine/utils/macros" with { type: "macro" };

const LOOP_MODE_VALUES = ["disabled", "forward", "backward", "pingpong"] as const;
export type LoopMode = (typeof LOOP_MODE_VALUES)[number];

export function isLoopMode(pValue: string): pValue is LoopMode {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- We are certain that LOOP_MODE_VALUES only contain strings.
	return (LOOP_MODE_VALUES as unknown as string[]).includes(pValue);
}

export interface SampleParams {
	id: string;
	audioBuffer: AudioBuffer;
}

export interface SampleOptions {
	numberOfChannels: number;
	sampleRate: number;
	loopMode: LoopMode;
	loopBegin: number;
	loopEnd: number;
}

export class Sample {
	id: string;
	_audioBuffer: AudioBuffer | null;
	numberOfChannels: number;
	sampleRate: number;
	loopMode: LoopMode;
	loopBegin: number;
	loopEnd: number;

	static getSample(pId: string): Sample {
		if (!GodotAudio.samples.has(pId)) {
			throw new ReferenceError(`Could not find sample "${pId}"`);
		}
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- We just checked if it `samples` has `pId`.
		return GodotAudio.samples.get(pId)!;
	}

	static getSampleOrNull(pId: string): Sample | null {
		return GodotAudio.samples.get(pId) ?? null;
	}

	static create(pParams: SampleParams, pOptions: Partial<SampleOptions> = {}): Sample {
		const sample = new GodotAudio.Sample(pParams, pOptions);
		GodotAudio.samples.set(pParams.id, sample);
		return sample;
	}

	static delete(pId: string): void {
		GodotAudio.samples.delete(pId);
	}

	constructor(pParams: SampleParams, pOptions: Partial<SampleOptions> = {}) {
		this.id = pParams.id;
		this._audioBuffer = null;
		this.numberOfChannels = pOptions.numberOfChannels ?? 2;
		this.sampleRate = pOptions.sampleRate ?? 44100;
		this.loopMode = pOptions.loopMode ?? "disabled";
		this.loopBegin = pOptions.loopBegin ?? 0;
		this.loopEnd = pOptions.loopEnd ?? 0;

		this.setAudioBuffer(pParams.audioBuffer);
	}

	getAudioBuffer(): AudioBuffer {
		return this._duplicateAudioBuffer();
	}

	setAudioBuffer(pAudioBuffer: AudioBuffer | null): void {
		this._audioBuffer = pAudioBuffer;
	}

	clear(): void {
		this.setAudioBuffer(null);
		GodotAudio.Sample.delete(this.id);
	}

	_duplicateAudioBuffer(): AudioBuffer {
		if (this._audioBuffer == null) {
			throw new TypeError("Couldn't duplicate a null audioBuffer");
		}
		const context = GodotAudio.context;
		if (context == null) {
			throw new TypeError($getNullishErrorString("GodotAudio.context"));
		}
		const channels = new Array<Float32Array<ArrayBuffer>>(this._audioBuffer.numberOfChannels);
		for (let i = 0; i < this._audioBuffer.numberOfChannels; i++) {
			const channel = new Float32Array(this._audioBuffer.getChannelData(i));
			channels[i] = channel;
		}
		const buffer = context.createBuffer(
			this.numberOfChannels,
			this._audioBuffer.length,
			this._audioBuffer.sampleRate,
		);
		for (let i = 0; i < channels.length; i++) {
			buffer.copyToChannel(channels[i], i, 0);
		}
		return buffer;
	}
}
