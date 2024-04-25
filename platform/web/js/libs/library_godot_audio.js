/**************************************************************************/
/*  library_godot_audio.js                                                */
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

/**
 * @typedef {{
 *   audioBuffer: AudioBuffer,
 *   numberOfChannels: number,
 *   sampleRate: number,
 *   loopMode: string,
 *   loopBegin: number,
 *   loopEnd: number,
 * }} Sample
 * 
 * @typedef {{
 *   offset: number,
 *   volumeDb: number,
 *   positionMode: string,
 *   busIndex: number
 * }} SampleNodeStartOptions
 * 
 * @typedef {{
 *  currentBus: number,
 *  source: AudioBufferSourceNode,
 *  gain: GainNode,
 *  stereoPanner: StereoPannerNode,
 *  startOptions: SampleNodeStartOptions,
 *  getOutputNode(): StereoPannerNode,
 *  clear(): void,
 * }} SampleNode
 * 
 * @typedef {{
 *   gain: GainNode,
 *   solo: GainNode,
 *   mute: GainNode,
 *   getInputNode(): GainNode,
 *   getOutputNode(): GainNode,
 *   clear(): void
 * }} Bus
 */
const GodotAudio = {
	$GodotAudio__deps: ['$GodotRuntime', '$GodotOS'],
	$GodotAudio: {
		ctx: null,
		input: null,
		driver: null,
		interval: 0,
		samples: null,
		sampleNodes: null,
		buses: null,

		linear_to_db: function (linear) {
			return Math.log(linear) * 8.6858896380650365530225783783321;
		},
		db_to_linear: function (db) {
			return Math.exp(db * 0.11512925464970228420089957273422);
		},

		init: function (mix_rate, latency, onstatechange, onlatencyupdate) {
			GodotAudio.samples = new Map();
			GodotAudio.sampleNodes = new Map();
			GodotAudio.buses = [];

			const opts = {};
			// If mix_rate is 0, let the browser choose.
			if (mix_rate) {
				GodotAudio.sampleRate = mix_rate;
				opts['sampleRate'] = mix_rate;
			}
			// Do not specify, leave 'interactive' for good performance.
			// opts['latencyHint'] = latency / 1000;
			const ctx = new (window.AudioContext || window.webkitAudioContext)(opts);
			GodotAudio.ctx = ctx;
			ctx.onstatechange = function () {
				let state = 0;
				switch (ctx.state) {
				case 'suspended':
					state = 0;
					break;
				case 'running':
					state = 1;
					break;
				case 'closed':
					state = 2;
					break;

					// no default
				}
				onstatechange(state);
			};
			ctx.onstatechange(); // Immediately notify state.
			// Update computed latency
			GodotAudio.interval = setInterval(function () {
				let computed_latency = 0;
				if (ctx.baseLatency) {
					computed_latency += GodotAudio.ctx.baseLatency;
				}
				if (ctx.outputLatency) {
					computed_latency += GodotAudio.ctx.outputLatency;
				}
				onlatencyupdate(computed_latency);
			}, 1000);
			GodotOS.atexit(GodotAudio.close_async);
			return ctx.destination.channelCount;
		},

		create_input: function (callback) {
			if (GodotAudio.input) {
				return 0; // Already started.
			}
			function gotMediaInput(stream) {
				try {
					GodotAudio.input = GodotAudio.ctx.createMediaStreamSource(stream);
					callback(GodotAudio.input);
				} catch (e) {
					GodotRuntime.error('Failed creating input.', e);
				}
			}
			if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
				navigator.mediaDevices.getUserMedia({
					'audio': true,
				}).then(gotMediaInput, function (e) {
					GodotRuntime.error('Error getting user media.', e);
				});
			} else {
				if (!navigator.getUserMedia) {
					navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
				}
				if (!navigator.getUserMedia) {
					GodotRuntime.error('getUserMedia not available.');
					return 1;
				}
				navigator.getUserMedia({
					'audio': true,
				}, gotMediaInput, function (e) {
					GodotRuntime.print(e);
				});
			}
			return 0;
		},

		close_async: function (resolve, reject) {
			const ctx = GodotAudio.ctx;
			GodotAudio.ctx = null;
			// Audio was not initialized.
			if (!ctx) {
				resolve();
				return;
			}
			// Remove latency callback
			if (GodotAudio.interval) {
				clearInterval(GodotAudio.interval);
				GodotAudio.interval = 0;
			}
			// Disconnect input, if it was started.
			if (GodotAudio.input) {
				GodotAudio.input.disconnect();
				GodotAudio.input = null;
			}
			// Disconnect output
			let closed = Promise.resolve();
			if (GodotAudio.driver) {
				closed = GodotAudio.driver.close();
			}
			closed.then(function () {
				return ctx.close();
			}).then(function () {
				ctx.onstatechange = null;
				resolve();
			}).catch(function (e) {
				ctx.onstatechange = null;
				GodotRuntime.error('Error closing AudioContext', e);
				resolve();
			});
		},

		/** @type {(playbackObjectId: number, streamObjectId: number, startOptions: SampleNodeStartOptions) => void} */
		start_sample: async function (playbackObjectId, streamObjectId, startOptions) {
			console.info(`start_sample(${playbackObjectId}, ${streamObjectId}, ${startOptions})`);
			/** @type {AudioContext} */
			const ctx = GodotAudio.ctx;

			GodotAudio.stop_sample(playbackObjectId);
			if (!GodotAudio.samples.has(streamObjectId)) {
				console.warn(`Could not start sample "${streamObjectId}", no sample found.`);
				return;
			}

			/** @type {Sample} */
			const sample = GodotAudio.samples.get(streamObjectId);
			/** @type {SampleNode} */
			const sampleNode = {
				source: ctx.createBufferSource(),
				gain: ctx.createGain(),
				stereoPanner: ctx.createStereoPanner(),
				startOptions,
				getOutputNode() {
					return this.stereoPanner;
				},
				clear() {
					this.source.disconnect();
					this.gain.disconnect();
					this.stereoPanner.disconnect();
				}
			};

			sampleNode.source.buffer = sample.audioBuffer;
			sampleNode.source.playbackRate = sample

			sampleNode.source.connect(sampleNode.gain);
			sampleNode.gain.connect(sampleNode.stereoPanner);
			
			sampleNode.gain.gain.value = GodotAudio.db_to_linear(startOptions.volumeDb);
			sampleNode.source.loop = sample.loopMode !== 'disabled';

			sampleNode.source.addEventListener('ended', () => {
				GodotAudio.stop_sample(playbackObjectId);
			});

			sampleNode.currentBus = startOptions.busIndex;
			/** @type {Bus[]} */
			const buses = GodotAudio.buses;
			const bus = buses[startOptions.busIndex];
			sampleNode.getOutputNode().connect(bus.getInputNode());

			sampleNode.source.start(startOptions.offset);
			GodotAudio.sampleNodes.set(playbackObjectId, sampleNode);
		},

		/** @type {(playbackObjectId: number) => void} */
		stop_sample: function (playbackObjectId) {
			console.info(`stop_sample(${playbackObjectId})`);

			/** @type {Map<number, SampleNode>} */
			const sampleNodes = GodotAudio.sampleNodes;
			const sampleNode = sampleNodes.get(playbackObjectId);
			if (sampleNode == null) {
				// Fail silently, it's ok.
				return;
			}
			sampleNode.source.stop();

			GodotAudio.sampleNodes.delete(playbackObjectId);
		},

		/** @type {(playbackObjectId: number, pan: number, volumeDb: number, pitchScale: number) => void} */
		update_sample: function (playbackObjectId, busIndex, pan, volumeDb, pitchScale) {
			// console.info(`update_sample(${playbackObjectId}, ${pan}, ${volumeDb}, ${pitchScale})`);
			/** @type {Map<number, SampleNode>} */
			const sampleNodes = GodotAudio.sampleNodes;
			const sampleNode = sampleNodes.get(playbackObjectId);
			if (sampleNode == null) {
				console.error(`error while trying to update sample node: sample node not found "${playbackObjectId}"`);
				return;
			}
			if (sampleNode.currentBus != busIndex) {
				/** @type {Bus[]} */
				const buses = GodotAudio.buses;
				const newBus = buses[busIndex];
				sampleNode.currentBus = busIndex;
				sampleNode.getOutputNode().disconnect();
				sampleNode.getOutputNode().connect(newBus.getInputNode());
			}
			sampleNode.source.playbackRate = pitchScale;
			sampleNode.gain.gain.value = GodotAudio.db_to_linear(volumeDb);
			sampleNode.stereoPanner.pan.value = pan;
		},

		/** @type {() => Bus} */
		create_sample_bus: function () {
			console.info(`create_sample_bus()`);
			/** @type {AudioContext} */
			const ctx = GodotAudio.ctx;

			/** @type {Bus} */
			const bus = {
				gain: ctx.createGain(),
				solo: ctx.createGain(),
				mute: ctx.createGain(),
				getInputNode() {
					return this.gain;
				},
				getOutputNode() {
					return this.mute;
				},
				clear() {
					this.gain.disconnect();
					this.solo.disconnect();
					this.mute.disconnect();
				}
			};
			bus.gain.connect(bus.solo);
			bus.solo.connect(bus.mute);
			return bus;
		},

		/** @type {(count: number) => void} */
		set_sample_bus_count: function (count) {
			console.info(`set_sample_bus_count(${count})`);
			/** @type {AudioContext} */
			const ctx = GodotAudio.ctx;
			/** @type {Bus[]} */
			const buses = GodotAudio.buses;

			if (count === buses.length) {
				return;
			}

			if (count < buses.length) {
				// TODO: what to do with nodes connected to the deleted buses?
				const deletedBuses = buses.slice(count);
				for (const deletedBus of deletedBuses) {
					deletedBus.clear();
				}
				GodotAudio.buses = buses.slice(0, count);
				return;
			}

			// count > buses.length
			for (let i = buses.length; i < count; i++) {
				/** @type {Bus} */
				const bus = GodotAudio.create_sample_bus();
				bus.getOutputNode().connect(ctx.destination);
				buses.push(bus);
			}
		},

		/** @type {(index: number) => void} */
		remove_sample_bus: function (index) {
			console.info(`remove_sample_bus(${index})`);
			/** @type {Bus[]} */
			const buses = GodotAudio.buses;
			const deletedBus = buses[index];
			deletedBus.clear();
			GodotAudio.buses = buses.filter((_, i) => i !== index);
		},

		/** @type {(atPos: number) => void} */
		add_sample_bus: function (atPos) {
			console.info(`add_sample_bus(${atPos})`);
			/** @type {AudioContext} */
			const ctx = GodotAudio.ctx;
			/** @type {Bus} */
			const newBus = GodotAudio.create_sample_bus();
			newBus.getOutputNode().connect(ctx.destination);
			/** @type {Bus[]} */
			const buses = GodotAudio.buses;
			GodotAudio.buses = [].concat(
				buses.slice(0, atPos),
				bus,
				buses.slice(atPos)
			);
		},

		/** @type {(busIndex: number, toPos: number) => void} */
		move_sample_bus: function (busIndex, toPos) {
			console.info(`move_sample_bus(${busIndex}, ${toPos})`);
			/** @type {AudioContext} */
			const ctx = GodotAudio.ctx;
			/** @type {Bus[]} */
			let buses = GodotAudio.buses;
			let movedBus = buses[busIndex];
			buses = buses.filter((_, i) => i !== busIndex);
			GodotAudio.buses = [].concat(
				buses.slice(0, toPos - 1),
				movedBus,
				buses.slice(toPos - 1)
			);

			/** @type {Map<number, SampleNode>} */
			const sampleNodes = GodotAudio.sampleNodes;
			sampleNodes.forEach((sampleNode) => {
				if (sampleNode.currentBus === busIndex) {
					sampleNode.currentBus = toPos;
					return;
				}
				if (sampleNode.currentBus < toPos) {
					sampleNode.currentBus -= 1;
				}
			});
		},

		/** @type {(busIndex: number, volumeDb: number) => void} */
		set_sample_bus_volume_db: function (busIndex, volumeDb) {
			console.info(`set_sample_bus_volume_db(${busIndex}, ${volumeDb})`);
			/** @type {Bus} */
			const bus = GodotAudio.buses[busIndex];
			bus.gain.gain.value = GodotAudio.db_to_linear(volumeDb);
		},

		/** @type {(busIndex: number, enable: boolean) => void} */
		set_sample_bus_solo: function (busIndex, enable) {
			console.info(`set_sample_bus_solo(${busIndex}, ${enable})`);
			/** @type {Bus[]} */
			const buses = GodotAudio.buses;
			const bus = buses[busIndex];
			bus.solo.gain.value = enable ? 1 : 0;
			const otherBuses = buses.filter((_, i) => i !== busIndex);
			for (const otherBus of otherBuses) {
				otherBus.solo.gain.value = enable ? 0 : 1;
			}
		},

		/** @type {(busIndex: number, enable: boolean) => void} */
		set_sample_bus_mute: function (busIndex, enable) {
			console.info(`set_sample_bus_mute(${busIndex}, ${enable})`);
			/** @type {Bus} */
			const bus = GodotAudio.buses[busIndex];
			bus.mute.gain.value = enable ? 0 : 1;
		},
	},

	godot_audio_is_available__sig: 'i',
	godot_audio_is_available__proxy: 'sync',
	godot_audio_is_available: function () {
		if (!(window.AudioContext || window.webkitAudioContext)) {
			return 0;
		}
		return 1;
	},

	godot_audio_has_worklet__proxy: 'sync',
	godot_audio_has_worklet__sig: 'i',
	godot_audio_has_worklet: function () {
		return (GodotAudio.ctx && GodotAudio.ctx.audioWorklet) ? 1 : 0;
	},

	godot_audio_has_script_processor__proxy: 'sync',
	godot_audio_has_script_processor__sig: 'i',
	godot_audio_has_script_processor: function () {
		return (GodotAudio.ctx && GodotAudio.ctx.createScriptProcessor) ? 1 : 0;
	},

	godot_audio_init__proxy: 'sync',
	godot_audio_init__sig: 'iiiii',
	godot_audio_init: function (p_mix_rate, p_latency, p_state_change, p_latency_update) {
		const statechange = GodotRuntime.get_func(p_state_change);
		const latencyupdate = GodotRuntime.get_func(p_latency_update);
		const mix_rate = GodotRuntime.getHeapValue(p_mix_rate, 'i32');
		const channels = GodotAudio.init(mix_rate, p_latency, statechange, latencyupdate);
		GodotRuntime.setHeapValue(p_mix_rate, GodotAudio.ctx.sampleRate, 'i32');
		return channels;
	},

	godot_audio_resume__proxy: 'sync',
	godot_audio_resume__sig: 'v',
	godot_audio_resume: function () {
		if (GodotAudio.ctx && GodotAudio.ctx.state !== 'running') {
			GodotAudio.ctx.resume();
		}
	},

	godot_audio_input_start__proxy: 'sync',
	godot_audio_input_start__sig: 'i',
	godot_audio_input_start: function () {
		return GodotAudio.create_input(function (input) {
			input.connect(GodotAudio.driver.get_node());
		});
	},

	godot_audio_input_stop__proxy: 'sync',
	godot_audio_input_stop__sig: 'v',
	godot_audio_input_stop: function () {
		if (GodotAudio.input) {
			const tracks = GodotAudio.input['mediaStream']['getTracks']();
			for (let i = 0; i < tracks.length; i++) {
				tracks[i]['stop']();
			}
			GodotAudio.input.disconnect();
			GodotAudio.input = null;
		}
	},

	godot_audio_sample_stream_is_registered__proxy: 'sync',
	godot_audio_sample_stream_is_registered__sig: 'ii',
	godot_audio_sample_stream_is_registered: function (streamObjectId) {
		return GodotAudio.samples.has(streamObjectId);
	},

	godot_audio_sample_register_stream__proxy: 'sync',
	godot_audio_sample_register_stream__sig: 'viiiiiii',
	/** @type {(streamObjectId: number, framesPtr: number, framesTotal: number, sampleRate: number, loopModeStrPtr: number, loopBegin: number, loopEnd: number) => void} */
	godot_audio_sample_register_stream: function (streamObjectId, framesPtr, framesTotal, sampleRate, loopModeStrPtr, loopBegin, loopEnd) {
		const BYTES_PER_FLOAT32 = 4;
		const loopMode = GodotRuntime.parseString(loopModeStrPtr);
		const numberOfChannels = 2;

		/** @type {Sample} */
		const sample = {
			audioBuffer: null,
			sampleRate,
			loopMode,
			loopBegin,
			loopEnd,
		};

		/** @type {Float32Array} */
		const subLeft = GodotRuntime.heapSub(HEAPF32, framesPtr, framesTotal);
		/** @type {Float32Array} */
		const subRight = GodotRuntime.heapSub(HEAPF32, framesPtr + (framesTotal * BYTES_PER_FLOAT32), framesTotal);

		/** @type {AudioContext} */
		const ctx = GodotAudio.ctx;
		const audioBuffer = ctx.createBuffer(numberOfChannels, framesTotal, GodotAudio.ctx.sampleRate);
		audioBuffer.copyToChannel(new Float32Array(subLeft), 0, 0);
		audioBuffer.copyToChannel(new Float32Array(subRight), 1, 0);

		sample.audioBuffer = audioBuffer;

		GodotAudio.samples.set(streamObjectId, sample);
	},

	godot_audio_sample_unregister_stream__proxy: 'sync',
	godot_audio_sample_unregister_stream__sig: 'vi',
	godot_audio_sample_unregister_stream: function (streamObjectId) {
		GodotAudio.samples.delete(streamObjectId);
	},

	godot_audio_sample_start__proxy: 'sync',
	godot_audio_sample_start__sig: 'viiiiii',
	/** @type {(playbackObjectId: number, streamObjectId: number, busIndex: number, offset: number, volumeDb: number, positionModeStrPtr: number)} */
	godot_audio_sample_start: function (playbackObjectId, streamObjectId, busIndex, offset, volumeDb, positionModeStrPtr) {
		/** @type {string} */
		const positionMode = GodotRuntime.parseString(positionModeStrPtr);
		/** @type {SampleNodeStartOptions} */
		const startOptions = {
			offset,
			volumeDb,
			positionMode,
			busIndex
		};
		GodotAudio.start_sample(playbackObjectId, streamObjectId, startOptions);
	},

	godot_audio_sample_stop__proxy: 'sync',
	godot_audio_sample_stop__sig: 'vi',
	godot_audio_sample_stop: function (playbackObjectId) {
		GodotAudio.stop_sample(playbackObjectId);
	},

	godot_audio_sample_is_active__proxy: 'sync',
	godot_audio_sample_is_active__sig: 'vi',
	godot_audio_sample_is_active: function (playbackObjectId) {
		return GodotAudio.sampleNodes.has(playbackObjectId);
	},

	godot_audio_sample_update__proxy: 'sync',
	godot_audio_sample_update__sig: 'viii',
	godot_audio_sample_update: function (playbackObjectId, pan, volumeDb, pitchScale) {
		GodotAudio.update_sample(playbackObjectId, pan, volumeDb, pitchScale);
	},

	godot_audio_sample_bus_set_count__proxy: 'sync',
	godot_audio_sample_bus_set_count__sig: 'vi',
	godot_audio_sample_bus_set_count: function (count) {
		GodotAudio.set_sample_bus_count(count);
	},

	godot_audio_sample_bus_remove__proxy: 'sync',
	godot_audio_sample_bus_remove__sig: 'vi',
	godot_audio_sample_bus_remove: function (index) {
		GodotAudio.remove_sample_bus(index);
	},

	godot_audio_sample_bus_add__proxy: 'sync',
	godot_audio_sample_bus_add__sig: 'vi',
	godot_audio_sample_bus_add: function (atPos) {
		GodotAudio.add_sample_bus(atPos);
	},

	godot_audio_sample_bus_move__proxy: 'sync',
	godot_audio_sample_bus_move__sig: 'vii',
	godot_audio_sample_bus_move: function (bus, toPos) {
		GodotAudio.move_sample_bus(bus, toPos);
	},

	godot_audio_sample_bus_set_volume_db__proxy: 'sync',
	godot_audio_sample_bus_set_volume_db__sig: 'vii',
	godot_audio_sample_bus_set_volume_db: function (bus, volumeDb) {
		GodotAudio.set_sample_bus_volume_db(bus, volumeDb);
	},

	godot_audio_sample_bus_set_solo__proxy: 'sync',
	godot_audio_sample_bus_set_solo__sig: 'vii',
	godot_audio_sample_bus_set_solo: function (bus, enable) {
		GodotAudio.set_sample_bus_solo(bus, enable);
	},

	godot_audio_sample_bus_set_mute__proxy: 'sync',
	godot_audio_sample_bus_set_mute__sig: 'vii',
	godot_audio_sample_bus_set_mute: function (bus, enable) {
		GodotAudio.set_sample_bus_mute(bus, enable);
	},
};

autoAddDeps(GodotAudio, '$GodotAudio');
mergeInto(LibraryManager.library, GodotAudio);

/**
 * The AudioWorklet API driver, used when threads are available.
 */
const GodotAudioWorklet = {
	$GodotAudioWorklet__deps: ['$GodotAudio', '$GodotConfig'],
	$GodotAudioWorklet: {
		promise: null,
		worklet: null,
		ring_buffer: null,

		create: function (channels) {
			const path = GodotConfig.locate_file('godot.audio.worklet.js');
			GodotAudioWorklet.promise = GodotAudio.ctx.audioWorklet.addModule(path).then(function () {
				GodotAudioWorklet.worklet = new AudioWorkletNode(
					GodotAudio.ctx,
					'godot-processor',
					{
						'outputChannelCount': [channels],
					}
				);
				return Promise.resolve();
			});
			GodotAudio.driver = GodotAudioWorklet;
		},

		start: function (in_buf, out_buf, state) {
			GodotAudioWorklet.promise.then(function () {
				const node = GodotAudioWorklet.worklet;
				node.connect(GodotAudio.ctx.destination);
				node.port.postMessage({
					'cmd': 'start',
					'data': [state, in_buf, out_buf],
				});
				node.port.onmessage = function (event) {
					GodotRuntime.error(event.data);
				};
			});
		},

		start_no_threads: function (p_out_buf, p_out_size, out_callback, p_in_buf, p_in_size, in_callback) {
			function RingBuffer() {
				let wpos = 0;
				let rpos = 0;
				let pending_samples = 0;
				const wbuf = new Float32Array(p_out_size);

				function send(port) {
					if (pending_samples === 0) {
						return;
					}
					const buffer = GodotRuntime.heapSub(HEAPF32, p_out_buf, p_out_size);
					const size = buffer.length;
					const tot_sent = pending_samples;
					out_callback(wpos, pending_samples);
					if (wpos + pending_samples >= size) {
						const high = size - wpos;
						wbuf.set(buffer.subarray(wpos, size));
						pending_samples -= high;
						wpos = 0;
					}
					if (pending_samples > 0) {
						wbuf.set(buffer.subarray(wpos, wpos + pending_samples), tot_sent - pending_samples);
					}
					port.postMessage({ 'cmd': 'chunk', 'data': wbuf.subarray(0, tot_sent) });
					wpos += pending_samples;
					pending_samples = 0;
				}
				this.receive = function (recv_buf) {
					const buffer = GodotRuntime.heapSub(HEAPF32, p_in_buf, p_in_size);
					const from = rpos;
					let to_write = recv_buf.length;
					let high = 0;
					if (rpos + to_write >= p_in_size) {
						high = p_in_size - rpos;
						buffer.set(recv_buf.subarray(0, high), rpos);
						to_write -= high;
						rpos = 0;
					}
					if (to_write) {
						buffer.set(recv_buf.subarray(high, to_write), rpos);
					}
					in_callback(from, recv_buf.length);
					rpos += to_write;
				};
				this.consumed = function (size, port) {
					pending_samples += size;
					send(port);
				};
			}
			GodotAudioWorklet.ring_buffer = new RingBuffer();
			GodotAudioWorklet.promise.then(function () {
				const node = GodotAudioWorklet.worklet;
				const buffer = GodotRuntime.heapSlice(HEAPF32, p_out_buf, p_out_size);
				node.connect(GodotAudio.ctx.destination);
				node.port.postMessage({
					'cmd': 'start_nothreads',
					'data': [buffer, p_in_size],
				});
				node.port.onmessage = function (event) {
					if (!GodotAudioWorklet.worklet) {
						return;
					}
					if (event.data['cmd'] === 'read') {
						const read = event.data['data'];
						GodotAudioWorklet.ring_buffer.consumed(read, GodotAudioWorklet.worklet.port);
					} else if (event.data['cmd'] === 'input') {
						const buf = event.data['data'];
						if (buf.length > p_in_size) {
							GodotRuntime.error('Input chunk is too big');
							return;
						}
						GodotAudioWorklet.ring_buffer.receive(buf);
					} else {
						GodotRuntime.error(event.data);
					}
				};
			});
		},

		get_node: function () {
			return GodotAudioWorklet.worklet;
		},

		close: function () {
			return new Promise(function (resolve, reject) {
				if (GodotAudioWorklet.promise === null) {
					return;
				}
				const p = GodotAudioWorklet.promise;
				p.then(function () {
					GodotAudioWorklet.worklet.port.postMessage({
						'cmd': 'stop',
						'data': null,
					});
					GodotAudioWorklet.worklet.disconnect();
					GodotAudioWorklet.worklet.port.onmessage = null;
					GodotAudioWorklet.worklet = null;
					GodotAudioWorklet.promise = null;
					resolve();
				}).catch(function (err) {
					// Aborted?
					GodotRuntime.error(err);
				});
			});
		},
	},

	godot_audio_worklet_create__proxy: 'sync',
	godot_audio_worklet_create__sig: 'ii',
	godot_audio_worklet_create: function (channels) {
		try {
			GodotAudioWorklet.create(channels);
		} catch (e) {
			GodotRuntime.error('Error starting AudioDriverWorklet', e);
			return 1;
		}
		return 0;
	},

	godot_audio_worklet_start__proxy: 'sync',
	godot_audio_worklet_start__sig: 'viiiii',
	godot_audio_worklet_start: function (p_in_buf, p_in_size, p_out_buf, p_out_size, p_state) {
		const out_buffer = GodotRuntime.heapSub(HEAPF32, p_out_buf, p_out_size);
		const in_buffer = GodotRuntime.heapSub(HEAPF32, p_in_buf, p_in_size);
		const state = GodotRuntime.heapSub(HEAP32, p_state, 4);
		GodotAudioWorklet.start(in_buffer, out_buffer, state);
	},

	godot_audio_worklet_start_no_threads__proxy: 'sync',
	godot_audio_worklet_start_no_threads__sig: 'viiiiii',
	godot_audio_worklet_start_no_threads: function (p_out_buf, p_out_size, p_out_callback, p_in_buf, p_in_size, p_in_callback) {
		const out_callback = GodotRuntime.get_func(p_out_callback);
		const in_callback = GodotRuntime.get_func(p_in_callback);
		GodotAudioWorklet.start_no_threads(p_out_buf, p_out_size, out_callback, p_in_buf, p_in_size, in_callback);
	},

	godot_audio_worklet_state_wait__sig: 'iiii',
	godot_audio_worklet_state_wait: function (p_state, p_idx, p_expected, p_timeout) {
		Atomics.wait(HEAP32, (p_state >> 2) + p_idx, p_expected, p_timeout);
		return Atomics.load(HEAP32, (p_state >> 2) + p_idx);
	},

	godot_audio_worklet_state_add__sig: 'iiii',
	godot_audio_worklet_state_add: function (p_state, p_idx, p_value) {
		return Atomics.add(HEAP32, (p_state >> 2) + p_idx, p_value);
	},

	godot_audio_worklet_state_get__sig: 'iii',
	godot_audio_worklet_state_get: function (p_state, p_idx) {
		return Atomics.load(HEAP32, (p_state >> 2) + p_idx);
	},
};

autoAddDeps(GodotAudioWorklet, '$GodotAudioWorklet');
mergeInto(LibraryManager.library, GodotAudioWorklet);

/*
 * The ScriptProcessorNode API, used when threads are disabled.
 */
const GodotAudioScript = {
	$GodotAudioScript__deps: ['$GodotAudio'],
	$GodotAudioScript: {
		script: null,

		create: function (buffer_length, channel_count) {
			GodotAudioScript.script = GodotAudio.ctx.createScriptProcessor(buffer_length, 2, channel_count);
			GodotAudio.driver = GodotAudioScript;
			return GodotAudioScript.script.bufferSize;
		},

		start: function (p_in_buf, p_in_size, p_out_buf, p_out_size, onprocess) {
			GodotAudioScript.script.onaudioprocess = function (event) {
				// Read input
				const inb = GodotRuntime.heapSub(HEAPF32, p_in_buf, p_in_size);
				const input = event.inputBuffer;
				if (GodotAudio.input) {
					const inlen = input.getChannelData(0).length;
					for (let ch = 0; ch < 2; ch++) {
						const data = input.getChannelData(ch);
						for (let s = 0; s < inlen; s++) {
							inb[s * 2 + ch] = data[s];
						}
					}
				}

				// Let Godot process the input/output.
				onprocess();

				// Write the output.
				const outb = GodotRuntime.heapSub(HEAPF32, p_out_buf, p_out_size);
				const output = event.outputBuffer;
				const channels = output.numberOfChannels;
				for (let ch = 0; ch < channels; ch++) {
					const data = output.getChannelData(ch);
					// Loop through samples and assign computed values.
					for (let sample = 0; sample < data.length; sample++) {
						data[sample] = outb[sample * channels + ch];
					}
				}
			};
			GodotAudioScript.script.connect(GodotAudio.ctx.destination);
		},

		get_node: function () {
			return GodotAudioScript.script;
		},

		close: function () {
			return new Promise(function (resolve, reject) {
				GodotAudioScript.script.disconnect();
				GodotAudioScript.script.onaudioprocess = null;
				GodotAudioScript.script = null;
				resolve();
			});
		},
	},

	godot_audio_script_create__proxy: 'sync',
	godot_audio_script_create__sig: 'iii',
	godot_audio_script_create: function (buffer_length, channel_count) {
		const buf_len = GodotRuntime.getHeapValue(buffer_length, 'i32');
		try {
			const out_len = GodotAudioScript.create(buf_len, channel_count);
			GodotRuntime.setHeapValue(buffer_length, out_len, 'i32');
		} catch (e) {
			GodotRuntime.error('Error starting AudioDriverScriptProcessor', e);
			return 1;
		}
		return 0;
	},

	godot_audio_script_start__proxy: 'sync',
	godot_audio_script_start__sig: 'viiiii',
	godot_audio_script_start: function (p_in_buf, p_in_size, p_out_buf, p_out_size, p_cb) {
		const onprocess = GodotRuntime.get_func(p_cb);
		GodotAudioScript.start(p_in_buf, p_in_size, p_out_buf, p_out_size, onprocess);
	},
};

autoAddDeps(GodotAudioScript, '$GodotAudioScript');
mergeInto(LibraryManager.library, GodotAudioScript);
