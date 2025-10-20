/**************************************************************************/
/*  microphone_feed.h                                                     */
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

#include "core/object/gdvirtual.gen.inc"
#include "core/object/ref_counted.h"
#include "core/templates/bit_field.h"
#include "core/templates/ring_buffer.h"
#include "servers/microphone/microphone_driver.h"
#include "servers/microphone/microphone_server.h"

class MicrophoneDriver;

class MicrophoneFeed : public RefCounted {
	GDCLASS(MicrophoneFeed, RefCounted);

	friend MicrophoneDriver;

public:
	enum FormatId {
		FORMAT_ID_UNDEFINED,
		FORMAT_ID_NOT_SUPPORTED,
		FORMAT_ID_ALAW_PCM,
		FORMAT_ID_ULAW_PCM,
		FORMAT_ID_LINEAR_PCM,
		FORMAT_ID_MAX,
	};

	enum FormatFlag {
		FORMAT_FLAG_NONE = 0,
		FORMAT_FLAG_IS_ALIGNED_HIGH = 1 << 0,
		FORMAT_FLAG_IS_BIG_ENDIAN = 1 << 1,
		FORMAT_FLAG_IS_FLOAT = 1 << 2,
		FORMAT_FLAG_IS_INTERLEAVED = 1 << 3,
		FORMAT_FLAG_IS_MIXABLE = 1 << 4,
		FORMAT_FLAG_IS_PACKED = 1 << 5,
		FORMAT_FLAG_IS_SIGNED_INTEGER = 1 << 6,
		FORMAT_FLAG_ALL = (1 << 7) - 1,
	};

private:
	uint32_t id;
	bool active = false;

protected:
	static void _bind_methods();

	String name;
	String description;
	String not_supported_format_id_name;
	FormatId format_id = FORMAT_ID_UNDEFINED;
	BitField<FormatFlag> format_flags = FORMAT_FLAG_NONE;
	double sample_rate = 44100;
	uint8_t channels = 1;
	uint32_t bit_depth = sizeof(float) * 8;

	mutable RingBuffer<uint8_t> ring_buffer;
	uint64_t ring_buffer_size = 0;

	float buffer_length = 0.5;

	void update_ring_buffer_size();
	void resize_buffer();

public:
	int get_id() const { return id; }
	virtual bool is_active() const { return MicrophoneDriver::get_singleton()->is_feed_active(Ref<MicrophoneFeed>(this)); }
	virtual void set_active(bool p_active) { MicrophoneDriver::get_singleton()->set_feed_active(Ref<MicrophoneFeed>(this), p_active); }

	String get_name() const { return name; }
	void set_name(String p_name) {
		if (p_name == name) {
			return;
		}
		name = p_name;
	}
	String get_description() const { return description; }
	void set_description(String p_description) {
		if (p_description == description) {
			return;
		}
		description = p_description;
	}

	BitField<FormatFlag> get_format_flags() const { return format_flags; }
	void set_format_flags(BitField<FormatFlag> p_format_flags) {
		if (p_format_flags == format_flags) {
			return;
		}
		format_flags = p_format_flags;
	}
	FormatId get_format_id() const { return format_id; }
	void set_format_id(FormatId p_format_id) {
		if (p_format_id == format_id) {
			return;
		}
		format_id = p_format_id;
	}
	String get_not_supported_format_id_name() const { return not_supported_format_id_name; }
	void set_not_supported_format_id_name(String p_not_supported_format_id_name) {
		if (p_not_supported_format_id_name == not_supported_format_id_name) {
			return;
		}
		not_supported_format_id_name = p_not_supported_format_id_name;
	}

	float get_sample_rate() const { return sample_rate; }
	void set_sample_rate(float p_sample_rate) {
		if (sample_rate == p_sample_rate) {
			return;
		}
		sample_rate = p_sample_rate;
		update_ring_buffer_size();
	}

	float get_buffer_length() const { return buffer_length; }
	void set_buffer_length(float p_buffer_length) {
		if (buffer_length == p_buffer_length) {
			return;
		}
		buffer_length = p_buffer_length;
		update_ring_buffer_size();
	}

	uint8_t get_channels() const { return channels; }
	void set_channels(uint8_t p_channels) {
		if (channels == p_channels) {
			return;
		}
		channels = p_channels;
		update_ring_buffer_size();
	}

	uint32_t get_bit_depth() const { return bit_depth; }
	void set_bit_depth(const uint32_t p_bit_depth) {
		if (bit_depth == p_bit_depth) {
			return;
		};
		bit_depth = p_bit_depth;
		update_ring_buffer_size();
	}

	inline uint32_t get_bytes_per_frame() const { return channels * bit_depth; }

	PackedByteArray get_buffer() const;
	void clear_buffer();

	virtual bool activate_feed();
	virtual void deactivate_feed();
	GDVIRTUAL0R(bool, _activate_feed);
	GDVIRTUAL0(_deactivate_feed);

	String get_human_readable_explanation();

	MicrophoneFeed();
	MicrophoneFeed(String p_name);
	virtual ~MicrophoneFeed();
};

VARIANT_ENUM_CAST(MicrophoneFeed::FormatId);
VARIANT_BITFIELD_CAST(MicrophoneFeed::FormatFlag);
