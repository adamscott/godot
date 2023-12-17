/**************************************************************************/
/*  audio_sample_player_map.h                                             */
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

#ifndef AUDIO_SAMPLE_PLAYER_MAP_H
#define AUDIO_SAMPLE_PLAYER_MAP_H

#include "audio_rid.h"
#include "core/object/ref_counted.h"

class AudioStream;

class AudioSamplePlayerMap : public AudioRID {
private:
	AudioStream *sample = nullptr;
	bool positional = false;
	float pan = 0.0f;
	float pan_depth = 0.0f;
	float volume_db = 0.0f;

public:
	void set_sample(AudioStream *p_sample);
	AudioStream *get_sample() const;

	void set_positional(bool p_positional) { positional = p_positional; }
	bool get_positional() { return positional; }

	void set_pan(float p_pan) { pan = p_pan; }
	float get_pan() const { return pan; }

	void set_pan_depth(float p_pan_depth) { pan_depth = p_pan_depth; }
	float get_pan_depth() const { return pan_depth; }

	void set_volume_db(float p_volume_db) { volume_db = p_volume_db; }
	float get_volume_db() { return volume_db; }
};

#endif // AUDIO_SAMPLE_PLAYER_MAP_H
