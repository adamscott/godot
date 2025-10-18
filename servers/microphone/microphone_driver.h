/**************************************************************************/
/*  microphone_driver.h                                                   */
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

#include "core/error/error_list.h"
#include "core/object/ref_counted.h"
#include "core/string/ustring.h"
#include "core/templates/local_vector.h"
#include "core/templates/ring_buffer.h"
#include "servers/microphone/microphone_server.h"

class MicrophoneFeed;

class MicrophoneDriver {
private:
	static MicrophoneDriver *singleton;
	static uint32_t next_feed_id;

protected:
	static void set_feed_id(Ref<MicrophoneFeed> p_feed);

public:
	static MicrophoneDriver *get_singleton() { return singleton; }
	void set_singleton() { singleton = this; }

	static RingBuffer<uint8_t> *get_ring_buffer_from_feed(Ref<MicrophoneFeed> p_feed);

	virtual LocalVector<Ref<MicrophoneFeed>> get_feeds() const = 0;
	virtual uint32_t get_feed_count() const = 0;
	virtual void update_feeds() = 0;
	virtual bool activate_feed(Ref<MicrophoneFeed> p_feed) = 0;
	virtual void deactivate_feed(Ref<MicrophoneFeed> p_feed) = 0;
	virtual bool is_feed_active(Ref<MicrophoneFeed> p_feed) const = 0;
	virtual void set_feed_active(Ref<MicrophoneFeed> p_feed, bool p_active) = 0;

	virtual void set_monitoring_feeds(bool p_monitoring_feeds) = 0;
	virtual bool is_monitoring_feeds() const = 0;

	virtual String get_name() const = 0;
	virtual Error init();

	MicrophoneDriver();
	virtual ~MicrophoneDriver();
};

class MicrophoneDriverDummy : public MicrophoneDriver {
public:
	virtual LocalVector<Ref<MicrophoneFeed>> get_feeds() const override { return LocalVector<Ref<MicrophoneFeed>>(); }
	virtual uint32_t get_feed_count() const override { return 0; }
	virtual void update_feeds() override {}

	virtual void set_monitoring_feeds(bool p_monitoring_feeds) override {}
	virtual bool is_monitoring_feeds() const override { return false; }
	virtual bool activate_feed(Ref<MicrophoneFeed> p_feed) override { return false; }
	virtual void deactivate_feed(Ref<MicrophoneFeed> p_feed) override {}
	virtual bool is_feed_active(Ref<MicrophoneFeed> p_feed) const override { return false; }
	virtual void set_feed_active(Ref<MicrophoneFeed> p_feed, bool p_active) override {}

	virtual String get_name() const override { return String("Dummy"); }

	MicrophoneDriverDummy() {}
	~MicrophoneDriverDummy() {}
};

class MicrophoneDriverManager {
	static inline const int MAX_DRIVERS = 10;
	static MicrophoneDriver *drivers[MAX_DRIVERS];
	static int driver_count;

	static MicrophoneDriverDummy dummy_driver;

public:
	static MicrophoneDriverDummy *get_dummy_singleton() { return &dummy_driver; }

	static void add_driver(MicrophoneDriver *p_driver);
	static void initialize(int p_driver);
	static int get_driver_count();
	static MicrophoneDriver *get_driver(int p_driver);

	MicrophoneDriverManager() {}
	~MicrophoneDriverManager() {}
};
