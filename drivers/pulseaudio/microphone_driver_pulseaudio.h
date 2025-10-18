/**************************************************************************/
/*  microphone_driver_pulseaudio.h                                        */
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

#ifdef PULSEAUDIO_ENABLED

#include "servers/microphone/microphone_driver.h"

#include "core/object/ref_counted.h"

class MicrophoneFeed;

class MicrophoneDriverPulseAudio : public MicrophoneDriver {
public:
	virtual LocalVector<Ref<MicrophoneFeed>> get_feeds() const override;
	virtual uint32_t get_feed_count() const override;
	virtual void update_feeds() override;
	virtual bool activate_feed(Ref<MicrophoneFeed> p_feed) override;
	virtual void deactivate_feed(Ref<MicrophoneFeed> p_feed) override;
	virtual bool is_feed_active(Ref<MicrophoneFeed> p_feed) const override;
	virtual void set_feed_active(Ref<MicrophoneFeed> p_feed, bool p_active) override;

	virtual void set_monitoring_feeds(bool p_monitoring_feeds) override;
	virtual bool is_monitoring_feeds() const override;

	virtual String get_name() const override { return String("PulseAudio"); }

	MicrophoneDriverPulseAudio();
	~MicrophoneDriverPulseAudio();
};

#endif // PULSEAUDIO_ENABLED
