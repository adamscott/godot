/**************************************************************************/
/*  microphone_linuxbsd_alsa.cpp                                          */
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

#include "microphone_linuxbsd_alsa.h"

#ifdef ALSA_ENABLED

#include "servers/audio/audio_server.h"
#include "servers/microphone/microphone_server.h"

/*
 * MicrophoneServerLinuxBSD
 */

void MicrophoneServerLinuxBSDALSA::notifications_enable() {
	print_line(vformat("enable notifications"));
}

void MicrophoneServerLinuxBSDALSA::notifications_disable() {
	print_line(vformat("disable notifications"));
}

MicrophoneServer *MicrophoneServerLinuxBSDALSA::create_function() {
	return memnew(MicrophoneServerLinuxBSDALSA());
}

void MicrophoneServerLinuxBSDALSA::register_linuxbsd_driver() {
	register_create_function("linuxbsd_alsa", create_function);
}

void MicrophoneServerLinuxBSDALSA::update_feeds() {
	print_line(vformat("MicrophoneServerLinuxBSDALSA::update_feeds"));
}

void MicrophoneServerLinuxBSDALSA::set_monitoring_feeds(bool p_monitoring_feeds) {
	if (p_monitoring_feeds == monitoring_feeds) {
		return;
	}

	MicrophoneServer::set_monitoring_feeds(p_monitoring_feeds);
	if (monitoring_feeds) {
		update_feeds();
		notifications_enable();
	} else {
		notifications_disable();
	}
}

MicrophoneServerLinuxBSDALSA::MicrophoneServerLinuxBSDALSA() {
}
MicrophoneServerLinuxBSDALSA::~MicrophoneServerLinuxBSDALSA() {}

#endif // ALSA_ENABLED
