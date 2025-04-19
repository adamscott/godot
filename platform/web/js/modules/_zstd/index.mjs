import { default as ZstdWasmModule } from "./zstd.mjs";

const {
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
	_malloc: malloc,
	_free: free,
	_ZSTD_decompressStream: ZSTD_decompressStream,
	_ZSTD_freeDStream: ZSTD_freeDStream,
	_ZSTD_initDStream: ZSTD_initDStream,
	ccall,
	cwrap,
    getValue,
    setValue,
	writeArrayToMemory,
} = await ZstdWasmModule();

export const wasm = {
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
	malloc,
	free,
	ZSTD_decompressStream,
	ZSTD_freeDStream,
	ZSTD_initDStream,
	ZSTD_DStreamInSize,
	ZSTD_DStreamOutSize,
	ccall,
	cwrap,
    getValue,
    setValue,
	writeArrayToMemory,
};

const zstdTransformContent = {
	start() {
		this.dstreamPtr = ZSTD_initDStream();
	},
	async transform(chunk, controller) {
		const _chunk = await chunk;
		controller.enqueue(_chunk);
		console.log(_chunk, this.dstreamPtr);
	},
	flush(controller) {
		if (this.dstreamPtr !== 0) {
			ZSTD_freeDStream(this.dstreamPtr);
			this.dstreamPtr = 0;
		}
	},
};

export class ZstdUncompressStream extends TransformStream {
	constructor() {
		super({ ...zstdTransformContent, dstreamPtr: 0 });
	}
}
