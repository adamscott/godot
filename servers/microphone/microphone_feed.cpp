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

#include "core/object/object.h"
#include "servers/microphone/microphone_server.h"

void MicrophoneFeed::update_buffer_size() {
	uint64_t new_buffer_size = (uint64_t)(buffer_length * sample_rate) * channels_per_frame * bytes_per_frame;
	if (new_buffer_size == buffer_size) {
		return;
	}
	buffer_size = new_buffer_size;
	resize_buffer();
}

void MicrophoneFeed::resize_buffer() {
	ring_buffer.resize(nearest_shift(buffer_size));
}

PackedByteArray MicrophoneFeed::get_buffer() const {
	PackedByteArray data;
	data.resize_initialized(buffer_size);
	uint32_t data_left = ring_buffer.data_left();
	if (data_left > buffer_size) {
		ring_buffer.advance_read(data_left - buffer_size);
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
	return ret;
}

void MicrophoneFeed::deactivate_feed() {
	GDVIRTUAL_CALL(_deactivate_feed);
}

MicrophoneFeed::MicrophoneFeed() {
	id = MicrophoneServer::get_singleton()->get_free_id();
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
	ClassDB::bind_method(D_METHOD("get_sample_rate"), &MicrophoneFeed::get_sample_rate);
	ClassDB::bind_method(D_METHOD("set_sample_rate", "sample_rate"), &MicrophoneFeed::set_sample_rate);
	ClassDB::bind_method(D_METHOD("get_buffer_length"), &MicrophoneFeed::get_buffer_length);
	ClassDB::bind_method(D_METHOD("set_buffer_length", "buffer_length"), &MicrophoneFeed::set_buffer_length);
	ClassDB::bind_method(D_METHOD("get_channels_per_frame"), &MicrophoneFeed::get_channels_per_frame);
	ClassDB::bind_method(D_METHOD("set_channels_per_frame", "channels_per_frame"), &MicrophoneFeed::set_channels_per_frame);
	ClassDB::bind_method(D_METHOD("get_bytes_per_frame"), &MicrophoneFeed::get_bytes_per_frame);
	ClassDB::bind_method(D_METHOD("set_bytes_per_frame", "bytes_per_frame"), &MicrophoneFeed::set_bytes_per_frame);

	ClassDB::bind_method(D_METHOD("get_buffer"), &MicrophoneFeed::get_buffer);
	ClassDB::bind_method(D_METHOD("clear_buffer"), &MicrophoneFeed::clear_buffer);

	GDVIRTUAL_BIND(_activate_feed);
	GDVIRTUAL_BIND(_deactivate_feed);

	ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "sample_rate"), "set_sample_rate", "get_sample_rate");
	ADD_PROPERTY(PropertyInfo(Variant::INT, "buffer_length"), "set_buffer_length", "get_buffer_length");
	ADD_PROPERTY(PropertyInfo(Variant::INT, "channels_per_frame"), "set_channels_per_frame", "get_channels_per_frame");
	ADD_PROPERTY(PropertyInfo(Variant::INT, "bytes_per_frame"), "set_bytes_per_frame", "get_bytes_per_frame");

	ADD_GROUP("Feed", "feed_");
	ADD_PROPERTY(PropertyInfo(Variant::BOOL, "feed_is_active"), "set_active", "is_active");
	ADD_PROPERTY(PropertyInfo(Variant::STRING, "feed_name"), "set_name", "get_name");

	ADD_SIGNAL(MethodInfo(SNAME("feed_activated")));
	ADD_SIGNAL(MethodInfo(SNAME("feed_deactivated")));
}
