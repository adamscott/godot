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

#include "core/error/error_macros.h"
#include "servers/microphone/microphone_feed.h"
#include <CoreAudioTypes/CoreAudioBaseTypes.h>

MicrophoneDriverAVFoundation::FeedEntry *MicrophoneDriverAVFoundation::get_feed_entry_from_feed(Ref<MicrophoneFeed> p_feed) {
	for (FeedEntry &feed_entry : _feed_entries) {
		if (feed_entry.feed == p_feed) {
			return &feed_entry;
		}
	}
	return nil;
}

void MicrophoneDriverAVFoundation::setup_feed_to_device_settings(Ref<MicrophoneFeed> p_feed, AVCaptureDevice *p_device) {
	AVCaptureDeviceFormat *active_format = p_device.activeFormat;
	CMFormatDescriptionRef format_description = active_format.formatDescription;
	ERR_FAIL_COND(CMFormatDescriptionGetMediaType(format_description) != kCMMediaType_Audio);
	const AudioStreamBasicDescription *audio_format_stream_basic_description = CMAudioFormatDescriptionGetStreamBasicDescription(format_description);
	ERR_FAIL_COND(audio_format_stream_basic_description == nullptr);

	p_feed->set_sample_rate(audio_format_stream_basic_description->mSampleRate);
	p_feed->set_channels_per_frame(audio_format_stream_basic_description->mChannelsPerFrame);
	p_feed->set_bytes_per_frame(audio_format_stream_basic_description->mBytesPerFrame);

	switch (audio_format_stream_basic_description->mFormatID) {
		case kAudioFormatLinearPCM: {
			p_feed->set_format_id(MicrophoneFeed::MICROPHONE_FEED_FORMAT_ID_LINEAR_PCM);
		} break;

		default: {
			// Do nothing.
		} break;
	}

	// format_id = audio_format_stream_basic_description->mFormatID;
	// format_flags = audio_format_stream_basic_description->mFormatFlags;
}

void MicrophoneDriverAVFoundation::set_monitoring_feeds(bool p_monitoring_feeds) {
	if (monitoring_feeds == p_monitoring_feeds) {
		return;
	}
	monitoring_feeds = p_monitoring_feeds;

	if (!monitoring_feeds) {
		device_notifications = nil;
		return;
	}

	update_feeds();
	device_notifications = [[MicrophoneDeviceNotification alloc] initForDriver:this];
}

bool MicrophoneDriverAVFoundation::get_monitoring_feeds() const {
	return device_notifications != nil;
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
		FeedEntry *feed_entry = &_feed_entries[i];
		if (feed_entry->feed.is_null()) {
			continue;
		}

		if (![devices containsObject:feed_entry->device]) {
			remove_feed_entry(feed_entry);
		}
	};

	for (AVCaptureDevice *device in devices) {
		bool found = false;
		for (uint32_t i = 0; i < _feed_entries.size(); i++) {
			FeedEntry *feed_entry = &_feed_entries[i];
			if (feed_entry->feed.is_null()) {
				continue;
			}
			if (feed_entry->device == device) {
				found = true;
			}
		}

		if (found) {
			continue;
		}

		Ref<MicrophoneFeed> feed;
		feed.instantiate();
		setup_feed_to_device_settings(feed, device);
		_feed_entries.push_back({ .feed = feed, .device = device });
	}
}

void MicrophoneDriverAVFoundation::remove_feed_entry(FeedEntry *p_feed_entry) {
	deactivate_feed_entry(p_feed_entry);
	for (uint32_t i = 0; i < _feed_entries.size(); i++) {
		if (&_feed_entries[i] == p_feed_entry) {
			_feed_entries.remove_at(i);
			break;
		}
	}
}

bool MicrophoneDriverAVFoundation::activate_feed_entry(FeedEntry *p_feed_entry) {
	if (p_feed_entry->capture_session) {
		return true;
	}

	auto init_device_capture_session = [p_feed_entry]() -> void {
		p_feed_entry->capture_session = [[MicrophoneDeviceCaptureSession alloc] initForFeed:p_feed_entry->feed
																				  andDevice:p_feed_entry->device];
		p_feed_entry->feed->emit_signal(SNAME("feed_activated"));
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
												 activate_feed_entry(p_feed_entry);
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

void MicrophoneDriverAVFoundation::deactivate_feed_entry(FeedEntry *p_feed_entry) {
	ERR_FAIL_NULL(p_feed_entry);

	if (p_feed_entry->capture_session) {
		[p_feed_entry->capture_session cleanup];
		p_feed_entry->capture_session = nil;
	}
}

bool MicrophoneDriverAVFoundation::activate_feed(Ref<MicrophoneFeed> p_feed) {
	FeedEntry *feed_entry = get_feed_entry_from_feed(p_feed);
	ERR_FAIL_NULL_V(feed_entry, false);
	return activate_feed_entry(feed_entry);
}

void MicrophoneDriverAVFoundation::deactivate_feed(Ref<MicrophoneFeed> p_feed) {
	FeedEntry *feed_entry = get_feed_entry_from_feed(p_feed);
	ERR_FAIL_NULL(feed_entry);
	deactivate_feed_entry(feed_entry);
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
	microphoneDriver->update_feeds();
}

- (id)initForDriver:(MicrophoneDriverAVFoundation *)pDriver {
	if (self = [super init]) {
		microphoneDriver = pDriver;
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

- (id)initForFeed:(Ref<MicrophoneFeed>)pFeed
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

	AudioFormatID formatId;
	switch (pFeed->get_format_id()) {
		case MicrophoneFeed::MICROPHONE_FEED_FORMAT_ID_LINEAR_PCM:
		default: {
			formatId = kAudioFormatLinearPCM;
		} break;
	}

	NSDictionary<NSString *, id> *settings = @{
		AVFormatIDKey : [NSNumber numberWithInt:formatId],
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
		RingBuffer<uint8_t> &ringBuffer = MicrophoneDriver::get_ring_buffer(feed);
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
