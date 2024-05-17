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
	get audioBuffer(): AudioBuffer;
	set audioBuffer(val: AudioBuffer);

	numberOfChannels: number;
	sampleRate: number;
	loopMode: LoopMode;
	loopBegin: number;
	loopEnd: number;

	static getSample(id: string): Sample;
	static getSampleOrNull(id: string): Sample | null;

	constructor(params: SampleParams, options?: SampleOptions);

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

	get inputNode(): AudioNode;
	get outputNode(): AudioNode;

	constructor(bus: Bus);

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
	get loopMode(): LoopMode;
	set loopMode(val: LoopMode);
	_playbackRate: number;
	get playbackRate(): number;
	set playbackRate(val: number);
	_pitchScale: number;
	get pitchScale(): number;
	set pitchScale(val: number);
	startTime: number;
	pauseTime: number;
	_source: AudioBufferSourceNode;
	_sampleNodeBuses: Map<Bus, SampleNodeBus>;
	get sample(): Sample;

	static getSampleNode(id: string): SampleNode;
	static getSampleNodeOrNull(id: string): SampleNode | null;
	static stopSampleNode(id: string): void;
	static pauseSampleNode(id: void, enable: boolean): void;

	constructor(params: SampleNodeParams, options?: SampleNodeOptions);

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
	get id(): number;
	get volumeDb(): number;
	set volumeDb(val: number);
	get inputNode(): AudioNode;
	get outputNode(): AudioNode
	_send: Bus;
	get send(): Bus;
	set send(val: Bus);

	static getBus(index: number): Bus;
	static move(fromIndex: number, toIndex: number): void;
	static get count(): number;
	static set count(val: number);
	static addAt(index: number): void;

	constructor();

	mute(enable: boolean): void;
	solo(enable: boolean): void;
	addSampleNode(sampleNode: SampleNode): void;
	removeSampleNode(sampleNode: SampleNode): void;
	connect(bus: Bus): Bus;
	clear(): void;
	_syncSampleNodes(): void;
	_disableSolo(): void;
	_enableSolo(): void;
}
