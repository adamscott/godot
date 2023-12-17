/**************************************************************************/
/*  audio_sample_player.cpp                                               */
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

#include "audio_sample_player.h"
#include "servers/audio/audio_stream.h"
#include "servers/audio_server.h"

void AudioSamplePlayer::set_sample(Ref<AudioStream> p_sample) {
	if (p_sample != sample) {
		if (p_sample == nullptr) {
			AudioServer::get_singleton()->sample_unregister(sample);
		} else {
			AudioServer::get_singleton()->sample_register(p_sample);
		}
	}

	sample = p_sample;
}

Ref<AudioStream> AudioSamplePlayer::get_sample() const {
	print_line(vformat("AudioSamplePlayer::get_sample() %s", sample));
	return sample;
}

void AudioSamplePlayer::_notification(int p_what) {
	switch (p_what) {
		case NOTIFICATION_ENTER_TREE: {
			print_line(vformat("AudioSamplePlayer::_notification(NOTIFICATION_ENTER_TREE)"));
		} break;

		case NOTIFICATION_INTERNAL_PROCESS: {
		} break;

		case NOTIFICATION_EXIT_TREE: {
			print_line(vformat("AudioSamplePlayer::_notification(NOTIFICATION_EXIT_TREE)"));
		} break;
	}
}

void AudioSamplePlayer::_bind_methods() {
	ClassDB::bind_method(D_METHOD("set_sample", "sample"), &AudioSamplePlayer::set_sample);
	ClassDB::bind_method(D_METHOD("get_sample"), &AudioSamplePlayer::get_sample);

	ADD_PROPERTY(PropertyInfo(Variant::OBJECT, "sample", PROPERTY_HINT_RESOURCE_TYPE, "AudioStream"), "set_sample", "get_sample");
}

AudioSamplePlayer::AudioSamplePlayer() {
}

AudioSamplePlayer::~AudioSamplePlayer() {
}
