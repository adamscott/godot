import { default as ZstdWasmModule } from "./zstd.mjs";

const nullptr = 0;

/**
 * @type {{
	HEAP8,
	HEAP16,
	HEAP32,
	HEAP64,
	HEAPF32,
	HEAPF64,
	HEAPU8,
	HEAPU16,
	HEAPU32,
	HEAPU64,
	_malloc,
	_free,
	_ZSTD_decompressStream,
    _ZSTD_createDCtx,
	_ZSTD_freeDCtx,
	_ZSTD_DCtx_setMaxWindowSize,
	_ZSTD_DStreamInSize,
	_ZSTD_DStreamOutSize,
	_ZSTD_isError,
	_ZSTD_getErrorName,
	ccall,
	cwrap,
	stackAlloc,
	stringToNewUTF8,
	UTF8ToString,
}}
 */
export const wasm = await ZstdWasmModule();

function mallocOrDie(size) {
	if (typeof size !== "number") {
		throw new Error(`size is not a number (${size})`);
	}
	const heapPtr = wasm._malloc(size);
	if (heapPtr === nullptr) {
		throw new Error("Could not malloc successfully.");
	}
	return heapPtr;
}

/**
 * Typed array.
 * @typedef {Int8Array|Int16Array|Int32Array|BigInt64Array|Uint8Array|Uint16Array|Uint32Array|BigUint64Array|Float32Array|Float64Array} TypedArray
 */

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
		if (this.ctxPtr === nullptr) {
			throw new Error("Could not create new Zstd context.");
		}

		this.inBufferSize = wasm._ZSTD_DStreamInSize();
		this.outBufferSize = wasm._ZSTD_DStreamOutSize();
		this.inBufferPtr = mallocOrDie(this.inBufferSize);
		this.outBufferPtr = mallocOrDie(this.outBufferSize);
		this.inBufferDataStackPtr = mallocOrDie(3 * Uint32Array.BYTES_PER_ELEMENT);
		this.outBufferDataStackPtr = mallocOrDie(3 * Uint32Array.BYTES_PER_ELEMENT);
	},

	async transform(chunk, controller) {
		let _chunk = await chunk;
		let offset = 0;
		let subchunk;
		let inBuffer;
		let outBuffer;

		while (true) {
			let nextInputOffset = offset + this.inBufferSize;
			if (this.lastReturn > 0) {
				nextInputOffset = offset + this.lastReturn;
			}

			subchunk = _chunk.slice(offset, nextInputOffset);
			if (subchunk.byteLength === 0) {
				break;
			}
			wasm.HEAPU8.set(subchunk, this.inBufferPtr);

			const inBufferData = toZSTD_inBuffer({
				srcPtr: this.inBufferPtr,
				size: subchunk.byteLength,
				pos: 0,
			});
			wasm.HEAPU8.set(inBufferData, this.inBufferDataStackPtr);

			while (true) {
				inBuffer = fromZSTD_inBuffer(
					wasm.HEAPU8.slice(
						this.inBufferDataStackPtr,
						this.inBufferDataStackPtr + 3 * Uint32Array.BYTES_PER_ELEMENT,
					),
				);
				if (inBuffer.pos >= inBuffer.size) {
					break;
				}

				const outBufferData = toZSTD_outBuffer({
					dstPtr: this.outBufferPtr,
					size: this.outBufferSize,
					pos: 0,
				});
				wasm.HEAPU8.set(outBufferData, this.outBufferDataStackPtr);

				let ret;
				ret = wasm._ZSTD_decompressStream(this.ctxPtr, this.outBufferDataStackPtr, this.inBufferDataStackPtr);
				if (wasm._ZSTD_isError(ret)) {
					throw new Error(
						`Zstd error while decompressing stream:\n[${ret}] ${wasm.UTF8ToString(wasm._ZSTD_getErrorName(ret))}`,
					);
				}

				outBuffer = fromZSTD_outBuffer(
					wasm.HEAPU8.slice(
						this.outBufferDataStackPtr,
						this.outBufferDataStackPtr + 3 * Uint32Array.BYTES_PER_ELEMENT,
					),
				);

				if (outBuffer.dstPtr > wasm.HEAPU8.byteLength) {
					throw new Error("`outBuffer.dstPtr` points outside of the size of HEAPU8");
				}

				const uncompressedData = wasm.HEAPU8.slice(outBuffer.dstPtr, outBuffer.dstPtr + outBuffer.pos);
				controller.enqueue(uncompressedData);

				this.lastReturn = ret;
			}

			offset += inBuffer.size;
		}
	},

	flush(controller) {
		if (this.lastReturn !== 0) {
			throw new Error(`Zstd error:\n[${lastRet}]EOF before the end of the stream.`);
		}

		wasm._ZSTD_freeDCtx(this.ctxPtr);
		wasm._free(this.inBufferPtr);
		wasm._free(this.outBufferPtr);
		wasm._free(this.inBufferDataStackPtr);
		wasm._free(this.outBufferDataStackPtr);

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
