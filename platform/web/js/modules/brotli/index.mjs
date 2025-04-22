import { NULLPTR, initWasmUtils } from "@godotengine/common/wasm";

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

const BrotliDecoderResult = {
	ERROR: 0,
	SUCCESS: 1,
	NEEDS_MORE_INPUT: 2,
	NEEDS_MORE_OUTPUT: 3,
};

const BROTLI_BUFFER_SIZE = 1024 * 512; // 512KiB

/**
 * The logic of `BrotliDecompressionStream`.
 * @type {ConstructorParameters<typeof TransformStream>[0]}
 */
const brotliTransformContent = {
	start() {
		this.instancePtr = wasm._BrotliDecoderCreateInstance(NULLPTR, NULLPTR, NULLPTR);
		if (this.instancePtr === NULLPTR) {
			throw new Error("Could not create new Brotli instance.");
		}
		this.inBuffer = new WasmValue({ size: BROTLI_BUFFER_SIZE });
		this.outBuffer = new WasmValue({ size: BROTLI_BUFFER_SIZE });

		// https://www.brotli.org/decode.html#a234
		this.availableIn = new WasmValue({ type: "size_t" });
		this.nextIn = new WasmValue({ type: "uint8_t*" });
		this.availableOut = new WasmValue({ type: "size_t" });
		this.nextOut = new WasmValue({ type: "uint8_t*" });
		this.totalOut = new WasmValue({ type: "size_t" });

		// this.data = new WasmStruct(Object.values(defs));
		this.result = BrotliDecoderResult.NEEDS_MORE_INPUT;

		this.availableIn.value = 0;
		this.nextIn.value = 0;
		this.availableOut.value = BROTLI_BUFFER_SIZE;
		this.nextOut.value = this.outBuffer.ptr;
		this.totalOut.value = 0;
	},

	async transform(chunk, controller) {
		const _chunk = await chunk;
		let offset = 0;

		whileLoop: while (true) {
			switch (this.result) {
				case BrotliDecoderResult.NEEDS_MORE_INPUT:
					{
						if (offset >= _chunk.byteLength) {
							break whileLoop;
						}
						const subchunk = _chunk.slice(offset, offset + BROTLI_BUFFER_SIZE);
						this.inBuffer.value = subchunk;
						this.availableIn.value = subchunk.byteLength;
						this.nextIn.value = this.inBuffer.ptr;
						offset += subchunk.byteLength;
					}
					break;
				case BrotliDecoderResult.NEEDS_MORE_OUTPUT:
					{
						const decompressedData = this.outBuffer.value.slice(0, BROTLI_BUFFER_SIZE);
						controller.enqueue(decompressedData);
						this.availableOut.value = BROTLI_BUFFER_SIZE;
						this.nextOut.value = this.outBuffer.ptr;
					}
					break;
				default:
					break whileLoop;
			}

			this.result = wasm._BrotliDecoderDecompressStream(
				this.instancePtr,
				this.availableIn.ptr,
				this.nextIn.ptr,
				this.availableOut.ptr,
				this.nextOut.ptr,
				this.totalOut.ptr,
			);
		}
	},

	flush(controller) {
		if (this.nextOut.value !== this.outBuffer.ptr) {
			const offset = this.nextOut.value - this.outBuffer.ptr;
			const decompressedData = this.outBuffer.value.slice(0, offset);
			controller.enqueue(decompressedData);
		}
		if (this.result === BrotliDecoderResult.NEEDS_MORE_OUTPUT) {
			controller.error(new Error("Brotli error:\nFailed to write output"));
			return;
		} else if (this.result !== BrotliDecoderResult.SUCCESS) {
			controller.error(new Error("Brotli error:\nCorrupt input"));
			return;
		}

		wasm._BrotliDecoderDestroyInstance(this.instancePtr);
		this.inBuffer.destroy();
		this.outBuffer.destroy();

		this.availableIn.destroy();
		this.nextIn.destroy();
		this.availableOut.destroy();
		this.nextOut.destroy();
		this.totalOut.destroy();

		controller.terminate();
	},
};

/**
 * This TransformStream decompresses Brotli chunks.
 */
export class BrotliDecompressionStream extends TransformStream {
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
