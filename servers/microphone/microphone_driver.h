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
#include "core/string/ustring.h"
#include "core/templates/local_vector.h"

class MicrophoneDriver {
	static MicrophoneDriver *singleton;

public:
	enum DataFormatId {
		DATA_FORMAT_ID_LINEAR_PCM,
		DATA_FORMAT_ID_MAX,
	};

	struct DeviceFormat {
		DataFormatId data_format_id;
		double sample_rate;
		int32_t bytes_per_frame;
		int32_t channels_per_frame;
	};

	struct Device {
		String name;
		String description;
		DeviceFormat defaultFormatValues;
	};

	static MicrophoneDriver *get_singleton() { return singleton; }
	void set_singleton() { singleton = this; }

	virtual LocalVector<Device> get_devices() const = 0;

	virtual void set_monitoring_feeds(bool p_monitoring_feeds) = 0;
	virtual bool get_monitoring_feeds() const = 0;

	virtual String get_name() const = 0;
	virtual Error init();

	MicrophoneDriver();
	virtual ~MicrophoneDriver();
};

class MicrophoneDriverDummy : public MicrophoneDriver {
public:
	virtual LocalVector<Device> get_devices() const { return LocalVector<Device>(); }

	virtual void set_monitoring_feeds(bool p_monitoring_feeds) {}
	virtual bool get_monitoring_feeds() const { return false; }

	virtual String get_name() const { return String("Dummy"); }

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
