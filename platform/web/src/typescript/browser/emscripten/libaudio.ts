/**************************************************************************/
/*  libaudio.ts                                                           */
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

// __emscripten_import_global_const_start
import { addToLibrary, autoAddDeps, HEAP32, HEAPF32 } from "./libemscripten.ts";
import { GodotRuntime } from "./libruntime.ts";
import { GodotConfig, GodotEventListeners, GodotOS } from "./libos.ts";
// __emscripten_import_global_const_end

import {
	CCharPointer,
	CDouble,
	CFloat,
	CFloatPointer,
	CFunctionPointer,
	CInt,
	CIntArrayPointer,
	CIntPointer,
	CPointer,
} from "./libemscripten.ts";

import { throwIfNull } from "+shared/utils/error.ts";

type AudioInitOnStateChangeCallback = (pState: CInt) => void;
type AudioInitOnLatencyChangeCallback = (pLatency: CFloat) => void;
type AudioScriptStartCallback = () => void;

type AudioSampleSetFinishedCallbackCallback = (
	pPlaybackObjectId: CPointer,
) => void;

type AudioWorkletStateAddOnOutCallback = (
	pPosition: CInt,
	pFrames: CInt,
) => void;
type AudioWorkletStateAddOnInCallback = (
	pPosition: CInt,
	pFrames: CInt,
) => void;

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

	clear() {
		this.setAudioBuffer(null);
		GodotAudio.Sample.delete(this.id);
	}

	_duplicateAudioBuffer(): AudioBuffer {
		throwIfNull(
			this._audioBuffer,
			new Error("Couldn't duplicate a null audioBuffer"),
		);
		const channels = new Array<Float32Array>(
			this._audioBuffer.numberOfChannels,
		);
		for (let i = 0; i < this._audioBuffer.numberOfChannels; i++) {
			const channel = new Float32Array(
				this._audioBuffer.getChannelData(i),
			);
			channels[i] = channel;
		}
		const buffer = GodotAudio.context.createBuffer(
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

class SampleNodeBus {
	_bus: Bus | null;
	_channelSplitter: ChannelSplitterNode | null;
	_lChannel: GainNode | null;
	_rChannel: GainNode | null;
	_slChannel: GainNode | null;
	_srChannel: GainNode | null;
	_cChannel: GainNode | null;
	_lfeChannel: GainNode | null;
	_channelMerger: ChannelMergerNode | null;

	static create(pBus: Bus): SampleNodeBus {
		return new GodotAudio.SampleNodeBus(pBus);
	}

	constructor(pBus: Bus) {
		const NUMBER_OF_WEB_CHANNELS = 6;

		this._bus = pBus;
		this._channelSplitter = GodotAudio.context.createChannelSplitter(
			NUMBER_OF_WEB_CHANNELS,
		);
		this._lChannel = GodotAudio.context.createGain();
		this._rChannel = GodotAudio.context.createGain();
		this._slChannel = GodotAudio.context.createGain();
		this._srChannel = GodotAudio.context.createGain();
		this._cChannel = GodotAudio.context.createGain();
		this._lfeChannel = GodotAudio.context.createGain();
		this._channelMerger = GodotAudio.context.createChannelMerger(
			NUMBER_OF_WEB_CHANNELS,
		);

		this._channelSplitter
			.connect(this._lChannel, GodotAudio.WebChannel.CHANNEL_L)
			.connect(
				this._channelMerger,
				GodotAudio.WebChannel.CHANNEL_L,
				GodotAudio.WebChannel.CHANNEL_L,
			);
		this._channelSplitter
			.connect(this._rChannel, GodotAudio.WebChannel.CHANNEL_R)
			.connect(
				this._channelMerger,
				GodotAudio.WebChannel.CHANNEL_L,
				GodotAudio.WebChannel.CHANNEL_R,
			);
		this._channelSplitter
			.connect(this._slChannel, GodotAudio.WebChannel.CHANNEL_SL)
			.connect(
				this._channelMerger,
				GodotAudio.WebChannel.CHANNEL_L,
				GodotAudio.WebChannel.CHANNEL_SL,
			);
		this._channelSplitter
			.connect(this._srChannel, GodotAudio.WebChannel.CHANNEL_SR)
			.connect(
				this._channelMerger,
				GodotAudio.WebChannel.CHANNEL_L,
				GodotAudio.WebChannel.CHANNEL_SR,
			);
		this._channelSplitter
			.connect(this._cChannel, GodotAudio.WebChannel.CHANNEL_C)
			.connect(
				this._channelMerger,
				GodotAudio.WebChannel.CHANNEL_L,
				GodotAudio.WebChannel.CHANNEL_C,
			);
		this._channelSplitter
			.connect(this._lfeChannel, GodotAudio.WebChannel.CHANNEL_L)
			.connect(
				this._channelMerger,
				GodotAudio.WebChannel.CHANNEL_L,
				GodotAudio.WebChannel.CHANNEL_LFE,
			);

		this._channelMerger.connect(this._bus.getInputNode());
	}

	getInputNode(): AudioNode | null {
		return this._channelSplitter;
	}

	getOutputNode(): AudioNode | null {
		return this._channelMerger;
	}

	setVolume(pVolume: Float32Array): void {
		if (pVolume.length !== GodotAudio.MAX_VOLUME_CHANNELS) {
			throw new Error(
				`Volume length isn't "${GodotAudio.MAX_VOLUME_CHANNELS}", is ${pVolume.length} instead`,
			);
		}
		if (
			this._lChannel == null || this._rChannel == null ||
			this._slChannel == null || this._srChannel == null ||
			this._cChannel == null || this._lfeChannel == null
		) {
			throw new Error("Channels are null");
		}

		this._lChannel.gain.value =
			pVolume[GodotAudio.GodotChannel.CHANNEL_L] ??
				0;
		this._rChannel.gain.value =
			pVolume[GodotAudio.GodotChannel.CHANNEL_R] ??
				0;
		this._slChannel.gain.value =
			pVolume[GodotAudio.GodotChannel.CHANNEL_SL] ?? 0;
		this._srChannel.gain.value =
			pVolume[GodotAudio.GodotChannel.CHANNEL_SR] ?? 0;
		this._cChannel.gain.value =
			pVolume[GodotAudio.GodotChannel.CHANNEL_C] ??
				0;
		this._lfeChannel.gain.value =
			pVolume[GodotAudio.GodotChannel.CHANNEL_LFE] ?? 0;
	}

	clear(): void {
		this._bus = null;
		this._channelSplitter?.disconnect();
		this._channelSplitter = null;
		this._lChannel?.disconnect();
		this._lChannel = null;
		this._rChannel?.disconnect();
		this._rChannel = null;
		this._slChannel?.disconnect();
		this._slChannel = null;
		this._srChannel?.disconnect();
		this._srChannel = null;
		this._cChannel?.disconnect();
		this._cChannel = null;
		this._lfeChannel?.disconnect();
		this._lfeChannel = null;
		this._channelMerger?.disconnect();
		this._channelMerger = null;
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
		this._playbackPosition = pOptions.offset ?? 0;
		this.startTime = pOptions.startTime ?? 0;
		this.isPaused = false;
		this.isStarted = false;
		this.isCanceled = false;
		this.pauseTime = 0;
		this._playbackRate = 44100;
		this.loopMode = pOptions.loopMode ?? this.getSample().loopMode ??
			"disabled";
		this._pitchScale = pOptions.pitchScale ?? 1;
		this._sourceStartTime = 0;
		this._sampleNodeBuses = new Map();
		this._source = GodotAudio.context.createBufferSource();

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

		this.connectPositionWorklet(pOptions.start).catch((pError) => {
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
					(busIndex * GodotAudio.MAX_VOLUME_CHANNELS) +
						GodotAudio.MAX_VOLUME_CHANNELS,
				),
			);
		}
	}

	getSampleNodeBus(pBus: Bus): SampleNodeBus {
		if (!this._sampleNodeBuses.has(pBus)) {
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
		}
		return this._sampleNodeBuses.get(pBus)!;
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
		if (this._positionWorklet != null) {
			return this._positionWorklet;
		}
		this._positionWorklet = new AudioWorkletNode(
			GodotAudio.context,
			"godot-position-reporting-processor",
		);
		GodotEventListeners.add(
			this._positionWorklet.port,
			"message",
			(pEvent: MessageEvent) => {
				switch (pEvent.data["type"]) {
					case "position":
						this._playbackPosition =
							(parseInt(pEvent.data.data, 10) /
								this.getSample().sampleRate) + this.offset;
						break;
					default:
						// Do nothing.
				}
			},
		);
		return this._positionWorklet;
	}

	clear(): void {
		this.isCanceled = true;
		this.isPaused = false;
		this.pauseTime = 0;

		if (this._source != null) {
			if (this._onEnded != null) {
				GodotEventListeners.remove(
					this._source,
					"ended",
					this._onEnded,
				);
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

		if (this._positionWorklet) {
			this._positionWorklet.disconnect();
			GodotEventListeners.remove(this._positionWorklet.port, "message");
			this._positionWorklet.port.postMessage({ type: "ended" });
			this._positionWorklet = null;
		}

		GodotAudio.SampleNode.delete(this.id);
	}

	_resetSourceStartTime(): void {
		this._sourceStartTime = GodotAudio.context.currentTime;
	}

	_syncPlaybackRate(): void {
		throwIfNull(this._source, new Error("Source is null"));
		this._source.playbackRate.value = this.getPlaybackRate() *
			this.getPitchScale();
	}

	_restart(): void {
		if (this._source != null) {
			this._source.disconnect();
		}
		this._source = GodotAudio.context.createBufferSource();
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
		if (!this.isStarted) {
			return;
		}
		this.isPaused = true;
		this.pauseTime =
			(GodotAudio.context.currentTime - this._sourceStartTime) /
			this.getPlaybackRate();
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

class Bus {
	_sampleNodes: Set<SampleNode>;
	isSolo: boolean;
	_send: Bus | null;
	_gainNode: GainNode;
	_soloNode: GainNode;
	_muteNode: GainNode;

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
		this._sampleNodes = new Set();
		this.isSolo = false;
		this._send = null;

		this._gainNode = GodotAudio.context.createGain();
		this._soloNode = GodotAudio.context.createGain();
		this._muteNode = GodotAudio.context.createGain();

		this._gainNode
			.connect(this._soloNode)
			.connect(this._muteNode);
	}

	getId(): number {
		return GodotAudio.buses.indexOf(this);
	}

	getVolumeDb(): number {
		return GodotAudio.linearToDb(this._gainNode.gain.value);
	}

	setVolumeDb(pVolumeDb: number): void {
		const linear = GodotAudio.dbToLinear(pVolumeDb);
		if (isFinite(linear)) {
			this._gainNode.gain.value = linear;
		}
	}

	getSend(): Bus | null {
		return this._send;
	}

	setSend(pSend: Bus | null): void {
		this._send = pSend;
		if (pSend == null) {
			if (this.getId() === 0) {
				this.getOutputNode().connect(
					GodotAudio.context.destination,
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
		return this._gainNode;
	}

	getOutputNode(): AudioNode {
		return this._muteNode;
	}

	setMute(pMute: boolean): void {
		this._muteNode.gain.value = pMute ? 0 : 1;
	}

	setSolo(pSolo: boolean): void {
		if (this.isSolo === pSolo) {
			return;
		}

		if (pSolo) {
			if (GodotAudio.busSolo != null && GodotAudio.busSolo !== this) {
				GodotAudio.busSolo._disableSolo();
			}
			this._enableSolo();
			return;
		}

		this._disableSolo();
	}

	addSampleNode(pSampleNode: SampleNode): void {
		this._sampleNodes.add(pSampleNode);
		const sampleOutputNode = pSampleNode.getOutputNode();
		if (sampleOutputNode == null) {
			throw new Error("Sample output node is null.");
		}
		sampleOutputNode.connect(this.getInputNode());
	}

	removeSampleNode(pSampleNode: SampleNode): void {
		this._sampleNodes.delete(pSampleNode);
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

	_syncSampleNodes(): void {
		const sampleNodes = Array.from(this._sampleNodes);
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

	_enableSolo(): void {
		this.isSolo = true;
		GodotAudio.busSolo = this;
		this._soloNode.gain.value = 1;
		const otherBuses = GodotAudio.buses.filter(
			(pOtherBus) => pOtherBus !== this,
		);
		for (let i = 0; i < otherBuses.length; i++) {
			const otherBus = otherBuses[i];
			otherBus._soloNode.gain.value = 0;
		}
	}

	_disableSolo() {
		this.isSolo = false;
		GodotAudio.busSolo = null;
		this._soloNode.gain.value = 1;
		const otherBuses = GodotAudio.buses.filter(
			(pOtherBus) => pOtherBus !== this,
		);
		for (let i = 0; i < otherBuses.length; i++) {
			const otherBus = otherBuses[i];
			otherBus._soloNode.gain.value = 1;
		}
	}
}

// __emscripten_declare_global_const_start
export declare const GodotAudio: typeof _GodotAudio.$GodotAudio;
// __emscripten_declare_global_const_end
const _GodotAudio = {
	$GodotAudio__deps: ["$GodotRuntime", "$GodotOS", "$GodotEventListeners"],
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
			| AudioSampleSetFinishedCallbackCallback
			| null,

		context: null as unknown as AudioContext,

		input: null as unknown as MediaStreamAudioSourceNode | null,
		driver: null as unknown as
			| typeof GodotAudioWorklet
			| typeof GodotAudioScript
			| null,
		interval: 0,
		sampleRate: 44100,

		audioPositionWorkletPromise: null as unknown as Promise<void>,

		linearToDb: (pLinear: number): number => {
			return Math.log(pLinear) * 8.6858896380650365530225783783321;
		},
		dbToLinear: (pDb: number): number => {
			return Math.exp(pDb * 0.11512925464970228420089957273422);
		},

		initialize: (
			pMixRate: number,
			_pLatency: number,
			pOnStateChange: (pState: number) => void,
			pOnLatencyUpdate: (pLatency: number) => void,
		): number => {
			// Initialize classes static values.
			GodotAudio.samples = new Map();
			GodotAudio.sampleNodes = new Map();
			GodotAudio.buses = [];
			GodotAudio.busSolo = null;

			const opts: Partial<
				NonNullable<ConstructorParameters<typeof AudioContext>[0]>
			> = {};
			// If `pMixRate` is `0`, let the browser choose.
			if (pMixRate) {
				GodotAudio.sampleRate = pMixRate;
				opts["sampleRate"] = pMixRate;
			}
			GodotAudio.context = new AudioContext(opts);
			GodotEventListeners.add(
				GodotAudio.context,
				"statechange",
				(_pEvent: Event) => {
					let state = 0;
					switch (GodotAudio.context.state) {
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
				},
			);
			// Immediately notify state.
			pOnStateChange(0);

			// Update computed latency.
			GodotAudio.interval = setInterval(function () {
				let computedLatency = 0;
				if (GodotAudio.context.baseLatency) {
					computedLatency += GodotAudio.context.baseLatency;
				}
				if (GodotAudio.context.outputLatency) {
					computedLatency += GodotAudio.context.outputLatency;
				}
				pOnLatencyUpdate(computedLatency);
			}, 1000);
			GodotOS.atExit(GodotAudio.closeAsync);

			const path = GodotConfig.locateFile(
				"godot.audio.position.worklet.js",
			);
			GodotAudio.audioPositionWorkletPromise = GodotAudio.context
				.audioWorklet
				.addModule(path);

			return GodotAudio.context.destination.channelCount;
		},

		createInput: (
			pCallback: (pMediaStreamSource: MediaStreamAudioSourceNode) => void,
		): number => {
			if (GodotAudio.input) {
				return 0;
			}

			navigator.mediaDevices.getUserMedia({
				audio: true,
			})
				.then((pStream) => {
					try {
						GodotAudio.input = GodotAudio.context
							.createMediaStreamSource(pStream);
						pCallback(GodotAudio.input);
					} catch (pError) {
						GodotRuntime.error("Failed creating input", pError);
					}
				})
				.catch((pError: Error) => {
					GodotRuntime.error("Error getting user media.", pError);
				});

			return 0;
		},

		closeAsync: async (): Promise<void> => {
			const context = GodotAudio.context;
			GodotAudio.context = new AudioContext();

			// Audio was not initialized.
			if (context == null) {
				return;
			}

			// Remove latency callback.
			if (GodotAudio.interval !== 0) {
				clearInterval(GodotAudio.interval);
				GodotAudio.interval = 0;
			}

			// Disconnect input, if it was started.
			if (GodotAudio.input != null) {
				GodotAudio.input.disconnect();
				GodotAudio.input = null;
			}

			// Disconnect output.
			if (GodotAudio.driver != null) {
				await GodotAudio.driver.close();
			}

			try {
				await context.close();
			} catch (pError) {
				GodotRuntime.error("Error closing AudioContext:", pError);
			} finally {
				GodotEventListeners.remove(context, "statechange");
			}
		},

		startSample: (
			pPlaybackObjectId: string,
			pStreamObjectId: string,
			pBusIndex: number,
			pStartOptions: Partial<SampleNodeOptions> = {},
		): void => {
			GodotAudio.SampleNode.stopSampleNode(pPlaybackObjectId);
			GodotAudio.SampleNode.create(
				{
					busIndex: pBusIndex,
					id: pPlaybackObjectId,
					streamObjectId: pStreamObjectId,
				},
				pStartOptions,
			);
		},

		stopSample: (pPlaybackObjectId: string): void => {
			GodotAudio.SampleNode.stopSampleNode(pPlaybackObjectId);
		},

		sampleSetPause: (pPlaybackObjectId: string, pPause: boolean): void => {
			GodotAudio.SampleNode.pauseSampleNode(pPlaybackObjectId, pPause);
		},

		updateSamplePitchScale: (
			pPlaybackObjectId: string,
			pPitchScale: number,
		): void => {
			const sampleNode = GodotAudio.SampleNode.getSampleNodeOrNull(
				pPlaybackObjectId,
			);
			if (sampleNode == null) {
				return;
			}
			sampleNode.setPitchScale(pPitchScale);
		},

		sampleSetVolumesLinear: (
			pPlaybackObjectId: string,
			pBusIndexes: number[],
			pVolumes: Float32Array,
		): void => {
			const sampleNode = GodotAudio.SampleNode.getSampleNodeOrNull(
				pPlaybackObjectId,
			);
			if (sampleNode == null) {
				return;
			}
			const buses = pBusIndexes.map((pBusIndex) =>
				GodotAudio.Bus.getBus(pBusIndex)
			);
			sampleNode.setVolumes(buses, pVolumes);
		},

		setSampleBusCount: (pCount: number): void => {
			GodotAudio.Bus.setCount(pCount);
		},

		removeSampleBus: (pIndex: number): void => {
			const bus = GodotAudio.Bus.getBusOrNull(pIndex);
			if (bus == null) {
				return;
			}
			bus.clear();
		},

		addSampleBus: (pAtPos: number): void => {
			GodotAudio.Bus.addAt(pAtPos);
		},

		moveSampleBus: (pBusIndex: number, pToPos: number): void => {
			GodotAudio.Bus.move(pBusIndex, pToPos);
		},

		setSampleBusSend: (pBusIndex: number, pSendIndex: number) => {
			const bus = GodotAudio.Bus.getBusOrNull(pBusIndex);
			if (bus == null) {
				// Cannot send from an invalid bus.
				return;
			}
			let targetBus = GodotAudio.Bus.getBusOrNull(pSendIndex);
			if (targetBus == null) {
				// Send to master.
				targetBus = GodotAudio.Bus.getBus(0);
			}
			bus.setSend(targetBus);
		},

		setSampleBusVolumeDb: (pBusIndex: number, pVolumeDb: number) => {
			const bus = GodotAudio.Bus.getBusOrNull(pBusIndex);
			if (bus == null) {
				return;
			}
			bus.setVolumeDb(pVolumeDb);
		},

		setSampleBusSolo: (pBusIndex: number, pEnable: boolean): void => {
			const bus = GodotAudio.Bus.getBusOrNull(pBusIndex);
			if (bus == null) {
				return;
			}
			bus.setSolo(pEnable);
		},

		setSampleBusMute: (pBusIndex: number, pEnable: boolean): void => {
			const bus = GodotAudio.Bus.getBusOrNull(pBusIndex);
			if (bus == null) {
				return;
			}
			bus.setMute(pEnable);
		},
	},

	godot_audio_is_available__sig: "i",
	godot_audio_is_available__proxy: "sync",
	godot_audio_is_available: (): CInt => {
		return Number(globalThis.AudioContext != null) as CInt;
	},

	godot_audio_has_worklet__proxy: "sync",
	godot_audio_has_worklet__sig: "i",
	godot_audio_has_worklet: (): CInt => {
		return Number(GodotAudio.context?.audioWorklet != null) as CInt;
	},

	godot_audio_has_script_processor__proxy: "sync",
	godot_audio_has_script_processor__sig: "i",
	godot_audio_has_script_processor: (): CInt => {
		return GodotRuntime.boolean(
			GodotAudio.context?.createScriptProcessor != null,
		);
	},

	godot_audio_init__proxy: "sync",
	godot_audio_init__sig: "ipipp",
	godot_audio_init: (
		pMixRatePtr: CIntPointer,
		pLatency: CInt,
		pOnStateChangeCallbackPtr: CFunctionPointer<
			AudioInitOnStateChangeCallback
		>,
		pOnLatencyUpdateCallbackPtr: CFunctionPointer<
			AudioInitOnLatencyChangeCallback
		>,
	): CInt => {
		const onStateChangeCallback = GodotRuntime.getFunction(
			pOnStateChangeCallbackPtr,
		);
		const onLatencyUpdateCallback = GodotRuntime.getFunction(
			pOnLatencyUpdateCallbackPtr,
		);
		const mixRate = GodotRuntime.getHeapValue(pMixRatePtr, "i32");
		const channels = GodotAudio.initialize(
			mixRate,
			pLatency,
			(pState) => onStateChangeCallback(pState as CInt),
			(pLatency) => onLatencyUpdateCallback(pLatency as CFloat),
		);
		GodotRuntime.setHeapValue(
			pMixRatePtr,
			GodotAudio.context.sampleRate,
			"i32",
		);
		return channels as CInt;
	},

	godot_audio_resume__proxy: "sync",
	godot_audio_resume__sig: "v",
	godot_audio_resume: (): void => {
		if (GodotAudio.context == null) {
			return;
		}
		if (GodotAudio.context.state !== "running") {
			GodotAudio.context.resume();
		}
	},

	godot_audio_input_start__proxy: "sync",
	godot_audio_input_start__sig: "i",
	godot_audio_input_start: (): CInt => {
		return GodotAudio.createInput(function (pInput) {
			throwIfNull(
				GodotAudio.driver,
				new Error("GodotAudio.driver is null"),
			);
			const worklet = GodotAudio.driver.getNode();
			if (worklet != null) {
				pInput.connect(worklet);
			}
		}) as CInt;
	},

	godot_audio_input_stop__proxy: "sync",
	godot_audio_input_stop__sig: "v",
	godot_audio_input_stop: (): void => {
		if (GodotAudio.input == null) {
			return;
		}

		const tracks = GodotAudio.input["mediaStream"]["getTracks"]();
		for (let i = 0; i < tracks.length; i++) {
			tracks[i]["stop"]();
		}
		GodotAudio.input.disconnect();
		GodotAudio.input = null;
	},

	godot_audio_sample_stream_is_registered__proxy: "sync",
	godot_audio_sample_stream_is_registered__sig: "ip",
	godot_audio_sample_stream_is_registered: (
		pStreamObjectIdStrPtr: CCharPointer,
	): CInt => {
		const streamObjectId = GodotRuntime.parseString(pStreamObjectIdStrPtr);
		return Number(
			GodotAudio.Sample.getSampleOrNull(streamObjectId) != null,
		) as CInt;
	},

	godot_audio_sample_register_stream__proxy: "sync",
	godot_audio_sample_register_stream__sig: "vppipii",
	godot_audio_sample_register_stream: (
		pStreamObjectIdStrPtr: CCharPointer,
		pFramesPtr: CFloatPointer,
		pFramesTotal: CInt,
		pLoopModeStrPtr: CCharPointer,
		pLoopBegin: CInt,
		pLoopEnd: CInt,
	): void => {
		const streamObjectId = GodotRuntime.parseString(pStreamObjectIdStrPtr);
		const loopMode = GodotRuntime.parseString(pLoopModeStrPtr);
		const numberOfChannels = 2;
		const sampleRate = GodotAudio.context.sampleRate;

		const subLeft = GodotRuntime.heapSub(HEAPF32, pFramesPtr, pFramesTotal);
		const subRight = GodotRuntime.heapSub(
			HEAPF32,
			(pFramesPtr +
				pFramesTotal * Float32Array.BYTES_PER_ELEMENT) as CPointer,
			pFramesTotal,
		);

		const audioBuffer = GodotAudio.context.createBuffer(
			numberOfChannels,
			pFramesTotal,
			sampleRate,
		);
		audioBuffer.copyToChannel(new Float32Array(subLeft), 0, 0);
		audioBuffer.copyToChannel(new Float32Array(subRight), 1, 0);

		GodotAudio.Sample.create(
			{
				id: streamObjectId,
				audioBuffer,
			},
			{
				loopBegin: pLoopBegin,
				loopEnd: pLoopEnd,
				loopMode: loopMode as LoopMode,
				numberOfChannels,
				sampleRate,
			},
		);
	},

	godot_audio_sample_unregister_stream__proxy: "sync",
	godot_audio_sample_unregister_stream__sig: "vp",
	godot_audio_sample_unregister_stream: (
		pStreamObjectIdStrPtr: CCharPointer,
	): void => {
		const streamObjectId = GodotRuntime.parseString(pStreamObjectIdStrPtr);
		const sample = GodotAudio.Sample.getSampleOrNull(streamObjectId);
		if (sample != null) {
			sample.clear();
		}
	},

	godot_audio_sample_start__proxy: "sync",
	godot_audio_sample_start__sig: "vppiffp",
	godot_audio_sample_start: (
		pPlaybackObjectIdStrPtr: CCharPointer,
		pStreamObjectIdStrPtr: CCharPointer,
		pBusIndex: CInt,
		pOffset: CFloat,
		pPitchScale: CFloat,
		pVolumePtr: CFloatPointer,
	): void => {
		const playbackObjectId = GodotRuntime.parseString(
			pPlaybackObjectIdStrPtr,
		);
		const streamObjectId = GodotRuntime.parseString(pStreamObjectIdStrPtr);
		const volume = GodotRuntime.heapSub(HEAPF32, pVolumePtr, 8);
		const startOptions: Partial<SampleNodeOptions> = {
			offset: pOffset,
			volume,
			playbackRate: 1,
			pitchScale: pPitchScale,
			start: true,
			// TODO: add missing startTime parameter.
			// TODO: add missing loopMode parameter.
		};
		GodotAudio.startSample(
			playbackObjectId,
			streamObjectId,
			pBusIndex,
			startOptions,
		);
	},

	godot_audio_sample_stop__proxy: "sync",
	godot_audio_sample_stop__sig: "vp",
	godot_audio_sample_stop: (pPlaybackObjectIdStrPtr: CCharPointer): void => {
		const playbackObjectId = GodotRuntime.parseString(
			pPlaybackObjectIdStrPtr,
		);
		GodotAudio.stopSample(playbackObjectId);
	},

	godot_audio_sample_set_pause__proxy: "sync",
	godot_audio_sample_set_pause__sig: "vpi",
	godot_audio_sample_set_pause: (
		pPlaybackObjectIdStrPtr: CCharPointer,
		pPause: CInt,
	): void => {
		const playbackObjectId = GodotRuntime.parseString(
			pPlaybackObjectIdStrPtr,
		);
		GodotAudio.sampleSetPause(playbackObjectId, Boolean(pPause));
	},

	godot_audio_sample_is_active__proxy: "sync",
	godot_audio_sample_is_active__sig: "ip",
	godot_audio_sample_is_active: (
		pPlaybackObjectIdStrPtr: CCharPointer,
	): CInt => {
		const playbackObjectId = GodotRuntime.parseString(
			pPlaybackObjectIdStrPtr,
		);
		return Number(GodotAudio.sampleNodes.has(playbackObjectId)) as CInt;
	},

	godot_audio_get_sample_playback_position__proxy: "sync",
	godot_audio_get_sample_playback_position__sig: "dp",
	godot_audio_get_sample_playback_position: (
		pPlaybackObjectIdStrPtr: CCharPointer,
	): CDouble => {
		const playbackObjectId = GodotRuntime.parseString(
			pPlaybackObjectIdStrPtr,
		);
		const sampleNode = GodotAudio.SampleNode.getSampleNodeOrNull(
			playbackObjectId,
		);
		if (sampleNode == null) {
			return 0 as CDouble;
		}
		return sampleNode.getPlaybackPosition() as CDouble;
	},

	godot_audio_sample_update_pitch_scale__proxy: "sync",
	godot_audio_sample_update_pitch_scale__sig: "vpf",
	godot_audio_sample_update_pitch_scale: (
		pPlaybackObjectIdStrPtr: CCharPointer,
		pPitchScale: CFloat,
	): void => {
		const playbackObjectId = GodotRuntime.parseString(
			pPlaybackObjectIdStrPtr,
		);
		GodotAudio.updateSamplePitchScale(playbackObjectId, pPitchScale);
	},

	godot_audio_sample_set_volumes_linear__proxy: "sync",
	godot_audio_sample_set_volumes_linear__sig: "vppipi",
	godot_audio_sample_set_volumes_linear: (
		pPlaybackObjectIdStrPtr: CCharPointer,
		pBusesPtr: CIntPointer,
		pBusesSize: CInt,
		pVolumesPtr: CFloatPointer,
		pVolumesSize: CInt,
	): void => {
		const playbackObjectId = GodotRuntime.parseString(
			pPlaybackObjectIdStrPtr,
		);

		const buses = GodotRuntime.heapSub(HEAP32, pBusesPtr, pBusesSize);
		const volumes = GodotRuntime.heapSub(
			HEAPF32,
			pVolumesPtr,
			pVolumesSize,
		);

		GodotAudio.sampleSetVolumesLinear(
			playbackObjectId,
			Array.from(buses),
			volumes,
		);
	},

	godot_audio_sample_bus_set_count__proxy: "sync",
	godot_audio_sample_bus_set_count__sig: "vi",
	godot_audio_sample_bus_set_count: (pCount: CInt): void => {
		GodotAudio.setSampleBusCount(pCount);
	},

	godot_audio_sample_bus_remove__proxy: "sync",
	godot_audio_sample_bus_remove__sig: "vi",
	godot_audio_sample_bus_remove: (pIndex: CInt): void => {
		GodotAudio.removeSampleBus(pIndex);
	},

	godot_audio_sample_bus_add__proxy: "sync",
	godot_audio_sample_bus_add__sig: "vi",
	godot_audio_sample_bus_add: (pAtPos: CInt): void => {
		GodotAudio.addSampleBus(pAtPos);
	},

	godot_audio_sample_bus_move__proxy: "sync",
	godot_audio_sample_bus_move__sig: "vii",
	godot_audio_sample_bus_move: (pFromPos: CInt, pToPos: CInt): void => {
		GodotAudio.moveSampleBus(pFromPos, pToPos);
	},

	godot_audio_sample_bus_set_send__proxy: "sync",
	godot_audio_sample_bus_set_send__sig: "vii",
	godot_audio_sample_bus_set_send: (
		pBus: CInt,
		pSendIndex: CInt,
	): void => {
		GodotAudio.setSampleBusSend(pBus, pSendIndex);
	},

	godot_audio_sample_bus_set_volume_db__proxy: "sync",
	godot_audio_sample_bus_set_volume_db__sig: "vif",
	godot_audio_sample_bus_set_volume_db: (
		pBus: CInt,
		pVolumeDb: CFloat,
	): void => {
		GodotAudio.setSampleBusVolumeDb(pBus, pVolumeDb);
	},

	godot_audio_sample_bus_set_solo__proxy: "sync",
	godot_audio_sample_bus_set_solo__sig: "vii",
	godot_audio_sample_bus_set_solo: (pBus: CInt, pEnable: CInt): void => {
		GodotAudio.setSampleBusSolo(pBus, Boolean(pEnable));
	},

	godot_audio_sample_bus_set_mute__proxy: "sync",
	godot_audio_sample_bus_set_mute__sig: "vii",
	godot_audio_sample_bus_set_mute: (pBus: CInt, pEnable: CInt): void => {
		GodotAudio.setSampleBusMute(pBus, Boolean(pEnable));
	},

	godot_audio_sample_set_finished_callback__proxy: "sync",
	godot_audio_sample_set_finished_callback__sig: "vp",
	godot_audio_sample_set_finished_callback: (
		pCallbackPtr: CFunctionPointer<AudioSampleSetFinishedCallbackCallback>,
	): void => {
		GodotAudio.sampleFinishedCallback = GodotRuntime.getFunction(
			pCallbackPtr,
		);
	},
};
autoAddDeps(_GodotAudio, "$GodotAudio");
addToLibrary(_GodotAudio);

type RingBufferOutCallback = (
	pWPosition: number,
	pPendingSamples: number,
) => void;
type RingBufferInCallback = (pFrom: number, pLength: number) => void;
class RingBuffer {
	wPosition: number;
	rPosition: number;
	pendingSamples: number;
	wBuffer: Float32Array;

	outBufferPtr: CPointer;
	outBufferSize: number;
	outCallback: RingBufferOutCallback;
	inBufferPtr: CPointer;
	inBufferSize: number;
	inCallback: RingBufferOutCallback;

	constructor(
		pOutBufferPtr: CPointer,
		pOutBufferSize: number,
		pOutCallback: RingBufferOutCallback,
		pInBufferPtr: CPointer,
		pInBufferSize: number,
		pInCallback: RingBufferInCallback,
	) {
		this.wPosition = 0;
		this.rPosition = 0;
		this.pendingSamples = 0;
		this.wBuffer = new Float32Array(pOutBufferSize);

		this.outBufferPtr = pOutBufferPtr;
		this.outBufferSize = pOutBufferSize;
		this.outCallback = pOutCallback;
		this.inBufferPtr = pInBufferPtr;
		this.inBufferSize = pInBufferSize;
		this.inCallback = pInCallback;
	}

	_send(pPort: MessagePort): void {
		if (this.pendingSamples === 0) {
			return;
		}
		const buffer = GodotRuntime.heapSub(
			HEAPF32,
			this.outBufferPtr,
			this.outBufferSize,
		);
		const size = buffer.length;
		const totalSent = this.pendingSamples;
		this.outCallback(this.wPosition, this.pendingSamples);
		if (this.wPosition + this.pendingSamples >= size) {
			const high = size - this.wPosition;
			this.wBuffer.set(buffer.subarray(this.wPosition, size));
			this.pendingSamples -= high;
			this.wPosition = 0;
		}
		if (this.pendingSamples > 0) {
			this.wBuffer.set(
				buffer.subarray(
					this.wPosition,
					this.wPosition + this.pendingSamples,
				),
				totalSent - this.pendingSamples,
			);
		}
		pPort.postMessage({
			"cmd": "chunk",
			"data": this.wBuffer.subarray(0, totalSent),
		});
		this.wPosition += this.pendingSamples;
		this.pendingSamples = 0;
	}

	receive(pReceivedBuffer: Float32Array): void {
		const buffer = GodotRuntime.heapSub(
			HEAPF32,
			this.inBufferPtr,
			this.inBufferSize,
		);
		const from = this.rPosition;
		let toWrite = pReceivedBuffer.length;
		let high = 0;
		if (this.rPosition + toWrite >= this.inBufferSize) {
			high = this.inBufferSize - this.rPosition;
			buffer.set(pReceivedBuffer.subarray(0, high), this.rPosition);
			toWrite -= high;
			this.rPosition = 0;
		}
		if (toWrite > 0) {
			buffer.set(pReceivedBuffer.subarray(high, toWrite), this.rPosition);
		}
		this.inCallback(from, pReceivedBuffer.length);
		this.rPosition += toWrite;
	}

	consumed(pSize: number, pPort: MessagePort): void {
		this.pendingSamples += pSize;
		this._send(pPort);
	}
}

// __emscripten_declare_global_const_start
export declare const GodotAudioWorklet:
	typeof _GodotAudioWorklet.$GodotAudioWorklet;
// __emscripten_declare_global_const_end
const _GodotAudioWorklet = {
	$GodotAudioWorklet__deps: [
		"$GodotAudio",
		"$GodotConfig",
		"$GodotEventListeners",
	],
	$GodotAudioWorklet: {
		promise: null as Promise<void> | null,
		worklet: null as AudioWorkletNode | null,
		ringBuffer: null as RingBuffer | null,
		RingBuffer,

		create: (pChannels: number): void => {
			const path = GodotConfig.locateFile("godot.audio.worklet.js");
			GodotAudioWorklet.promise = GodotAudio.context.audioWorklet
				.addModule(path)
				.then(() => {
					GodotAudioWorklet.worklet = new AudioWorkletNode(
						GodotAudio.context,
						"godot-processor",
						{ outputChannelCount: [pChannels] },
					);
				});
			GodotAudio.driver = GodotAudioWorklet;
		},

		start: (
			pInBuffer: Float32Array,
			pOutBuffer: Float32Array,
			pState: Int32Array,
		): void => {
			GodotAudioWorklet.promise?.then(() => {
				const node = GodotAudioWorklet.worklet!;
				node.connect(GodotAudio.context.destination);
				node.port.postMessage({
					cmd: "start",
					data: [pState, pInBuffer, pOutBuffer],
				});
				GodotEventListeners.add(
					node.port,
					"message",
					(pEvent: MessageEvent) => {
						GodotRuntime.error(pEvent.data);
					},
				);
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
			GodotAudioWorklet.promise?.then(() => {
				const node = GodotAudioWorklet.worklet!;
				const buffer = GodotRuntime.heapSlice(
					HEAPF32,
					pOutBufferPtr,
					pOutBufferSize,
				);
				node.connect(GodotAudio.context.destination);
				node.port.postMessage({
					cmd: "start_nothreads",
					data: [buffer, pInBufferSize],
				});

				GodotEventListeners.add(node.port, "message", (pEvent) => {
					if (GodotAudioWorklet.worklet == null) {
						return;
					}
					switch (pEvent.data["cmd"]) {
						case "read":
							{
								const read = pEvent.data["data"] as number;
								GodotAudioWorklet.ringBuffer!.consumed(
									read,
									GodotAudioWorklet.worklet.port,
								);
							}
							break;
						case "input":
							{
								const buffer = pEvent
									.data["data"] as Float32Array;
								if (buffer.length > pInBufferSize) {
									GodotRuntime.error(
										"Input chunk is too big.",
									);
									return;
								}
								GodotAudioWorklet.ringBuffer!.receive(buffer);
							}
							break;
						default:
							GodotRuntime.error(pEvent.data);
					}
				});
			});
		},

		getNode: (): AudioWorkletNode | null => {
			return GodotAudioWorklet.worklet;
		},

		close: async () => {
			if (GodotAudioWorklet.promise == null) {
				return;
			}

			try {
				await GodotAudioWorklet.promise;
				const worklet = GodotAudioWorklet.worklet!;
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
			return GodotRuntime.status.FAILED;
		}
		return GodotRuntime.status.OK;
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
		const outBuffer = GodotRuntime.heapSub(
			HEAPF32,
			pOutBufferPtr,
			pOutBufferSize,
		);
		const inBuffer = GodotRuntime.heapSub(
			HEAPF32,
			pInBufferPtr,
			pInBufferSize,
		);
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
				outCallback(pPosition as CInt, pFrames as CInt);
			},
			pInBufferPtr,
			pInBufferSize,
			(pPosition, pFrames) => {
				inCallback(pPosition as CInt, pFrames as CInt);
			},
		);
	},

	godot_audio_worklet_state_wait__sig: "ipiii",
	godot_audio_worklet_state_wait: (
		pStatePtr: CIntPointer,
		pIndex: CInt,
		pExpected: CInt,
		pTimeout: CInt,
	): CInt => {
		Atomics.wait(HEAP32, (pStatePtr >> 2) + pIndex, pExpected, pTimeout);
		return Atomics.load(HEAP32, (pStatePtr >> 2) + pIndex) as CInt;
	},

	godot_audio_worklet_state_add__sig: "ipii",
	godot_audio_worklet_state_add: (
		pStatePtr: CPointer,
		pIndex: CInt,
		pValue: CInt,
	): CInt => {
		return Atomics.add(HEAP32, (pStatePtr >> 2) + pIndex, pValue) as CInt;
	},

	godot_audio_worklet_state_get__sig: "ipi",
	godot_audio_worklet_state_get: (
		pStatePtr: CPointer,
		pIdx: CInt,
	): CInt => {
		return Atomics.load(HEAP32, (pStatePtr >> 2) + pIdx) as CInt;
	},
};
autoAddDeps(_GodotAudioWorklet, "$GodotAudioWorklet");
addToLibrary(_GodotAudioWorklet);

// __emscripten_declare_global_const_start
export declare const GodotAudioScript:
	typeof _GodotAudioScript.$GodotAudioScript;
// __emscripten_declare_global_const_end
const _GodotAudioScript = {
	$GodotAudioScript__deps: ["$GodotAudio", "$GodotRuntime"],
	$GodotAudioScript: {
		script: null as ScriptProcessorNode | null,

		create: (pBufferLength: number, pChannelCount: number): number => {
			GodotAudioScript.script = GodotAudio.context.createScriptProcessor(
				pBufferLength,
				2,
				pChannelCount,
			);
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
			if (GodotAudioScript.script == null) {
				GodotRuntime.error("Cannot add a listener to a null object.");
				return;
			}

			GodotAudioScript.script.onaudioprocess = (pEvent) => {
				// Read input.
				const inBuffer = GodotRuntime.heapSub(
					HEAPF32,
					pInBufferPtr,
					pInBufferSize,
				);
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
				const outBuffer = GodotRuntime.heapSub(
					HEAPF32,
					pOutBufferPointer,
					pOutBufferSize,
				);
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

			GodotAudioScript.script!.connect(GodotAudio.context.destination);
		},

		getNode: (): ScriptProcessorNode | null => {
			return GodotAudioScript.script;
		},

		close: (): Promise<void> => {
			if (GodotAudioScript.script == null) {
				return Promise.resolve();
			}
			GodotAudioScript.script.disconnect();
			GodotAudioScript.script.onaudioprocess = null;
			GodotAudioScript.script = null;
			return Promise.resolve();
		},
	},

	godot_audio_script_create__proxy: "sync",
	godot_audio_script_create__sig: "ipi",
	godot_audio_script_create: (
		pBufferSizePtr: CIntPointer,
		pChannelCount: CInt,
	): CInt => {
		const bufferLength = GodotRuntime.getHeapValue(pBufferSizePtr, "i32");
		try {
			const outLength = GodotAudioScript.create(
				bufferLength,
				pChannelCount,
			);
			GodotRuntime.setHeapValue(pBufferSizePtr, outLength, "i32");
		} catch (error) {
			GodotRuntime.error(
				"Error starting AudioDriverScriptProcessor",
				error,
			);
			return GodotRuntime.status.FAILED;
		}
		return GodotRuntime.status.OK;
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
		GodotAudioScript.start(
			pInBufferPtr,
			pInBufferSize,
			pOutBufferPtr,
			pOutBufferSize,
			onProcess,
		);
	},
};
autoAddDeps(_GodotAudioScript, "$GodotAudioScript");
addToLibrary(_GodotAudioScript);
