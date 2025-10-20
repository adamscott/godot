/**************************************************************************/
/*  microphone_driver_pulseaudio.cpp                                      */
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

#include "microphone_driver_pulseaudio.h"

#ifdef PULSEAUDIO_ENABLED

#include "core/error/error_list.h"
#include "core/error/error_macros.h"
#include "core/object/object.h"
#include "core/os/main_loop.h"
#include "core/os/os.h"
#include "servers/microphone/microphone_feed.h"
#include "servers/microphone/microphone_server.h"

Error _microphone_feed_to_pa_sample_spec(Ref<MicrophoneFeed> p_feed, pa_sample_spec &p_pa_sample_spec) {
	pa_sample_format sample_format;
	BitField<MicrophoneFeed::FormatFlag> feed_format_flags = p_feed->get_format_flags();

#define HAS_FLAG(flag) \
	feed_format_flags.has_flag(MicrophoneFeed::flag)
#define HAS_BIT_DEPTH(bit_depth) \
	p_feed->get_bit_depth() == bit_depth
#define FORMAT_ERROR(error_string, ...) \
	ERR_FAIL_V_MSG(ERR_CANT_CREATE, vformat("unsupported format for PulseAudio: %s", error_string))

	switch (p_feed->get_format_id()) {
		case MicrophoneFeed::MICROPHONE_FEED_FORMAT_ID_ALAW:
		case MicrophoneFeed::MICROPHONE_FEED_FORMAT_ID_ULAW: {
			bool is_alaw = p_feed->get_format_id() == MicrophoneFeed::MICROPHONE_FEED_FORMAT_ID_ALAW;
			String format_name = is_alaw ? "ALAW" : "ULAW";
#define FORMAT_ERROR_LAW(str) \
	FORMAT_ERROR(vformat("doesn't support %s %s samples", format_name, str))

			if (HAS_FLAG(MICROPHONE_FEED_FORMAT_FLAG_IS_FLOAT)) {
				FORMAT_ERROR_LAW("float");
			} else if (HAS_FLAG(MICROPHONE_FEED_FORMAT_FLAG_IS_SIGNED_INTEGER)) {
				FORMAT_ERROR_LAW("signed integer");
			} else if (HAS_FLAG(MICROPHONE_FEED_FORMAT_FLAG_IS_PACKED)) {
				FORMAT_ERROR_LAW("packed");
			} else if (HAS_FLAG(MICROPHONE_FEED_FORMAT_FLAG_IS_ALIGNED_HIGH)) {
				FORMAT_ERROR_LAW("aligned high");
			} else {
				if (HAS_BIT_DEPTH(8)) {
					sample_format = is_alaw ? PA_SAMPLE_ALAW : PA_SAMPLE_ULAW;
				} else {
					FORMAT_ERROR_LAW("non 8-bit");
				}
			}

#undef FORMAT_ERROR_LAW
		} break;

		case MicrophoneFeed::MICROPHONE_FEED_FORMAT_ID_LINEAR_PCM: {
			if (HAS_FLAG(MICROPHONE_FEED_FORMAT_FLAG_IS_FLOAT)) {
				if (HAS_BIT_DEPTH(32)) {
					if (HAS_FLAG(MICROPHONE_FEED_FORMAT_FLAG_IS_BIG_ENDIAN)) {
						sample_format = PA_SAMPLE_FLOAT32BE;
					} else {
						sample_format = PA_SAMPLE_FLOAT32LE;
					}
				} else {
					FORMAT_ERROR("doesn't support non 32-bit float samples");
				}
			} else if (HAS_FLAG(MICROPHONE_FEED_FORMAT_FLAG_IS_SIGNED_INTEGER)) {
				if (HAS_BIT_DEPTH(16)) {
					if (HAS_FLAG(MICROPHONE_FEED_FORMAT_FLAG_IS_BIG_ENDIAN)) {
						sample_format = PA_SAMPLE_S16BE;
					} else {
						sample_format = PA_SAMPLE_S16LE;
					}
				} else if (HAS_BIT_DEPTH(32)) {
					if (HAS_FLAG(MICROPHONE_FEED_FORMAT_FLAG_IS_BIG_ENDIAN)) {
						sample_format = PA_SAMPLE_S32BE;
					} else {
						sample_format = PA_SAMPLE_S32LE;
					}
				} else if (HAS_BIT_DEPTH(24)) {
					if (HAS_FLAG(MICROPHONE_FEED_FORMAT_FLAG_IS_PACKED)) {
						if (HAS_FLAG(MICROPHONE_FEED_FORMAT_FLAG_IS_BIG_ENDIAN)) {
							sample_format = PA_SAMPLE_S24BE;
						} else {
							sample_format = PA_SAMPLE_S24LE;
						}
					} else if (HAS_FLAG(MICROPHONE_FEED_FORMAT_FLAG_IS_ALIGNED_HIGH)) {
						if (HAS_FLAG(MICROPHONE_FEED_FORMAT_FLAG_IS_BIG_ENDIAN)) {
							sample_format = PA_SAMPLE_S24_32BE;
						} else {
							sample_format = PA_SAMPLE_S24_32LE;
						}
					} else {
						FORMAT_ERROR("doesn't support 24-bit non-packed and non aligned high samples");
					}
				} else {
					FORMAT_ERROR(vformat("doesn't support %s-bit samples", p_feed->get_bit_depth()));
				}
			} else {
				if (HAS_BIT_DEPTH(8)) {
					sample_format = PA_SAMPLE_U8;
				} else {
					FORMAT_ERROR("doesn't support non 8-bit unsigned samples");
				}
			}
		} break;
		case MicrophoneFeed::MICROPHONE_FEED_FORMAT_ID_UNDEFINED:
		case MicrophoneFeed::MICROPHONE_FEED_FORMAT_ID_MAX: {
			ERR_FAIL_V(ERR_CANT_CREATE);
		} break;
	}

	p_pa_sample_spec.format = sample_format;

	return OK;
}

/*
 * MicrophoneDriverPulseAudio
 */
void MicrophoneDriverPulseAudio::setup_feed_to_source_settings(Ref<MicrophoneFeed> p_feed, const pa_source_info *p_pa_source_info) {
	p_feed->set_name(String::utf8(p_pa_source_info->name));
	p_feed->set_description(String::utf8(p_pa_source_info->description));

	BitField<MicrophoneFeed::FormatFlag> format_flags = MicrophoneFeed::MICROPHONE_FEED_FORMAT_FLAG_NONE;

#define FORMAT_ALAW() \
	p_feed->set_format_id(MicrophoneFeed::MICROPHONE_FEED_FORMAT_ID_ALAW)
#define FORMAT_ULAW() \
	p_feed->set_format_id(MicrophoneFeed::MICROPHONE_FEED_FORMAT_ID_ULAW)
#define FORMAT_LINEAR_PCM() \
	p_feed->set_format_id(MicrophoneFeed::MICROPHONE_FEED_FORMAT_ID_LINEAR_PCM)

#define BIT_DEPTH(bit_depth) \
	p_feed->set_bit_depth(bit_depth)

#define IS_ALIGNED_HIGH() \
	format_flags.set_flag(MicrophoneFeed::MICROPHONE_FEED_FORMAT_FLAG_IS_ALIGNED_HIGH)
#define IS_BIG_ENDIAN(is_big_endian)                                                      \
	if (is_big_endian) {                                                                  \
		format_flags.set_flag(MicrophoneFeed::MICROPHONE_FEED_FORMAT_FLAG_IS_BIG_ENDIAN); \
	}                                                                                     \
	(void)0
#define IS_FLOAT() \
	format_flags.set_flag(MicrophoneFeed::MICROPHONE_FEED_FORMAT_FLAG_IS_FLOAT)
#define IS_PACKED() \
	format_flags.set_flag(MicrophoneFeed::MICROPHONE_FEED_FORMAT_FLAG_IS_PACKED)
#define IS_SIGNED_INTEGER() \
	format_flags.set_flag(MicrophoneFeed::MICROPHONE_FEED_FORMAT_FLAG_IS_SIGNED_INTEGER)

#define SAMPLE_U8()      \
	FORMAT_LINEAR_PCM(); \
	BIT_DEPTH(8)
#define SAMPLE_ALAW() \
	FORMAT_ALAW();    \
	BIT_DEPTH(8)
#define SAMPLE_ULAW() \
	FORMAT_ULAW();    \
	BIT_DEPTH(8)
#define SAMPLE_S16(is_big_endian) \
	FORMAT_LINEAR_PCM();          \
	BIT_DEPTH(16);                \
	IS_SIGNED_INTEGER();          \
	IS_BIG_ENDIAN(is_big_endian)
#define SAMPLE_FLOAT32(is_big_endian) \
	FORMAT_LINEAR_PCM();              \
	BIT_DEPTH(32);                    \
	IS_FLOAT();                       \
	IS_BIG_ENDIAN(is_big_endian)
#define SAMPLE_S32(is_big_endian) \
	FORMAT_LINEAR_PCM();          \
	BIT_DEPTH(32);                \
	IS_SIGNED_INTEGER();          \
	IS_BIG_ENDIAN(is_big_endian)
#define SAMPLE_S24(is_big_endian) \
	FORMAT_LINEAR_PCM();          \
	BIT_DEPTH(24);                \
	IS_SIGNED_INTEGER();          \
	IS_PACKED();                  \
	IS_BIG_ENDIAN(is_big_endian)
#define SAMPLE_S24_32(is_big_endian) \
	FORMAT_LINEAR_PCM();             \
	BIT_DEPTH(24);                   \
	IS_SIGNED_INTEGER();             \
	IS_ALIGNED_HIGH();               \
	IS_BIG_ENDIAN(is_big_endian)

	switch (p_pa_source_info->sample_spec.format) {
		case PA_SAMPLE_U8: {
			SAMPLE_U8();
		} break;
		case PA_SAMPLE_ALAW: {
			SAMPLE_ALAW();
		} break;
		case PA_SAMPLE_ULAW: {
			SAMPLE_ULAW();
		} break;
		case PA_SAMPLE_S16LE: {
			SAMPLE_S16(false);
		} break;
		case PA_SAMPLE_S16BE: {
			SAMPLE_S16(true);
		} break;
		case PA_SAMPLE_FLOAT32LE: {
			SAMPLE_FLOAT32(false);
		} break;
		case PA_SAMPLE_FLOAT32BE: {
			SAMPLE_FLOAT32(true);
		} break;
		case PA_SAMPLE_S32LE: {
			SAMPLE_S32(false);
		} break;
		case PA_SAMPLE_S32BE: {
			SAMPLE_S32(true);
		} break;
		case PA_SAMPLE_S24LE: {
			SAMPLE_S24(false);
		} break;
		case PA_SAMPLE_S24BE: {
			SAMPLE_S24(true);
		} break;
		case PA_SAMPLE_S24_32LE: {
			SAMPLE_S24_32(false);
		} break;
		case PA_SAMPLE_S24_32BE: {
			SAMPLE_S24_32(true);
		} break;
		case PA_SAMPLE_MAX:
		case PA_SAMPLE_INVALID: {
			ERR_FAIL();
		} break;
	}

	p_feed->set_format_flags(format_flags);

	p_feed->set_sample_rate(p_pa_source_info->sample_spec.rate);
	p_feed->set_channels_per_frame(p_pa_source_info->sample_spec.channels);

#undef SAMPLE_U8
#undef SAMPLE_ALAW
#undef SAMPLE_ULAW
#undef SAMPLE_S16
#undef SAMPLE_FLOAT32
#undef SAMPLE_S32
#undef SAMPLE_S24
#undef SAMPLE_S24_32

#undef IS_ALIGNED_HIGH
#undef IS_BIG_ENDIAN
#undef IS_FLOAT
#undef IS_PACKED
#undef IS_SIGNED_INTEGER

#undef BIT_DEPTH

#undef ALAW
#undef ULAW
#undef LINEAR_PCM
}

void MicrophoneDriverPulseAudio::_pa_context_state_callback(pa_context *p_pa_context, void *p_userdata) {
	pa_context_state state;
	int *_pa_ready = static_cast<int *>(p_userdata);

	state = pa_context_get_state(p_pa_context);
	switch (state) {
		// There are just here for reference
		case PA_CONTEXT_UNCONNECTED:
		case PA_CONTEXT_CONNECTING:
		case PA_CONTEXT_AUTHORIZING:
		case PA_CONTEXT_SETTING_NAME:
		default:
			break;
		case PA_CONTEXT_FAILED:
		case PA_CONTEXT_TERMINATED:
			*_pa_ready = 2;
			break;
		case PA_CONTEXT_READY:
			*_pa_ready = 1;
			break;
	}
}

void MicrophoneDriverPulseAudio::_pa_context_get_source_info_list_callback(pa_context *p_pa_context, const pa_source_info *p_pa_source_info, int p_eol, void *p_userdata) {
	MicrophoneDriverPulseAudio *microphone_driver = static_cast<MicrophoneDriverPulseAudio *>(p_userdata);
	ERR_FAIL_NULL(microphone_driver);

	if (p_eol) {
		pa_threaded_mainloop_signal(microphone_driver->_pa_threaded_mainloop, 0);
		return;
	}

	// Exclude output monitor devices. (i.e. loopback)
	if (p_pa_source_info->monitor_of_sink != PA_INVALID_INDEX) {
		return;
	}

	if (p_pa_source_info->n_ports > 0) {
		uint32_t port = 0;
		for (; port != p_pa_source_info->n_ports; port++) {
			if (p_pa_source_info->ports[port]->available != PA_PORT_AVAILABLE_NO) {
				break;
			}
		}
		if (port == p_pa_source_info->n_ports) {
			return;
		}
	}

	bool feed_entry_found = false;
	for (FeedEntry &feed_entry : microphone_driver->_feed_entries) {
		if (p_pa_source_info->index == feed_entry.pa_index) {
			feed_entry.marked_as_checked = true;
			feed_entry_found = true;
			break;
		}
	}

	if (!feed_entry_found) {
		Ref<MicrophoneFeed> feed;
		feed.instantiate();
		microphone_driver->setup_feed_to_source_settings(feed, p_pa_source_info);
		microphone_driver->_feed_entries.push_back({ .marked_as_checked = true, .pa_index = p_pa_source_info->index, .feed = feed });
		microphone_driver->feeds_updated = true;
		MicrophoneServer::get_singleton()->emit_signal("feed_added", feed);
	}
}

void MicrophoneDriverPulseAudio::_pa_context_subscription_source_callback(pa_context *p_pa_context, pa_subscription_event_type p_pa_subscription_event_type, uint32_t p_index, void *p_userdata) {
	MicrophoneDriverPulseAudio *microphone_driver = static_cast<MicrophoneDriverPulseAudio *>(p_userdata);
	ERR_FAIL_NULL(microphone_driver);
	microphone_driver->callback_helper->call_update_feeds();

#ifdef THREADS_ENABLED
	pa_threaded_mainloop_signal(microphone_driver->_pa_threaded_mainloop, 0);
#endif
}

void MicrophoneDriverPulseAudio::start_updating_feeds() {
	monitoring_feeds = true;

#ifdef THREADS_ENABLED
	pa_threaded_mainloop_lock(_pa_threaded_mainloop);
#else
	pa_mainloop_lock(_pa_mainloop);
#endif // THREADS_ENABLED

	_pa_context_subscription_source_operation = pa_context_subscribe(_pa_context, PA_SUBSCRIPTION_MASK_SOURCE, nullptr, nullptr);
	pa_context_set_subscribe_callback(_pa_context, &MicrophoneDriverPulseAudio::_pa_context_subscription_source_callback, this);

#ifdef THREADS_ENABLED
	pa_threaded_mainloop_unlock(_pa_threaded_mainloop);
#else
	pa_mainloop_unlock(_pa_mainloop);
#endif // THREADS_ENABLED
}

void MicrophoneDriverPulseAudio::stop_updating_feeds() {
	monitoring_feeds = false;
	update_feeds_started = false;

	if (_pa_context_subscription_source_operation) {
		pa_operation_cancel(_pa_context_subscription_source_operation);
		pa_operation_unref(_pa_context_subscription_source_operation);
		_pa_context_subscription_source_operation = nullptr;
	}
}

MicrophoneDriverPulseAudio::FeedEntry *MicrophoneDriverPulseAudio::get_feed_entry_from_feed(const Ref<MicrophoneFeed> p_feed) const {
	for (FeedEntry &feed_entry : _feed_entries) {
		if (feed_entry.feed == p_feed) {
			return &feed_entry;
		}
	}
	return nullptr;
}

LocalVector<Ref<MicrophoneFeed>> MicrophoneDriverPulseAudio::get_feeds() const {
	LocalVector<Ref<MicrophoneFeed>> feeds;
	for (FeedEntry &feed_entry : _feed_entries) {
		feeds.push_back(feed_entry.feed);
	}
	return feeds;
}

void MicrophoneDriverPulseAudio::remove_feed_entry(FeedEntry *p_feed_entry) {
	for (uint32_t i = 0; i < _feed_entries.size(); i++) {
		if (&_feed_entries[i] == p_feed_entry) {
			remove_feed_entry_at(i);
			break;
		}
	}
}

void MicrophoneDriverPulseAudio::remove_feed_entry_at(uint32_t p_feed_entry_index) {
	ERR_FAIL_INDEX(p_feed_entry_index, _feed_entries.size());
	deactivate_feed_entry(&_feed_entries[p_feed_entry_index]);
	Ref<MicrophoneFeed> feed = _feed_entries[p_feed_entry_index].feed;
	_feed_entries.remove_at(p_feed_entry_index);
	MicrophoneServer::get_singleton()->emit_signal("feed_removed", feed);
}

bool MicrophoneDriverPulseAudio::activate_feed_entry(FeedEntry *p_feed_entry) const {
	ERR_FAIL_NULL_V(p_feed_entry, false);
	ERR_FAIL_COND_V(p_feed_entry->pa_stream != nullptr, false);
	ERR_FAIL_COND_V(p_feed_entry->feed.is_null(), false);
	Ref<MicrophoneFeed> feed = p_feed_entry->feed;

	pa_sample_spec _pa_sample_spec;
	pa_channel_map _pa_channel_map;

	Error err = _microphone_feed_to_pa_sample_spec(feed, _pa_sample_spec);
	ERR_FAIL_COND_V_MSG(err != OK, false, "couldn't create pa_sample_spec from MicrophoneFeed");

#ifdef THREADS_ENABLED
	pa_threaded_mainloop_lock(_pa_threaded_mainloop);
#else
	pa_mainloop_lock(_pa_mainloop);
#endif

	int input_latency = 30;
	int input_buffer_frames = nearest_shift(uint32_t(float(input_latency) * feed->get_sample_rate() / 1000.0));
	int input_buffer_size = input_buffer_frames * feed->get_channels_per_frame();

	pa_buffer_attr _pa_stream_attributes = {};
	_pa_stream_attributes.maxlength = (uint32_t)-1;
	_pa_stream_attributes.fragsize = input_buffer_size * (feed->get_bit_depth() / 8);

	p_feed_entry->pa_stream = pa_stream_new(_pa_context, "GodotMicrophoneRecord", &_pa_sample_spec, &_pa_channel_map);
	ERR_FAIL_NULL_V(p_feed_entry->pa_stream, false);

	bool success = true;

	int error_code = pa_stream_connect_record(p_feed_entry->pa_stream, feed->get_name().utf8().get_data(), &_pa_stream_attributes, PA_STREAM_NOFLAGS);
	if (error_code > 0) {
		success = false;
		ERR_PRINT(vformat(R"*(failed to initialize stream record for "%s")*", feed));
	}

#ifdef THREADS_ENABLED
	pa_threaded_mainloop_unlock(_pa_threaded_mainloop);
#else
	pa_mainloop_unlock(_pa_mainloop);
#endif

	return success;
}

void MicrophoneDriverPulseAudio::deactivate_feed_entry(FeedEntry *p_feed_entry) {
	ERR_FAIL_NULL(p_feed_entry);
	if (p_feed_entry->pa_stream) {
		pa_stream_disconnect(p_feed_entry->pa_stream);
		pa_stream_unref(p_feed_entry->pa_stream);
		p_feed_entry->pa_stream = nullptr;
	}
}

uint32_t MicrophoneDriverPulseAudio::get_feed_count() const {
	return _feed_entries.size();
}

void MicrophoneDriverPulseAudio::update_feeds() {
	if (!monitoring_feeds || update_feeds_started) {
		return;
	}
	ERR_FAIL_COND(_pa_context_get_source_info_list_operation != nullptr);
	update_feeds_started = true;
	feeds_updated = false;

#ifdef THREADS_ENABLED
	pa_threaded_mainloop_lock(_pa_threaded_mainloop);
#endif // THREADS_ENABLED
	_pa_context_get_source_info_list_operation = pa_context_get_source_info_list(_pa_context, &MicrophoneDriverPulseAudio::_pa_context_get_source_info_list_callback, (void *)this);
	ERR_FAIL_NULL(_pa_context_get_source_info_list_operation);
	while (pa_operation_get_state(_pa_context_get_source_info_list_operation) == PA_OPERATION_RUNNING) {
#ifdef THREADS_ENABLED
		pa_threaded_mainloop_wait(_pa_threaded_mainloop);
#else
		pa_mainloop_iterate(_pa_mainloop, 1);
#endif // THREADS_ENABLED
	}
	pa_operation_unref(_pa_context_get_source_info_list_operation);
	_pa_context_get_source_info_list_operation = nullptr;
#ifdef THREADS_ENABLED
	pa_threaded_mainloop_unlock(_pa_threaded_mainloop);
#endif // THREADS_ENABLED

	for (int64_t i = _feed_entries.size() - 1; i >= 0; i--) {
		FeedEntry *feed_entry = &_feed_entries[i];
		if (!feed_entry->marked_as_checked) {
			feeds_updated = true;
			remove_feed_entry_at(i);
			continue;
		}
	}

	if (feeds_updated) {
		feeds_updated = false;
		MicrophoneServer::get_singleton()->emit_signal("feeds_updated");
	}

	for (FeedEntry &feed_entry : _feed_entries) {
		feed_entry.marked_as_checked = false;
	}

	update_feeds_started = false;
}

bool MicrophoneDriverPulseAudio::activate_feed(Ref<MicrophoneFeed> p_feed) {
	FeedEntry *feed_entry = get_feed_entry_from_feed(p_feed);
	ERR_FAIL_NULL_V(feed_entry, false);
	return activate_feed_entry(feed_entry);
}

void MicrophoneDriverPulseAudio::deactivate_feed(Ref<MicrophoneFeed> p_feed) {
	FeedEntry *feed_entry = get_feed_entry_from_feed(p_feed);
	ERR_FAIL_NULL(feed_entry);
	deactivate_feed_entry(feed_entry);
}

bool MicrophoneDriverPulseAudio::is_feed_active(Ref<MicrophoneFeed> p_feed) const {
	FeedEntry *feed_entry = get_feed_entry_from_feed(p_feed);
	ERR_FAIL_NULL_V(feed_entry, false);
	return feed_entry->pa_stream != nullptr;
}

void MicrophoneDriverPulseAudio::set_feed_active(Ref<MicrophoneFeed> p_feed, bool p_active) {
	FeedEntry *feed_entry = get_feed_entry_from_feed(p_feed);
	ERR_FAIL_NULL(feed_entry);
	if ((feed_entry->pa_stream != nullptr) == p_active) {
		return;
	}
}

void MicrophoneDriverPulseAudio::set_monitoring_feeds(bool p_monitoring_feeds) {
	if (monitoring_feeds == p_monitoring_feeds) {
		return;
	}
	monitoring_feeds = p_monitoring_feeds;

	if (!monitoring_feeds) {
		stop_updating_feeds();
		return;
	}

	update_feeds();
	start_updating_feeds();
}

bool MicrophoneDriverPulseAudio::is_monitoring_feeds() const {
	return monitoring_feeds;
}

Error MicrophoneDriverPulseAudio::init() {
	callback_helper = memnew(MicrophoneDriverPulseAudioCallbackHelper(this));

	pa_mainloop_api *_pa_mainloop_api = nullptr;

#ifdef THREADS_ENABLED
	_pa_threaded_mainloop = pa_threaded_mainloop_new();
	ERR_FAIL_NULL_V(_pa_threaded_mainloop, FAILED);
	_pa_mainloop_api = pa_threaded_mainloop_get_api(_pa_threaded_mainloop);
	ERR_FAIL_NULL_V(_pa_mainloop_api, FAILED);
#else
	if (AudioDriver::get_singleton()->get_name() == "PulseAudio") {
		return FAILED;
	}
	_pa_mainloop = pa_mainloop_new();
	ERR_FAIL_NULL_V(_pa_mainloop, FAILED);
	pa_mainloop_api *_pa_mainloop_api = pa_mainloop_get_api(_pa_mainloop);
	ERR_FAIL_NULL_V(_pa_mainloop_api, FAILED);
#endif

	_pa_context = pa_context_new(_pa_mainloop_api, "GodotMicrophoneDriver");
	ERR_FAIL_NULL_V(_pa_context, FAILED);

	pa_context_connect(_pa_context, nullptr, PA_CONTEXT_NOFLAGS, nullptr);

	int _pa_ready = 0;
	pa_context_set_state_callback(_pa_context, &MicrophoneDriverPulseAudio::_pa_context_state_callback, &_pa_ready);
	pa_threaded_mainloop_start(_pa_threaded_mainloop);

	while (_pa_ready == 0) {
#ifdef THREADS_ENABLED
		pa_threaded_mainloop_wait(_pa_threaded_mainloop);
#else
		pa_mainloop_iterate(_pa_mainloop, 1, nullptr);
#endif // THREADS_ENABLED
	}

	return OK;
}

MicrophoneDriverPulseAudio::MicrophoneDriverPulseAudio() {
}

MicrophoneDriverPulseAudio::~MicrophoneDriverPulseAudio() {
	if (callback_helper) {
		memfree(callback_helper);
	}

	if (_pa_context) {
		pa_context_disconnect(_pa_context);
		pa_context_unref(_pa_context);
		_pa_context = nullptr;
	}

#ifdef THREADS_ENABLED
	if (_pa_threaded_mainloop) {
		pa_threaded_mainloop_stop(_pa_threaded_mainloop);
		pa_threaded_mainloop_free(_pa_threaded_mainloop);
		_pa_threaded_mainloop = nullptr;
	}
#else
	if (_pa_mainloop) {
		pa_mainloop_stop(_pa_mainloop);
		pa_mainloop_free(_pa_mainloop);
		_pa_mainloop = nullptr;
	}
#endif // THREADS_ENABLED
}

/*
 * MicrophoneDriverPulseAudioCallbackHelper
 */
void MicrophoneDriverPulseAudioCallbackHelper::call_update_feeds_callback() {
	driver->update_feeds();
}

void MicrophoneDriverPulseAudioCallbackHelper::call_update_feeds() {
	if (OS::get_singleton()->get_main_loop()->is_connected("process_frame", call_update_feeds_callback_callable)) {
		return;
	}
	OS::get_singleton()->get_main_loop()->connect("process_frame", call_update_feeds_callback_callable, CONNECT_DEFERRED | CONNECT_ONE_SHOT);
}

MicrophoneDriverPulseAudioCallbackHelper::MicrophoneDriverPulseAudioCallbackHelper(MicrophoneDriverPulseAudio *p_driver) {
	driver = p_driver;
	call_update_feeds_callback_callable = callable_mp(this, &MicrophoneDriverPulseAudioCallbackHelper::call_update_feeds_callback);
}

MicrophoneDriverPulseAudioCallbackHelper::~MicrophoneDriverPulseAudioCallbackHelper() {}

#endif // PULSEAUDIO_ENABLED
