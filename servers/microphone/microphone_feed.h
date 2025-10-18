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
#include "core/templates/ring_buffer.h"
#include "servers/microphone/microphone_server.h"

class MicrophoneDriver;

class MicrophoneFeed : public RefCounted {
	GDCLASS(MicrophoneFeed, RefCounted);

	friend MicrophoneDriver;

public:
	enum MicrophoneFeedFormatId {
		MICROPHONE_FEED_FORMAT_ID_LINEAR_PCM,
		MICROPHONE_FEED_FORMAT_ID_MAX,
	};

private:
	int id;
	bool active = false;

protected:
	String name;
	String description;
	MicrophoneFeedFormatId format_id = MICROPHONE_FEED_FORMAT_ID_LINEAR_PCM;
	double sample_rate = 44100;
	float buffer_length = 0.5;
	uint64_t buffer_size = 0;
	uint32_t channels_per_frame = 1;
	uint32_t bytes_per_frame = sizeof(float);
	mutable RingBuffer<uint8_t> ring_buffer;

	inline uint32_t get_bits_per_channel() {
		return (8 * bytes_per_frame) / channels_per_frame;
	}

	static void _bind_methods();
	void resize_buffer();
	void update_buffer_size();

public:
	int get_id() const { return id; }
	virtual bool is_active() const { return active; }
	virtual void set_active(bool p_is_active) { active = p_is_active; }

	String get_name() const { return name; }
	void set_name(String p_name) { name = p_name; }

	MicrophoneFeedFormatId get_format_id() const { return format_id; }
	void set_format_id(MicrophoneFeedFormatId p_format_id) { format_id = p_format_id; }

	float get_sample_rate() const { return sample_rate; }
	void set_sample_rate(float p_sample_rate) {
		if (sample_rate == p_sample_rate) {
			return;
		}
		sample_rate = p_sample_rate;
		update_buffer_size();
	}

	float get_buffer_length() const { return buffer_length; }
	void set_buffer_length(float p_buffer_length) {
		if (buffer_length == p_buffer_length) {
			return;
		}
		buffer_length = p_buffer_length;
		update_buffer_size();
	}

	uint32_t get_channels_per_frame() const { return channels_per_frame; }
	void set_channels_per_frame(uint32_t p_channels_per_frame) {
		if (channels_per_frame == p_channels_per_frame) {
			return;
		}
		channels_per_frame = p_channels_per_frame;
		update_buffer_size();
	}

	uint32_t get_bytes_per_frame() const { return bytes_per_frame; }
	void set_bytes_per_frame(uint32_t p_bytes_per_frame) {
		if (bytes_per_frame == p_bytes_per_frame) {
			return;
		}
		bytes_per_frame = p_bytes_per_frame;
		update_buffer_size();
	}

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
