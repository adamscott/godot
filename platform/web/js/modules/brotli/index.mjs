import { NULLPTR, initWasmUtils } from "@godotengine/common";

import { default as BrotliWasmModule } from "./brotli.mjs";

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
    _BrotliDecoderCreateInstance,
	_BrotliDecoderDestroyInstance,
	_BrotliDecoderDecompressStream,
    _BrotliDecoderSetParameter,
	_BrotliDecoderGetErrorCode,
	_BrotliDecoderErrorString,
	ccall,
	cwrap,
	stackAlloc,
	stringToNewUTF8,
	UTF8ToString,
}}
 */
export const wasm = await BrotliWasmModule();
const { mallocOrDie, freeOrDie, sizeOf, WasmValue, WasmStruct } = initWasmUtils(wasm);

// function mallocOrDie(size) {
// 	if (typeof size !== "number") {
// 		throw new Error(`size is not a number (${size})`);
// 	}
// 	const heapPtr = wasm._malloc(size);
// 	if (heapPtr === nullptr) {
// 		throw new Error("Could not malloc successfully.");
// 	}
// 	return heapPtr;
// }

/**
 * Typed array.
 * @typedef {Int8Array|Int16Array|Int32Array|BigInt64Array|Uint8Array|Uint16Array|Uint32Array|BigUint64Array|Float32Array|Float64Array} TypedArray
 */

const BrotliDecoderResult = {
	ERROR: 0,
	SUCCESS: 1,
	NEEDS_MORE_INPUT: 2,
	NEEDS_MORE_OUTPUT: 3,
};

// class WasmValue {
// 	get value() {
// 		return wasm.HEAPU8.slice(this.ptr, this.ptr + this.size);
// 	}
//
// 	set value(val) {
// 		let valueToSet = val;
// 		if (typeof val === "number") {
// 			valueToSet = [val];
// 		}
// 		wasm.HEAPU8.set(valueToSet, this.ptr);
// 	}
//
// 	constructor(size) {
// 		this.size = size;
// 		this.ptr = nullptr;
//
// 		this._init();
// 	}
//
// 	destroy() {
// 		wasm._free(this.ptr);
// 	}
//
// 	_init() {
// 		this.ptr = mallocOrDie(this.size);
// 	}
// }

const BROTLI_BUFFER_SIZE = 1 << 20; // 1MiB
/**
 * The logic of `BrotliUncompressStream`.
 */
const brotliTransformContent = {
	start() {
		this.instancePtr = wasm._BrotliDecoderCreateInstance(nullptr, nullptr, nullptr);
		if (this.instancePtr === nullptr) {
			throw new Error("Could not create new Brotli instance.");
		}
		this.inBuffer = new WasmValue(BROTLI_BUFFER_SIZE);
		this.outBuffer = new WasmValue(BROTLI_BUFFER_SIZE);
		this.inAvailable = new WasmValue(sizeOf("size_t"));
		this.outAvailable = new WasmValue(sizeOf("size_t"));
		this.inNext = new WasmValue(sizeOf("u8*"));
		this.outNext = new WasmValue(sizeOf("u8*"));
	},

	async transform(chunk, controller) {
		const _chunk = await chunk;
		let offset = 0;
		let result = BrotliDecoderResult.NEEDS_MORE_INPUT;

		this.inAvailable.value = 0;
		this.outAvailable.value = BROTLI_BUFFER_SIZE;
		this.inNext.value = 0;
		this.outNext.value = this.outBufferPtr;

		while_loop: while (true) {
			switch (result) {
				case BrotliDecoderResult.NEEDS_MORE_INPUT:
					{
						if (offset >= _chunk.byteLength) {
							break while_loop;
						}
						const subchunk = _chunk.slice(offset, offset + BROTLI_BUFFER_SIZE);
						this.inAvailable.value = subchunk.byteLength;
					}
					break;
				case BrotliDecoderResult.NEEDS_MORE_OUTPUT:
					{
					}
					break;
				default:
					break while_loop;
			}

			const result = wasm._BrotliDecoderDecompressStream(this.instancePtr);
		}
	},

	flush(controller) {
		wasm._BrotliDecoderDestroyInstance(this.instancePtr);
		this.inBuffer.destroy();
		this.outBuffer.destroy();
		this.inAvailable.destroy();
		this.outAvailable.destroy();
		this.inNext.destroy();
		this.outNext.destroy();

		controller.terminate();
	},
};

/**
 * This TransformStream decompresses Brotli chunks.
 */
export class BrotliUncompressStream extends TransformStream {
	constructor() {
		super({
			...brotliTransformContent,
			instancePtr: nullptr,
			inBuffer: null,
			outBuffer: null,
			inAvailable: null,
			outAvailable: null,
			inNext: null,
			outNext: null,
		});
	}
}
