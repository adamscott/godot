/**************************************************************************/
/*  microphone_driver_avfoundation.mm                                     */
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

#include "microphone_driver_avfoundation.h"

#include "servers/microphone/microphone_feed.h"

void MicrophoneDriverAVFoundation::set_monitoring_feeds(bool p_monitoring_feeds) {
}

bool MicrophoneDriverAVFoundation::get_monitoring_feeds() const {
	return false;
}

LocalVector<Ref<MicrophoneFeed>> MicrophoneDriverAVFoundation::get_feeds() const {
	LocalVector<Ref<MicrophoneFeed>> feeds;
	for (FeedEntry &feed_entry : _feed_entries) {
		feeds.push_back(feed_entry.feed);
	}
	return feeds;
}

void MicrophoneDriverAVFoundation::update_feeds() {
	NSArray<AVCaptureDevice *> *devices = nullptr;

#if defined(__x86_64__)
	if (@available(macOS 10.15, *)) {
#endif
		AVCaptureDeviceDiscoverySession *session;
		if (@available(macOS 14.0, *)) {
			// AVCaptureDeviceTypeBuiltInMicrophone is deprecated since macOS 14.0
			session = [AVCaptureDeviceDiscoverySession discoverySessionWithDeviceTypes:[NSArray arrayWithObjects:AVCaptureDeviceTypeMicrophone, nil] mediaType:AVMediaTypeAudio position:AVCaptureDevicePositionUnspecified];
		} else {
			session = [AVCaptureDeviceDiscoverySession discoverySessionWithDeviceTypes:[NSArray arrayWithObjects:AVCaptureDeviceTypeBuiltInMicrophone, nil] mediaType:AVMediaTypeAudio position:AVCaptureDevicePositionUnspecified];
		}
		devices = session.devices;
#if defined(__x86_64__)
	} else {
		devices = [AVCaptureDevice devicesWithMediaType:AVMediaTypeAudio];
	}
#endif

	// Remove outdated devices.
	for (uint32_t i = _feed_entries.size() - 1; i >= 0; i--) {
		FeedEntry &feed_entry = _feed_entries[i];
		if (feed_entry.feed.is_null()) {
			continue;
		}

		if (![devices containsObject:feed_entry.device]) {
			// remove_feed(feed);
			_feed_entries.remove_at(i);
		}
	};

	for (AVCaptureDevice *device in devices) {
		bool found = false;
		for (uint32_t i = 0; i < _feed_entries.size(); i++) {
			FeedEntry &feed_entry = _feed_entries[i];
			if (feed_entry.feed.is_null()) {
				continue;
			}
			if (feed_entry.device == device) {
				found = true;
			}
		}

		if (found) {
			continue;
		}

		Ref<MicrophoneFeed> feed;
		feed.instantiate();
		_feed_entries.push_back({ .feed = feed, .device = device });
	}
}

MicrophoneDriverAVFoundation::MicrophoneDriverAVFoundation() {}
MicrophoneDriverAVFoundation::~MicrophoneDriverAVFoundation() {}
