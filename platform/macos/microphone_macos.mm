/**************************************************************************/
/*  microphone_macos.mm                                                   */
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

#include "microphone_macos.h"

#include "servers/audio/audio_server.h"
#include "servers/microphone/microphone_server.h"
#include <AVFAudio/AVFAudio.h>
#include <AVFoundation/AVFoundation.h>
#include <CoreAudioTypes/CoreAudioBaseTypes.h>
#include <CoreMedia/CMFormatDescription.h>
#include <CoreMedia/CMSampleBuffer.h>

/*
 * MicrophoneServerMacOS
 */

MicrophoneServer *MicrophoneServerMacOS::create_function() {
	return memnew(MicrophoneServerMacOS());
}

void MicrophoneServerMacOS::register_macos_driver() {
	register_create_function("macos", create_function);
}

void MicrophoneServerMacOS::update_feeds() {
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
	for (int i = feeds.size() - 1; i >= 0; i--) {
		Ref<MicrophoneFeedMacOS> feed = (Ref<MicrophoneFeedMacOS>)feeds[i];
		if (feed.is_null()) {
			continue;
		}

		if (![devices containsObject:feed->get_device()]) {
			remove_feed(feed);
		}
	};

	for (AVCaptureDevice *device in devices) {
		bool found = false;
		for (int i = 0; i < feeds.size(); i++) {
			Ref<MicrophoneFeedMacOS> feed = (Ref<MicrophoneFeedMacOS>)feeds[i];
			if (feed.is_null()) {
				continue;
			}
			if (feed->get_device() == device) {
				found = true;
			}
		}

		if (found) {
			continue;
		}

		Ref<MicrophoneFeedMacOS> feed;
		feed.instantiate();
		feed->set_device(device);
		feeds.push_back(feed);
	}

	emit_signal(SNAME("feeds_updated"));
}

void MicrophoneServerMacOS::set_monitoring_feeds(bool p_monitoring_feeds) {
	if (p_monitoring_feeds == monitoring_feeds) {
		return;
	}

	MicrophoneServer::set_monitoring_feeds(p_monitoring_feeds);
	if (monitoring_feeds) {
		update_feeds();
		device_notifications = [[MicrophoneDeviceNotification alloc] initForServer:this];
	} else {
		device_notifications = nil;
	}
}

MicrophoneServerMacOS::MicrophoneServerMacOS() {}
MicrophoneServerMacOS::~MicrophoneServerMacOS() {
}

/*
 * MicrophoneFeedMacOS
 */

void MicrophoneFeedMacOS::set_active(bool p_is_active) {
	if (p_is_active == is_active()) {
		return;
	}

	if (!p_is_active) {
		deactivate_feed();
		return;
	}

	activate_feed();
}

void MicrophoneFeedMacOS::set_device(AVCaptureDevice *p_device) {
	device = p_device;

	NSString *device_name = p_device.localizedName;
	name = String::utf8(device_name.UTF8String);

	set_to_device_native_settings();
}

void MicrophoneFeedMacOS::set_to_device_native_settings() {
	ERR_FAIL_COND(device.activeFormat == nullptr);

	AVCaptureDeviceFormat *active_format = device.activeFormat;
	CMFormatDescriptionRef format_description = active_format.formatDescription;
	ERR_FAIL_COND(CMFormatDescriptionGetMediaType(format_description) != kCMMediaType_Audio);
	const AudioStreamBasicDescription *audio_format_stream_basic_description = CMAudioFormatDescriptionGetStreamBasicDescription(format_description);
	ERR_FAIL_COND(audio_format_stream_basic_description == nullptr);
	sample_rate = audio_format_stream_basic_description->mSampleRate;
	channels_per_frame = audio_format_stream_basic_description->mChannelsPerFrame;
	bytes_per_frame = audio_format_stream_basic_description->mBytesPerFrame;

	format_id = audio_format_stream_basic_description->mFormatID;
	format_flags = audio_format_stream_basic_description->mFormatFlags;

	update_buffer_size();
}

bool MicrophoneFeedMacOS::activate_feed() {
	if (device_capture_session) {
		return true;
	}

	if (!MicrophoneFeed::activate_feed()) {
		return false;
	}

	auto init_device_capture_session = [this]() -> void {
		device_capture_session = [[MicrophoneDeviceCaptureSession alloc] initForFeed:this andDevice:device];
		emit_signal(SNAME("feed_activated"));
	};

	if (@available(macOS 10.14, *)) {
		switch ([AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeAudio]) {
			case AVAuthorizationStatusAuthorized: {
				init_device_capture_session();
				return true;
			} break;

			case AVAuthorizationStatusDenied: {
				return false;
			} break;

			case AVAuthorizationStatusNotDetermined: {
				[AVCaptureDevice requestAccessForMediaType:AVMediaTypeAudio
										 completionHandler:^(BOOL granted) {
											 if (granted) {
												 activate_feed();
											 }
										 }];
				return false;
			} break;

			case AVAuthorizationStatusRestricted: {
				return false;
			} break;
		}
	} else {
		init_device_capture_session();
		return true;
	}
}

void MicrophoneFeedMacOS::deactivate_feed() {
	if (!device_capture_session) {
		return;
	}
	[device_capture_session cleanup];
	device_capture_session = nil;
	MicrophoneFeed::deactivate_feed();
}

MicrophoneFeedMacOS::MicrophoneFeedMacOS() {
	device = nil;
	device_capture_session = nil;
}
MicrophoneFeedMacOS::~MicrophoneFeedMacOS() {
	if (device_capture_session) {
		deactivate_feed();
	}
}

/*
 * MicrophoneDeviceNotification
 */

@implementation MicrophoneDeviceNotification

- (void)addObservers {
	[[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(devices_changed:) name:AVCaptureDeviceWasConnectedNotification object:nil];
	[[NSNotificationCenter defaultCenter] addObserver:self selector:@selector(devices_changed:) name:AVCaptureDeviceWasDisconnectedNotification object:nil];
}

- (void)removeObservers {
	[[NSNotificationCenter defaultCenter] removeObserver:self name:AVCaptureDeviceWasConnectedNotification object:nil];
	[[NSNotificationCenter defaultCenter] removeObserver:self name:AVCaptureDeviceWasDisconnectedNotification object:nil];
}

- (void)devicesChanged:(NSNotification *)notification {
	microphoneServer->update_feeds();
}

- (id)initForServer:(MicrophoneServerMacOS *)pServer {
	if (self = [super init]) {
		microphoneServer = pServer;
		[self addObservers];
	}
	return self;
}

- (void)dealloc {
	[self removeObservers];
}

@end

/*
 * MicrophoneDeviceSession
 */

@implementation MicrophoneDeviceCaptureSession

- (id)initForFeed:(Ref<MicrophoneFeedMacOS>)pFeed
		andDevice:(AVCaptureDevice *)pDevice {
	if (!(self = [super init])) {
		return self;
	}

	NSError *error;
	feed = pFeed;

	[self beginConfiguration];

	inputDevice = [AVCaptureDeviceInput
			deviceInputWithDevice:pDevice
							error:&error];
	ERR_FAIL_COND_V_MSG(!inputDevice, self, vformat(R"*(could not get input device for MicrophoneFeed "%s")*", feed->get_name()));
	[self addInput:inputDevice];

	dataOutput = [AVCaptureAudioDataOutput new];
	ERR_FAIL_COND_V_MSG(!dataOutput, self, vformat(R"*(could not get data output for MicrophoneFeed "%s")*", feed->get_name()));

	NSDictionary<NSString *, id> *settings = @{
		AVFormatIDKey : [NSNumber numberWithInt:kAudioFormatLinearPCM],
		AVSampleRateKey : [NSNumber numberWithFloat:feed->get_sample_rate()],
		AVNumberOfChannelsKey : [NSNumber numberWithInt:feed->get_channels_per_frame()]
	};
	dataOutput.audioSettings = settings;

	[dataOutput setSampleBufferDelegate:self queue:dispatch_get_main_queue()];

	[self addOutput:dataOutput];
	[self commitConfiguration];
	[self startRunning];

	return self;
}
- (void)captureOutput:(AVCaptureOutput *)pCaptureOutput
		didOutputSampleBuffer:(CMSampleBufferRef)pSampleBuffer
			   fromConnection:(AVCaptureConnection *)pConnection {
	if (pSampleBuffer == nil) {
		return;
	}

	CFRetain(pSampleBuffer);

	OSStatus os_error;
	size_t bufferSize = 0;
	os_error = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
			pSampleBuffer,
			&bufferSize,
			nil,
			0,
			nil,
			nil,
			0,
			nil);
	ERR_FAIL_COND_MSG(os_error != noErr, vformat("error when calling CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer: %s", os_error));

	// print_line(vformat("bufferSize: %s", (uint64_t)bufferSize));
	CMBlockBufferRef blockBuffer = CMSampleBufferGetDataBuffer(pSampleBuffer);
	AudioBufferList *audioBufferList = (AudioBufferList *)malloc(bufferSize);

	os_error = CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer(
			pSampleBuffer,
			nullptr,
			audioBufferList,
			bufferSize,
			nullptr,
			nullptr,
			kCMSampleBufferFlag_AudioBufferList_Assure16ByteAlignment,
			&blockBuffer);
	ERR_FAIL_COND_MSG(os_error != noErr, vformat("error when calling CMSampleBufferGetAudioBufferListWithRetainedBlockBuffer: %s", os_error));

	for (UInt32 i = 0; i < audioBufferList->mNumberBuffers; i++) {
		AudioBuffer &audioBuffer = audioBufferList->mBuffers[i];
		RingBuffer<uint8_t> &ringBuffer = MicrophoneFeedMacOSProxy::get_ring_buffer(feed);
		uint32_t spaceLeft = ringBuffer.space_left();
		uint32_t dataSize = audioBuffer.mDataByteSize;
		if (spaceLeft < dataSize) {
			ringBuffer.advance_read(dataSize - spaceLeft);
		}
		uint32_t writeSize = ringBuffer.write((uint8_t *)audioBuffer.mData, dataSize);
		if (writeSize != dataSize) {
			ERR_PRINT(vformat("writeSize (%s) != dataSize (%s)", writeSize, dataSize));
		}
	}

	CFRelease(blockBuffer);
	CFRelease(pSampleBuffer);
	free(audioBufferList);
}
- (void)cleanup {
	[self stopRunning];
	[self beginConfiguration];

	if (inputDevice) {
		[self removeInput:inputDevice];
		inputDevice = nil;
	}

	[self commitConfiguration];
}

@end
