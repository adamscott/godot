/**************************************************************************/
/*  microphone_linuxbsd_pulseaudio.cpp                                    */
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

#include "microphone_linuxbsd_pulseaudio.h"
#include "pulse/context.h"

#ifdef PULSEAUDIO_ENABLED

#include "drivers/pulseaudio/audio_driver_pulseaudio.h"
#include "servers/audio/audio_server.h"
#include "servers/microphone/microphone_server.h"
#include "thirdparty/linuxbsd_headers/pulse/def.h"
#include "thirdparty/linuxbsd_headers/pulse/introspect.h"
#include "thirdparty/linuxbsd_headers/pulse/mainloop.h"
#include "thirdparty/linuxbsd_headers/pulse/subscribe.h"

/*
 * MicrophoneServerLinuxBSDPulseAudio
 */

void MicrophoneServerLinuxBSDPulseAudio::notifications_enable() {
	// if (notifications_pulseaudio_subscription != nullptr) {
	// 	return;
	// }
	// pa_mainloop *_pa_mainloop = driver_pulseaudio->get_pulseaudio_mainloop();
	// ERR_FAIL_NULL(_pa_mainloop);
	// pa_context *_pa_context = driver_pulseaudio->get_pulseaudio_context();
	// ERR_FAIL_NULL(_pa_context);

	// notifications_pulseaudio_subscription = pa_context_subscribe(_pa_context, PA_SUBSCRIPTION_MASK_SOURCE, nullptr, this);
	// pa_operation_state _pa_operation_state = PA_OPERATION_RUNNING;
	// while (_pa_operation_state == PA_OPERATION_RUNNING) {
	// 	int ret = pa_mainloop_iterate(_pa_mainloop, 1, nullptr);
	// 	if (ret < 0) {
	// 		ERR_PRINT("error while iterating the PulseAudio main loop");
	// 		break;
	// 	}
	// 	_pa_operation_state = pa_operation_get_state(notifications_pulseaudio_subscription);
	// }
	// String operation_state;
	// switch (_pa_operation_state) {
	// 	case PA_OPERATION_RUNNING: {
	// 		operation_state = "PA_OPERATION_RUNNING";
	// 	} break;
	// 	case PA_OPERATION_CANCELLED: {
	// 		operation_state = "PA_OPERATION_CANCELLED";
	// 	} break;
	// 	case PA_OPERATION_DONE: {
	// 		operation_state = "PA_OPERATION_DONE";
	// 	} break;
	// }

	// if (pa_operation_get_state(notifications_pulseaudio_subscription) == PA_OPERATION_DONE) {
	// 	pa_context_set_subscribe_callback(_pa_context, &MicrophoneServerLinuxBSDPulseAudio::notifications_callback, this);
	// }
}

void MicrophoneServerLinuxBSDPulseAudio::notifications_disable() {
	// if (notifications_pulseaudio_subscription == nullptr) {
	// 	return;
	// }
	// pa_operation_cancel(notifications_pulseaudio_subscription);
	// pa_operation_unref(notifications_pulseaudio_subscription);
	// notifications_pulseaudio_subscription = nullptr;
}

void MicrophoneServerLinuxBSDPulseAudio::notifications_callback(pa_context *p_pa_context, pa_subscription_event_type p_subscription_event_type, uint32_t p_index, void *p_userdata) {
	MicrophoneServerLinuxBSDPulseAudio *microphone_server = static_cast<MicrophoneServerLinuxBSDPulseAudio *>(p_userdata);
	ERR_FAIL_NULL(microphone_server);
	print_line(vformat("MicrophoneServerLinuxBSDPulseAudio::notifications_pulseaudio_callback"));
	microphone_server->update_feeds();
}

void MicrophoneServerLinuxBSDPulseAudio::update_feeds() {
	// print_line(vformat("MicrophoneServerLinuxBSDPulseAudio::update_feeds_pulseaudio"));
	// ERR_FAIL_NULL(driver_pulseaudio);
	// print_line(vformat("MicrophoneServerLinuxBSDPulseAudio::update_feeds_pulseaudio"));

	// pa_mainloop *_pa_mainloop = driver_pulseaudio->get_pulseaudio_mainloop();
	// ERR_FAIL_NULL(_pa_mainloop);
	// pa_context *_pa_context = driver_pulseaudio->get_pulseaudio_context();
	// ERR_FAIL_NULL(_pa_context);

	// pa_operation *_update_feeds_operation = pa_context_get_source_info_list(_pa_context, &MicrophoneServerLinuxBSDPulseAudio::update_feeds_sourcelist_callback, this);
	// pa_operation_state _pa_operation_state = PA_OPERATION_RUNNING;
	// while (_pa_operation_state == PA_OPERATION_RUNNING) {
	// 	int ret = pa_mainloop_iterate(_pa_mainloop, 1, nullptr);
	// 	if (ret < 0) {
	// 		ERR_PRINT("error while iterating the PulseAudio main loop");
	// 		break;
	// 	}
	// 	_pa_operation_state = pa_operation_get_state(_update_feeds_operation);
	// }
	// pa_operation_unref(_update_feeds_operation);
	// _update_feeds_operation = nullptr;
	// print_line(vformat("MicrophoneServerLinuxBSDPulseAudio::update_feeds_pulseaudio [END]"));
}

void MicrophoneServerLinuxBSDPulseAudio::update_feeds_sourcelist_callback(pa_context *p_pa_context, const pa_source_info *p_source_info, int p_eol, void *p_userdata) {
	print_line(vformat("MicrophoneServerLinuxBSDPulseAudio::update_feeds_pulseaudio_sourcelist_callback"));
	print_line(vformat("detected: %s", p_source_info->name));
}

MicrophoneServer *MicrophoneServerLinuxBSDPulseAudio::create_function() {
	return memnew(MicrophoneServerLinuxBSDPulseAudio());
}

void MicrophoneServerLinuxBSDPulseAudio::register_linuxbsd_driver() {
	register_create_function("linuxbsd", create_function);
}

void MicrophoneServerLinuxBSDPulseAudio::set_monitoring_feeds(bool p_monitoring_feeds) {
	if (p_monitoring_feeds == monitoring_feeds) {
		return;
	}

	MicrophoneServer::set_monitoring_feeds(p_monitoring_feeds);
	if (monitoring_feeds) {
		update_feeds();
		notifications_enable();
	} else {
		notifications_disable();
	}
}

MicrophoneServerLinuxBSDPulseAudio::MicrophoneServerLinuxBSDPulseAudio() {
	_pa_t_mainloop = pa_threaded_mainloop_new();
	ERR_FAIL_NULL(_pa_t_mainloop);
}
MicrophoneServerLinuxBSDPulseAudio::~MicrophoneServerLinuxBSDPulseAudio() {
	if (_pa_context) {
		pa_context_unref(_pa_context);
		_pa_context = nullptr;
	}

	if (_pa_t_mainloop) {
		pa_threaded_mainloop_stop(_pa_t_mainloop);
		pa_threaded_mainloop_free(_pa_t_mainloop);
		_pa_t_mainloop = nullptr;
	}
}

#endif // PULSEAUDIO_ENABLED
