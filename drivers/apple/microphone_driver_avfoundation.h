/**************************************************************************/
/*  microphone_driver_avfoundation.h                                      */
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

#include "servers/microphone/microphone_driver.h"

#include "core/object/ref_counted.h"

#include <AVFoundation/AVFoundation.h>

class MicrophoneFeed;
@class MicrophoneDeviceNotification;
@class MicrophoneDeviceCaptureSession;

class MicrophoneDriverAVFoundation : public MicrophoneDriver {
private:
	void setup_feed_to_device_settings(Ref<MicrophoneFeed> p_feed, AVCaptureDevice *p_device);

protected:
	bool monitoring_feeds = false;
	MicrophoneDeviceNotification *device_notifications = nullptr;

	struct FeedEntry {
		Ref<MicrophoneFeed> feed;
		AVCaptureDevice *device;
		MicrophoneDeviceCaptureSession *capture_session;
	};

	mutable LocalVector<FeedEntry> _feed_entries;

public:
	virtual LocalVector<Ref<MicrophoneFeed>> get_feeds() const override;
	virtual void update_feeds() override;
	virtual bool activate_feed(Ref<MicrophoneFeed> p_feed) override;
	virtual void deactivate_feed(Ref<MicrophoneFeed> p_feed) override;

	virtual void set_monitoring_feeds(bool p_monitoring_feeds) override;
	virtual bool get_monitoring_feeds() const override;

	virtual String get_name() const override { return String("AVFoundation"); }

	MicrophoneDriverAVFoundation();
	~MicrophoneDriverAVFoundation();
};

@interface MicrophoneDeviceNotification : NSObject {
	MicrophoneDriverAVFoundation *microphoneDriver;
}

- (void)addObservers;
- (void)removeObservers;

- (void)devicesChanged:(NSNotification *)notification;
- (id)initForDriver:(MicrophoneDriverAVFoundation *)pDriver;
- (void)dealloc;
@end

@interface MicrophoneDeviceCaptureSession : AVCaptureSession <AVCaptureAudioDataOutputSampleBufferDelegate> {
	Ref<MicrophoneFeed> feed;
	AVCaptureDeviceInput *inputDevice;
	AVCaptureAudioDataOutput *dataOutput;
}

- (id)initForFeed:(Ref<MicrophoneFeed>)pFeed
		andDevice:(AVCaptureDevice *)pDevice;
- (void)captureOutput:(AVCaptureOutput *)pCaptureOutput
		didOutputSampleBuffer:(CMSampleBufferRef)pSampleBuffer
			   fromConnection:(AVCaptureConnection *)pConnection;

- (void)cleanup;

@end
