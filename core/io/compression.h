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
#include "core/variant/variant.h"
#include <cstdint>

#include <zlib.h>

class Compression {
public:
	// Deflate.
	static inline int zlib_level = Z_DEFAULT_COMPRESSION;
	static inline int zlib_chunk_size = 16384;
	// Gzip.
	static inline int gzip_level = Z_DEFAULT_COMPRESSION;
	static inline int gzip_chunk_size = 16384;
	// Zstd.
	static inline int zstd_level = 3;
	static inline bool zstd_long_distance_matching = false;
	static inline int zstd_window_log_size = 27; // ZSTD_WINDOWLOG_LIMIT_DEFAULT
	// Brotli.
	static inline int brotli_chunk_size = 16284;
	static inline int brotli_encoder_mode = 1;
	static inline int brotli_quality = 9;

	enum Mode : int32_t {
		MODE_FASTLZ,
		MODE_DEFLATE,
		MODE_ZSTD,
		MODE_GZIP,
		MODE_BROTLI
	};

public:
	struct Settings {
		struct FastLZ {
		};

		struct Deflate {
			int level;
			uint32_t chunk_size;
			Deflate() :
					level(zlib_level), chunk_size(zlib_chunk_size) {}
		};

		struct Gzip {
			int level;
			uint32_t chunk_size;
			Gzip() :
					level(gzip_level), chunk_size(gzip_chunk_size) {}
		};

		struct Zstd {
			int level;
			bool long_distance_matching;
			int window_log_size;
			Zstd() :
					level(zstd_level), long_distance_matching(zstd_long_distance_matching), window_log_size(zstd_window_log_size) {}
		};

		struct Brotli {
			enum EncoderMode {
				BROTLI_ENCODER_MODE_FONT,
				BROTLI_ENCODER_MODE_GENERIC,
				BROTLI_ENCODER_MODE_TEXT,
			};

			uint32_t chunk_size;
			EncoderMode encoder_mode;
			uint8_t quality;

			constexpr Brotli &operator=(const Brotli &p_brotli_settings) {
				encoder_mode = p_brotli_settings.encoder_mode;
				quality = p_brotli_settings.quality;
				return *this;
			}

			Brotli() :
					chunk_size(brotli_chunk_size), encoder_mode(static_cast<EncoderMode>(brotli_encoder_mode)), quality(brotli_quality) {}
		};

	private:
		Mode _mode = MODE_ZSTD;
		bool _mode_set = false;

		void _copy_from_settings(const Settings &p_settings) {
			set_mode(p_settings._mode);
#define SWITCH_CASE(mode, variable)       \
	case MODE_##mode: {                   \
		*variable = *p_settings.variable; \
	} break
			switch (_mode) {
				SWITCH_CASE(DEFLATE, deflate);
				SWITCH_CASE(GZIP, gzip);
				SWITCH_CASE(ZSTD, zstd);
				SWITCH_CASE(BROTLI, brotli);
#undef SWITCH_CASE
				default: {
					// Do nothing.
				}
			}
		}

		void _switch_from() {
			if (!_mode_set) {
				return;
			}

			switch (_mode) {
				case MODE_FASTLZ: {
					memfree(fastlz);
				} break;
				case MODE_DEFLATE: {
					memfree(deflate);
				} break;
				case MODE_GZIP: {
					memfree(gzip);
				} break;
				case MODE_ZSTD: {
					memfree(zstd);
				} break;
				case MODE_BROTLI: {
					memfree(brotli);
				} break;
				default: {
					// Do nothing.
				}
			}
			fastlz = nullptr;
		}

		void _switch_to(const Mode p_mode) {
			switch (p_mode) {
				case MODE_FASTLZ: {
					fastlz = memnew(FastLZ);
				} break;
				case MODE_DEFLATE: {
					deflate = memnew(Deflate);
				} break;
				case MODE_GZIP: {
					gzip = memnew(Gzip);
				} break;
				case MODE_ZSTD: {
					zstd = memnew(Zstd);
				} break;
				case MODE_BROTLI: {
					brotli = memnew(Brotli);
				} break;
				default: {
					// Do nothing.
				}
			}
			_mode = p_mode;
			_mode_set = true;
		}

	public:
		union {
			FastLZ *fastlz = nullptr;
			Deflate *deflate;
			Gzip *gzip;
			Zstd *zstd;
			Brotli *brotli;
		};

		Mode get_mode() const {
			return _mode;
		}

		void set_mode(Mode p_mode) {
			if (p_mode == _mode && _mode_set) {
				return;
			}
			_switch_from();
			_switch_to(p_mode);
		}

		constexpr void operator=(const Settings &p_settings) {
			_copy_from_settings(p_settings);
		}

		Settings() :
				Settings(MODE_ZSTD) {}

		Settings(Mode p_mode) {
			set_mode(p_mode);
		}

		Settings(const Settings &p_settings) {
			_copy_from_settings(p_settings);
		}

		~Settings() {
			_switch_from();
		}
	};

	struct Stream {
		struct FastLZ {
		};

		struct Deflate {
		};

		struct Gzip {
		};

		struct Zstd {
		};

		struct Brotli {
			PackedByteArray in_buffer;
			PackedByteArray out_buffer;

			void *brotli_decoder_instance = nullptr;

			size_t available_in = 0;
			const uint8_t *next_in = nullptr;
			size_t available_out = 0;
			uint8_t *next_out = nullptr;
			size_t total_out = 0;

			int result = 0;

			void initialize(const Stream &p_stream);
			void finalize(const Stream &p_stream);
		};

		uint8_t *src;
		uint32_t src_size;
		uint32_t src_offset;
		uint8_t *dst;
		uint32_t dst_max_size;
		uint32_t dst_offset;
		Settings settings;

		bool initialized = false;
		bool done = false;

	private:
		Mode _mode;
		bool _mode_set = false;

		void _switch_from() {
			if (!_mode_set) {
				return;
			}

			switch (_mode) {
				case MODE_FASTLZ: {
					memfree(fastlz);
				} break;
				case MODE_DEFLATE: {
					memfree(deflate);
				} break;
				case MODE_GZIP: {
					memfree(gzip);
				} break;
				case MODE_ZSTD: {
					memfree(zstd);
				} break;
				case MODE_BROTLI: {
					memfree(brotli);
				} break;
				default: {
					// Do nothing.
				}
			}
			fastlz = nullptr;
		}

		void _switch_to(const Mode p_mode) {
			switch (p_mode) {
				case MODE_FASTLZ: {
					fastlz = memnew(FastLZ);
				} break;
				case MODE_DEFLATE: {
					deflate = memnew(Deflate);
				} break;
				case MODE_GZIP: {
					gzip = memnew(Gzip);
				} break;
				case MODE_ZSTD: {
					zstd = memnew(Zstd);
				} break;
				case MODE_BROTLI: {
					brotli = memnew(Brotli);
				} break;
				default: {
					// Do nothing.
				}
			}
			_mode = p_mode;
			_mode_set = true;
		}

	public:
		union {
			FastLZ *fastlz = nullptr;
			Deflate *deflate;
			Gzip *gzip;
			Zstd *zstd;
			Brotli *brotli;
		};

		void set_mode(const Mode p_mode) {
			if (_mode == p_mode) {
				return;
			}
			_switch_from();
			_switch_to(p_mode);
			settings.set_mode(p_mode);
		}

		Mode get_mode() {
			return _mode;
		}

		void initialize() {
			ERR_FAIL_COND(initialized);

			switch (_mode) {
				case MODE_BROTLI: {
					brotli->initialize(*this);
				} break;
				default: {
					// Do nothing.
				}
			}

			initialized = true;
		}

		void finalize() {
			ERR_FAIL_COND(!initialized || done);

			switch (_mode) {
				case MODE_BROTLI: {
					brotli->finalize(*this);
				} break;
				default: {
					// Do nothing.
				}
			}

			done = true;
		}

		PackedByteArray load_chunk(uint32_t p_chunk_size);
		void save_chunk(PackedByteArray p_chunk);

		~Stream() {
			_switch_from();
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

	static Error stream_decompress(Stream &p_stream);
};
