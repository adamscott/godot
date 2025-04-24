/**************************************************************************/
/*  compression.cpp                                                       */
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

#include "compression.h"

#include "core/config/project_settings.h"
#include "core/error/error_list.h"
#include "core/io/zip_io.h"

#include "core/variant/variant.h"
#include "thirdparty/misc/fastlz.h"

#include <zstd.h>

#ifdef BROTLI_ENABLED
#include <brotli/decode.h>
#include <brotli/encode.h>
#endif

// Caches for zstd.
static BinaryMutex mutex;
static ZSTD_DCtx *current_zstd_d_ctx = nullptr;
static bool current_zstd_long_distance_matching;
static int current_zstd_window_log_size;

int Compression::compress(uint8_t *p_dst, const uint8_t *p_src, int p_src_size, const Settings &p_settings) {
	switch (p_settings.get_mode()) {
		case MODE_BROTLI: {
			BrotliEncoderMode mode = BROTLI_MODE_GENERIC;
			switch (p_settings.brotli->encoder_mode) {
				case Settings::Brotli::BROTLI_ENCODER_MODE_FONT: {
					mode = BROTLI_MODE_FONT;
				} break;
				case Settings::Brotli::BROTLI_ENCODER_MODE_GENERIC: {
					mode = BROTLI_MODE_GENERIC;
				} break;
				case Settings::Brotli::BROTLI_ENCODER_MODE_TEXT: {
					mode = BROTLI_MODE_TEXT;
				} break;
			}
			size_t encoded_size;
			if (BrotliEncoderCompress(p_settings.brotli->quality, 24, mode, p_src_size, p_src, &encoded_size, p_dst)) {
				return encoded_size;
			}
			return -1;
		} break;
		case MODE_FASTLZ: {
			if (p_src_size < 16) {
				uint8_t src[16];
				memset(&src[p_src_size], 0, 16 - p_src_size);
				memcpy(src, p_src, p_src_size);
				return fastlz_compress(src, 16, p_dst);
			} else {
				return fastlz_compress(p_src, p_src_size, p_dst);
			}

		} break;
		case MODE_DEFLATE:
		case MODE_GZIP: {
			int window_bits = p_settings.get_mode() == MODE_DEFLATE ? 15 : 15 + 16;

			z_stream strm;
			strm.zalloc = zipio_alloc;
			strm.zfree = zipio_free;
			strm.opaque = Z_NULL;
			int level = p_settings.get_mode() == MODE_DEFLATE ? p_settings.deflate->level : p_settings.gzip->level;
			int err = deflateInit2(&strm, level, Z_DEFLATED, window_bits, 8, Z_DEFAULT_STRATEGY);
			if (err != Z_OK) {
				return -1;
			}

			strm.avail_in = p_src_size;
			int aout = deflateBound(&strm, p_src_size);
			strm.avail_out = aout;
			strm.next_in = (Bytef *)p_src;
			strm.next_out = p_dst;
			deflate(&strm, Z_FINISH);
			aout = aout - strm.avail_out;
			deflateEnd(&strm);
			return aout;

		} break;
		case MODE_ZSTD: {
			ZSTD_CCtx *cctx = ZSTD_createCCtx();
			ZSTD_CCtx_setParameter(cctx, ZSTD_c_compressionLevel, p_settings.zstd->level);
			if (p_settings.zstd->long_distance_matching) {
				ZSTD_CCtx_setParameter(cctx, ZSTD_c_enableLongDistanceMatching, 1);
				ZSTD_CCtx_setParameter(cctx, ZSTD_c_windowLog, p_settings.zstd->window_log_size);
			}
			int max_dst_size = get_max_compressed_buffer_size(p_src_size, p_settings);
			int ret = ZSTD_compressCCtx(cctx, p_dst, max_dst_size, p_src, p_src_size, p_settings.zstd->level);
			ZSTD_freeCCtx(cctx);
			return ret;
		} break;
	}

	ERR_FAIL_V(-1);
}

int Compression::get_max_compressed_buffer_size(int p_src_size, const Settings &p_settings) {
	switch (p_settings.get_mode()) {
		case MODE_BROTLI: {
			return BrotliEncoderMaxCompressedSize(p_src_size);
		} break;
		case MODE_FASTLZ: {
			int ss = p_src_size + p_src_size * 6 / 100;
			if (ss < 66) {
				ss = 66;
			}
			return ss;

		} break;
		case MODE_DEFLATE:
		case MODE_GZIP: {
			int window_bits = p_settings.get_mode() == MODE_DEFLATE ? 15 : 15 + 16;

			z_stream strm;
			strm.zalloc = zipio_alloc;
			strm.zfree = zipio_free;
			strm.opaque = Z_NULL;
			int err = deflateInit2(&strm, Z_DEFAULT_COMPRESSION, Z_DEFLATED, window_bits, 8, Z_DEFAULT_STRATEGY);
			if (err != Z_OK) {
				return -1;
			}
			int aout = deflateBound(&strm, p_src_size);
			deflateEnd(&strm);
			return aout;
		} break;
		case MODE_ZSTD: {
			return ZSTD_compressBound(p_src_size);
		} break;
	}

	ERR_FAIL_V(-1);
}

int Compression::decompress(uint8_t *p_dst, int p_dst_max_size, const uint8_t *p_src, int p_src_size, const Settings &p_settings) {
	switch (p_settings.get_mode()) {
		case MODE_BROTLI: {
#ifdef BROTLI_ENABLED
			size_t ret_size = p_dst_max_size;
			BrotliDecoderResult res = BrotliDecoderDecompress(p_src_size, p_src, &ret_size, p_dst);
			ERR_FAIL_COND_V(res != BROTLI_DECODER_RESULT_SUCCESS, -1);
			return ret_size;
#else
			ERR_FAIL_V_MSG(-1, "Godot was compiled without brotli support.");
#endif
		} break;
		case MODE_FASTLZ: {
			int ret_size = 0;

			if (p_dst_max_size < 16) {
				uint8_t dst[16];
				fastlz_decompress(p_src, p_src_size, dst, 16);
				memcpy(p_dst, dst, p_dst_max_size);
				ret_size = p_dst_max_size;
			} else {
				ret_size = fastlz_decompress(p_src, p_src_size, p_dst, p_dst_max_size);
			}
			return ret_size;
		} break;
		case MODE_DEFLATE:
		case MODE_GZIP: {
			int window_bits = p_settings.get_mode() == MODE_DEFLATE ? 15 : 15 + 16;

			z_stream strm;
			strm.zalloc = zipio_alloc;
			strm.zfree = zipio_free;
			strm.opaque = Z_NULL;
			strm.avail_in = 0;
			strm.next_in = Z_NULL;
			int err = inflateInit2(&strm, window_bits);
			ERR_FAIL_COND_V(err != Z_OK, -1);

			strm.avail_in = p_src_size;
			strm.avail_out = p_dst_max_size;
			strm.next_in = (Bytef *)p_src;
			strm.next_out = p_dst;

			err = inflate(&strm, Z_FINISH);
			int total = strm.total_out;
			inflateEnd(&strm);
			ERR_FAIL_COND_V(err != Z_STREAM_END, -1);
			return total;
		} break;
		case MODE_ZSTD: {
			MutexLock lock(mutex);

			if (!current_zstd_d_ctx || current_zstd_long_distance_matching != p_settings.zstd->long_distance_matching || current_zstd_window_log_size != p_settings.zstd->window_log_size) {
				if (current_zstd_d_ctx) {
					ZSTD_freeDCtx(current_zstd_d_ctx);
				}

				current_zstd_d_ctx = ZSTD_createDCtx();
				if (p_settings.zstd->long_distance_matching) {
					ZSTD_DCtx_setParameter(current_zstd_d_ctx, ZSTD_d_windowLogMax, p_settings.zstd->window_log_size);
				}
				current_zstd_long_distance_matching = p_settings.zstd->long_distance_matching;
				current_zstd_window_log_size = p_settings.zstd->window_log_size;
			}

			int ret = ZSTD_decompressDCtx(current_zstd_d_ctx, p_dst, p_dst_max_size, p_src, p_src_size);
			return ret;
		} break;
	}

	ERR_FAIL_V(-1);
}

/**
	This will handle both Gzip and Deflate streams. It will automatically allocate the output buffer into the provided p_dst_vect Vector.
	This is required for compressed data whose final uncompressed size is unknown, as is the case for HTTP response bodies.
	This is much slower however than using Compression::decompress because it may result in multiple full copies of the output buffer.
*/
int Compression::decompress_dynamic(Vector<uint8_t> *p_dst_vect, int p_max_dst_size, const uint8_t *p_src, int p_src_size, const Settings &p_settings) {
	uint8_t *dst = nullptr;
	int out_mark = 0;

	ERR_FAIL_COND_V(p_src_size <= 0, Z_DATA_ERROR);

	if (p_settings.get_mode() == MODE_BROTLI) {
#ifdef BROTLI_ENABLED
		BrotliDecoderResult ret;
		BrotliDecoderState *state = BrotliDecoderCreateInstance(nullptr, nullptr, nullptr);
		ERR_FAIL_NULL_V(state, Z_DATA_ERROR);

		// Setup the stream inputs.
		const uint8_t *next_in = p_src;
		size_t avail_in = p_src_size;
		uint8_t *next_out = nullptr;
		size_t avail_out = 0;
		size_t total_out = 0;

		// Ensure the destination buffer is empty.
		p_dst_vect->clear();

		// Decompress until stream ends or end of file.
		do {
			// Add another chunk size to the output buffer.
			// This forces a copy of the whole buffer.
			p_dst_vect->resize(p_dst_vect->size() + p_settings.brotli->chunk_size);
			// Get pointer to the actual output buffer.
			dst = p_dst_vect->ptrw();

			// Set the stream to the new output stream.
			// Since it was copied, we need to reset the stream to the new buffer.
			next_out = &(dst[out_mark]);
			avail_out += p_settings.brotli->chunk_size;

			ret = BrotliDecoderDecompressStream(state, &avail_in, &next_in, &avail_out, &next_out, &total_out);
			if (ret == BROTLI_DECODER_RESULT_ERROR) {
				WARN_PRINT(BrotliDecoderErrorString(BrotliDecoderGetErrorCode(state)));
				BrotliDecoderDestroyInstance(state);
				p_dst_vect->clear();
				return Z_DATA_ERROR;
			}

			out_mark += p_settings.brotli->chunk_size - avail_out;

			// Enforce max output size.
			if (p_max_dst_size > -1 && total_out > (uint64_t)p_max_dst_size) {
				BrotliDecoderDestroyInstance(state);
				p_dst_vect->clear();
				return Z_BUF_ERROR;
			}
		} while (ret != BROTLI_DECODER_RESULT_SUCCESS);

		// If all done successfully, resize the output if it's larger than the actual output.
		if ((unsigned long)p_dst_vect->size() > total_out) {
			p_dst_vect->resize(total_out);
		}

		// Clean up and return.
		BrotliDecoderDestroyInstance(state);
		return Z_OK;
#else
		ERR_FAIL_V_MSG(Z_ERRNO, "Godot was compiled without brotli support.");
#endif
	} else {
		// This function only supports GZip and Deflate.
		ERR_FAIL_COND_V(p_settings.get_mode() != MODE_DEFLATE && p_settings.get_mode() != MODE_GZIP, Z_ERRNO);

		int ret;
		z_stream strm;
		int window_bits = p_settings.get_mode() == MODE_DEFLATE ? 15 : 15 + 16;

		// Initialize the stream.
		strm.zalloc = Z_NULL;
		strm.zfree = Z_NULL;
		strm.opaque = Z_NULL;
		strm.avail_in = 0;
		strm.next_in = Z_NULL;

		int err = inflateInit2(&strm, window_bits);
		ERR_FAIL_COND_V(err != Z_OK, -1);

		// Setup the stream inputs.
		strm.next_in = (Bytef *)p_src;
		strm.avail_in = p_src_size;

		// Ensure the destination buffer is empty.
		p_dst_vect->clear();

		// Decompress until deflate stream ends or end of file.
		int chunk_size;
		if (p_settings.get_mode() == MODE_DEFLATE) {
			chunk_size = p_settings.deflate->chunk_size;
		} else {
			chunk_size = p_settings.gzip->chunk_size;
		}

		do {
			// Add another chunk size to the output buffer.
			// This forces a copy of the whole buffer.
			p_dst_vect->resize(p_dst_vect->size() + chunk_size);
			// Get pointer to the actual output buffer.
			dst = p_dst_vect->ptrw();

			// Set the stream to the new output stream.
			// Since it was copied, we need to reset the stream to the new buffer.
			strm.next_out = &(dst[out_mark]);
			strm.avail_out = chunk_size;

			// Run inflate() on input until output buffer is full and needs to be resized or input runs out.
			do {
				ret = inflate(&strm, Z_SYNC_FLUSH);

				switch (ret) {
					case Z_NEED_DICT:
						ret = Z_DATA_ERROR;
						[[fallthrough]];
					case Z_DATA_ERROR:
					case Z_MEM_ERROR:
					case Z_STREAM_ERROR:
					case Z_BUF_ERROR:
						if (strm.msg) {
							WARN_PRINT(strm.msg);
						}
						(void)inflateEnd(&strm);
						p_dst_vect->clear();
						return ret;
				}
			} while (strm.avail_out > 0 && strm.avail_in > 0);

			out_mark += chunk_size;

			// Enforce max output size.
			if (p_max_dst_size > -1 && strm.total_out > (uint64_t)p_max_dst_size) {
				(void)inflateEnd(&strm);
				p_dst_vect->clear();
				return Z_BUF_ERROR;
			}
		} while (ret != Z_STREAM_END);

		// If all done successfully, resize the output if it's larger than the actual output.
		if ((unsigned long)p_dst_vect->size() > strm.total_out) {
			p_dst_vect->resize(strm.total_out);
		}

		// Clean up and return.
		(void)inflateEnd(&strm);
		return Z_OK;
	}
}

Error Compression::stream_decompress(Stream &p_stream) {
	switch (p_stream.get_mode()) {
		case MODE_BROTLI: {
			if (p_stream.done) {
				return FAILED;
			}
			if (!p_stream.initialized) {
				p_stream.initialize();
			}

			// Chunk assignment.
			const uint32_t BUFFER_SIZE = p_stream.settings.brotli->chunk_size;
			PackedByteArray chunk = p_stream.load_chunk(BUFFER_SIZE);

			// If the chunk is empty, it means that we loaded all the file.
			if (chunk.size() == 0) {
				if (p_stream.brotli->next_out != p_stream.brotli->out_buffer.ptrw()) {
					const uint32_t offset = p_stream.brotli->next_out - p_stream.brotli->out_buffer.ptrw();
					p_stream.save_chunk(p_stream.brotli->out_buffer.slice(0, offset));
				}
				if (p_stream.brotli->result == BROTLI_DECODER_RESULT_NEEDS_MORE_OUTPUT) {
					return ERR_FILE_CANT_WRITE;
				} else if (p_stream.brotli->result == BROTLI_DECODER_RESULT_NEEDS_MORE_INPUT) {
					return ERR_FILE_CORRUPT;
				}

				p_stream.finalize();
			}

			while (true) {
				switch (static_cast<BrotliDecoderResult>(p_stream.brotli->result)) {
					case BROTLI_DECODER_RESULT_NEEDS_MORE_INPUT: {
						memcpy(p_stream.brotli->in_buffer.ptrw(), chunk.ptr(), chunk.size());
						p_stream.brotli->available_in = chunk.size();
						p_stream.brotli->next_in = p_stream.brotli->in_buffer.ptr();
					} break;
					case BROTLI_DECODER_RESULT_NEEDS_MORE_OUTPUT: {
						p_stream.save_chunk(p_stream.brotli->out_buffer);
						p_stream.brotli->available_out = BUFFER_SIZE;
						p_stream.brotli->next_out = p_stream.brotli->out_buffer.ptrw();
					} break;
					default: {
						ERR_FAIL_V_MSG(FAILED, "This is a bug. This should not happen.");
					}
				}

				{
					BrotliDecoderState *state = static_cast<BrotliDecoderState *>(p_stream.brotli->brotli_decoder_instance);
					size_t *available_in = &p_stream.brotli->available_in;
					const uint8_t **next_in = &p_stream.brotli->next_in;
					size_t *available_out = &p_stream.brotli->available_out;
					uint8_t **next_out = &p_stream.brotli->next_out;
					size_t *total_out = &p_stream.brotli->total_out;
					p_stream.brotli->result = BrotliDecoderDecompressStream(state, available_in, next_in, available_out, next_out, total_out);
				}
			}

		} break;
		default: {
			return FAILED;
		}
	}
}

PackedByteArray Compression::Stream::load_chunk(uint32_t p_chunk_size) {
	ERR_FAIL_NULL_V(src, PackedByteArray());

	PackedByteArray loaded_chunk;

	uint32_t chunk_size = MIN(src_size - src_offset, p_chunk_size);
	loaded_chunk.resize(chunk_size);
	memcpy(loaded_chunk.ptrw(), src + src_offset, chunk_size);
	src_offset += chunk_size;

	return loaded_chunk;
}

void Compression::Stream::save_chunk(PackedByteArray p_chunk) {
	ERR_FAIL_NULL(dst);
	ERR_FAIL_INDEX(*dst + dst_offset, dst_max_size);

	const uint32_t chunk_size = p_chunk.size();
	memcpy(dst + dst_offset, p_chunk.ptr(), chunk_size);
	dst_offset += chunk_size;
}

void Compression::Stream::Brotli::initialize(const Stream &p_stream) {
	in_buffer.resize(p_stream.settings.brotli->chunk_size);
	out_buffer.resize(p_stream.settings.brotli->chunk_size);

	brotli_decoder_instance = BrotliDecoderCreateInstance(nullptr, nullptr, nullptr);

	available_in = 0;
	next_in = nullptr;
	available_out = p_stream.brotli->in_buffer.size();
	next_out = p_stream.brotli->out_buffer.ptrw();

	result = BROTLI_DECODER_RESULT_NEEDS_MORE_INPUT;
}

void Compression::Stream::Brotli::finalize(const Stream &p_stream) {
	BrotliDecoderDestroyInstance(static_cast<BrotliDecoderState *>(brotli_decoder_instance));
}
