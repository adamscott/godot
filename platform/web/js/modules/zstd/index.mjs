import { NULLPTR, initWasmUtils } from "@godotengine/common/wasm";

import { default as ZstdWasmModule } from "./zstd.mjs";

export const wasm = await ZstdWasmModule();
const { WasmValue, WasmStruct, WasmStructMember } = initWasmUtils(wasm);

/**
 * @typedef {import("@godotengine/common").WasmStructMember} WasmStructMember
 */

/**
 * The logic of `ZstdDecompressionStream`.
 * @type {ConstructorParameters<typeof TransformStream>[0]}
 */
const zstdTransformContent = {
	start() {
		this.ctxPtr = wasm._ZSTD_createDCtx();
		if (this.ctxPtr === NULLPTR) {
			throw new Error("Could not create new Zstd context.");
		}

		this.inBufferSize = wasm._ZSTD_DStreamInSize();
		this.outBufferSize = wasm._ZSTD_DStreamOutSize();
		this.inBuffer = new WasmValue({ size: this.inBufferSize });
		this.outBuffer = new WasmValue({ size: this.outBufferSize });

		/** @type {number!} */
		let offset;
		/** @type {WasmStructMember!} */
		let previousDef;

		// inBuffer struct.
		offset = 0;
		/** @type {Record<string, WasmStructMember>} */
		const inBufferDataDefs = {};
		previousDef = inBufferDataDefs["src"] = new WasmStructMember({
			name: "src",
			type: "void*",
			offset,
		});
		offset += previousDef.size;
		previousDef = inBufferDataDefs["size"] = new WasmStructMember({
			name: "size",
			type: "size_t",
			offset,
		});
		offset += previousDef.size;
		previousDef = inBufferDataDefs["pos"] = new WasmStructMember({
			name: "pos",
			type: "size_t",
			offset,
		});
		this.inBufferData = new WasmStruct(Object.values(inBufferDataDefs));

		// outBuffer struct.
		offset = 0;
		/** @type {Record<string, WasmStructMember>} */
		const outBufferDataDefs = {};
		previousDef = outBufferDataDefs["dst"] = new WasmStructMember({
			name: "dst",
			type: "void*",
			offset,
		});
		offset += previousDef.size;
		previousDef = outBufferDataDefs["size"] = new WasmStructMember({
			name: "size",
			type: "size_t",
			offset,
		});
		offset += previousDef.size;
		previousDef = outBufferDataDefs["pos"] = new WasmStructMember({
			name: "pos",
			type: "size_t",
			offset,
		});
		this.outBufferData = new WasmStruct(Object.values(outBufferDataDefs));

		// Initialize basic data for the first transform pass.
		this.inBufferData.src.value = this.inBuffer.ptr;
		this.inBufferData.size.value = 0;
		this.inBufferData.pos.value = 0;
	},

	/**
	 * @param {Uint8Array} chunk
	 */
	async transform(chunk, controller) {
		while (true) {
			const subchunk = chunk.slice(0, this.inBuffer.size);
			chunk = chunk.slice(this.inBuffer.size);

			this.inBuffer.value = subchunk;
			this.inBufferData.src.value = this.inBuffer.ptr;
			this.inBufferData.size.value = subchunk.byteLength;
			this.inBufferData.pos.value = 0;

			while (this.inBufferData.pos.value < this.inBufferData.size.value) {
				this.outBufferData.dst.value = this.outBuffer.ptr;
				this.outBufferData.size.value = this.outBuffer.size;
				this.outBufferData.pos.value = 0;

				let ret = wasm._ZSTD_decompressStream(this.ctxPtr, this.outBufferData.ptr, this.inBufferData.ptr);
				if (wasm._ZSTD_isError(ret)) {
					controller.error(
						new Error(
							`Zstd error:\n[${this.lastReturn}] ${wasm.UTF8ToString(wasm._ZSTD_getErrorName(ret))}`,
						),
					);
					return;
				}
				const decompressedData = this.outBuffer.value.slice(0, this.outBufferData.pos.value);
				controller.enqueue(decompressedData);
				this.lastReturn = ret;
			}

			if (chunk.byteLength === 0) {
				break;
			}
		}
	},

	flush(controller) {
		if (this.lastReturn !== 0) {
			controller.error(new Error(`Zstd error:\n[${lastRet}]EOF before the end of the stream.`));
			controller.terminate();
			return;
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
export class ZstdDecompressionStream extends TransformStream {
	constructor() {
		super({
			...zstdTransformContent,
			ctxPtr: 0,
			inBuffer: null,
			outBuffer: null,
			inBufferData: null,
			outBufferData: null,
			lastReturn: 0,
			blob: null,
		});
	}
}
