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

const BrotliDecoderResult = {
	ERROR: 0,
	SUCCESS: 1,
	NEEDS_MORE_INPUT: 2,
	NEEDS_MORE_OUTPUT: 3,
};

/**
 * The logic of `BrotliUncompressStream`.
 */
const brotliTransformContent = {
	start() {
		this.instancePtr = wasm._BrotliDecoderCreateInstance(nullptr, nullptr, nullptr);
		if (this.instancePtr === nullptr) {
			throw new Error("Could not create new Brotli instance.");
		}
		this.inBufferPtr = mallocOrDie(this.bufferSize);
		this.outBufferPtr = mallocOrDie(this.bufferSize);
	},

	async transform(chunk, controller) {
		const _chunk = await chunk;
		let offset = 0;
		let result = BrotliDecoderResult.NEEDS_MORE_INPUT;

		let availableIn = nullptr;
		let availableOut = nullptr;
		let nextIn = nullptr;
		let nextOut = nullptr;

		while_loop: while (true) {
			let subchunk = _chunk.slice(offset, this.bufferSize);
			wasm.HEAPU8.set(subchunk, this.inBufferPtr);

			switch (result) {
				case BrotliDecoderResult.NEEDS_MORE_INPUT:
					{
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
		wasm._free(this.inBufferPtr);
		wasm._free(this.outBufferPtr);

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
			bufferSize: 1 << 20, // 1MiB
			inBufferPtr: nullptr,
			outBufferPtr: nullptr,
		});
	}
}
