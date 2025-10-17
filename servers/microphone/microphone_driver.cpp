/**************************************************************************/
/*  microphone_driver.cpp                                                 */
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

#include "microphone_driver.h"

#include "core/config/project_settings.h"

/*
 * MicrophoneDriver
 */
MicrophoneDriver *MicrophoneDriver::singleton = nullptr;

Error MicrophoneDriver::init() {
	return OK;
}

MicrophoneDriver::MicrophoneDriver() {}
MicrophoneDriver::~MicrophoneDriver() {}

/*
 * MicrophoneDriverManager
 */
MicrophoneDriverDummy MicrophoneDriverManager::dummy_driver;
MicrophoneDriver *MicrophoneDriverManager::drivers[MAX_DRIVERS] = {
	&MicrophoneDriverManager::dummy_driver,
};
int MicrophoneDriverManager::driver_count = 1;

void MicrophoneDriverManager::add_driver(MicrophoneDriver *p_driver) {
	ERR_FAIL_COND(driver_count >= MAX_DRIVERS);
	drivers[driver_count - 1] = p_driver;

	// Last driver is always our dummy driver
	drivers[driver_count++] = &MicrophoneDriverManager::dummy_driver;
}

int MicrophoneDriverManager::get_driver_count() {
	return driver_count;
}

void MicrophoneDriverManager::initialize(int p_driver) {
	GLOBAL_DEF_RST("audio/driver/enable_microphone_server", false);

	int failed_driver = -1;

	// Check if there is a selected driver
	if (p_driver >= 0 && p_driver < driver_count) {
		if (drivers[p_driver]->init() == OK) {
			drivers[p_driver]->set_singleton();
			return;
		} else {
			failed_driver = p_driver;
		}
	}

	// No selected driver, try them all in order
	for (int i = 0; i < driver_count; i++) {
		// Don't re-init the driver if it failed above
		if (i == failed_driver) {
			continue;
		}

		if (drivers[i]->init() == OK) {
			drivers[i]->set_singleton();
			break;
		}
	}

	if (driver_count > 1 && String(MicrophoneDriver::get_singleton()->get_name()) == "dummy") {
		WARN_PRINT("All audio drivers failed, falling back to the dummy driver.");
	}
}

MicrophoneDriver *MicrophoneDriverManager::get_driver(int p_driver) {
	ERR_FAIL_INDEX_V(p_driver, driver_count, nullptr);
	return drivers[p_driver];
}
