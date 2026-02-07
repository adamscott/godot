/**************************************************************************/
/*  ring_buffer.ts                                                        */
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

import type { CPointer } from "@godotengine/emscripten-utils/types";

export type RingBufferOutCallback = (pWPosition: number, pPendingSamples: number) => void;
export type RingBufferInCallback = (pFrom: number, pLength: number) => void;

export class RingBuffer {
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
		const buffer = GodotRuntime.heapSub(HEAPF32, this.outBufferPtr, this.outBufferSize);
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
				buffer.subarray(this.wPosition, this.wPosition + this.pendingSamples),
				totalSent - this.pendingSamples,
			);
		}
		pPort.postMessage({
			cmd: "chunk",
			data: this.wBuffer.subarray(0, totalSent),
		});
		this.wPosition += this.pendingSamples;
		this.pendingSamples = 0;
	}

	receive(pReceivedBuffer: Float32Array): void {
		const buffer = GodotRuntime.heapSub(HEAPF32, this.inBufferPtr, this.inBufferSize);
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
