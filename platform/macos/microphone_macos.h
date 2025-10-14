/**************************************************************************/
/*  microphone_macos.h                                                    */
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

#ifdef COREAUDIO_ENABLED

#include "servers/audio/audio_server.h"
#include "servers/microphone/microphone_feed.h"
#include "servers/microphone/microphone_server.h"

#import <AVFoundation/AVFoundation.h>
#import <AudioUnit/AudioUnit.h>
#ifdef MACOS_ENABLED
#import <CoreAudio/AudioHardware.h>
#endif // MACOS_ENABLED

@class MicrophoneDeviceNotification;
@class MicrophoneDeviceCaptureSession;

class MicrophoneServerMacOS : public MicrophoneServer {
	GDSOFTCLASS(MicrophoneServerMacOS, MicrophoneServer);
	_THREAD_SAFE_CLASS_

	// AudioComponentInstance input_unit = nullptr;
	MicrophoneDeviceNotification *device_notifications = nullptr;

public:
	static MicrophoneServer *create_function();
	static void register_macos_driver();

	void update_feeds();
	void set_monitoring_feeds(bool p_monitoring_feeds) override;

	MicrophoneServerMacOS();
	~MicrophoneServerMacOS();
};

class MicrophoneFeedMacOSProxy;

class MicrophoneFeedMacOS : public MicrophoneFeed {
	GDSOFTCLASS(MicrophoneFeedMacOS, MicrophoneFeed);

	friend MicrophoneFeedMacOSProxy;

private:
	AVCaptureDevice *device;
	MicrophoneDeviceCaptureSession *device_capture_session;

	AudioFormatID format_id;
	AudioFormatFlags format_flags;

	RingBuffer<uint8_t> &_get_ring_buffer() {
		return ring_buffer;
	}

public:
	bool is_active() const override { return device_capture_session; }
	void set_active(bool p_active) override;

	AVCaptureDevice *get_device() const { return device; }
	void set_device(AVCaptureDevice *p_device);

	virtual void set_to_device_native_settings() override;

	virtual bool activate_feed() override;
	virtual void deactivate_feed() override;

	MicrophoneFeedMacOS();
	~MicrophoneFeedMacOS();
};

class MicrophoneFeedMacOSProxy {
public:
	static RingBuffer<uint8_t> &get_ring_buffer(Ref<MicrophoneFeedMacOS> p_microphone_server) {
		return p_microphone_server->_get_ring_buffer();
	}
};

@interface MicrophoneDeviceNotification : NSObject {
	MicrophoneServerMacOS *microphoneServer;
}

- (void)addObservers;
- (void)removeObservers;

- (void)devicesChanged:(NSNotification *)notification;
- (id)initForServer:(MicrophoneServerMacOS *)pServer;
- (void)dealloc;
@end

@interface MicrophoneDeviceCaptureSession : AVCaptureSession <AVCaptureAudioDataOutputSampleBufferDelegate> {
	Ref<MicrophoneFeedMacOS> feed;
	AVCaptureDeviceInput *inputDevice;
	AVCaptureAudioDataOutput *dataOutput;
}

- (id)initForFeed:(Ref<MicrophoneFeedMacOS>)pFeed
		andDevice:(AVCaptureDevice *)pDevice;
- (void)captureOutput:(AVCaptureOutput *)pCaptureOutput
		didOutputSampleBuffer:(CMSampleBufferRef)pSampleBuffer
			   fromConnection:(AVCaptureConnection *)pConnection;

- (void)cleanup;

@end

#endif // COREAUDIO_ENABLED
