/**************************************************************************/
/*  audio.ts                                                              */
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

export declare const GodotAudio: typeof _GodotAudio.$GodotAudio;

export type LoopMode = "disabled" | "forward" | "backward" | "pingpong";

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

class Sample {
	id: string;
	#audioBuffer: AudioBuffer | null;
	numberOfChannels: number;
	sampleRate: number;
	loopMode: LoopMode;
	loopBegin: number;
	loopEnd: number;

	static getSample(pId: string): Sample {
		if (!GodotAudio.samples.has(pId)) {
			throw new ReferenceError(`Could not find sample "${pId}"`);
		}
		return GodotAudio.samples.get(pId)!;
	}

	static getSampleOrNull(pId: string): Sample | null {
		return GodotAudio.samples.get(pId) ?? null;
	}

	static create(
		pParams: SampleParams,
		pOptions: Partial<SampleOptions> = {},
	): Sample {
		const sample = new GodotAudio.Sample(pParams, pOptions);
		GodotAudio.samples.set(pParams.id, sample);
		return sample;
	}

	static delete(pId: string): void {
		GodotAudio.samples.delete(pId);
	}

	constructor(pParams: SampleParams, pOptions: Partial<SampleOptions> = {}) {
		this.id = pParams.id;
		this.#audioBuffer = null;
		this.numberOfChannels = pOptions.numberOfChannels ?? 2;
		this.sampleRate = pOptions.sampleRate ?? 44100;
		this.loopMode = pOptions.loopMode ?? "disabled";
		this.loopBegin = pOptions.loopBegin ?? 0;
		this.loopEnd = pOptions.loopEnd ?? 0;

		this.setAudioBuffer(pParams.audioBuffer);
	}

	getAudioBuffer(): AudioBuffer {
		return this.#duplicateAudioBuffer();
	}

	setAudioBuffer(pAudioBuffer: AudioBuffer | null): void {
		this.#audioBuffer = pAudioBuffer;
	}

	clear() {
		this.setAudioBuffer(null);
		GodotAudio.Sample.delete(this.id);
	}

	#duplicateAudioBuffer(): AudioBuffer {
		if (this.#audioBuffer == null) {
			throw new Error("couldn't duplicate a null audioBuffer");
		}
		const channels = new Array<Float32Array>(
			this.#audioBuffer.numberOfChannels,
		);
		for (let i = 0; i < this.#audioBuffer.numberOfChannels; i++) {
			const channel = new Float32Array(
				this.#audioBuffer.getChannelData(i),
			);
			channels[i] = channel;
		}
		const buffer = GodotAudio.audioContext.createBuffer(
			this.numberOfChannels,
			this.#audioBuffer.length,
			this.#audioBuffer.sampleRate,
		);
		for (let i = 0; i < channels.length; i++) {
			buffer.copyToChannel(channels[i], i, 0);
		}
		return buffer;
	}
}

class SampleNodeBus {
	#bus: Bus | null;
	#channelSplitter: ChannelSplitterNode | null;
	#lChannel: GainNode | null;
	#rChannel: GainNode | null;
	#slChannel: GainNode | null;
	#srChannel: GainNode | null;
	#cChannel: GainNode | null;
	#lfeChannel: GainNode | null;
	#channelMerger: ChannelMergerNode | null;

	static create(pBus: Bus): SampleNodeBus {
		return new GodotAudio.SampleNodeBus(pBus);
	}

	constructor(pBus: Bus) {
		const NUMBER_OF_WEB_CHANNELS = 6;

		this.#bus = pBus;
		this.#channelSplitter = GodotAudio.audioContext.createChannelSplitter(
			NUMBER_OF_WEB_CHANNELS,
		);
		this.#lChannel = GodotAudio.audioContext.createGain();
		this.#rChannel = GodotAudio.audioContext.createGain();
		this.#slChannel = GodotAudio.audioContext.createGain();
		this.#srChannel = GodotAudio.audioContext.createGain();
		this.#cChannel = GodotAudio.audioContext.createGain();
		this.#lfeChannel = GodotAudio.audioContext.createGain();
		this.#channelMerger = GodotAudio.audioContext.createChannelMerger(
			NUMBER_OF_WEB_CHANNELS,
		);

		this.#channelSplitter
			.connect(this.#lChannel, GodotAudio.WebChannel.CHANNEL_L)
			.connect(
				this.#channelMerger,
				GodotAudio.WebChannel.CHANNEL_L,
				GodotAudio.WebChannel.CHANNEL_L,
			);
		this.#channelSplitter
			.connect(this.#rChannel, GodotAudio.WebChannel.CHANNEL_R)
			.connect(
				this.#channelMerger,
				GodotAudio.WebChannel.CHANNEL_L,
				GodotAudio.WebChannel.CHANNEL_R,
			);
		this.#channelSplitter
			.connect(this.#slChannel, GodotAudio.WebChannel.CHANNEL_SL)
			.connect(
				this.#channelMerger,
				GodotAudio.WebChannel.CHANNEL_L,
				GodotAudio.WebChannel.CHANNEL_SL,
			);
		this.#channelSplitter
			.connect(this.#srChannel, GodotAudio.WebChannel.CHANNEL_SR)
			.connect(
				this.#channelMerger,
				GodotAudio.WebChannel.CHANNEL_L,
				GodotAudio.WebChannel.CHANNEL_SR,
			);
		this.#channelSplitter
			.connect(this.#cChannel, GodotAudio.WebChannel.CHANNEL_C)
			.connect(
				this.#channelMerger,
				GodotAudio.WebChannel.CHANNEL_L,
				GodotAudio.WebChannel.CHANNEL_C,
			);
		this.#channelSplitter
			.connect(this.#lfeChannel, GodotAudio.WebChannel.CHANNEL_L)
			.connect(
				this.#channelMerger,
				GodotAudio.WebChannel.CHANNEL_L,
				GodotAudio.WebChannel.CHANNEL_LFE,
			);

		this.#channelMerger.connect(this.#bus.getInputNode());
	}

	getInputNode(): AudioNode | null {
		return this.#channelSplitter;
	}

	getOutputNode(): AudioNode | null {
		return this.#channelMerger;
	}

	setVolume(pVolume: Float32Array): void {
		if (pVolume.length !== GodotAudio.MAX_VOLUME_CHANNELS) {
			throw new Error(
				`Volume length isn't "${GodotAudio.MAX_VOLUME_CHANNELS}", is ${pVolume.length} instead`,
			);
		}
		if (
			this.#lChannel == null || this.#rChannel == null ||
			this.#slChannel == null || this.#srChannel == null ||
			this.#cChannel == null || this.#lfeChannel == null
		) {
			throw new Error("Channels are null");
		}

		this.#lChannel.gain.value =
			pVolume[GodotAudio.GodotChannel.CHANNEL_L] ??
				0;
		this.#rChannel.gain.value =
			pVolume[GodotAudio.GodotChannel.CHANNEL_R] ??
				0;
		this.#slChannel.gain.value =
			pVolume[GodotAudio.GodotChannel.CHANNEL_SL] ?? 0;
		this.#srChannel.gain.value =
			pVolume[GodotAudio.GodotChannel.CHANNEL_SR] ?? 0;
		this.#cChannel.gain.value =
			pVolume[GodotAudio.GodotChannel.CHANNEL_C] ??
				0;
		this.#lfeChannel.gain.value =
			pVolume[GodotAudio.GodotChannel.CHANNEL_LFE] ?? 0;
	}

	clear(): void {
		this.#bus = null;
		this.#channelSplitter?.disconnect();
		this.#channelSplitter = null;
		this.#lChannel?.disconnect();
		this.#lChannel = null;
		this.#rChannel?.disconnect();
		this.#rChannel = null;
		this.#slChannel?.disconnect();
		this.#slChannel = null;
		this.#srChannel?.disconnect();
		this.#srChannel = null;
		this.#cChannel?.disconnect();
		this.#cChannel = null;
		this.#lfeChannel?.disconnect();
		this.#lfeChannel = null;
		this.#channelMerger?.disconnect();
		this.#channelMerger = null;
	}
}

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

class SampleNode {
	id: string;
	streamObjectId: string;
	offset: number;
	#playbackPosition: number;
	startTime: number;
	isPaused: boolean;
	isStarted: boolean;
	isCanceled: boolean;
	pauseTime: number;
	#playbackRate = 44100;
	loopMode: LoopMode;
	#pitchScale: number;
	#sourceStartTime: number;
	#sampleNodeBuses: Map<Bus, SampleNodeBus>;
	#source: AudioBufferSourceNode | null;
	#onEnded: ((event: Event) => void) | null;
	#positionWorklet: AudioWorkletNode | null;

	static getSampleNode(pId: string): SampleNode {
		if (!GodotAudio.sampleNodes.has(pId)) {
			throw new ReferenceError(`Could not find sample node "${pId}"`);
		}
		return GodotAudio.sampleNodes.get(pId);
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

	static create(
		pParams: SampleNodeParams,
		pOptions: Partial<SampleNodeOptions> = {},
	): SampleNode {
		const sampleNode = new GodotAudio.SampleNode(pParams, pOptions);
		GodotAudio.sampleNodes.set(pParams.id, sampleNode);
		return sampleNode;
	}

	static delete(pId: string): void {
		GodotAudio.sampleNodes.delete(pId);
	}

	constructor(
		pParams: SampleNodeParams,
		pOptions: Partial<SampleNodeOptions> = {},
	) {
		this.id = pParams.id;
		this.streamObjectId = pParams.streamObjectId;
		this.offset = pOptions.offset ?? 0;
		this.#playbackPosition = pOptions.offset ?? 0;
		this.startTime = pOptions.startTime ?? 0;
		this.isPaused = false;
		this.isStarted = false;
		this.isCanceled = false;
		this.pauseTime = 0;
		this.#playbackRate = 44100;
		this.loopMode = pOptions.loopMode ?? this.getSample().loopMode ??
			"disabled";
		this.#pitchScale = pOptions.pitchScale ?? 1;
		this.#sourceStartTime = 0;
		this.#sampleNodeBuses = new Map();
		this.#source = GodotAudio.audioContext.createBufferSource();

		this.#onEnded = null;
		this.#positionWorklet = null;

		this.setPlaybackRate(pOptions.playbackRate ?? 44100);
		this.#source.buffer = this.getSample().getAudioBuffer();

		this.#addEndedListener();

		const bus = GodotAudio.Bus.getBus(pParams.busIndex);
		const sampleNodeBus = this.getSampleNodeBus(bus);
		sampleNodeBus.setVolume(pOptions.volume);

		this.connectPositionWorklet(pOptions.start).catch((pError) => {
			const newErr = new Error("Failed to create PositionWorklet.");
			newErr.cause = pError;
			GodotRuntime.error(newErr);
		});
	}

	getPlaybackRate(): number {
		return this.#playbackRate;
	}

	getPlaybackPosition(): number {
		return this.#playbackPosition;
	}

	setPlaybackRate(pPlaybackRate: number): void {
		this.#playbackRate = pPlaybackRate;
		this.#syncPlaybackRate();
	}

	getPitchScale(): number {
		return this.#pitchScale;
	}

	setPitchScale(pPitchScale: number): void {
		this.#pitchScale = pPitchScale;
		this.#syncPlaybackRate();
	}

	getSample(): Sample {
		return GodotAudio.Sample.getSample(this.streamObjectId);
	}

	getOutputNode(): AudioNode | null {
		return this.#source;
	}

	start(): void {
		if (this.isStarted) {
			return;
		}
		this.#resetSourceStartTime();
		if (this.#source == null) {
			throw new Error("Source is null.");
		}
		this.#source.start(this.startTime, this.offset);
		this.isStarted = true;
	}

	stop(): void {
		this.clear();
	}

	restart(): void {
		this.isPaused = false;
		this.pauseTime = 0;
		this.#resetSourceStartTime();
		this.#restart();
	}

	pause(pEnable = true): void {
		if (pEnable) {
			this.#pause();
			return;
		}
		this.#unpause();
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
					(busIndex * GodotAudio.MAX_VOLUME_CHANNELS) +
						GodotAudio.MAX_VOLUME_CHANNELS,
				),
			);
		}
	}

	getSampleNodeBus(pBus: Bus): SampleNodeBus {
		if (!this.#sampleNodeBuses.has(pBus)) {
			const sampleNodeBus = GodotAudio.SampleNodeBus.create(pBus);
			this.#sampleNodeBuses.set(pBus, sampleNodeBus);
			if (this.#source == null) {
				throw new Error("Source is null.");
			}
			const sampleInputNode = sampleNodeBus.getInputNode();
			if (sampleInputNode == null) {
				throw new Error("Sample input node is null");
			}
			this.#source.connect(sampleInputNode);
		}
		return this.#sampleNodeBuses.get(pBus)!;
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
		if (this.#source == null) {
			throw new Error("Source is null");
		}
		this.#source.connect(this.getPositionWorklet());
		if (pStart) {
			this.start();
		}
	}

	getPositionWorklet(): AudioWorkletNode {
		if (this.#positionWorklet != null) {
			return this.#positionWorklet;
		}
		this.#positionWorklet = new AudioWorkletNode(
			GodotAudio.audioContext,
			"godot-position-reporting-processor",
		);
		this.#positionWorklet.port.onmessage = (prevent) => {
			switch (prevent.data["type"]) {
				case "position":
					this.#playbackPosition = (parseInt(prevent.data.data, 10) /
						this.getSample().sampleRate) + this.offset;
					break;
				default:
					// Do nothing.
			}
		};
		return this.#positionWorklet;
	}

	clear(): void {
		this.isCanceled = true;
		this.isPaused = false;
		this.pauseTime = 0;

		if (this.#source != null) {
			if (this.#onEnded != null) {
				this.#source.removeEventListener("ended", this.#onEnded);
			}
			this.#onEnded = null;
			if (this.isStarted) {
				this.#source.stop();
			}
			this.#source.disconnect();
			this.#source = null;
		}

		for (const sampleNodeBus of this.#sampleNodeBuses.values()) {
			sampleNodeBus.clear();
		}
		this.#sampleNodeBuses.clear();

		if (this.#positionWorklet) {
			this.#positionWorklet.disconnect();
			this.#positionWorklet.port.onmessage = null;
			this.#positionWorklet.port.postMessage({ type: "ended" });
			this.#positionWorklet = null;
		}

		GodotAudio.SampleNode.delete(this.id);
	}

	#resetSourceStartTime(): void {
		this.#sourceStartTime = GodotAudio.audioContext.currentTime;
	}

	#syncPlaybackRate(): void {
		if (this.#source == null) {
			throw new Error("Source is null.");
		}
		this.#source.playbackRate.value = this.getPlaybackRate() *
			this.getPitchScale();
	}

	#restart(): void {
		if (this.#source != null) {
			this.#source.disconnect();
		}
		this.#source = GodotAudio.audioContext.createBufferSource();
		this.#source.buffer = this.getSample().getAudioBuffer();

		// Make sure that we connect the new source to the sample node bus.
		for (const sampleNodeBus of this.#sampleNodeBuses.values()) {
			const sampleInputNode = sampleNodeBus.getInputNode();
			if (sampleInputNode == null) {
				throw new Error("Sample input node is null.");
			}
			this.connect(sampleInputNode);
		}

		this.#addEndedListener();
		const pauseTime = this.isPaused ? this.pauseTime : 0;
		if (this.#positionWorklet != null) {
			this.#positionWorklet.port.postMessage({ type: "clear" });
			this.#source.connect(this.#positionWorklet);
		}
		this.#source.start(this.startTime, this.offset + pauseTime);
		this.isStarted = true;
	}

	#pause(): void {
		if (!this.isStarted) {
			return;
		}
		this.isPaused = true;
		this.pauseTime =
			(GodotAudio.audioContext.currentTime - this.#sourceStartTime) /
			this.getPlaybackRate();
		if (this.#source == null) {
			throw new Error("Source is null.");
		}
		this.#source.stop();
	}

	#unpause(): void {
		this.#restart();
		this.isPaused = false;
		this.pauseTime = 0;
	}

	#addEndedListener(): void {
		if (this.#source == null) {
			throw new Error("Source is null");
		}

		if (this.#onEnded != null) {
			this.#source.removeEventListener("ended", this.#onEnded);
		}

		this.#onEnded = (_) => {
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
		this.#source.addEventListener("ended", this.#onEnded);
	}
}

class Bus {
	#sampleNodes: Set<SampleNode>;
	isSolo: boolean;
	#send: Bus | null;
	#gainNode: GainNode;
	#soloNode: GainNode;
	#muteNode: GainNode;

	static getCount(): number {
		return GodotAudio.buses.length;
	}

	static setCount(pCount: number): void {
		const buses = GodotAudio.buses;
		if (pCount === buses.length) {
			return;
		}

		if (pCount < buses.length) {
			// TODO: what to do with nodes connected to the deleted buses?
			const deletedBuses = buses.slice(pCount);
			for (let i = 0; i < deletedBuses.length; i++) {
				const deletedBus = deletedBuses[i];
				deletedBus.clear();
			}
			GodotAudio.buses = buses.slice(0, pCount);
			return;
		}

		for (let i = GodotAudio.buses.length; i < pCount; i++) {
			GodotAudio.Bus.create();
		}
	}

	static getBus(pIndex: number): Bus {
		if (pIndex < 0 || pIndex >= GodotAudio.buses.length) {
			throw new ReferenceError(`invalid bus index "${pIndex}"`);
		}
		return GodotAudio.buses[pIndex];
	}

	static getBusOrNull(pIndex: number): Bus | null {
		if (pIndex < 0 || pIndex >= GodotAudio.buses.length) {
			return null;
		}
		return GodotAudio.buses[pIndex];
	}

	static move(pFromIndex: number, pToIndex: number): void {
		const movedBus = GodotAudio.Bus.getBusOrNull(pFromIndex);
		if (movedBus == null) {
			return;
		}
		const buses = GodotAudio.buses.filter((_, i) => i !== pFromIndex);
		// Inserts at index.
		buses.splice(pToIndex - 1, 0, movedBus);
		GodotAudio.buses = buses;
	}

	static addAt(pIndex: number): void {
		const newBus = GodotAudio.Bus.create();
		if (pIndex !== newBus.getId()) {
			GodotAudio.Bus.move(newBus.getId(), pIndex);
		}
	}

	static create(): Bus {
		const newBus = new GodotAudio.Bus();
		const isFirstBus = GodotAudio.buses.length === 0;
		GodotAudio.buses.push(newBus);
		if (isFirstBus) {
			newBus.setSend(null);
		} else {
			newBus.setSend(GodotAudio.Bus.getBus(0));
		}
		return newBus;
	}

	constructor() {
		this.#sampleNodes = new Set();
		this.isSolo = false;
		this.#send = null;

		this.#gainNode = GodotAudio.audioContext.createGain();
		this.#soloNode = GodotAudio.audioContext.createGain();
		this.#muteNode = GodotAudio.audioContext.createGain();

		this.#gainNode
			.connect(this.#soloNode)
			.connect(this.#muteNode);
	}

	getId(): number {
		return GodotAudio.buses.indexOf(this);
	}

	getVolumeDb(): number {
		return GodotAudio.linearToDb(this.#gainNode.gain.value);
	}

	setVolumeDb(pVolumeDb: number): void {
		const linear = GodotAudio.dbToLinear(pVolumeDb);
		if (isFinite(linear)) {
			this.#gainNode.gain.value = linear;
		}
	}

	getSend(): Bus | null {
		return this.#send;
	}

	setSend(pSend: Bus | null): void {
		this.#send = pSend;
		if (pSend == null) {
			if (this.getId() === 0) {
				this.getOutputNode().connect(
					GodotAudio.audioContext.destination,
				);
				return;
			}
			throw new Error(
				`Cannot send to "${pSend}" without the bus being at index 0 (current index: ${this.getId()})`,
			);
		}
		this.connect(pSend);
	}

	getInputNode(): AudioNode {
		return this.#gainNode;
	}

	getOutputNode(): AudioNode {
		return this.#muteNode;
	}

	setMute(pMute: boolean): void {
		this.#muteNode.gain.value = pMute ? 0 : 1;
	}

	setSolo(pSolo: boolean): void {
		if (this.isSolo === pSolo) {
			return;
		}

		if (pSolo) {
			if (GodotAudio.busSolo != null && GodotAudio.busSolo !== this) {
				GodotAudio.busSolo.#disableSolo();
			}
			this.#enableSolo();
			return;
		}

		this.#disableSolo();
	}

	addSampleNode(pSampleNode: SampleNode): void {
		this.#sampleNodes.add(pSampleNode);
		const sampleOutputNode = pSampleNode.getOutputNode();
		if (sampleOutputNode == null) {
			throw new Error("Sample output node is null.");
		}
		sampleOutputNode.connect(this.getInputNode());
	}

	removeSampleNode(pSampleNode: SampleNode): void {
		this.#sampleNodes.delete(pSampleNode);
		const sampleOutputNode = pSampleNode.getOutputNode();
		if (sampleOutputNode == null) {
			throw new Error("Sample output node is null.");
		}
		sampleOutputNode.disconnect();
	}

	connect(pBus: Bus): Bus {
		if (pBus == null) {
			throw new Error("Cannot connect to null bus");
		}
		this.getOutputNode().disconnect();
		this.getOutputNode().connect(pBus.getInputNode());
		return pBus;
	}

	clear(): void {
		GodotAudio.buses = GodotAudio.buses.filter((pBus) => pBus !== this);
	}

	#syncSampleNodes(): void {
		const sampleNodes = Array.from(this.#sampleNodes);
		for (let i = 0; i < sampleNodes.length; i++) {
			const sampleNode = sampleNodes[i];
			const sampleOutputNode = sampleNode.getOutputNode();
			if (sampleOutputNode == null) {
				throw new Error("Sample output node is null.");
			}
			sampleOutputNode.disconnect();
			sampleOutputNode.connect(this.getInputNode());
		}
	}

	#enableSolo(): void {
		this.isSolo = true;
		GodotAudio.busSolo = this;
		this.#soloNode.gain.value = 1;
		const otherBuses = GodotAudio.buses.filter(
			(pOtherBus) => pOtherBus !== this,
		);
		for (let i = 0; i < otherBuses.length; i++) {
			const otherBus = otherBuses[i];
			otherBus.#soloNode.gain.value = 0;
		}
	}

	#disableSolo() {
		this.isSolo = false;
		GodotAudio.busSolo = null;
		this.#soloNode.gain.value = 1;
		const otherBuses = GodotAudio.buses.filter(
			(pOtherBus) => pOtherBus !== this,
		);
		for (let i = 0; i < otherBuses.length; i++) {
			const otherBus = otherBuses[i];
			otherBus.#soloNode.gain.value = 1;
		}
	}
}

export const _GodotAudio = {
	$GodotAudio__deps: ["$GodotRuntime", "$GodotOS"],
	$GodotAudio: {
		/**
		 * Max number of volume channels.
		 */
		MAX_VOLUME_CHANNELS: 8,

		/**
		 * Represents the index of each sound channel relative to the engine.
		 */
		GodotChannel: Object.freeze({
			CHANNEL_L: 0,
			CHANNEL_R: 1,
			CHANNEL_C: 3,
			CHANNEL_LFE: 4,
			CHANNEL_RL: 5,
			CHANNEL_RR: 6,
			CHANNEL_SL: 7,
			CHANNEL_SR: 8,
		}),

		/**
		 * Represents the index of each sound channel relative to the Web Audio API.
		 */
		WebChannel: Object.freeze({
			CHANNEL_L: 0,
			CHANNEL_R: 1,
			CHANNEL_SL: 2,
			CHANNEL_SR: 3,
			CHANNEL_C: 4,
			CHANNEL_LFE: 5,
		}),

		samples: null as unknown as Map<string, Sample>,
		Sample,

		SampleNodeBus,

		sampleNodes: null as unknown as Map<string, SampleNode>,
		SampleNode,

		buses: null as unknown as Bus[],
		busSolo: null as Bus | null,
		Bus,

		sampleFinishedCallback: null as
			| ((pPlaybackObjectIdPtr: number) => void)
			| null,

		audioContext: null as unknown as AudioContext,

		input: null,
		driver: null,
		interval: 0,
		sampleRate: 44100,

		audioPositionWorkletPromise: null as unknown as Promise<AudioWorklet>,

		linearToDb: (pLinear: number): number => {
			return Math.log(pLinear) * 8.6858896380650365530225783783321;
		},
		dbToLinear: (pDb: number): number => {
			return Math.exp(pDb * 0.11512925464970228420089957273422);
		},

		init: (
			pMixRate: number,
			pLatency: number,
			pOnStateChange: (pState: number) => void,
			pOnLatencyUpdate: (pLatency: number) => void,
		): number => {
			// Initialize classes static values.
			GodotAudio.samples = new Map();
			GodotAudio.sampleNodes = new Map();
			GodotAudio.buses = [];
			GodotAudio.busSolo = null;

			const opts: ConstructorParameters<AudioContext>[0] = {};
			// If `pMixRate` is `0`, let the browser choose.
			if (pMixRate) {
				GodotAudio.sampleRate = pMixRate;
				opts["sampleRate"] = pMixRate;
			}
			GodotAudio.audioContext = new AudioContext(opts);
			GodotAudio.audioContext.addEventListener("statechange", () => {
				let state = 0;
				switch (GodotAudio.audioContext.state) {
					case "suspended":
						state = 0;
						break;
					case "running":
						state = 1;
						break;
					case "closed":
						state = 2;
						break;
					default:
						// Do nothing.
				}
				pOnStateChange(state);
			});
			// Immediately notify state.
			pOnStateChange(0);

			// Update computed latency.
			GodotAudio.interval = setInterval(function () {
				let computedLatency = 0;
				if (GodotAudio.audioContext.baseLatency) {
					computedLatency += GodotAudio.audioContext.baseLatency;
				}
				if (GodotAudio.audioContext.outputLatency) {
					computedLatency += GodotAudio.audioContext.outputLatency;
				}
				pOnLatencyUpdate(computedLatency);
			}, 1000);
			GodotOS.atexit(GodotAudio.closeAsync);

			const path = GodotConfig.locate_file(
				"godot.audio.position.worklet.js",
			);
			GodotAudio.audioPositionWorkletPromise = GodotAudio.audioContext
				.audioWorklet
				.addModule(path);

			return GodotAudio.audioContext.destination.channelCount;
		},

		createInput: (pCallback: unknown): number => {
			if (GodotAudio.input) {
				return 0;
			}

			function gotMediaInput(stream: unknown) {
			}

			navigator.mediaDevices.getUserMedia({
				audio: true,
			})
				.then(gotMediaInput)
				.catch((pError: Error) => {
					GodotRuntime.error("Error getting user media.", pError);
				});
			return 0;
		},
	},
};
