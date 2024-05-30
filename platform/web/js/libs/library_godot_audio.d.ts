export type PositionMode = "none" | "2D" | "3D";
export type LoopMode = "disabled" | "forward" | "backward" | "pingpong";

interface SampleParams {
	id: string
	audioBuffer: AudioBuffer
}

interface SampleOptions {
	numberOfChannels?: number
	sampleRate?: number
	loopMode?: LoopMode
	loopBegin?: number
	loopEnd?: number
}

export declare class Sample {
	static _samples: Map<string, Sample>;

	id: string;

	_audioBuffer: AudioBuffer;
	numberOfChannels: number;
	sampleRate: number;
	loopMode: LoopMode;
	loopBegin: number;
	loopEnd: number;

	static getSample(id: string): Sample;
	static getSampleOrNull(id: string): Sample | null;
	static create(params: SampleParams, options?: SampleOptions): Sample;
	static clear(id: string): void;

	constructor(params: SampleParams, options?: SampleOptions);

	getAudioBuffer(): AudioBuffer;
	setAudioBuffer(val: AudioBuffer);
	clear(): void;
	_duplicateAudioBuffer(): Sample;
}

export declare class SampleNodeBus {
	_bus: Bus;
	_channelSplitter: ChannelSplitterNode;
	_l: GainNode;
	_r: GainNode;
	_sl: GainNode;
	_sr: GainNode;
	_c: GainNode;
	_lfe: GainNode;
	_channelMerger: ChannelMergerNode;

	static create(bus: Bus): SampleNodeBus;

	constructor(bus: Bus);

	getInputNode(): AudioNode;
	getOutputNode(): AudioNode;
	setVolume(volume: Float32Array): void;
	clear(): void;
}

interface SampleNodeParams {
	id: string,
	streamObjectId: string,
	busIndex: number,
}

interface SampleNodeOptions {
	offset: number,
	positionMode: PositionMode,
	playbackRate: number,
	startTime: number,
	loopMode: LoopMode,
	volume: Float32Array,
}

export declare class SampleNode {
	static _sampleNodes: Map<string, SampleNode>;

	id: string;
	streamObjectId: string;
	offset: number;
	positionMode: PositionMode;
	_loopMode: LoopMode;
	_playbackRate: number;
	_pitchScale: number;
	startTime: number;
	pauseTime: number;
	_source: AudioBufferSourceNode;
	_sampleNodeBuses: Map<Bus, SampleNodeBus>;

	static getSampleNode(id: string): SampleNode;
	static getSampleNodeOrNull(id: string): SampleNode | null;
	static stopSampleNode(id: string): void;
	static pauseSampleNode(id: void, enable: boolean): void;
	static create(params: SampleNodeParams, options?: SampleNodeOptions): SampleNode;
	static clear(id: string): void;

	constructor(params: SampleNodeParams, options?: SampleNodeOptions);

	getLoopMode(): LoopMode;
	setLoopMode(val: LoopMode);
	getPlaybackRate(): number;
	setPlaybackRate(val: number);
	getPitchScale(): number;
	setPitchScale(val: number);
	getSample(): Sample;
	getOutputNode(): AudioNode;

	start(): void;
	stop(): void;
	pause(enable?: boolean): void;
	connect(node: AudioNode): AudioNode;
	clear(): void;
	setVolumes(buses: Bus[], volumes: Float32Array): void;
	getSampleNodeBus(bus: Bus): SampleNodeBus;
	_syncPlaybackRate(): void;
}

export declare class Bus {
	static _buses: Bus[];
	static _busSolo: Bus | null;

	_gainNode: GainNode;
	_soloNode: GainNode;
	_muteNode: GainNode;
	_sampleNodes: Set<SampleNode>;
	isSolo: boolean;
	_send: Bus;

	static getCount(): number;
	static setCount(val: number);
	static get(index: number): Bus;
	static move(fromIndex: number, toIndex: number): void;
	static addAt(index: number): void;
	static create(): Bus;

	constructor();

	getId(): number;
	getVolumeDb(): number;
	setVolumeDb(val: number);
	getSend(): Bus;
	setSend(val: Bus);
	getInputNode(): AudioNode;
	getOutputNode(): AudioNode;

	mute(enable: boolean): void;
	solo(enable: boolean): void;
	addSampleNode(sampleNode: SampleNode): void;
	removeSampleNode(sampleNode: SampleNode): void;
	connect(bus: Bus): Bus;
	clear(): void;
	_syncSampleNodes(): void;
	_enableSolo(): void;
	_disableSolo(): void;
}
