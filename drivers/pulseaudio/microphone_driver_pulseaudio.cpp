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

#ifdef SOWRAP_ENABLED
#include "pulse-so_wrap.h"
#else
#include <pulse/pulseaudio.h>
#endif

LocalVector<Ref<MicrophoneFeed>> MicrophoneDriverPulseAudio::get_feeds() const {
	LocalVector<Ref<MicrophoneFeed>> feeds;
	return feeds;
}

uint32_t MicrophoneDriverPulseAudio::get_feed_count() const {
	return 0;
}

void MicrophoneDriverPulseAudio::update_feeds() {
}

bool MicrophoneDriverPulseAudio::activate_feed(Ref<MicrophoneFeed> p_feed) {
	return false;
}

void MicrophoneDriverPulseAudio::deactivate_feed(Ref<MicrophoneFeed> p_feed) {
}

bool MicrophoneDriverPulseAudio::is_feed_active(Ref<MicrophoneFeed> p_feed) const {
	return false;
}

void MicrophoneDriverPulseAudio::set_feed_active(Ref<MicrophoneFeed> p_feed, bool p_active) const {
}

void MicrophoneDriverPulseAudio::set_monitoring_feeds(bool p_monitoring_feeds) {
}

bool MicrophoneDriverPulseAudio::is_monitoring_feeds() const {
}

MicrophoneDriverPulseAudio::MicrophoneDriverPulseAudio() {}
MicrophoneDriverPulseAudio::~MicrophoneDriverPulseAudio() {}

#endif // PULSEAUDIO_ENABLED
