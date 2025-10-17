/**************************************************************************/
/*  microphone_linuxbsd_pulseaudio.h                                      */
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

#include "pulse/context.h"
#ifdef PULSEAUDIO_ENABLED

#include "servers/microphone/microphone_feed.h"
#include "servers/microphone/microphone_server.h"

#ifdef SOWRAP_ENABLED
#include "drivers/pulseaudio/audio_driver_pulseaudio.h"
#else
#include <pulse/pulseaudio.h>
#endif

class MicrophoneServerLinuxBSDPulseAudio : public MicrophoneServer {
	GDSOFTCLASS(MicrophoneServerLinuxBSDPulseAudio, MicrophoneServer);
	_THREAD_SAFE_CLASS_

private:
	AudioDriverPulseAudio *driver_pulseaudio = nullptr;

	pa_operation *notifications_pulseaudio_subscription = nullptr;

	void notifications_enable();
	void notifications_disable();

	static void notifications_callback(pa_context *p_pa_context, pa_subscription_event_type p_subscription_event_type, uint32_t p_index, void *p_userdata);
	static void update_feeds_sourcelist_callback(pa_context *p_pa_context, const pa_source_info *p_source_info, int p_eol, void *p_userdata);

public:
	static MicrophoneServer *create_function();
	static void register_linuxbsd_driver();

	void update_feeds();
	void set_monitoring_feeds(bool p_monitoring_feeds) override;

	MicrophoneServerLinuxBSDPulseAudio();
	~MicrophoneServerLinuxBSDPulseAudio();
};

class MicrophoneFeedLinuxBSD : public MicrophoneFeed {
	GDSOFTCLASS(MicrophoneFeedLinuxBSD, MicrophoneFeed);

private:
};

#endif // PULSEAUDIO_ENABLED
