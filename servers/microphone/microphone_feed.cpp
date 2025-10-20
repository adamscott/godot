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
#include "core/string/string_builder.h"
#include "servers/microphone/microphone_driver.h"
#include "servers/microphone/microphone_server.h"

void MicrophoneFeed::update_ring_buffer_size() {
	uint64_t new_ring_buffer_size = (uint64_t)(buffer_length * sample_rate) * channels * (bit_depth / 8);
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

String MicrophoneFeed::get_human_readable_explanation() {
	const String INDENT = String(" ").repeat(2);
	const String YES = "yes";
	const String NO = "no";
#define BOOL_TO_YES_NO(value) (value ? YES : NO)
#define FORMAT_FLAG_TO_YES_NO(flag) BOOL_TO_YES_NO(format_flags.has_flag(MicrophoneFeed::FormatFlag::flag))

	StringBuilder root_builder;
	root_builder.append(vformat("Name:        %s\n", name));
	root_builder.append(vformat("Description: %s\n", description));
	root_builder.append(vformat("Sample rate: %s\n", sample_rate));
	root_builder.append(vformat("Channels:    %s\n", channels));
	root_builder.append(vformat("Bit depth:   %s\n", bit_depth));
	String format_id_string;
	switch (format_id) {
		case FORMAT_ID_UNDEFINED: {
			format_id_string = "UNDEFINED [invalid value]";
		} break;
		case FORMAT_ID_NOT_SUPPORTED: {
			format_id_string = vformat("NOT SUPPORTED (%s) [invalid value]", not_supported_format_id_name);
		} break;
		case FORMAT_ID_ALAW_PCM: {
			format_id_string = "A-law PCM";
		} break;
		case FORMAT_ID_ULAW_PCM: {
			format_id_string = "μ-law PCM";
		} break;
		case FORMAT_ID_LINEAR_PCM: {
			format_id_string = "Linear PCM";
		} break;
		case FORMAT_ID_MAX: {
			format_id_string = "MAX [invalid value]";
		} break;
	}
	root_builder.append(vformat("Format id:   %s\n", format_id_string));
	root_builder.append("Format flags: \n");
	StringBuilder flags_builder;
	flags_builder.append(vformat("Aligned high:   %s\n", FORMAT_FLAG_TO_YES_NO(FORMAT_FLAG_IS_ALIGNED_HIGH)));
	flags_builder.append(vformat("Big endian:     %s\n", FORMAT_FLAG_TO_YES_NO(FORMAT_FLAG_IS_BIG_ENDIAN)));
	flags_builder.append(vformat("Float:          %s\n", FORMAT_FLAG_TO_YES_NO(FORMAT_FLAG_IS_FLOAT)));
	flags_builder.append(vformat("Interleaved:    %s\n", FORMAT_FLAG_TO_YES_NO(FORMAT_FLAG_IS_INTERLEAVED)));
	flags_builder.append(vformat("Mixable:        %s\n", FORMAT_FLAG_TO_YES_NO(FORMAT_FLAG_IS_MIXABLE)));
	flags_builder.append(vformat("Packed:         %s\n", FORMAT_FLAG_TO_YES_NO(FORMAT_FLAG_IS_PACKED)));
	flags_builder.append(vformat("Signed integer: %s\n", FORMAT_FLAG_TO_YES_NO(FORMAT_FLAG_IS_SIGNED_INTEGER)));
	root_builder.append(flags_builder.as_string().indent(INDENT));

	return root_builder.as_string();

#undef FORMAT_FLAG_TO_YES_NO
#undef BOOL_TO_YES_NO
}

MicrophoneFeed::MicrophoneFeed() {
	id = -1;
	name = "<uninitialized>";
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
	ClassDB::bind_method(D_METHOD("get_not_supported_format_id_name"), &MicrophoneFeed::get_not_supported_format_id_name);
	ClassDB::bind_method(D_METHOD("set_not_supported_format_id_name", "not_supported_format_id_name"), &MicrophoneFeed::set_not_supported_format_id_name);

	ClassDB::bind_method(D_METHOD("get_sample_rate"), &MicrophoneFeed::get_sample_rate);
	ClassDB::bind_method(D_METHOD("set_sample_rate", "sample_rate"), &MicrophoneFeed::set_sample_rate);
	ClassDB::bind_method(D_METHOD("get_buffer_length"), &MicrophoneFeed::get_buffer_length);
	ClassDB::bind_method(D_METHOD("set_buffer_length", "buffer_length"), &MicrophoneFeed::set_buffer_length);
	ClassDB::bind_method(D_METHOD("get_channels"), &MicrophoneFeed::get_channels);
	ClassDB::bind_method(D_METHOD("set_channels", "channels"), &MicrophoneFeed::set_channels);
	ClassDB::bind_method(D_METHOD("get_bit_depth"), &MicrophoneFeed::get_bit_depth);
	ClassDB::bind_method(D_METHOD("set_bit_depth", "bit_depth"), &MicrophoneFeed::set_bit_depth);
	ClassDB::bind_method(D_METHOD("get_bytes_per_frame"), &MicrophoneFeed::get_bytes_per_frame);

	ClassDB::bind_method(D_METHOD("get_buffer"), &MicrophoneFeed::get_buffer);
	ClassDB::bind_method(D_METHOD("clear_buffer"), &MicrophoneFeed::clear_buffer);

	ClassDB::bind_method(D_METHOD("get_human_readable_explanation"), &MicrophoneFeed::get_human_readable_explanation);

	GDVIRTUAL_BIND(_activate_feed);
	GDVIRTUAL_BIND(_deactivate_feed);

	ADD_PROPERTY(PropertyInfo(Variant::STRING, "name"), "set_name", "get_name");
	ADD_PROPERTY(PropertyInfo(Variant::STRING, "description"), "set_description", "get_description");

	ADD_PROPERTY(PropertyInfo(Variant::INT, "format_id", PROPERTY_HINT_ENUM, "Undefined,Not Supported,A-law PCM,μ-law PCM,Linear PCM"), "set_format_id", "get_format_id");
	ADD_PROPERTY(PropertyInfo(Variant::INT, "format_flags", PROPERTY_HINT_FLAGS, "Is Aligned High,Is Big Endian,Is Float,Is Interleaved,Is Mixable,Is Packed,Is Signed Integer"), "set_format_flags", "get_format_flags");
	ADD_PROPERTY(PropertyInfo(Variant::STRING, "not_supported_format_id_name", PROPERTY_HINT_FLAGS), "set_not_supported_format_id_name", "get_not_supported_format_id_name");

	ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "sample_rate"), "set_sample_rate", "get_sample_rate");
	ADD_PROPERTY(PropertyInfo(Variant::INT, "buffer_length"), "set_buffer_length", "get_buffer_length");
	ADD_PROPERTY(PropertyInfo(Variant::INT, "channels"), "set_channels", "get_channels");
	ADD_PROPERTY(PropertyInfo(Variant::INT, "bit_depth"), "set_bit_depth", "get_bit_depth");

	ADD_PROPERTY(PropertyInfo(Variant::BOOL, "active"), "set_active", "is_active");

	ADD_SIGNAL(MethodInfo(SNAME("activated")));
	ADD_SIGNAL(MethodInfo(SNAME("deactivated")));

	BIND_ENUM_CONSTANT(FORMAT_ID_UNDEFINED);
	BIND_ENUM_CONSTANT(FORMAT_ID_NOT_SUPPORTED);
	BIND_ENUM_CONSTANT(FORMAT_ID_ALAW_PCM);
	BIND_ENUM_CONSTANT(FORMAT_ID_ULAW_PCM);
	BIND_ENUM_CONSTANT(FORMAT_ID_LINEAR_PCM);
	BIND_ENUM_CONSTANT(FORMAT_ID_MAX);

	BIND_BITFIELD_FLAG(FORMAT_FLAG_NONE);
	BIND_BITFIELD_FLAG(FORMAT_FLAG_IS_ALIGNED_HIGH);
	BIND_BITFIELD_FLAG(FORMAT_FLAG_IS_BIG_ENDIAN);
	BIND_BITFIELD_FLAG(FORMAT_FLAG_IS_FLOAT);
	BIND_BITFIELD_FLAG(FORMAT_FLAG_IS_INTERLEAVED);
	BIND_BITFIELD_FLAG(FORMAT_FLAG_IS_MIXABLE);
	BIND_BITFIELD_FLAG(FORMAT_FLAG_IS_PACKED);
	BIND_BITFIELD_FLAG(FORMAT_FLAG_IS_SIGNED_INTEGER);
	BIND_BITFIELD_FLAG(FORMAT_FLAG_ALL);
}
