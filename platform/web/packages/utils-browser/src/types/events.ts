/**************************************************************************/
/*  events.ts                                                             */
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

export interface EventTargetRegistry {
	AbortSignal: AbortSignal;
	AbstractWorker: AbstractWorker;
	Animation: Animation;
	AudioScheduledSourceNode: AudioScheduledSourceNode;
	AudioWorkletNode: AudioWorkletNode;
	BaseAudioContext: BaseAudioContext;
	BroadcastChannel: BroadcastChannel;
	Document: Document;
	Element: Element;
	EventSource: EventSource;
	EventTarget: EventTarget;
	FileReader: FileReader;
	FontFaceSet: FontFaceSet;
	GlobalEventHandlers: GlobalEventHandlers;
	HTMLBodyElement: HTMLBodyElement;
	HTMLElement: HTMLElement;
	// eslint-disable-next-line @typescript-eslint/no-deprecated -- It's just for typing purposes.
	HTMLFrameSetElement: HTMLFrameSetElement;
	HTMLMediaElement: HTMLMediaElement;
	HTMLVideoElement: HTMLVideoElement;
	IDBDatabase: IDBDatabase;
	IDBOpenDBRequest: IDBOpenDBRequest;
	IDBRequest: IDBRequest;
	IDBTransaction: IDBTransaction;
	MIDIAccess: MIDIAccess;
	MIDIInput: MIDIInput;
	MIDIPort: MIDIPort;
	MathMLElement: MathMLElement;
	MediaDevices: MediaDevices;
	MediaKeySession: MediaKeySession;
	MediaQueryList: MediaQueryList;
	MediaRecorder: MediaRecorder;
	MediaSource: MediaSource;
	MediaStream: MediaStream;
	MediaStreamTrack: MediaStreamTrack;
	MessagePort: MessagePort;
	Notification: Notification;
	OfflineAudioContext: OfflineAudioContext;
	OffscreenCanvas: OffscreenCanvas;
	PaymentRequest: PaymentRequest;
	Performance: Performance;
	PermissionStatus: PermissionStatus;
	PictureInPictureWindow: PictureInPictureWindow;
	RTCDTMFSender: RTCDTMFSender;
	RTCDataChannel: RTCDataChannel;
	RTCDtlsTransport: RTCDtlsTransport;
	RTCIceTransport: RTCIceTransport;
	RTCPeerConnection: RTCPeerConnection;
	RTCSctpTransport: RTCSctpTransport;
	RemotePlayback: RemotePlayback;
	SVGElement: SVGElement;
	SVGSVGElement: SVGSVGElement;
	ScreenOrientation: ScreenOrientation;
	// eslint-disable-next-line @typescript-eslint/no-deprecated -- It's just for typing purposes.
	ScriptProcessorNode: ScriptProcessorNode;
	ServiceWorkerContainer: ServiceWorkerContainer;
	ServiceWorker: ServiceWorker;
	ServiceWorkerRegistration: ServiceWorkerRegistration;
	ShadowRoot: ShadowRoot;
	SourceBuffer: SourceBuffer;
	SourceBufferList: SourceBufferList;
	SpeechSynthesis: SpeechSynthesis;
	SpeechSynthesisUtterance: SpeechSynthesisUtterance;
	TextTrackCue: TextTrackCue;
	TextTrack: TextTrack;
	TextTrackList: TextTrackList;
	VideoDecoder: VideoDecoder;
	VideoEncoder: VideoEncoder;
	VisualViewport: VisualViewport;
	WakeLockSentinel: WakeLockSentinel;
	WebSocket: WebSocket;
	WindowEventHandlers: WindowEventHandlers;
	Window: Window;
	Worker: Worker;
	XMLHttpRequest: XMLHttpRequest;
	XMLHttpRequestEventTarget: XMLHttpRequestEventTarget;
	XRCompositionLayer: XRCompositionLayer;
	XRReferenceSpace: XRReferenceSpace;
	XRSession: XRSession;
	XRSystem: XRSystem;
}

export type EventTargetToName<T extends EventTargetRegistry[keyof EventTargetRegistry]> = {
	[K in keyof EventTargetRegistry]: T extends EventTargetRegistry[K]
		? EventTargetRegistry[K] extends T
			? K
			: never
		: never;
}[keyof EventTargetRegistry];

export interface EventTargetEventMapMap {
	AbortSignal: AbortSignalEventMap;
	AbstractWorker: AbstractWorkerEventMap;
	Animation: AnimationEventMap;
	AudioScheduledSourceNode: AudioScheduledSourceNodeEventMap;
	AudioWorkletNode: AudioWorkletNodeEventMap;
	BaseAudioContext: BaseAudioContextEventMap;
	BroadcastChannel: BroadcastChannelEventMap;
	Document: DocumentEventMap;
	Element: ElementEventMap;
	EventSource: EventSourceEventMap;
	EventTarget: Record<string, Event>;
	FileReader: FileReaderEventMap;
	FontFaceSet: FontFaceSetEventMap;
	GlobalEventHandlers: GlobalEventHandlersEventMap;
	HTMLBodyElement: HTMLBodyElementEventMap;
	HTMLElement: HTMLElementEventMap;
	HTMLFrameSetElement: HTMLFrameSetElementEventMap;
	HTMLMediaElement: HTMLMediaElementEventMap;
	HTMLVideoElement: HTMLVideoElementEventMap;
	IDBDatabase: IDBDatabaseEventMap;
	IDBOpenDBRequest: IDBOpenDBRequestEventMap;
	IDBRequest: IDBRequestEventMap;
	IDBTransaction: IDBTransactionEventMap;
	MIDIAccess: MIDIAccessEventMap;
	MIDIInput: MIDIInputEventMap;
	MIDIPort: MIDIPortEventMap;
	MathMLElement: MathMLElementEventMap;
	MediaDevices: MediaDevicesEventMap;
	MediaKeySession: MediaKeySessionEventMap;
	MediaQueryList: MediaQueryListEventMap;
	MediaRecorder: MediaRecorderEventMap;
	MediaSource: MediaSourceEventMap;
	MediaStream: MediaStreamEventMap;
	MediaStreamTrack: MediaStreamTrackEventMap;
	MessagePort: MessagePortEventMap;
	Notification: NotificationEventMap;
	OfflineAudioContext: OfflineAudioContextEventMap;
	OffscreenCanvas: OffscreenCanvasEventMap;
	PaymentRequest: PaymentRequestEventMap;
	Performance: PerformanceEventMap;
	PermissionStatus: PermissionStatusEventMap;
	PictureInPictureWindow: PictureInPictureWindowEventMap;
	RTCDTMFSender: RTCDTMFSenderEventMap;
	RTCDataChannel: RTCDataChannelEventMap;
	RTCDtlsTransport: RTCDtlsTransportEventMap;
	RTCIceTransport: RTCIceTransportEventMap;
	RTCPeerConnection: RTCPeerConnectionEventMap;
	RTCSctpTransport: RTCSctpTransportEventMap;
	RemotePlayback: RemotePlaybackEventMap;
	SVGElement: SVGElementEventMap;
	SVGSVGElement: SVGSVGElementEventMap;
	ScreenOrientation: ScreenOrientationEventMap;
	ScriptProcessorNode: ScriptProcessorNodeEventMap;
	ServiceWorkerContainer: ServiceWorkerContainerEventMap;
	ServiceWorker: ServiceWorkerEventMap;
	ServiceWorkerRegistration: ServiceWorkerRegistrationEventMap;
	ShadowRoot: ShadowRootEventMap;
	SourceBuffer: SourceBufferEventMap;
	SourceBufferList: SourceBufferListEventMap;
	SpeechSynthesis: SpeechSynthesisEventMap;
	SpeechSynthesisUtterance: SpeechSynthesisUtteranceEventMap;
	TextTrackCue: TextTrackCueEventMap;
	TextTrack: TextTrackEventMap;
	TextTrackList: TextTrackListEventMap;
	VideoDecoder: VideoDecoderEventMap;
	VideoEncoder: VideoEncoderEventMap;
	VisualViewport: VisualViewportEventMap;
	WakeLockSentinel: WakeLockSentinelEventMap;
	WebSocket: WebSocketEventMap;
	WindowEventHandlers: WindowEventHandlersEventMap;
	Window: WindowEventMap;
	Worker: WorkerEventMap;
	XMLHttpRequest: XMLHttpRequestEventMap;
	XMLHttpRequestEventTarget: XMLHttpRequestEventTargetEventMap;
	XRCompositionLayer: XRCompositionLayerEventMap;
	XRReferenceSpace: XRReferenceSpaceEventMap;
	XRSession: XRSessionEventMap;
	XRSystem: XRSystemEventMap;
}

export type GetEventTargetEventMap<ET> = EventTargetEventMapMap[EventTargetToName<
	ET extends EventTargetRegistry[keyof EventTargetRegistry] ? ET : never
>];

export type GetEventTargetListener<ET extends EventTarget, T extends keyof GetEventTargetEventMap<ET>> = <
	CB extends Parameters<ET["addEventListener"]>[1],
	EL extends CB extends EventListenerOrEventListenerObject
		? CB extends EventListenerObject
			? CB["handleEvent"]
			: CB extends EventListener
				? CB
				: CB
		: null,
>(
	this: ThisParameterType<EL>,
	event: GetEventTargetEventMap<ET>[T],
) => // eslint-disable-next-line @typescript-eslint/no-explicit-any -- We really want to be able to return anything, as it doesn't matter.
any;
