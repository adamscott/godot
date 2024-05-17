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

/* eslint-disable no-use-before-define */

/**
 * @typedef {typeof import("./library_godot_audio").PositionMode} PositionMode
 * @typedef {typeof import("./library_godot_audio").LoopMode} LoopMode
 * @typedef {typeof import("./library_godot_audio").Sample} Sample
 * @typedef {typeof import("./library_godot_audio").SampleNodeBus} SampleNodeBus
 * @typedef {typeof import("./library_godot_audio").SampleNode} SampleNode
 * @typedef {typeof import("./library_godot_audio").Bus} Bus
 */

function GodotAudioClassesInit() {
	// Sample class definition
	function Sample(params, options = {}) {
		this.id = params.id;
		this._audioBuffer = null;
		this.numberOfChannels = options.numberOfChannels ?? 2;
		this.sampleRate = options.sampleRate ?? 44100;
		this.loopMode = options.loopMode ?? 'disabled';
		this.loopBegin = options.loopBegin ?? 0;
		this.loopEnd = options.loopEnd ?? 0;

		Object.defineProperties(this, {
			'audioBuffer': {
				get() {
					return this._duplicateAudioBuffer();
				},
				set(val) {
					this._audioBuffer = val;
				},
			},
		});
		this.audioBuffer = params.audioBuffer;
	}
	Sample._samples = new Map();
	Sample.getSample = function (id) {
		if (!Sample._samples.has(id)) {
			throw new Error(`Could not find sample "${id}"`);
		}
		return Sample._samples.get(id);
	};
	Sample.getSampleOrNull = function (id) {
		return this._samples.get(id) ?? null;
	};
	Sample.prototype.clear = function () {
		this.audioBuffer = null;
		Sample._samples.delete(this.id);
	};
	Sample.prototype._duplicateAudioBuffer = function () {
		if (this._audioBuffer == null) {
			throw new Error("couldn't duplicate a null audioBuffer");
		}
		/** @type {Float32Array[]} */
		const channels = new Array(this._audioBuffer.numberOfChannels);
		for (let i = 0; i < this._audioBuffer.numberOfChannels; i++) {
			const channel = new Float32Array(this._audioBuffer.getChannelData(i));
			channels[i] = channel;
		}
		const buffer = GodotAudio.ctx.createBuffer(this.numberOfChannels, this._audioBuffer.length, this._audioBuffer.sampleRate);
		for (let i = 0; i < channels.length; i++) {
			buffer.copyToChannel(channels[i], i, 0);
		}
		return buffer;
	};

	// SampleNodeBus class definition
	function SampleNodeBus(bus) {
		this._bus = bus;

		this._channelSplitter = GodotAudio.ctx.createChannelSplitter(6);
		this._l = GodotAudio.ctx.createGain();
		this._r = GodotAudio.ctx.createGain();
		this._sl = GodotAudio.ctx.createGain();
		this._sr = GodotAudio.ctx.createGain();
		this._c = GodotAudio.ctx.createGain();
		this._lfe = GodotAudio.ctx.createGain();
		this._channelMerger = GodotAudio.ctx.createChannelMerger(6);

		this._channelSplitter
			.connect(this._l, GodotAudio.WebChannel.CHANNEL_L)
			.connect(this._channelMerger, GodotAudio.WebChannel.CHANNEL_L, GodotAudio.WebChannel.CHANNEL_L);
		this._channelSplitter
			.connect(this._r, GodotAudio.WebChannel.CHANNEL_R)
			.connect(this._channelMerger, GodotAudio.WebChannel.CHANNEL_L, GodotAudio.WebChannel.CHANNEL_R);
		this._channelSplitter
			.connect(this._sl, GodotAudio.WebChannel.CHANNEL_SL)
			.connect(this._channelMerger, GodotAudio.WebChannel.CHANNEL_L, GodotAudio.WebChannel.CHANNEL_SL);
		this._channelSplitter
			.connect(this._sr, GodotAudio.WebChannel.CHANNEL_SR)
			.connect(this._channelMerger, GodotAudio.WebChannel.CHANNEL_L, GodotAudio.WebChannel.CHANNEL_SR);
		this._channelSplitter
			.connect(this._c, GodotAudio.WebChannel.CHANNEL_C)
			.connect(this._channelMerger, GodotAudio.WebChannel.CHANNEL_L, GodotAudio.WebChannel.CHANNEL_C);
		this._channelSplitter
			.connect(this._lfe, GodotAudio.WebChannel.CHANNEL_L)
			.connect(this._channelMerger, GodotAudio.WebChannel.CHANNEL_L, GodotAudio.WebChannel.CHANNEL_LFE);

		this._channelMerger.connect(this._bus.inputNode);

		Object.defineProperties(this, {
			'inputNode': {
				get() {
					return this._channelSplitter;
				},
			},
			'outputNode': {
				get() {
					return this._channelMerger;
				},
			},
		});
	}
	SampleNodeBus.prototype.setVolume = function (volume) {
		if (volume.length !== GodotAudio.MAX_CHANNELS) {
			throw new Error(`Volume length isn't "${GodotAudio.MAX_CHANNELS}", is ${volume.length} instead`);
		}
		this._l.gain.value = volume[GodotAudio.GodotChannel.CHANNEL_L] ?? 0;
		this._r.gain.value = volume[GodotAudio.GodotChannel.CHANNEL_R] ?? 0;
		this._sl.gain.value = volume[GodotAudio.GodotChannel.CHANNEL_SL] ?? 0;
		this._sr.gain.value = volume[GodotAudio.GodotChannel.CHANNEL_SR] ?? 0;
		this._c.gain.value = volume[GodotAudio.GodotChannel.CHANNEL_C] ?? 0;
		this._lfe.gain.value = volume[GodotAudio.GodotChannel.CHANNEL_LFE] ?? 0;
	};
	SampleNodeBus.prototype.clear = function () {
		this._bus = null;
		this._channelSplitter.disconnect();
		this._channelSplitter = null;
		this._l.disconnect();
		this._l = null;
		this._r.disconnect();
		this._r = null;
		this._sl.disconnect();
		this._sl = null;
		this._sr.disconnect();
		this._sr = null;
		this._c.disconnect();
		this._c = null;
		this._lfe.disconnect();
		this._lfe = null;
		this._channelMerger.disconnect();
		this._channelMerger = null;
	};

	// SampleNode class definition
	function SampleNode(params, options = {}) {
		this.id = params.id;
		this.streamObjectId = params.streamObjectId;

		this._source = GodotAudio.ctx.createBufferSource();

		this._playbackRate = 44100;
		this.offset = options.offset ?? 0;
		this.positionMode = options.positionMode ?? 'none';
		this._loopMode = 'disabled';
		this.startTime = options.startTime ?? 0;
		this.pauseTime = 0;
		this._pitchScale = 1;
		this._sampleNodeBuses = new Map();

		Object.defineProperties(this, {
			'playbackRate': {
				get() {
					return this._playbackRate;
				},
				set(val) {
					this._playbackRate = val;
					this._syncPlaybackRate();
				},
			},
			'loopMode': {
				get() {
					return this._loopMode;
				},
				set(val) {
					this._loopMode = val;
					this._source.loop = val === 'forward';
				},
			},
			'pitchScale': {
				get() {
					return this._pitchScale;
				},
				set(val) {
					this._pitchScale = val;
					this._syncPlaybackRate();
				},
			},
			'sample': {
				get() {
					return GodotAudio.Sample.getSample(this.streamObjectId);
				},
			},
		});
		this.playbackRate = options.playbackRate ?? 44100;
		this.loopMode = options.loopMode ?? this.sample.loopMode ?? 'disabled';
		this._source.buffer = this.sample.audioBuffer;

		const self = this;
		this._source.addEventListener('ended', (event) => {
			switch (self.sample.loopMode) {
			case 'none':
				GodotAudio.stop_sample(this.id);
				break;
			default:
				// do nothing
			}
		});

		const bus = GodotAudio.Bus.getBus(params.busIndex);
		const sampleNodeBus = this.getSampleNodeBus(bus);
		sampleNodeBus.setVolume(options.volume);
	}
	SampleNode._sampleNodes = new Map();
	SampleNode.getSampleNode = function (id) {
		if (!GodotAudio.SampleNode._sampleNodes.has(id)) {
			throw new Error(`Could not find sample node "${id}"`);
		}
		return GodotAudio.SampleNode._sampleNodes.get(id);
	};
	SampleNode.getSampleNodeOrNull = function (id) {
		return GodotAudio.SampleNode._sampleNodes.get(id) ?? null;
	};
	SampleNode.stopSampleNode = function (id) {
		const sampleNode = GodotAudio.SampleNode.getSampleNodeOrNull(id);
		if (sampleNode == null) {
			return;
		}
		sampleNode.stop();
	};
	SampleNode.pauseSampleNode = function (id, enable) {
		const sampleNode = GodotAudio.SampleNode.getSampleNode(id);
		sampleNode.pause(enable);
	};
	SampleNode.prototype.start = function () {
		this._source.start(this.offset);
	};
	SampleNode.prototype.stop = function () {
		this._source.stop();
		this.clear();
	};
	SampleNode.prototype.pause = function (enable = true) {
		if (enable) {
			this.pauseTime = (GodotAudio.ctx.currentTime - this.startTime) / this.playbackRate;
			this._source.stop();
			return;
		}

		if (this.pauseTime === 0) {
			return;
		}

		/** @type {Sample} */
		this._source.buffer = this.sample.audioBuffer;
		this._source.connect(this._gain);
		this._source.start(this.offset + this.pauseTime);
	};
	SampleNode.prototype.connect = function (node) {
		return this.outputNode.connect(node);
	};
	SampleNode.prototype.setVolumes = function (buses, volumes) {
		for (let busIdx = 0; busIdx < buses.length; busIdx++) {
			const sampleNodeBus = this.getSampleNodeBus(buses[busIdx]);
			sampleNodeBus.setVolume(
				volumes.slice(busIdx * GodotAudio.MAX_CHANNELS, (busIdx * GodotAudio.MAX_CHANNELS) + GodotAudio.MAX_CHANNELS)
			);
		}
	};
	SampleNode.prototype.getSampleNodeBus = function (bus) {
		if (!this._sampleNodeBuses.has(bus)) {
			this._sampleNodeBuses.set(bus, new GodotAudio.SampleNodeBus(bus));
			this._source.connect(this._sampleNodeBuses.get(bus).inputNode);
		}
		return this._sampleNodeBuses.get(bus);
	};
	SampleNode.prototype.clear = function () {
		this._source.stop();
		this._source.disconnect();
		this._source = null;

		this._sampleNodeBuses.forEach((sampleNodeBus) => {
			sampleNodeBus.clear();
		});
		this._sampleNodeBuses.clear();
		this._sampleNodeBuses = null;

		SampleNode._sampleNodes.delete(this.id);
	};
	SampleNode.prototype._syncPlaybackRate = function () {
		this._source.playbackRate.value = this.playbackRate * this.pitchScale;
	};

	// Bus class definition
	function Bus() {
		this._sampleNodes = new Set();
		this.isSolo = false;
		this._send = null;

		Object.defineProperties(this, {
			'id': {
				get() {
					return GodotAudio.Bus._buses.indexOf(this);
				},
			},
			'volumeDb': {
				get() {
					return GodotAudio.linear_to_db(this._gainNode.gain.value);
				},
				set(val) {
					this._gainNode.gain.value = GodotAudio.db_to_linear(val);
				},
			},
			'send': {
				get() {
					return this._send;
				},
				set(val) {
					this._send = val;
					if (val == null) {
						if (this.id === 0) {
							this.outputNode.connect(GodotAudio.ctx.destination);
							return;
						}
						throw new Error(`Cannot send to "${val}" without the bus being at index 0 (current index: ${this.id})`);
					}
					this.connect(val);
				},
			},
			'inputNode': {
				get() {
					return this._gainNode;
				},
			},
			'outputNode': {
				get() {
					return this._muteNode;
				},
			},
		});

		this._gainNode = GodotAudio.ctx.createGain();
		this._soloNode = GodotAudio.ctx.createGain();
		this._muteNode = GodotAudio.ctx.createGain();

		this._gainNode
			.connect(this._soloNode)
			.connect(this._muteNode);

		const isFirstBus = GodotAudio.Bus._buses.length === 0;
		GodotAudio.Bus._buses.push(this);
		if (isFirstBus) {
			this.send = null;
		} else {
			this.send = GodotAudio.Bus.getBus(0);
		}
	}
	Bus._buses = [];
	Bus._busSolo = null;
	Bus.getBus = function (index) {
		if (index < 0 || index > GodotAudio.Bus._buses.length) {
			throw new Error(`invalid bus index "${index}"`);
		}
		return GodotAudio.Bus._buses[index];
	};
	Bus.move = function (fromIndex, toIndex) {
		const movedBus = GodotAudio.Bus.getBus(fromIndex);
		let buses = GodotAudio.Bus._buses;
		buses = buses.filter((_, i) => i !== fromIndex);
		// Inserts at index.
		buses.splice(toIndex - 1, 0, movedBus);
		GodotAudio.Bus._buses = buses;
	};
	Bus.addAt = function (index) {
		const newBus = new GodotAudio.Bus();
		newBus.getOutputNode().connect(GodotAudio.ctx.destination);
		// Inserts at index.
		GodotAudio.Bus._buses.splice(index, 0, newBus);
	};
	Object.defineProperties(Bus, {
		'count': {
			get() {
				return GodotAudio.Bus._buses.length;
			},
			set(val) {
				const buses = GodotAudio.Bus._buses;
				if (val === buses.length) {
					return;
				}

				if (val < buses.length) {
					// TODO: what to do with nodes connected to the deleted buses?
					const deletedBuses = buses.slice(val);
					for (let i = 0; i < deletedBuses.length; i++) {
						const deletedBus = deletedBuses[i];
						deletedBus.clear();
					}
					GodotAudio.Bus._buses = buses.slice(0, val);
					return;
				}

				for (let i = GodotAudio.Bus._buses.length; i < val; i++) {
					const bus = new GodotAudio.Bus();
					Bus._buses.push(bus);
				}
			},
		},
	});
	Bus.prototype.mute = function (enable) {
		this._muteNode.gain.value = enable ? 0 : 1;
	};
	Bus.prototype.solo = function (enable) {
		if (this.isSolo === enable) {
			return;
		}

		if (enable) {
			if (GodotAudio.Bus._busSolo != null && GodotAudio.Bus._busSolo !== this) {
				GodotAudio.Bus._busSolo._disableSolo();
			}
			this._enableSolo();
			return;
		}

		this._disableSolo();
	};
	Bus.prototype.addSampleNode = function (sampleNode) {
		this._sampleNodes.add(sampleNode);
		sampleNode.outputNode.connect(this.inputNode);
	};
	Bus.prototype.removeSampleNode = function (sampleNode) {
		this._sampleNodes.delete(sampleNode);
		sampleNode.outputNode.disconnect();
	};
	Bus.prototype.connect = function (bus) {
		if (bus == null) {
			throw new Error('cannot connect to null bus');
		}
		this.outputNode.disconnect();
		this.outputNode.connect(bus.inputNode);
		return bus;
	};
	Bus.prototype.clear = function () {
		GodotAudio.Bus._buses = GodotAudio.Bus._buses.filter((v) => v !== this);
	};
	Bus.prototype._syncSampleNodes = function () {
		const sampleNodes = Array.from(this._sampleNodes);
		for (let i = 0; i < sampleNodes.length; i++) {
			const sampleNode = sampleNodes[i];
			sampleNode.outputNode.disconnect();
			sampleNode.outputNode.connect(this.inputNode);
		}
	};
	Bus.prototype._disableSolo = function () {
		this.isSolo = false;
		GodotAudio.Bus._busSolo = null;
		this._soloNode.gain.value = 1;
		const otherBuses = GodotAudio.Bus._buses.filter((otherBus) => otherBus !== this);
		for (let i = 0; i < otherBuses.length; i++) {
			const otherBus = otherBuses[i];
			otherBus._soloNode.gain.value = 1;
		}
	};
	Bus.prototype._enableSolo = function () {
		this.isSolo = true;
		GodotAudio.Bus._busSolo = this;
		this._soloNode.gain.value = 1;
		const otherBuses = GodotAudio.Bus._buses.filter((otherBus) => otherBus !== this);
		for (let i = 0; i < otherBuses.length; i++) {
			const otherBus = otherBuses[i];
			otherBus._soloNode.gain.value = 0;
		}
	};

	GodotAudio.Sample = Sample;
	GodotAudio.SampleNodeBus = SampleNodeBus;
	GodotAudio.SampleNode = SampleNode;
	GodotAudio.Bus = Bus;
}

const GodotAudio = {
	MAX_CHANNELS: 8,
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
	WebChannel: Object.freeze({
		CHANNEL_L: 0,
		CHANNEL_R: 1,
		CHANNEL_SL: 2,
		CHANNEL_SR: 3,
		CHANNEL_C: 4,
		CHANNEL_LFE: 5,
	}),

	/** @type {Sample} */
	Sample: null,
	/** @type {SampleNodeBus} */
	SampleNodeBus: null,
	/** @type {SampleNode} */
	SampleNode: null,
	/** @type {Bus} */
	Bus: null,

	classesInit: GodotAudioClassesInit,

	/** @type {AudioContext} */
	ctx: null,
	input: null,
	driver: null,
	interval: 0,
	/** @type {Map<string, Sample>} */
	samples: null,
	/** @type {Bus[]} */
	buses: null,

	/** @type {(linear: number) => number} */
	linear_to_db: function (linear) {
		// eslint-disable-next-line no-loss-of-precision
		return Math.log(linear) * 8.6858896380650365530225783783321;
	},
	/** @type {(db: number) => number} */
	db_to_linear: function (db) {
		// eslint-disable-next-line no-loss-of-precision
		return Math.exp(db * 0.11512925464970228420089957273422);
	},

	init: function (mix_rate, latency, onstatechange, onlatencyupdate) {
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

	/** @type {(playbackObjectId: string, streamObjectId: number, busIndex: number, startOptions: SampleNodeConstructorOptions) => void} */
	start_sample: async function (playbackObjectId, streamObjectId, busIndex, startOptions) {
		GodotAudio.SampleNode.stopSampleNode(playbackObjectId);

		const sampleNode = new GodotAudio.SampleNode({
			busIndex: busIndex,
			id: playbackObjectId,
			streamObjectId: streamObjectId,
		}, startOptions);
		GodotAudio.SampleNode._sampleNodes.set(playbackObjectId, sampleNode);

		sampleNode.start();
	},

	/** @type {(playbackObjectId: string) => void} */
	stop_sample: function (playbackObjectId) {
		GodotAudio.SampleNode.stopSampleNode(playbackObjectId);
	},

	/** @type {(playbackObjectId: string, pause: boolean) => void} */
	sample_set_pause: function (playbackObjectId, pause) {
		GodotAudio.SampleNode.pauseSampleNode(playbackObjectId, pause);
	},

	/** @type {(playbackObjectId: string, busIndex: number, pitchScale: number) => void} */
	update_sample_pitch_scale: function (playbackObjectId, pitchScale) {
		const sampleNode = GodotAudio.SampleNode.getSampleNode(playbackObjectId);
		sampleNode.pitchScale = pitchScale;
	},

	/** @type {(playbackObjectId: string, busIndexes: number[], volumes: Float32Array) => void} */
	sample_set_volumes_linear(playbackObjectId, busIndexes, volumes) {
		const sampleNode = GodotAudio.SampleNode.getSampleNode(playbackObjectId);
		const buses = busIndexes.map((busIndex) => GodotAudio.Bus.getBus(busIndex));
		sampleNode.setVolumes(buses, volumes);
	},

	/** @type {(count: number) => void} */
	set_sample_bus_count: function (count) {
		GodotAudio.Bus.count = count;
	},

	/** @type {(index: number) => void} */
	remove_sample_bus: function (index) {
		const bus = GodotAudio.Bus.getBus(index);
		bus.clear();
	},

	/** @type {(atPos: number) => void} */
	add_sample_bus: function (atPos) {
		GodotAudio.Bus.addAt(atPos);
	},

	/** @type {(busIndex: number, toPos: number) => void} */
	move_sample_bus: function (busIndex, toPos) {
		GodotAudio.Bus.move(busIndex, toPos);
	},

	/** @type {(busIndex: number, sendIndex: number) => void} */
	set_sample_bus_send: function (busIndex, sendIndex) {
		const bus = GodotAudio.Bus.getBus(busIndex);
		bus.send = GodotAudio.Bus.getBus(sendIndex);
	},

	/** @type {(busIndex: number, volumeDb: number) => void} */
	set_sample_bus_volume_db: function (busIndex, volumeDb) {
		const bus = GodotAudio.Bus.getBus(busIndex);
		bus.volumeDb = volumeDb;
	},

	/** @type {(busIndex: number, enable: boolean) => void} */
	set_sample_bus_solo: function (busIndex, enable) {
		const bus = GodotAudio.Bus.getBus(busIndex);
		bus.solo(enable);
	},

	/** @type {(busIndex: number, enable: boolean) => void} */
	set_sample_bus_mute: function (busIndex, enable) {
		const bus = GodotAudio.Bus.getBus(busIndex);
		bus.mute(enable);
	},
};

const _GodotAudio = {
	$GodotAudio__deps: ['$GodotRuntime', '$GodotOS'],
	$GodotAudio__postset: `
		GodotAudio.classesInit();
`,
	$GodotAudio: GodotAudio,

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
		return GodotAudio.Sample.getSampleOrNull(streamObjectId) != null;
	},

	godot_audio_sample_register_stream__proxy: 'sync',
	godot_audio_sample_register_stream__sig: 'viiiiiii',
	/** @type {(streamObjectIdStrPtr: number, framesPtr: number, framesTotal: number, sampleRate: number, loopModeStrPtr: number, loopBegin: number, loopEnd: number) => void} */
	godot_audio_sample_register_stream: function (streamObjectIdStrPtr, framesPtr, framesTotal, loopModeStrPtr, loopBegin, loopEnd) {
		const BYTES_PER_FLOAT32 = 4;
		const streamObjectId = GodotRuntime.parseString(streamObjectIdStrPtr);
		const loopMode = GodotRuntime.parseString(loopModeStrPtr);
		const numberOfChannels = 2;
		const sampleRate = GodotAudio.ctx.sampleRate;

		/** @type {Float32Array} */
		const subLeft = GodotRuntime.heapSub(HEAPF32, framesPtr, framesTotal);
		/** @type {Float32Array} */
		const subRight = GodotRuntime.heapSub(HEAPF32, framesPtr + (framesTotal * BYTES_PER_FLOAT32), framesTotal);

		const audioBuffer = GodotAudio.ctx.createBuffer(numberOfChannels, framesTotal, sampleRate);
		audioBuffer.copyToChannel(new Float32Array(subLeft), 0, 0);
		audioBuffer.copyToChannel(new Float32Array(subRight), 1, 0);

		const sample = new GodotAudio.Sample({
			id: streamObjectId,
			audioBuffer,
		}, {
			loopBegin,
			loopEnd,
			loopMode,
			numberOfChannels,
			sampleRate,
		});
		GodotAudio.Sample._samples.set(streamObjectId, sample);
	},

	godot_audio_sample_unregister_stream__proxy: 'sync',
	godot_audio_sample_unregister_stream__sig: 'vi',
	/** @type {(streamObjectIdStrPtr: number) => void} */
	godot_audio_sample_unregister_stream: function (streamObjectIdStrPtr) {
		const streamObjectId = GodotRuntime.parseString(streamObjectIdStrPtr);
		GodotAudio.samples.delete(streamObjectId);
	},

	godot_audio_sample_start__proxy: 'sync',
	godot_audio_sample_start__sig: 'viiiiii',
	/** @type {(playbackObjectIdStrPtr: number, streamObjectIdStrPtr: number, busIndex: number, offset: number, volumePtr: number, positionModeStrPtr: number)} */
	godot_audio_sample_start: function (playbackObjectIdStrPtr, streamObjectIdStrPtr, busIndex, offset, volumePtr, positionModeStrPtr) {
		const playbackObjectId = GodotRuntime.parseString(playbackObjectIdStrPtr);
		const streamObjectId = GodotRuntime.parseString(streamObjectIdStrPtr);
		/** @type {string} */
		const positionMode = GodotRuntime.parseString(positionModeStrPtr);
		/** @type {Float32Array} */
		const volume = GodotRuntime.heapSub(HEAPF32, volumePtr, 8);
		/** @type {SampleNodeConstructorOptions} */
		const startOptions = {
			offset,
			volume,
			positionMode,
			playbackRate: 1,
		};
		GodotAudio.start_sample(playbackObjectId, streamObjectId, busIndex, startOptions);
	},

	godot_audio_sample_stop__proxy: 'sync',
	godot_audio_sample_stop__sig: 'vi',
	/** @type {(playbackObjectIdStrPtr: number) => void} */
	godot_audio_sample_stop: function (playbackObjectIdStrPtr) {
		const playbackObjectId = GodotRuntime.parseString(playbackObjectIdStrPtr);
		GodotAudio.stop_sample(playbackObjectId);
	},

	godot_audio_sample_set_pause__proxy: 'sync',
	godot_audio_sample_set_pause__sig: 'vii',
	godot_audio_sample_set_pause: function (playbackObjectIdStrPtr, pause) {
		const playbackObjectId = GodotRuntime.parseString(playbackObjectIdStrPtr);
		GodotAudio.sample_set_pause(playbackObjectId, pause);
	},

	godot_audio_sample_is_active__proxy: 'sync',
	godot_audio_sample_is_active__sig: 'vi',
	godot_audio_sample_is_active: function (playbackObjectIdStrPtr) {
		const playbackObjectId = GodotRuntime.parseString(playbackObjectIdStrPtr);
		return GodotAudio.sampleNodes.has(playbackObjectId);
	},

	godot_audio_sample_update_pitch_scale__proxy: 'sync',
	godot_audio_sample_update_pitch_scale__sig: 'vii',
	godot_audio_sample_update_pitch_scale: function (playbackObjectIdStrPtr, pitchScale) {
		const playbackObjectId = GodotRuntime.parseString(playbackObjectIdStrPtr);
		GodotAudio.update_sample_pitch_scale(playbackObjectId, pitchScale);
	},

	godot_audio_sample_set_volumes_linear__proxy: 'sync',
	godot_audio_sample_set_volumes_linear__sig: 'vii',
	godot_audio_sample_set_volumes_linear: function (playbackObjectIdStrPtr, busesPtr, busesSize, volumesPtr, volumesSize) {
		const playbackObjectId = GodotRuntime.parseString(playbackObjectIdStrPtr);

		/** @type {Uint32Array} */
		const buses = GodotRuntime.heapSub(HEAP32, busesPtr, busesSize);
		/** @type {Float32Array} */
		const volumes = GodotRuntime.heapSub(HEAPF32, volumesPtr, volumesSize);

		GodotAudio.sample_set_volumes_linear(playbackObjectId, Array.from(buses), volumes);
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

	godot_audio_sample_bus_set_send__proxy: 'sync',
	godot_audio_sample_bus_set_send__sig: 'vii',
	godot_audio_sample_bus_set_send: function (bus, sendIndex) {
		GodotAudio.set_sample_bus_send(bus, sendIndex);
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

autoAddDeps(_GodotAudio, '$GodotAudio');
mergeInto(LibraryManager.library, _GodotAudio);

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
