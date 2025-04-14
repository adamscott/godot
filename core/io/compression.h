/**************************************************************************/
/*  compression.h                                                         */
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

#pragma once

#include "core/templates/vector.h"
#include "core/typedefs.h"

#include <zlib.h>

class Compression {
public:
	static inline int zlib_level = Z_DEFAULT_COMPRESSION;
	static inline int gzip_level = Z_DEFAULT_COMPRESSION;
	static inline int zstd_level = 3;
	static inline bool zstd_long_distance_matching = false;
	static inline int zstd_window_log_size = 27; // ZSTD_WINDOWLOG_LIMIT_DEFAULT
	static inline int gzip_chunk = 16384;

	enum Mode : int32_t {
		MODE_FASTLZ,
		MODE_DEFLATE,
		MODE_ZSTD,
		MODE_GZIP,
		MODE_BROTLI
	};

	struct Settings {
		struct Brotli {
			enum EncoderMode {
				BROTLI_ENCODER_MODE_FONT,
				BROTLI_ENCODER_MODE_GENERIC,
				BROTLI_ENCODER_MODE_TEXT,
			};

		private:
			EncoderMode _encoder_mode = BROTLI_ENCODER_MODE_GENERIC;
			uint8_t _quality = 9;

		public:
			EncoderMode get_encoder_mode() const {
				return _encoder_mode;
			}

			void set_encoder_mode(EncoderMode p_encoder_mode) {
				_encoder_mode = p_encoder_mode;
			}

			uint8_t get_quality() const {
				return _quality;
			}

			void set_quality(uint8_t p_quality) {
				_quality = p_quality;
			}
		};

	private:
		Mode _mode = MODE_ZSTD;
		bool _mode_set = false;

	public:
		union {
			Brotli *brotli = nullptr;
		};

		Mode get_mode() const {
			if (!_mode_set) {
				ERR_FAIL_V_MSG(_mode, "Trying to get mode when none has been set yet");
			}
			return _mode;
		}

		void set_mode(Mode p_mode) {
			if (_mode_set) {
				ERR_FAIL_MSG("Cannot set mode twice.");
			}
			_mode_set = true;
			_mode = p_mode;
			switch (_mode) {
				case MODE_BROTLI: {
					brotli = memnew(Brotli);
				} break;
				default: {
					// Do nothing.
				}
			}
		}

		Settings() {
			_mode = MODE_ZSTD;
			_mode_set = false;
			brotli = nullptr;
		}

		Settings(Mode p_mode) {
			set_mode(p_mode);
		}

		~Settings() {
			if (!_mode_set) {
				return;
			}
			switch (_mode) {
				case MODE_BROTLI: {
					memfree(brotli);
				} break;
				default: {
					// Do nothing.
				}
			}
		}
	};

public:
	static int compress(uint8_t *p_dst, const uint8_t *p_src, int p_src_size, Mode p_mode = MODE_ZSTD) {
		return compress(p_dst, p_src, p_src_size, Settings(p_mode));
	}
	static int compress(uint8_t *p_dst, const uint8_t *p_src, int p_src_size, const Settings &p_settings = {});
	static int get_max_compressed_buffer_size(int p_src_size, Mode p_mode = MODE_ZSTD) {
		return get_max_compressed_buffer_size(p_src_size, Settings(p_mode));
	}
	static int get_max_compressed_buffer_size(int p_src_size, const Settings &p_settings = {});
	static int decompress(uint8_t *p_dst, int p_dst_max_size, const uint8_t *p_src, int p_src_size, Mode p_mode = MODE_ZSTD) {
		return decompress(p_dst, p_dst_max_size, p_src, p_src_size, Settings(p_mode));
	}
	static int decompress(uint8_t *p_dst, int p_dst_max_size, const uint8_t *p_src, int p_src_size, const Settings &p_settings = {});
	static int decompress_dynamic(Vector<uint8_t> *p_dst_vect, int p_max_dst_size, const uint8_t *p_src, int p_src_size, Mode p_mode = MODE_ZSTD) {
		return decompress_dynamic(p_dst_vect, p_max_dst_size, p_src, p_src_size, Settings(p_mode));
	}
	static int decompress_dynamic(Vector<uint8_t> *p_dst_vect, int p_max_dst_size, const uint8_t *p_src, int p_src_size, const Settings &p_settings = {});
};
