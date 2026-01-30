/**************************************************************************/
/*  bus.ts                                                                */
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
import type { SampleNode } from "./sample_node.js";

export class Bus {
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
			for (const deletedBus of deletedBuses) {
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
		const context = GodotAudio.context;
		throwIfNullish(context, new Error("`GodotAudio.context` is null or undefined."));

		this._sampleNodes = new Set();
		this.isSolo = false;
		this._send = null;

		this._gainNode = context.createGain();
		this._soloNode = context.createGain();
		this._muteNode = context.createGain();

		this._gainNode.connect(this._soloNode).connect(this._muteNode);
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
		const context = GodotAudio.context;
		throwIfNullish(context, new Error("`GodotAudio.context` is null or undefined."));

		this._send = pSend;
		if (pSend == null) {
			if (this.getId() === 0) {
				this.getOutputNode().connect(context.destination);
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
		this.getOutputNode().disconnect();
		this.getOutputNode().connect(pBus.getInputNode());
		return pBus;
	}

	clear(): void {
		GodotAudio.buses = GodotAudio.buses.filter((pBus) => pBus !== this);
	}

	_syncSampleNodes(): void {
		const sampleNodes = Array.from(this._sampleNodes);
		for (const sampleNode of sampleNodes) {
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
		const otherBuses = GodotAudio.buses.filter((pOtherBus) => pOtherBus !== this);
		for (const otherBus of otherBuses) {
			otherBus._soloNode.gain.value = 0;
		}
	}

	_disableSolo(): void {
		this.isSolo = false;
		GodotAudio.busSolo = null;
		this._soloNode.gain.value = 1;
		const otherBuses = GodotAudio.buses.filter((pOtherBus) => pOtherBus !== this);
		for (const otherBus of otherBuses) {
			otherBus._soloNode.gain.value = 1;
		}
	}
}
