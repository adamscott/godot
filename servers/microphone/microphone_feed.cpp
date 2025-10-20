/**************************************************************************/
/*  microphone_feed.cpp                                                   */
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

#include "microphone_feed.h"

#include "core/object/class_db.h"
#include "core/object/object.h"
#include "servers/microphone/microphone_driver.h"
#include "servers/microphone/microphone_server.h"

void MicrophoneFeed::update_ring_buffer_size() {
	uint64_t new_ring_buffer_size = (uint64_t)(buffer_length * sample_rate) * channels_per_frame * (bit_depth / 8);
	if (new_ring_buffer_size == ring_buffer_size) {
		return;
	}
	ring_buffer_size = new_ring_buffer_size;
	resize_buffer();
}

void MicrophoneFeed::resize_buffer() {
	ring_buffer.resize(nearest_shift(ring_buffer_size));
}

PackedByteArray MicrophoneFeed::get_buffer() const {
	PackedByteArray data;
	data.resize_initialized(ring_buffer_size);
	uint32_t data_left = ring_buffer.data_left();
	if (data_left > ring_buffer_size) {
		ring_buffer.advance_read(data_left - ring_buffer_size);
	}
	ring_buffer.read(data.ptrw(), ring_buffer.data_left());
	return data;
}

void MicrophoneFeed::clear_buffer() {
	ring_buffer.clear();
}

bool MicrophoneFeed::activate_feed() {
	bool ret = true;
	GDVIRTUAL_CALL(_activate_feed, ret);

	if (ret) {
		return MicrophoneDriver::get_singleton()->activate_feed(this);
	}
	return ret;
}

void MicrophoneFeed::deactivate_feed() {
	GDVIRTUAL_CALL(_deactivate_feed);
	MicrophoneDriver::get_singleton()->deactivate_feed(this);
}

MicrophoneFeed::MicrophoneFeed() {
	id = -1;
	name = "???";
}

MicrophoneFeed::~MicrophoneFeed() {
}

void MicrophoneFeed::_bind_methods() {
	ClassDB::bind_method(D_METHOD("get_id"), &MicrophoneFeed::get_id);

	ClassDB::bind_method(D_METHOD("is_active"), &MicrophoneFeed::is_active);
	ClassDB::bind_method(D_METHOD("set_active", "active"), &MicrophoneFeed::set_active);
	ClassDB::bind_method(D_METHOD("get_name"), &MicrophoneFeed::get_name);
	ClassDB::bind_method(D_METHOD("set_name", "name"), &MicrophoneFeed::set_name);
	ClassDB::bind_method(D_METHOD("get_description"), &MicrophoneFeed::get_description);
	ClassDB::bind_method(D_METHOD("set_description", "description"), &MicrophoneFeed::set_description);

	ClassDB::bind_method(D_METHOD("get_format_id"), &MicrophoneFeed::get_format_id);
	ClassDB::bind_method(D_METHOD("set_format_id", "format_id"), &MicrophoneFeed::set_format_id);
	ClassDB::bind_method(D_METHOD("get_format_flags"), &MicrophoneFeed::get_format_flags);
	ClassDB::bind_method(D_METHOD("set_format_flags", "format_flags"), &MicrophoneFeed::set_format_flags);

	ClassDB::bind_method(D_METHOD("get_sample_rate"), &MicrophoneFeed::get_sample_rate);
	ClassDB::bind_method(D_METHOD("set_sample_rate", "sample_rate"), &MicrophoneFeed::set_sample_rate);
	ClassDB::bind_method(D_METHOD("get_buffer_length"), &MicrophoneFeed::get_buffer_length);
	ClassDB::bind_method(D_METHOD("set_buffer_length", "buffer_length"), &MicrophoneFeed::set_buffer_length);
	ClassDB::bind_method(D_METHOD("get_channels_per_frame"), &MicrophoneFeed::get_channels_per_frame);
	ClassDB::bind_method(D_METHOD("set_channels_per_frame", "channels_per_frame"), &MicrophoneFeed::set_channels_per_frame);
	ClassDB::bind_method(D_METHOD("get_bit_depth"), &MicrophoneFeed::get_bit_depth);
	ClassDB::bind_method(D_METHOD("set_bit_depth", "bit_depth"), &MicrophoneFeed::set_bit_depth);
	ClassDB::bind_method(D_METHOD("get_bytes_per_frame"), &MicrophoneFeed::get_bytes_per_frame);

	ClassDB::bind_method(D_METHOD("get_buffer"), &MicrophoneFeed::get_buffer);
	ClassDB::bind_method(D_METHOD("clear_buffer"), &MicrophoneFeed::clear_buffer);

	GDVIRTUAL_BIND(_activate_feed);
	GDVIRTUAL_BIND(_deactivate_feed);

	ADD_PROPERTY(PropertyInfo(Variant::STRING, "name"), "set_name", "get_name");
	ADD_PROPERTY(PropertyInfo(Variant::STRING, "description"), "set_description", "get_description");

	ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "sample_rate"), "set_sample_rate", "get_sample_rate");
	ADD_PROPERTY(PropertyInfo(Variant::INT, "buffer_length"), "set_buffer_length", "get_buffer_length");
	ADD_PROPERTY(PropertyInfo(Variant::INT, "channels_per_frame"), "set_channels_per_frame", "get_channels_per_frame");
	ADD_PROPERTY(PropertyInfo(Variant::INT, "bit_depth"), "set_bit_depth", "get_bit_depth");

	ADD_PROPERTY(PropertyInfo(Variant::BOOL, "active"), "set_active", "is_active");

	ADD_SIGNAL(MethodInfo(SNAME("activated")));
	ADD_SIGNAL(MethodInfo(SNAME("deactivated")));

	BIND_ENUM_CONSTANT(FORMAT_ID_ALAW);
	BIND_ENUM_CONSTANT(FORMAT_ID_ULAW);
	BIND_ENUM_CONSTANT(FORMAT_ID_LINEAR_PCM);
	BIND_ENUM_CONSTANT(FORMAT_ID_MAX);

	BIND_BITFIELD_FLAG(FORMAT_FLAG_NONE);
	BIND_BITFIELD_FLAG(FORMAT_FLAG_IS_ALIGNED_HIGH);
	BIND_BITFIELD_FLAG(FORMAT_FLAG_IS_BIG_ENDIAN);
	BIND_BITFIELD_FLAG(FORMAT_FLAG_IS_FLOAT);
	BIND_BITFIELD_FLAG(FORMAT_FLAG_IS_NON_INTERLEAVED);
	BIND_BITFIELD_FLAG(FORMAT_FLAG_IS_NON_MIXABLE);
	BIND_BITFIELD_FLAG(FORMAT_FLAG_IS_PACKED);
	BIND_BITFIELD_FLAG(FORMAT_FLAG_IS_SIGNED_INTEGER);
	BIND_BITFIELD_FLAG(FORMAT_FLAG_ALL);
}
