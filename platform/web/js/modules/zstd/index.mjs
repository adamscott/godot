import { NULLPTR, initWasmUtils } from "@godotengine/common";

import { default as ZstdWasmModule } from "./zstd.mjs";

export const wasm = await ZstdWasmModule();
const { mallocOrDie, freeOrDie, sizeOf, WasmValue, WasmStruct } = initWasmUtils(wasm);

/**
 * Zstd stream "in-buffer"
 * @typedef {{ srcPtr: number, size: number, pos: number }} ZstdInBuffer
 */

/**
 * Zstd stream "out-buffer"
 * @typedef {{ dstPtr: number, size: number, pos: number }} ZstdOutBuffer
 */

/**
 * Converts an object to `ZSTD_inBuffer` struct data
 * @param {Object} param
 * @param {number} param.srcPtr
 * @param {number} param.size
 * @param {number} param.pos
 * @returns {Uint8Array}
 */
function toZSTD_inBuffer({ srcPtr, size, pos }) {
	const uint32Array = new Uint32Array(3);
	const dataView = new DataView(uint32Array.buffer);
	dataView.setUint32(0 * Uint32Array.BYTES_PER_ELEMENT, srcPtr, true);
	dataView.setUint32(1 * Uint32Array.BYTES_PER_ELEMENT, size, true);
	dataView.setUint32(2 * Uint32Array.BYTES_PER_ELEMENT, pos, true);
	return new Uint8Array(uint32Array.buffer);
}

/**
 * Converts `ZSTD_inBuffer` struct data to an object.
 * @param {TypedArray} zstdInBuffer
 * @returns {ZstdInBuffer}
 */
function fromZSTD_inBuffer(zstdInBuffer) {
	if (zstdInBuffer.byteLength !== 3 * Uint32Array.BYTES_PER_ELEMENT) {
		throw new Error("Invalid `ZSTD_inBuffer` struct data");
	}
	const dataView = new DataView(zstdInBuffer.buffer);
	return {
		srcPtr: dataView.getUint32(0 * Uint32Array.BYTES_PER_ELEMENT, true),
		size: dataView.getUint32(1 * Uint32Array.BYTES_PER_ELEMENT, true),
		pos: dataView.getUint32(2 * Uint32Array.BYTES_PER_ELEMENT, true),
	};
}

/**
 * Converts parameters to `ZSTD_outBuffer` struct data
 * @param {Object} param
 * @param {number} param.dstPtr
 * @param {number} param.size
 * @param {number} param.pos
 * @returns {Uint8Array}
 */
function toZSTD_outBuffer({ dstPtr, size, pos }) {
	const uint32Array = new Uint32Array(3);
	const dataView = new DataView(uint32Array.buffer);
	dataView.setUint32(0 * Uint32Array.BYTES_PER_ELEMENT, dstPtr, true);
	dataView.setUint32(1 * Uint32Array.BYTES_PER_ELEMENT, size, true);
	dataView.setUint32(2 * Uint32Array.BYTES_PER_ELEMENT, pos, true);
	return new Uint8Array(uint32Array.buffer);
}

/**
 * Converts `ZSTD_outBuffer` struct data to an object.
 * @param {TypedArray} zstdOutBuffer
 * @returns {ZstdOutBuffer}
 */
function fromZSTD_outBuffer(zstdOutBuffer) {
	if (zstdOutBuffer.byteLength !== 3 * Uint32Array.BYTES_PER_ELEMENT) {
		throw new Error("Invalid `ZSTD_outBuffer` struct data");
	}
	const dataView = new DataView(zstdOutBuffer.buffer);
	return {
		dstPtr: dataView.getUint32(0 * Uint32Array.BYTES_PER_ELEMENT, true),
		size: dataView.getUint32(1 * Uint32Array.BYTES_PER_ELEMENT, true),
		pos: dataView.getUint32(2 * Uint32Array.BYTES_PER_ELEMENT, true),
	};
}

/**
 * The logic of `ZstdUncompressStream`.
 */
const zstdTransformContent = {
	start() {
		this.ctxPtr = wasm._ZSTD_createDCtx();
		if (this.ctxPtr === NULLPTR) {
			throw new Error("Could not create new Zstd context.");
		}

		this.inBufferSize = wasm._ZSTD_DStreamInSize();
		this.outBufferSize = wasm._ZSTD_DStreamOutSize();
		this.inBuffer = new WasmValue(this.inBufferSize);
		this.outBuffer = new WasmValue(this.outBufferSize);
		this.inBufferData = new WasmStruct([
			{ name: "src", type: "*", size: sizeOf("*"), offset: 0 },
			{ name: "size", type: "u32", size: sizeOf("u32"), offset: sizeOf("*") },
			{ name: "pos", type: "u32", size: sizeOf("u32"), offset: sizeOf("*") + sizeOf("u32") },
		]);
		this.outBufferData = new WasmStruct([
			{ name: "dst", type: "*", size: sizeOf("*"), offset: 0 },
			{ name: "size", type: "u32", size: sizeOf("u32"), offset: sizeOf("*") },
			{ name: "pos", type: "u32", size: sizeOf("u32"), offset: sizeOf("*") + sizeOf("u32") },
		]);
	},

	async transform(chunk, controller) {
		let _chunk = await chunk;
		let offset = 0;
		let subchunk;

		while (true) {
			let nextInputOffset = offset + this.inBufferSize;
			if (this.lastReturn > 0) {
				nextInputOffset = offset + this.lastReturn;
			}

			subchunk = _chunk.slice(offset, nextInputOffset);
			if (subchunk.byteLength === 0) {
				break;
			}
			this.inBuffer.value = subchunk;

			this.inBufferData.set("src", this.inBuffer.ptr);
			this.inBufferData.set("size", subchunk.byteLength);
			this.inBufferData.set("pos", 0);

			while (true) {
				if (this.inBufferData.get("pos") >= this.inBuffer.get("size")) {
					break;
				}

				this.outBufferData.set("dst", this.outBuffer.ptr);
				this.outBufferData.set("size", this.outBufferSize);
				this.outBufferData.set("pos", 0);

				let ret;
				ret = wasm._ZSTD_decompressStream(this.ctxPtr, this.outBufferData.ptr, this.inBufferData.ptr);
				if (wasm._ZSTD_isError(ret)) {
					controller.error(
						new Error(`Zstd error:\n[${ret}] ${wasm.UTF8ToString(wasm._ZSTD_getErrorName(ret))}`),
					);
				}

				const uncompressedData = this.outBuffer.value;
				controller.enqueue(uncompressedData);

				this.lastReturn = ret;
			}

			offset += inBuffer.size;
		}
	},

	flush(controller) {
		if (this.lastReturn !== 0) {
			controller.error(new Error(`Zstd error:\n[${lastRet}]EOF before the end of the stream.`));
		}

		wasm._ZSTD_freeDCtx(this.ctxPtr);
		this.inBuffer.destroy();
		this.outBuffer.destroy();
		this.inBufferData.destroy();
		this.outBufferData.destroy();

		controller.terminate();
	},
};

/**
 * This TransformStream decompresses Zstd chunks.
 */
export class ZstdUncompressStream extends TransformStream {
	constructor() {
		super({
			...zstdTransformContent,
			ctxPtr: 0,
			inBufferPtr: 0,
			inBufferDataStackPtr: 0,
			outBufferPtr: 0,
			outBufferDataStackPtr: 0,
			lastReturn: 0,
		});
	}
}
