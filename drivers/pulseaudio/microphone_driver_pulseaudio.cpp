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

#include "core/error/error_macros.h"
#include "servers/microphone/microphone_feed.h"
#include "servers/microphone/microphone_server.h"

#include "thirdparty/linuxbsd_headers/pulse/def.h"
#include "thirdparty/linuxbsd_headers/pulse/thread-mainloop.h"

void MicrophoneDriverPulseAudio::_pa_context_state_callback(pa_context *p_pa_context, void *p_userdata) {
	print_line(vformat("_pa_context_state_callback"));
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

	bool found = false;
	for (FeedEntry &feed_entry : microphone_driver->_feed_entries) {
		if (p_pa_source_info->index == feed_entry.pa_index) {
			feed_entry.checked = true;
			found = true;
			break;
		}
	}
	if (!found) {
		Ref<MicrophoneFeed> feed;
		feed.instantiate();
		microphone_driver->_feed_entries.push_back({ .checked = true, .pa_index = p_pa_source_info->index, .feed = feed });
	}

	print_line(vformat("name: %s", p_pa_source_info->name));

	if (p_eol > 0) {
		pa_threaded_mainloop_signal(microphone_driver->_pa_threaded_mainloop, 0);
		return;
	}
}

void MicrophoneDriverPulseAudio::stop_updating_feeds() {
	monitoring_feeds = false;
	started_update_feeds = false;
	call_proxy->cancel_update_feeds();
}

LocalVector<Ref<MicrophoneFeed>> MicrophoneDriverPulseAudio::get_feeds() const {
	LocalVector<Ref<MicrophoneFeed>> feeds;
	return feeds;
}

uint32_t MicrophoneDriverPulseAudio::get_feed_count() const {
	return 0;
}

void MicrophoneDriverPulseAudio::update_feeds() {
	if (!monitoring_feeds || started_update_feeds) {
		return;
	}
	ERR_FAIL_COND(_pa_context_get_source_info_list_operation != nullptr);
	started_update_feeds = true;

#ifdef THREADS_ENABLED
	pa_threaded_mainloop_lock(_pa_threaded_mainloop);
#endif // THREADS_ENABLED
	_pa_context_get_source_info_list_operation = pa_context_get_source_info_list(_pa_context, &MicrophoneDriverPulseAudio::_pa_context_get_source_info_list_callback, (void *)this);
	ERR_FAIL_NULL(_pa_context_get_source_info_list_operation);
	print_line(vformat("_pa_context_get_source_info_list_operation: %x", (uint64_t)_pa_context_get_source_info_list_operation));
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
}

bool MicrophoneDriverPulseAudio::activate_feed(Ref<MicrophoneFeed> p_feed) {
	return false;
}

void MicrophoneDriverPulseAudio::deactivate_feed(Ref<MicrophoneFeed> p_feed) {
}

bool MicrophoneDriverPulseAudio::is_feed_active(Ref<MicrophoneFeed> p_feed) const {
	return false;
}

void MicrophoneDriverPulseAudio::set_feed_active(Ref<MicrophoneFeed> p_feed, bool p_active) {
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
}

bool MicrophoneDriverPulseAudio::is_monitoring_feeds() const {
	return false;
}

Error MicrophoneDriverPulseAudio::init() {
	pa_mainloop_api *_pa_mainloop_api = nullptr;

#ifdef THREADS_ENABLED
	_pa_threaded_mainloop = pa_threaded_mainloop_new();
	ERR_FAIL_NULL_V(_pa_threaded_mainloop, FAILED);
	_pa_mainloop_api = pa_threaded_mainloop_get_api(_pa_threaded_mainloop);
	ERR_FAIL_NULL_V(_pa_mainloop_api, FAILED);
#else
	if (AudioDriver::get_singleton()->get_name() == "PulseAudio") {
		print_verbose("couldn't not initialize MicrophoneDriverPulseAudio with running AudioDriverPulseAudio running without thread support.");
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

	call_proxy = memnew(MicrophoneDriverPulseAudioCallProxy(this));

	return OK;
}

MicrophoneDriverPulseAudio::MicrophoneDriverPulseAudio() {
}
MicrophoneDriverPulseAudio::~MicrophoneDriverPulseAudio() {
	if (call_proxy) {
		memfree(call_proxy);
		call_proxy = nullptr;
	}

	if (_pa_context) {
		pa_context_unref(_pa_context);
		_pa_context = nullptr;
	}

	if (_pa_threaded_mainloop) {
		pa_threaded_mainloop_free(_pa_threaded_mainloop);
		_pa_threaded_mainloop = nullptr;
	}
}

/*
 * MicrophoneDriverPulseAudioCallProxy
 */
void MicrophoneDriverPulseAudioCallProxy::launch_update_feeds() {
	if (!waiting) {
		return;
	}
	microphone_driver->started_update_feeds = false;
	microphone_driver->update_feeds();
}

void MicrophoneDriverPulseAudioCallProxy::trigger_update_feeds() {
	if (waiting) {
		return;
	}
	callable_mp(this, &MicrophoneDriverPulseAudioCallProxy::launch_update_feeds).call_deferred();
}

void MicrophoneDriverPulseAudioCallProxy::cancel_update_feeds() {
	waiting = false;
}

MicrophoneDriverPulseAudioCallProxy::MicrophoneDriverPulseAudioCallProxy(MicrophoneDriverPulseAudio *p_microphone_driver) {
	microphone_driver = p_microphone_driver;
}
MicrophoneDriverPulseAudioCallProxy::~MicrophoneDriverPulseAudioCallProxy() {}

#endif // PULSEAUDIO_ENABLED
