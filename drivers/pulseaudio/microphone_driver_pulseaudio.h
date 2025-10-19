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

#include "core/object/object.h"
#ifdef PULSEAUDIO_ENABLED

#include "servers/microphone/microphone_driver.h"

#include "core/object/ref_counted.h"

#ifdef SOWRAP_ENABLED
#include "pulse-so_wrap.h"
#else
#include <pulse/pulseaudio.h>
#endif

class MicrophoneFeed;
class MicrophoneDriverPulseAudioCallProxy;

class MicrophoneDriverPulseAudio : public MicrophoneDriver {
	friend MicrophoneDriverPulseAudioCallProxy;

protected:
#ifdef THREADS_ENABLED
	pa_threaded_mainloop *_pa_threaded_mainloop = nullptr;
#else
	pa_mainloop *_pa_mainloop = nullptr;
#endif // THREADS_ENABLED
	pa_context *_pa_context = nullptr;

	static void _pa_context_state_callback(pa_context *p_pa_context, void *p_userdata);
	pa_operation *_pa_context_get_source_info_list_operation = nullptr;
	static void _pa_context_get_source_info_list_callback(pa_context *p_pa_context, const pa_source_info *p_pa_source_info, int p_eol, void *p_userdata);

	bool started_update_feeds = false;
	void stop_updating_feeds();
	MicrophoneDriverPulseAudioCallProxy *call_proxy = nullptr;

	struct FeedEntry {
		bool checked;
		uint32_t pa_index;
		Ref<MicrophoneFeed> feed;
	};
	mutable LocalVector<FeedEntry> _feed_entries;
	FeedEntry *get_feed_entry_from_feed(const Ref<MicrophoneFeed> p_feed) const;

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
	virtual Error init() override;

	MicrophoneDriverPulseAudio();
	~MicrophoneDriverPulseAudio();
};

class MicrophoneDriverPulseAudioCallProxy : public Object {
	GDCLASS(MicrophoneDriverPulseAudioCallProxy, Object);

private:
	MicrophoneDriverPulseAudio *microphone_driver;
	bool waiting = false;

	void launch_update_feeds();

public:
	void trigger_update_feeds();
	void cancel_update_feeds();

	MicrophoneDriverPulseAudioCallProxy(MicrophoneDriverPulseAudio *p_microphone_driver);
	~MicrophoneDriverPulseAudioCallProxy();
};

#endif // PULSEAUDIO_ENABLED
