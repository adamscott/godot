import { NULLPTR, initWasmUtils } from "@godotengine/common";

import { default as ZstdWasmModule } from "./zstd.mjs";

export const wasm = await ZstdWasmModule();
const { WasmValue, WasmStruct, WasmStructMember } = initWasmUtils(wasm);

/**
 * @typedef {import("@godotengine/common").WasmStructMember} WasmStructMember
 */

/**
 * The logic of `ZstdUncompressStream`.
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

	async transform(chunk, controller) {
		const chunkData = {
			/** @type {Uint8Array} */
			chunk: await chunk,
			pos: 0,
			get size() {
				return this.chunk.byteLength;
			},
		};
		/** @type {Uint8Array|null} */
		let subchunkPadding = null;

		subchunkAssignmentLoop: while (true) {
			let lastReturnOffset = 0;
			if (this.lastReturn > 0) {
				lastReturnOffset = this.lastReturn;
			}
			let start = chunkData.pos;
			let end = Math.min(chunkData.pos + this.inBuffer.size, chunkData.size);
			let chunk = chunkData.chunk.slice(start, end - lastReturnOffset);
			if (this.lastReturn > 0) {
				let newChunk = new Uint8Array(end - start + lastReturnOffset);
				newChunk.set(subchunkPadding, 0);
				newChunk.set(chunk, lastReturnOffset);
				chunk = newChunk;
				this.lastReturn = 0;
			}
			const subchunkData = {
				chunk,
				pos: 0,
				get size() {
					return this.chunk.byteLength;
				},
			};

			this.inBuffer.value = subchunkData.chunk;
			this.inBufferData.src.value = this.inBuffer.ptr;
			this.inBufferData.size.value = this.inBuffer.size;
			this.inBufferData.pos.value = 0;

			processLoop: while (true) {
				if (this.lastReturn > 0) {
					const remainingBufferSize = this.inBuffer.size.value - this.inBuffer.pos.value;
					if (this.lastReturn < remainingBufferSize) {
						// TODO:
						//   - We need to make inBufferData the size of lastReturn.
						//   - We need to backup the remaining data for the next pass, to put in the next subchunk.
						const lastReturnBuffer = this.inBuffer.value.slice(
							this.inBufferData.pos.value,
							this.inBufferData.pos.value + this.lastReturn,
						);
						subchunkPadding = this.inBuffer.value.slice(this.inBufferData.pos.value + this.lastReturn);
						this.inBuffer.value = lastReturnBuffer;
						this.inBufferData.src.value = this.inBuffer.ptr;
						this.inBufferData.size.value = lastReturnBuffer.byteLength;
						this.inBufferData.pos.value = 0;
					}
					this.lastReturn = 0;
				}

				flushLoop: while (true) {
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

					const uncompressedData = this.outBuffer.value;
					this.enqueued.push(uncompressedData);
					controller.enqueue(uncompressedData);

					this.lastReturn = ret;

					if (this.outBufferData.pos.value < this.outBufferData.size.value) {
						break flushLoop;
					}
				}

				if (this.inBufferData.pos.value >= this.inBufferData.size.value) {
					break processLoop;
				}
			}

			if (subchunkData.pos >= subchunkData.size) {
				chunkData.pos = subchunkData.size;
				break subchunkAssignmentLoop;
			}
		}

		// let subchunk;

		// chunkAssignmentLoop: while (true) {
		// 	subchunk = _chunk.slice(this.inBufferData.pos.value, nextInputOffset);
		// 	if (subchunk.byteLength === 0) {
		// 		break;
		// 	}

		// 	subchunkAssignmentLoop: while (true) {
		// 		this.inBuffer.value = subchunk;

		// 		this.inBufferData.src.value = this.inBuffer.ptr;
		// 		this.inBufferData.size.value = subchunk.byteLength;
		// 		this.inBufferData.pos.value = 0;

		// 		subchunkProcessingLoop: while (true) {
		// 			if (this.inBufferData.pos.value >= this.inBufferData.size.value) {
		// 				break subchunkProcessingLoop;
		// 			}

		// 			this.outBufferData.dst.value = this.outBuffer.ptr;
		// 			this.outBufferData.size.value = this.outBufferSize;
		// 			this.outBufferData.pos.value = 0;

		// 			let ret = wasm._ZSTD_decompressStream(this.ctxPtr, this.outBufferData.ptr, this.inBufferData.ptr);
		// 			if (wasm._ZSTD_isError(ret)) {
		// 				controller.error(
		// 					new Error(
		// 						`Zstd error:\n[${this.lastReturn}] ${wasm.UTF8ToString(wasm._ZSTD_getErrorName(ret))}`,
		// 					),
		// 				);
		// 				return;
		// 			}

		// 			const uncompressedData = this.outBuffer.value;
		// 			this.enqueued.push(uncompressedData);
		// 			controller.enqueue(uncompressedData);

		// 			this.lastReturn = ret;
		// 		}

		// 		// offset = this.inBufferData.size.value;
		// 	}
		// }
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
export class ZstdUncompressStream extends TransformStream {
	constructor() {
		super({
			...zstdTransformContent,
			ctxPtr: 0,
			inBuffer: null,
			outBuffer: null,
			inBufferData: null,
			outBufferData: null,
			lastReturn: 0,
			enqueued: [],
		});
	}
}
