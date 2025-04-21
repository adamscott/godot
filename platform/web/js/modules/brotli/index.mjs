import { NULLPTR, initWasmUtils } from "@godotengine/common";

import { default as BrotliWasmModule } from "./brotli.mjs";

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

const BROTLI_BUFFER_SIZE = 1 << 20; // 1MiB
/**
 * The logic of `BrotliUncompressStream`.
 */
const brotliTransformContent = {
	start() {
		this.instancePtr = wasm._BrotliDecoderCreateInstance(NULLPTR, NULLPTR, NULLPTR);
		if (this.instancePtr === NULLPTR) {
			throw new Error("Could not create new Brotli instance.");
		}
		this.inBuffer = new WasmValue(BROTLI_BUFFER_SIZE);
		this.outBuffer = new WasmValue(BROTLI_BUFFER_SIZE);

		// https://www.brotli.org/decode.html#a234
		/** @type {Record<string, import("@godotengine/common").WasmStructMemberDefinition>} */
		const defs = {};
		let offset = 0;
		let previousDef;
		previousDef = defs["available_in"] = {
			name: "available_in",
			type: "size_t",
			size: sizeOf("size_t"),
			offset,
		};
		offset += previousDef.size;
		previousDef = defs["next_in"] = {
			name: "next_in",
			type: "uint8_t*",
			size: sizeOf("uint8_t*"),
			offset,
		};
		offset += previousDef.size;
		previousDef = defs["available_out"] = {
			name: "available_out",
			type: "size_t",
			size: sizeOf("size_t"),
			offset,
		};
		offset += previousDef.size;
		previousDef = defs["next_out"] = {
			name: "next_out",
			type: "uint8_t*",
			size: sizeOf("uint8_t*"),
			offset,
		};
		offset += previousDef.size;
		previousDef = data["total_out"] = {
			name: "total_out",
			type: "size_t",
			size: sizeOf("size_t"),
			offset,
		};

		this.data = new WasmStruct(Object.values(defs));
		this.result = BrotliDecoderResult.NEEDS_MORE_INPUT;
	},

	async transform(chunk, controller) {
		const _chunk = await chunk;
		let offset = 0;

		this.data.inAvailable.value = 0;
		this.data.outAvailable.value = BROTLI_BUFFER_SIZE;
		this.data.inNext.value = 0;
		this.data.outNext.value = this.outBuffer.ptr;

		while_loop: while (true) {
			switch (this.result) {
				case BrotliDecoderResult.NEEDS_MORE_INPUT:
					{
						if (offset >= _chunk.byteLength) {
							break while_loop;
						}
						const subchunk = _chunk.slice(offset, offset + BROTLI_BUFFER_SIZE);
						this.inBuffer.value = subchunk;
						this.data.inAvailable.value = subchunk.byteLength;
						this.data.inNext.value = this.inBuffer.ptr;
						offset += subchunk.byteLength;
					}
					break;
				case BrotliDecoderResult.NEEDS_MORE_OUTPUT:
					{
						const uncompressedData = this.outBuffer.value.slice(0, BROTLI_BUFFER_SIZE);
						controller.enqueue(uncompressedData);
						this.data.outAvailable.value = BROTLI_BUFFER_SIZE;
						this.data.outNext.value = this.outBuffer.ptr;
					}
					break;
				default:
					break while_loop;
			}

			this.result = wasm._BrotliDecoderDecompressStream(
				this.instancePtr,
				this.data.inAvailable.value,
				this.data.inNext.value,
				this.data.outAvailable.ptr,
				this.data.outNext.value,
				NULLPTR,
			);
		}
	},

	flush(controller) {
		if (this.data.outNext.value !== this.outBuffer.ptr) {
			const data = this.outBuffer.value.slice(0, this.data.outNext.value - this.outBuffer.ptr);
			controller.enqueue(data);
		}
		if (this.result === BrotliDecoderResult.NEEDS_MORE_OUTPUT) {
			controller.error(new Error("Brotli error:\nFailed to write output"));
		} else if (this.result !== BrotliDecoderResult.SUCCESS) {
			controller.error(new Error("Brotli error:\nCorrupt input"));
		}

		wasm._BrotliDecoderDestroyInstance(this.instancePtr);
		this.inBuffer.destroy();
		this.outBuffer.destroy();
		this.data.destroy();

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
			instancePtr: NULLPTR,
			inBuffer: null,
			outBuffer: null,
			data: null,
			result: 0,
		});
	}
}
