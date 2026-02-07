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

export class RingBuffer {
	buffer: Float32Array;
	readPosition: number;
	writePosition: number;

	constructor(pBuffer: Float32Array) {
		this.buffer = pBuffer;
		this.readPosition = 0;
		this.writePosition = 0;
	}

	// eslint-disable-next-line @typescript-eslint/class-methods-use-this -- Virtual method.
	dataLeft(): number {
		throw new Error("Virtual method to override.");
	}

	spaceLeft(): number {
		return this.buffer.length - this.dataLeft();
	}

	read(pOutput: Float32Array): void {
		const size = this.buffer.length;
		let from = 0;
		let bytesToWrite = pOutput.length;
		if (this.readPosition + bytesToWrite > size) {
			const high = size - this.readPosition;
			pOutput.set(this.buffer.subarray(this.readPosition, size));
			from = high;
			bytesToWrite -= high;
			this.readPosition = 0;
		}
		if (bytesToWrite > 0) {
			pOutput.set(this.buffer.subarray(this.readPosition, this.readPosition + bytesToWrite), from);
		}
		this.readPosition += bytesToWrite;
	}

	write(pInput: Float32Array): void {
		const bytesToWrite = pInput.length;
		const mw = this.buffer.length - this.writePosition;
		if (mw >= bytesToWrite) {
			this.buffer.set(pInput, this.writePosition);
			this.writePosition += bytesToWrite;
			if (mw === bytesToWrite) {
				this.writePosition = 0;
			}
		} else {
			const high = pInput.subarray(0, mw);
			const low = pInput.subarray(mw);
			this.buffer.set(high, this.writePosition);
			this.buffer.set(low);
			this.writePosition = low.length;
		}
	}
}

export class RingBufferThreaded extends RingBuffer {
	available: Int32Array;

	constructor(pBuffer: Float32Array, pAvailable: Int32Array) {
		super(pBuffer);
		this.available = pAvailable;
	}

	dataLeft(): number {
		return Atomics.load(this.available, 0);
	}

	read(pOutput: Float32Array): void {
		super.read(pOutput);
		Atomics.add(this.available, 0, -pOutput.length);
		Atomics.notify(this.available, 0);
	}

	write(pInput: Float32Array): void {
		const bytesToWrite = pInput.length;
		super.write(pInput);
		Atomics.add(this.available, 0, bytesToWrite);
		Atomics.notify(this.available, 0);
	}
}

export class RingBufferNonThreaded extends RingBuffer {
	available: number;

	constructor(pBuffer: Float32Array, pAvailable: number) {
		super(pBuffer);
		this.available = pAvailable;
	}

	dataLeft(): number {
		return this.available;
	}

	read(pOutput: Float32Array): void {
		super.read(pOutput);
		this.available -= pOutput.length;
	}

	write(pInput: Float32Array): void {
		const bytesToWrite = pInput.length;
		super.write(pInput);
		this.available += bytesToWrite;
	}
}
