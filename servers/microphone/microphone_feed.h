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
		MICROPHONE_FEED_FORMAT_ID_UNDEFINED,
		MICROPHONE_FEED_FORMAT_ID_ALAW,
		MICROPHONE_FEED_FORMAT_ID_ULAW,
		MICROPHONE_FEED_FORMAT_ID_LINEAR_PCM,
		MICROPHONE_FEED_FORMAT_ID_MAX,
	};

	enum FormatFlag {
		MICROPHONE_FEED_FORMAT_FLAG_NONE = 0,
		MICROPHONE_FEED_FORMAT_FLAG_IS_ALIGNED_HIGH = 1 << 0,
		MICROPHONE_FEED_FORMAT_FLAG_IS_BIG_ENDIAN = 1 << 1,
		MICROPHONE_FEED_FORMAT_FLAG_IS_FLOAT = 1 << 2,
		MICROPHONE_FEED_FORMAT_FLAG_IS_NON_INTERLEAVED = 1 << 3,
		MICROPHONE_FEED_FORMAT_FLAG_IS_NON_MIXABLE = 1 << 4,
		MICROPHONE_FEED_FORMAT_FLAG_IS_PACKED = 1 << 5,
		MICROPHONE_FEED_FORMAT_FLAG_IS_SIGNED_INTEGER = 1 << 6,
		MICROPHONE_FEED_FORMAT_FLAG_ALL = (1 << 7) - 1,
	};

private:
	uint32_t id;
	bool active = false;

protected:
	static void _bind_methods();

	String name;
	String description;
	FormatId format_id = MICROPHONE_FEED_FORMAT_ID_UNDEFINED;
	BitField<FormatFlag> format_flags = 0;
	double sample_rate = 44100;
	uint32_t channels_per_frame = 1;
	uint32_t bit_depth = sizeof(float) * 8;

	mutable RingBuffer<uint8_t> ring_buffer;
	uint64_t ring_buffer_size = 0;

	float buffer_length = 0.5;

	void resize_buffer();
	void update_ring_buffer_size();

public:
	int get_id() const { return id; }
	virtual bool is_active() const { return MicrophoneDriver::get_singleton()->is_feed_active(Ref<MicrophoneFeed>(this)); }
	virtual void set_active(bool p_active) { MicrophoneDriver::get_singleton()->set_feed_active(Ref<MicrophoneFeed>(this), p_active); }

	String get_name() const { return name; }
	void set_name(String p_name) { name = p_name; }
	String get_description() const { return description; }
	void set_description(String p_description) { description = p_description; }

	void set_format_flags(BitField<FormatFlag> p_format_flags) { format_flags = p_format_flags; }
	BitField<FormatFlag> get_format_flags() const { return format_flags; }
	FormatId get_format_id() const { return format_id; }
	void set_format_id(FormatId p_format_id) { format_id = p_format_id; }

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

	uint32_t get_channels_per_frame() const { return channels_per_frame; }
	void set_channels_per_frame(uint32_t p_channels_per_frame) {
		if (channels_per_frame == p_channels_per_frame) {
			return;
		}
		channels_per_frame = p_channels_per_frame;
		update_ring_buffer_size();
	}

	uint32_t get_bit_depth() const { return bit_depth; }
	void set_bit_depth(const uint32_t p_bit_depth) { bit_depth = p_bit_depth; }

	inline uint32_t get_bytes_per_frame() const { return channels_per_frame * bit_depth; }

	PackedByteArray get_buffer() const;
	void clear_buffer();

	virtual bool activate_feed();
	virtual void deactivate_feed();
	GDVIRTUAL0R(bool, _activate_feed);
	GDVIRTUAL0(_deactivate_feed);

	MicrophoneFeed();
	MicrophoneFeed(String p_name);
	virtual ~MicrophoneFeed();
};

VARIANT_ENUM_CAST(MicrophoneFeed::FormatId);
VARIANT_BITFIELD_CAST(MicrophoneFeed::FormatFlag);
