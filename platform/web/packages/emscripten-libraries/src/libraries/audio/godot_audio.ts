/**************************************************************************/
/*  godot_audio.ts                                                        */
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

import {
	convertFunctionToIifeString as $convertFunctionToIifeString,
	getNullishErrorString as $getNullishErrorString,
} from "@godotengine/utils/macros" with { type: "macro" };
import type {
	CCharPointer,
	CDouble,
	CFloat,
	CFloatPointer,
	CFunctionPointer,
	CInt,
	CIntPointer,
	CPointer,
} from "@godotengine/emscripten-utils/types";
import {
	GodotAudio,
	type GodotAudioScript,
	type GodotAudioWorklet,
	GodotConfig,
	GodotEventListeners,
	GodotOS,
	GodotRuntime,
	HEAP32,
	HEAPF32,
	addToLibrary,
	autoAddDeps,
} from "#/external/index.js";

import { Sample, isLoopMode } from "./sample.js";
import { SampleNode, type SampleNodeOptions } from "./sample_node.js";

import { Bus } from "./bus.js";
import { SampleNodeBus } from "./sample_node_bus.js";

/**
 * Represents the index of each sound channel relative to the engine.
 * See `AudioStreamPlayer3D::_calc_output_vol()` for output array indices.
 */
export const GodotChannel = {
	CHANNEL_L: 0,
	CHANNEL_R: 1,
	CHANNEL_C: 2,
	CHANNEL_LFE: 3,
	CHANNEL_RL: 4,
	CHANNEL_RR: 5,
	CHANNEL_SL: 6,
	CHANNEL_SR: 7,
} as const;

/**
 * Represents the index of each sound channel relative to the Web Audio API.
 */
export const WebChannel = {
	CHANNEL_L: 0,
	CHANNEL_R: 1,
	CHANNEL_SL: 2,
	CHANNEL_SR: 3,
	CHANNEL_C: 4,
	CHANNEL_LFE: 5,
};

type AudioInitOnStateChangeCallback = (pState: CInt) => void;
type AudioInitOnLatencyChangeCallback = (pLatency: CFloat) => void;

type AudioSampleSetFinishedCallbackCallback = (pPlaybackObjectId: CPointer) => void;

export const _GodotAudio = {
	$GodotAudio__deps: ["$GodotRuntime", "$GodotOS", "$GodotEventListeners"],
	$GodotAudio__postset: $convertFunctionToIifeString(() => {
		GodotAudio.samples = new Map();
		GodotAudio.sampleNodes = new Map();
		GodotAudio.buses = [];
		GodotAudio.audioPositionWorkletPromise = Promise.resolve();
	}),
	$GodotAudio: {
		/**
		 * Max number of volume channels.
		 */
		MAX_VOLUME_CHANNELS: 8,

		GodotChannel,
		WebChannel,

		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Initialized in postset.
		samples: null as unknown as Map<string, Sample>,
		Sample,

		SampleNodeBus,

		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Initialized in postset.
		sampleNodes: null as unknown as Map<string, SampleNode>,
		SampleNode,

		// This is a rare case where `Array` is preferred to `Set` as indices are needed.
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Initialized in postset.
		buses: null as unknown as Bus[],
		busSolo: null as Bus | null,
		Bus,

		sampleFinishedCallback: null as AudioSampleSetFinishedCallbackCallback | null,

		context: null as AudioContext | null,

		input: null as MediaStreamAudioSourceNode | null,
		driver: null as typeof GodotAudioWorklet | typeof GodotAudioScript | null,
		interval: 0,
		sampleRate: 44100,

		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Initialized in postset.
		audioPositionWorkletPromise: null as unknown as Promise<void>,

		linearToDb: (pLinear: number): number => {
			// Real value: 8.6858896380650365530225783783321
			const coefficient = 8.68588963806503;
			return Math.log(pLinear) * coefficient;
		},
		dbToLinear: (pDb: number): number => {
			// Real value: 0.11512925464970228420089957273422
			const coefficient = 0.11512925464970228;
			return Math.exp(pDb * coefficient);
		},

		initialize: (
			pMixRate: number,
			_pLatency: number,
			pOnStateChange: (pState: number) => void,
			pOnLatencyUpdate: (pLatency: number) => void,
		): number => {
			const opts: Partial<NonNullable<ConstructorParameters<typeof AudioContext>[0]>> = {};
			// If `pMixRate` is `0`, let the browser choose.
			if (pMixRate !== 0) {
				GodotAudio.sampleRate = pMixRate;
				opts.sampleRate = pMixRate;
			}
			GodotAudio.context = new AudioContext(opts);
			GodotEventListeners.add(GodotAudio.context, "statechange", (_pEvent: Event) => {
				const context = GodotAudio.context;
				if (context == null) {
					return;
				}
				let state = 0;
				switch (context.state) {
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
			GodotAudio.interval = setInterval(() => {
				const context = GodotAudio.context;
				if (context == null) {
					return;
				}
				let computedLatency = 0;
				if (context.baseLatency > 0) {
					computedLatency += context.baseLatency;
				}
				if (context.outputLatency > 0) {
					computedLatency += context.outputLatency;
				}
				pOnLatencyUpdate(computedLatency);
			}, 1000);
			GodotOS.atExit(GodotAudio.closeAsync);

			const path = GodotConfig.locateFile("godot.audio.position.worklet.js");
			GodotAudio.audioPositionWorkletPromise = GodotAudio.context.audioWorklet.addModule(path);

			return GodotAudio.context.destination.channelCount;
		},

		createInput: (pCallback: (pMediaStreamSource: MediaStreamAudioSourceNode) => void): number => {
			if (GodotAudio.input != null) {
				return 0;
			}

			navigator.mediaDevices
				.getUserMedia({
					audio: true,
				})
				.then((pStream) => {
					const context = GodotAudio.context;
					if (context == null) {
						return;
					}
					try {
						GodotAudio.input = context.createMediaStreamSource(pStream);
						pCallback(GodotAudio.input);
					} catch (pError) {
						GodotRuntime.error("Failed creating input", pError);
					}
				})
				.catch((pError: unknown) => {
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

		updateSamplePitchScale: (pPlaybackObjectId: string, pPitchScale: number): void => {
			const sampleNode = GodotAudio.SampleNode.getSampleNodeOrNull(pPlaybackObjectId);
			if (sampleNode == null) {
				return;
			}
			sampleNode.setPitchScale(pPitchScale);
		},

		sampleSetVolumesLinear: (pPlaybackObjectId: string, pBusIndexes: number[], pVolumes: Float32Array): void => {
			const sampleNode = GodotAudio.SampleNode.getSampleNodeOrNull(pPlaybackObjectId);
			if (sampleNode == null) {
				return;
			}
			const buses = pBusIndexes.map((pBusIndex) => GodotAudio.Bus.getBus(pBusIndex));
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
			targetBus ??= GodotAudio.Bus.getBus(0);
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
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- We really want to check.
		return GodotRuntime.asCIntBoolean(globalThis.AudioContext != null);
	},

	godot_audio_has_worklet__proxy: "sync",
	godot_audio_has_worklet__sig: "i",
	godot_audio_has_worklet: (): CInt => {
		return GodotRuntime.asCIntBoolean(GodotAudio.context?.audioWorklet != null);
	},

	godot_audio_has_script_processor__proxy: "sync",
	godot_audio_has_script_processor__sig: "i",
	godot_audio_has_script_processor: (): CInt => {
		return GodotRuntime.asCIntBoolean(GodotAudio.context?.createScriptProcessor != null);
	},

	godot_audio_init__proxy: "sync",
	godot_audio_init__sig: "ipipp",
	godot_audio_init: (
		pMixRatePtr: CIntPointer,
		pLatency: CInt,
		pOnStateChangeCallbackPtr: CFunctionPointer<AudioInitOnStateChangeCallback>,
		pOnLatencyUpdateCallbackPtr: CFunctionPointer<AudioInitOnLatencyChangeCallback>,
	): CInt => {
		const onStateChangeCallback = GodotRuntime.getFunction(pOnStateChangeCallbackPtr);
		const onLatencyUpdateCallback = GodotRuntime.getFunction(pOnLatencyUpdateCallbackPtr);
		const mixRate = GodotRuntime.getHeapValue(pMixRatePtr, "i32");
		const channels = GodotAudio.initialize(
			mixRate,
			pLatency,
			(pState) => {
				onStateChangeCallback(GodotRuntime.asCInt(pState));
			},
			(pLatency) => {
				onLatencyUpdateCallback(GodotRuntime.asCType<CFloat>(pLatency));
			},
		);
		const context = GodotAudio.context;
		if (context == null) {
			GodotRuntime.error(new Error("`GodotAudio.context()` is `null` even after initialization."));
		} else {
			GodotRuntime.setHeapValue(pMixRatePtr, GodotRuntime.asCInt(context.sampleRate), "i32");
		}
		return GodotRuntime.asCInt(channels);
	},

	godot_audio_resume__proxy: "sync",
	godot_audio_resume__sig: "v",
	godot_audio_resume: (): void => {
		const context = GodotAudio.context;
		if (context == null) {
			return;
		}
		if (context.state !== "running") {
			context.resume().catch((pError: unknown) => {
				GodotRuntime.error("Error while resuming audio:", pError);
			});
		}
	},

	godot_audio_input_start__proxy: "sync",
	godot_audio_input_start__sig: "i",
	godot_audio_input_start: (): CInt => {
		return GodotRuntime.asCInt(
			GodotAudio.createInput((pInput) => {
				const driver = GodotAudio.driver;
				if (driver == null) {
					throw new TypeError($getNullishErrorString("GodotAudio.driver"));
				}
				const worklet = driver.getNode();
				if (worklet != null) {
					pInput.connect(worklet);
				}
			}),
		);
	},

	godot_audio_input_stop__proxy: "sync",
	godot_audio_input_stop__sig: "v",
	godot_audio_input_stop: (): void => {
		if (GodotAudio.input == null) {
			return;
		}

		const tracks = GodotAudio.input.mediaStream.getTracks();
		for (const track of tracks) {
			track.stop();
		}
		GodotAudio.input.disconnect();
		GodotAudio.input = null;
	},

	godot_audio_sample_stream_is_registered__proxy: "sync",
	godot_audio_sample_stream_is_registered__sig: "ip",
	godot_audio_sample_stream_is_registered: (pStreamObjectIdStrPtr: CCharPointer): CInt => {
		const streamObjectId = GodotRuntime.parseString(pStreamObjectIdStrPtr);
		return GodotRuntime.asCIntBoolean(GodotAudio.Sample.getSampleOrNull(streamObjectId) != null);
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
		const context = GodotAudio.context;
		if (context == null) {
			return;
		}

		const streamObjectId = GodotRuntime.parseString(pStreamObjectIdStrPtr);
		const loopMode = GodotRuntime.parseString(pLoopModeStrPtr);
		if (!isLoopMode(loopMode)) {
			throw new Error(`\`${loopMode}\` is not a valid loop mode.`);
		}

		const numberOfChannels = 2;
		const sampleRate = context.sampleRate;

		const subLeft = GodotRuntime.heapSub(HEAPF32, pFramesPtr, pFramesTotal);
		const subRight = GodotRuntime.heapSub(
			HEAPF32,
			GodotRuntime.asCType<CPointer>(pFramesPtr + pFramesTotal * Float32Array.BYTES_PER_ELEMENT),
			pFramesTotal,
		);

		const audioBuffer = context.createBuffer(numberOfChannels, pFramesTotal, sampleRate);
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
				loopMode,
				numberOfChannels,
				sampleRate,
			},
		);
	},

	godot_audio_sample_unregister_stream__proxy: "sync",
	godot_audio_sample_unregister_stream__sig: "vp",
	godot_audio_sample_unregister_stream: (pStreamObjectIdStrPtr: CCharPointer): void => {
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
		const playbackObjectId = GodotRuntime.parseString(pPlaybackObjectIdStrPtr);
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
		GodotAudio.startSample(playbackObjectId, streamObjectId, pBusIndex, startOptions);
	},

	godot_audio_sample_stop__proxy: "sync",
	godot_audio_sample_stop__sig: "vp",
	godot_audio_sample_stop: (pPlaybackObjectIdStrPtr: CCharPointer): void => {
		const playbackObjectId = GodotRuntime.parseString(pPlaybackObjectIdStrPtr);
		GodotAudio.stopSample(playbackObjectId);
	},

	godot_audio_sample_set_pause__proxy: "sync",
	godot_audio_sample_set_pause__sig: "vpi",
	godot_audio_sample_set_pause: (pPlaybackObjectIdStrPtr: CCharPointer, pPause: CInt): void => {
		const playbackObjectId = GodotRuntime.parseString(pPlaybackObjectIdStrPtr);
		GodotAudio.sampleSetPause(playbackObjectId, Boolean(pPause));
	},

	godot_audio_sample_is_active__proxy: "sync",
	godot_audio_sample_is_active__sig: "ip",
	godot_audio_sample_is_active: (pPlaybackObjectIdStrPtr: CCharPointer): CInt => {
		const playbackObjectId = GodotRuntime.parseString(pPlaybackObjectIdStrPtr);
		return GodotRuntime.asCIntBoolean(GodotAudio.sampleNodes.has(playbackObjectId));
	},

	godot_audio_get_sample_playback_position__proxy: "sync",
	godot_audio_get_sample_playback_position__sig: "dp",
	godot_audio_get_sample_playback_position: (pPlaybackObjectIdStrPtr: CCharPointer): CDouble => {
		const playbackObjectId = GodotRuntime.parseString(pPlaybackObjectIdStrPtr);
		const sampleNode = GodotAudio.SampleNode.getSampleNodeOrNull(playbackObjectId);
		if (sampleNode == null) {
			return GodotRuntime.asCType<CDouble>(0);
		}
		return GodotRuntime.asCType<CDouble>(sampleNode.getPlaybackPosition());
	},

	godot_audio_sample_update_pitch_scale__proxy: "sync",
	godot_audio_sample_update_pitch_scale__sig: "vpf",
	godot_audio_sample_update_pitch_scale: (pPlaybackObjectIdStrPtr: CCharPointer, pPitchScale: CFloat): void => {
		const playbackObjectId = GodotRuntime.parseString(pPlaybackObjectIdStrPtr);
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
		const playbackObjectId = GodotRuntime.parseString(pPlaybackObjectIdStrPtr);

		const buses = GodotRuntime.heapSub(HEAP32, pBusesPtr, pBusesSize);
		const volumes = GodotRuntime.heapSub(HEAPF32, pVolumesPtr, pVolumesSize);

		GodotAudio.sampleSetVolumesLinear(playbackObjectId, Array.from(buses), volumes);
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
	godot_audio_sample_bus_set_send: (pBus: CInt, pSendIndex: CInt): void => {
		GodotAudio.setSampleBusSend(pBus, pSendIndex);
	},

	godot_audio_sample_bus_set_volume_db__proxy: "sync",
	godot_audio_sample_bus_set_volume_db__sig: "vif",
	godot_audio_sample_bus_set_volume_db: (pBus: CInt, pVolumeDb: CFloat): void => {
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
		GodotAudio.sampleFinishedCallback = GodotRuntime.getFunction(pCallbackPtr);
	},
};
autoAddDeps(_GodotAudio, "$GodotAudio");
addToLibrary(_GodotAudio);
