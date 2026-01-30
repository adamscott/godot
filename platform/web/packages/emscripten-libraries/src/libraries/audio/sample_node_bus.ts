/**************************************************************************/
/*  sample_node_bus.ts                                                    */
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

import { throwIfNullish } from "@godotengine/utils/error";
import type { Bus } from "./bus.js";

export class SampleNodeBus {
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

		const context = GodotAudio.context;
		throwIfNullish(context, new Error("`GodotAudio.context` is nullish."));

		this._bus = pBus;
		this._channelSplitter = context.createChannelSplitter(NUMBER_OF_WEB_CHANNELS);
		this._lChannel = context.createGain();
		this._rChannel = context.createGain();
		this._slChannel = context.createGain();
		this._srChannel = context.createGain();
		this._cChannel = context.createGain();
		this._lfeChannel = context.createGain();
		this._channelMerger = context.createChannelMerger(NUMBER_OF_WEB_CHANNELS);

		this._channelSplitter
			.connect(this._lChannel, GodotAudio.WebChannel.CHANNEL_L)
			.connect(this._channelMerger, GodotAudio.WebChannel.CHANNEL_L, GodotAudio.WebChannel.CHANNEL_L);
		this._channelSplitter
			.connect(this._rChannel, GodotAudio.WebChannel.CHANNEL_R)
			.connect(this._channelMerger, GodotAudio.WebChannel.CHANNEL_L, GodotAudio.WebChannel.CHANNEL_R);
		this._channelSplitter
			.connect(this._slChannel, GodotAudio.WebChannel.CHANNEL_SL)
			.connect(this._channelMerger, GodotAudio.WebChannel.CHANNEL_L, GodotAudio.WebChannel.CHANNEL_SL);
		this._channelSplitter
			.connect(this._srChannel, GodotAudio.WebChannel.CHANNEL_SR)
			.connect(this._channelMerger, GodotAudio.WebChannel.CHANNEL_L, GodotAudio.WebChannel.CHANNEL_SR);
		this._channelSplitter
			.connect(this._cChannel, GodotAudio.WebChannel.CHANNEL_C)
			.connect(this._channelMerger, GodotAudio.WebChannel.CHANNEL_L, GodotAudio.WebChannel.CHANNEL_C);
		this._channelSplitter
			.connect(this._lfeChannel, GodotAudio.WebChannel.CHANNEL_L)
			.connect(this._channelMerger, GodotAudio.WebChannel.CHANNEL_L, GodotAudio.WebChannel.CHANNEL_LFE);

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
			throw new Error(`Volume length isn't "${GodotAudio.MAX_VOLUME_CHANNELS}", is ${pVolume.length} instead`);
		}
		if (
			this._lChannel == null ||
			this._rChannel == null ||
			this._slChannel == null ||
			this._srChannel == null ||
			this._cChannel == null ||
			this._lfeChannel == null
		) {
			throw new Error("Channels are null");
		}

		const getVolumeValue = (
			pChannel: (typeof GodotAudio.GodotChannel)[keyof typeof GodotAudio.GodotChannel],
		): number => {
			if (pChannel >= pVolume.length) {
				return 0;
			}
			return pVolume[pChannel];
		};

		this._lChannel.gain.value = getVolumeValue(GodotAudio.GodotChannel.CHANNEL_L);
		this._rChannel.gain.value = getVolumeValue(GodotAudio.GodotChannel.CHANNEL_R);
		this._slChannel.gain.value = getVolumeValue(GodotAudio.GodotChannel.CHANNEL_SL);
		this._srChannel.gain.value = getVolumeValue(GodotAudio.GodotChannel.CHANNEL_SR);
		this._cChannel.gain.value = getVolumeValue(GodotAudio.GodotChannel.CHANNEL_C);
		this._lfeChannel.gain.value = getVolumeValue(GodotAudio.GodotChannel.CHANNEL_LFE);
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
