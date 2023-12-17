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
#include "core/object/class_db.h"
#include "core/object/object.h"
#include "servers/audio/audio_stream.h"
#include "servers/audio_server.h"

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
	ClassDB::bind_method(D_METHOD("set_volume_db", "volume_db"), &AudioSamplePlayer::set_volume_db);
	ClassDB::bind_method(D_METHOD("get_volume_db"), &AudioSamplePlayer::get_volume_db);

	ClassDB::bind_method(D_METHOD("play", "from_pos"), &AudioSamplePlayer::play, DEFVAL(0.0f));
	ClassDB::bind_method(D_METHOD("stop"), &AudioSamplePlayer::stop);

	ADD_PROPERTY(PropertyInfo(Variant::OBJECT, "sample", PROPERTY_HINT_RESOURCE_TYPE, "AudioStream"), "set_sample", "get_sample");
	ADD_PROPERTY(PropertyInfo(Variant::FLOAT, "volume_db", PROPERTY_HINT_RANGE, "-80,24,suffix:dB"), "set_volume_db", "get_volume_db");
}

void AudioSamplePlayer::set_sample(Ref<AudioStream> p_sample) {
	AudioServer::get_singleton()->sample_player_set_sample(rid, p_sample);
}

Ref<AudioStream> AudioSamplePlayer::get_sample() const {
	return AudioServer::get_singleton()->sample_player_get_sample(rid);
}

void AudioSamplePlayer::set_volume_db(float p_volume_db) {
	AudioServer::get_singleton()->sample_player_set_volume_db(rid, p_volume_db);
}

float AudioSamplePlayer::get_volume_db() const {
	return AudioServer::get_singleton()->sample_player_get_volume_db(rid);
}

void AudioSamplePlayer::play(float p_from_pos) {
	AudioServer::get_singleton()->sample_player_play(rid, p_from_pos);
}

void AudioSamplePlayer::stop() {
	AudioServer::get_singleton()->sample_player_stop(rid);
}

AudioSamplePlayer::AudioSamplePlayer() {
	rid = AudioServer::get_singleton()->sample_player_allocate();
	AudioServer::get_singleton()->sample_player_initialize(rid);
}

AudioSamplePlayer::~AudioSamplePlayer() {
	AudioServer::get_singleton()->sample_player_free(rid);
}
