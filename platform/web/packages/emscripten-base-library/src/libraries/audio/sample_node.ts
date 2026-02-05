/**************************************************************************/
/*  sample_node.ts                                                        */
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

import type { LoopMode, Sample } from "./sample.js";
import { getNullishErrorString as $getNullishErrorString } from "@godotengine/utils/macros" with { type: "macro" };
import type { Bus } from "./bus.js";
import type { SampleNodeBus } from "./sample_node_bus.js";

export interface SampleNodeParams {
	id: string;
	streamObjectId: string;
	busIndex: number;
}

export interface SampleNodeOptions {
	offset: number;
	playbackRate: number;
	startTime: number;
	pitchScale: number;
	loopMode: LoopMode;
	volume: Float32Array;
	start: boolean;
}

export class SampleNode {
	id: string;
	streamObjectId: string;
	offset: number;
	_playbackPosition: number;
	startTime: number;
	isPaused: boolean;
	isStarted: boolean;
	isCanceled: boolean;
	pauseTime: number;
	_playbackRate = 44100;
	loopMode: LoopMode;
	_pitchScale: number;
	_sourceStartTime: number;
	_sampleNodeBuses: Map<Bus, SampleNodeBus>;
	_source: AudioBufferSourceNode | null;
	_onEnded: ((event: Event) => void) | null;
	_positionWorklet: AudioWorkletNode | null;

	static getSampleNode(pId: string): SampleNode {
		if (!GodotAudio.sampleNodes.has(pId)) {
			throw new ReferenceError(`Could not find sample node "${pId}"`);
		}
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- We just checked if it `sampleNodes` has `pId`.
		return GodotAudio.sampleNodes.get(pId)!;
	}

	static getSampleNodeOrNull(pId: string): SampleNode | null {
		return GodotAudio.sampleNodes.get(pId) ?? null;
	}

	static stopSampleNode(pId: string): void {
		const sampleNode = GodotAudio.SampleNode.getSampleNodeOrNull(pId);
		if (sampleNode == null) {
			return;
		}
		sampleNode.stop();
	}

	static pauseSampleNode(pId: string, enable: boolean): void {
		const sampleNode = GodotAudio.SampleNode.getSampleNodeOrNull(pId);
		if (sampleNode == null) {
			return;
		}
		sampleNode.pause(enable);
	}

	static create(pParams: SampleNodeParams, pOptions: Partial<SampleNodeOptions> = {}): SampleNode {
		const sampleNode = new GodotAudio.SampleNode(pParams, pOptions);
		GodotAudio.sampleNodes.set(pParams.id, sampleNode);
		return sampleNode;
	}

	static delete(pId: string): void {
		GodotAudio.sampleNodes.delete(pId);
	}

	constructor(pParams: SampleNodeParams, pOptions: Partial<SampleNodeOptions> = {}) {
		const context = GodotAudio.context;
		if (context == null) {
			throw new TypeError($getNullishErrorString("GodotAudio.context"));
		}

		this.id = pParams.id;
		this.streamObjectId = pParams.streamObjectId;
		this.offset = pOptions.offset ?? 0;
		this._playbackPosition = pOptions.offset ?? 0;
		this.startTime = pOptions.startTime ?? 0;
		this.isPaused = false;
		this.isStarted = false;
		this.isCanceled = false;
		this.pauseTime = 0;
		this._playbackRate = 44100;
		this.loopMode = pOptions.loopMode ?? this.getSample().loopMode;
		this._pitchScale = pOptions.pitchScale ?? 1;
		this._sourceStartTime = 0;
		this._sampleNodeBuses = new Map();
		this._source = context.createBufferSource();

		this._onEnded = null;
		this._positionWorklet = null;

		this.setPlaybackRate(pOptions.playbackRate ?? 44100);
		this._source.buffer = this.getSample().getAudioBuffer();

		this._addEndedListener();

		const bus = GodotAudio.Bus.getBus(pParams.busIndex);
		const sampleNodeBus = this.getSampleNodeBus(bus);

		if (pOptions.volume != null) {
			sampleNodeBus.setVolume(pOptions.volume);
		}

		this.connectPositionWorklet(pOptions.start).catch((pError: unknown) => {
			const newErr = new Error("Failed to create PositionWorklet.");
			newErr.cause = pError;
			GodotRuntime.error(newErr);
		});
	}

	getPlaybackRate(): number {
		return this._playbackRate;
	}

	getPlaybackPosition(): number {
		return this._playbackPosition;
	}

	setPlaybackRate(pPlaybackRate: number): void {
		this._playbackRate = pPlaybackRate;
		this._syncPlaybackRate();
	}

	getPitchScale(): number {
		return this._pitchScale;
	}

	setPitchScale(pPitchScale: number): void {
		this._pitchScale = pPitchScale;
		this._syncPlaybackRate();
	}

	getSample(): Sample {
		return GodotAudio.Sample.getSample(this.streamObjectId);
	}

	getOutputNode(): AudioNode | null {
		return this._source;
	}

	start(): void {
		if (this.isStarted) {
			return;
		}
		this._resetSourceStartTime();
		if (this._source == null) {
			throw new Error("Source is null.");
		}
		this._source.start(this.startTime, this.offset);
		this.isStarted = true;
	}

	stop(): void {
		this.clear();
	}

	restart(): void {
		this.isPaused = false;
		this.pauseTime = 0;
		this._resetSourceStartTime();
		this._restart();
	}

	pause(pEnable = true): void {
		if (pEnable) {
			this._pause();
			return;
		}
		this._unpause();
	}

	connect(pNode: AudioNode): AudioNode {
		const outputNode = this.getOutputNode();
		if (outputNode == null) {
			throw new Error("Output node is null");
		}
		return outputNode.connect(pNode);
	}

	setVolumes(pBuses: Bus[], pVolumes: Float32Array): void {
		for (let busIndex = 0; busIndex < pBuses.length; busIndex++) {
			const sampleNodeBus = this.getSampleNodeBus(pBuses[busIndex]);
			sampleNodeBus.setVolume(
				pVolumes.slice(
					busIndex * GodotAudio.MAX_VOLUME_CHANNELS,
					busIndex * GodotAudio.MAX_VOLUME_CHANNELS + GodotAudio.MAX_VOLUME_CHANNELS,
				),
			);
		}
	}

	getSampleNodeBus(pBus: Bus): SampleNodeBus {
		if (this._sampleNodeBuses.has(pBus)) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- We just checked if it `sampleNodesBuses` has `pBus`.
			return this._sampleNodeBuses.get(pBus)!;
		}

		const sampleNodeBus = GodotAudio.SampleNodeBus.create(pBus);
		this._sampleNodeBuses.set(pBus, sampleNodeBus);
		if (this._source == null) {
			throw new Error("Source is null.");
		}
		const sampleInputNode = sampleNodeBus.getInputNode();
		if (sampleInputNode == null) {
			throw new Error("Sample input node is null");
		}
		this._source.connect(sampleInputNode);
		return sampleNodeBus;
	}

	/**
	 * Sets up and connects the source to the GodotPositionReportingProcessor.
	 * If the worklet module is not loaded in, it will be added.
	 */
	async connectPositionWorklet(pStart = false): Promise<void> {
		await GodotAudio.audioPositionWorkletPromise;
		if (this.isCanceled) {
			return;
		}
		if (this._source == null) {
			throw new Error("Source is null");
		}
		this._source.connect(this.getPositionWorklet());
		if (pStart) {
			this.start();
		}
	}

	getPositionWorklet(): AudioWorkletNode {
		const context = GodotAudio.context;
		if (context == null) {
			throw new TypeError($getNullishErrorString("GodotAudio.context"));
		}
		if (this._positionWorklet != null) {
			return this._positionWorklet;
		}
		this._positionWorklet = new AudioWorkletNode(context, "godot-position-reporting-processor");
		GodotEventListeners.add(this._positionWorklet.port, "message", (pEvent: MessageEvent) => {
			switch (pEvent.data.type) {
				case "position":
					{
						const eventData = pEvent.data.data as unknown;
						if (eventData == null) {
							throw new TypeError($getNullishErrorString("pEvent.data.data"));
						}
						if (typeof eventData !== "string") {
							throw new TypeError(`\`pEvent.data.data\` is not \`string\` (\`${typeof eventData}\`).`);
						}
						this._playbackPosition = parseInt(eventData, 10) / this.getSample().sampleRate + this.offset;
					}
					break;
				default:
				// Do nothing.
			}
		});
		return this._positionWorklet;
	}

	clear(): void {
		this.isCanceled = true;
		this.isPaused = false;
		this.pauseTime = 0;

		if (this._source != null) {
			if (this._onEnded != null) {
				GodotEventListeners.remove(this._source, "ended", this._onEnded);
			}
			this._onEnded = null;
			if (this.isStarted) {
				this._source.stop();
			}
			this._source.disconnect();
			this._source = null;
		}

		for (const sampleNodeBus of this._sampleNodeBuses.values()) {
			sampleNodeBus.clear();
		}
		this._sampleNodeBuses.clear();

		if (this._positionWorklet != null) {
			this._positionWorklet.disconnect();
			GodotEventListeners.remove(this._positionWorklet.port, "message");
			this._positionWorklet.port.postMessage({ type: "ended" });
			this._positionWorklet = null;
		}

		GodotAudio.SampleNode.delete(this.id);
	}

	_resetSourceStartTime(): void {
		const context = GodotAudio.context;
		if (context == null) {
			return;
		}
		this._sourceStartTime = context.currentTime;
	}

	_syncPlaybackRate(): void {
		if (this._source == null) {
			throw new TypeError($getNullishErrorString("_source"));
		}
		this._source.playbackRate.value = this.getPlaybackRate() * this.getPitchScale();
	}

	_restart(): void {
		const context = GodotAudio.context;
		if (context == null) {
			return;
		}
		if (this._source != null) {
			this._source.disconnect();
		}
		this._source = context.createBufferSource();
		this._source.buffer = this.getSample().getAudioBuffer();

		// Make sure that we connect the new source to the sample node bus.
		for (const sampleNodeBus of this._sampleNodeBuses.values()) {
			const sampleInputNode = sampleNodeBus.getInputNode();
			if (sampleInputNode == null) {
				throw new Error("Sample input node is null.");
			}
			this.connect(sampleInputNode);
		}

		this._addEndedListener();
		const pauseTime = this.isPaused ? this.pauseTime : 0;
		if (this._positionWorklet != null) {
			this._positionWorklet.port.postMessage({ type: "clear" });
			this._source.connect(this._positionWorklet);
		}
		this._source.start(this.startTime, this.offset + pauseTime);
		this.isStarted = true;
	}

	_pause(): void {
		const context = GodotAudio.context;
		if (context == null) {
			return;
		}
		if (!this.isStarted) {
			return;
		}
		this.isPaused = true;
		this.pauseTime = (context.currentTime - this._sourceStartTime) / this.getPlaybackRate();
		if (this._source == null) {
			throw new Error("Source is null.");
		}
		this._source.stop();
	}

	_unpause(): void {
		this._restart();
		this.isPaused = false;
		this.pauseTime = 0;
	}

	_addEndedListener(): void {
		if (this._source == null) {
			throw new Error("Source is null");
		}

		if (this._onEnded != null) {
			GodotEventListeners.remove(this._source, "ended", this._onEnded);
		}

		this._onEnded = (_pEvent) => {
			if (this.isPaused) {
				return;
			}

			switch (this.getSample().loopMode) {
				case "disabled":
					{
						const id = this.id;
						this.stop();
						if (GodotAudio.sampleFinishedCallback != null) {
							const idCharPtr = GodotRuntime.allocString(id);
							GodotAudio.sampleFinishedCallback(idCharPtr);
							GodotRuntime.free(idCharPtr);
						}
					}
					break;
				case "forward":
				case "backward":
					this.restart();
					break;
				default:
				// do nothing
			}
		};
		GodotEventListeners.add(this._source, "ended", this._onEnded);
	}
}
