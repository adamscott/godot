/**************************************************************************/
/*  godot_rtc_data_channel.ts                                             */
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

import type {
	CCharPointer,
	CFunctionPointer,
	CIDHandlerId,
	CInt,
	CUintPointer,
	CVoidPointer,
} from "@godotengine/emscripten-utils/types";
import { getMaxUInt16 as $getMaxUInt16 } from "@godotengine/utils/macros" with { type: "macro" };

type RTCDataChannelId = CIDHandlerId<RTCDataChannel>;
type RTCChOnOpen = (pObjectPtr: CVoidPointer) => void;
type RTCChOnMessage = (pObjectPtr: CVoidPointer, pBufferPtr: CUintPointer, pBufferSize: CInt, pIsString: CInt) => void;
type RTCChOnClose = (pObjectPtr: CVoidPointer) => void;
type RTCChOnError = (pObjectPtr: CVoidPointer) => void;

type ConnectOnOpenCallback = () => void;
type ConnectOnMessageCallback = (pOutPtr: CUintPointer, pOutLength: number, pIsString: boolean) => void;
type ConnectOnErrorCallback = () => void;
type ConnectOnCloseCallback = () => void;

function _godotRtcDataChannelConnect(
	pId: RTCDataChannelId,
	pOnOpen: ConnectOnOpenCallback,
	pOnMessage: ConnectOnMessageCallback,
	pOnError: ConnectOnErrorCallback,
	pOnClose: ConnectOnCloseCallback,
): void {
	const dataChannel = IDHandler.get(pId);
	if (dataChannel == null) {
		return;
	}

	dataChannel.binaryType = "arraybuffer";
	GodotEventListeners.add(dataChannel, "open", (_pEvent: RTCDataChannelEvent) => {
		pOnOpen();
	});
	GodotEventListeners.add(dataChannel, "close", (_pEvent: RTCDataChannelEvent) => {
		pOnClose();
	});
	GodotEventListeners.add(dataChannel, "error", (_pEvent: RTCDataChannelEvent) => {
		pOnError();
	});
	GodotEventListeners.add(dataChannel, "message", (pEvent: MessageEvent) => {
		// eslint-disable-next-line @typescript-eslint/init-declarations -- Will initialize later.
		let buffer: Uint8Array;
		let isString = false;
		if (pEvent.data instanceof ArrayBuffer) {
			buffer = new Uint8Array(pEvent.data);
		} else if (pEvent.data instanceof Blob) {
			GodotRuntime.error("Blob type not supported");
			return;
		} else if (typeof pEvent.data === "string") {
			isString = true;
			buffer = new Uint8Array(new TextEncoder().encode(pEvent.data));
		} else {
			GodotRuntime.error("Unknown message type");
			return;
		}
		const bufferLength = buffer.byteLength;
		const outPtr = GodotRuntime.malloc<CUintPointer>(bufferLength);
		HEAPU8.set(buffer, outPtr);
		pOnMessage(outPtr, bufferLength, isString);
		GodotRuntime.free(outPtr);
	});
}

function _godotRtcDataChannelClose(pId: RTCDataChannelId): void {
	const dataChannel = IDHandler.get(pId);
	if (dataChannel == null) {
		return;
	}
	GodotEventListeners.remove(dataChannel);
	dataChannel.close();
}

// We make sure to type `getProperty` properly.
// First, by returning `NonNullable<RTCDataChannel[T]>`, we ensure that even if `RTCDataChannel[T]` is `number | null`,
// it doesn't matter because we will return the default if it's nullable.
// Also, with the overloads:
// -- we tell that if no `pDefault` is given, it will return null by default.
function _godotRtcDataChannelGetProperty<T extends keyof RTCDataChannel>(
	pId: RTCDataChannelId,
	pProperty: T,
): NonNullable<RTCDataChannel[T]> | null;
// -- tell that if `pDefault` is given, it will return that value by default.
function _godotRtcDataChannelGetProperty<T extends keyof RTCDataChannel, U>(
	pId: RTCDataChannelId,
	pProperty: T,
	pDefault: U,
): NonNullable<RTCDataChannel[T]> | U;
function _godotRtcDataChannelGetProperty<T extends keyof RTCDataChannel, U>(
	pId: RTCDataChannelId,
	pProperty: T,
	pDefault?: U,
): unknown {
	const defaultReturnValue = typeof pDefault === "undefined" ? null : (pDefault as U);

	const dataChannel = IDHandler.get(pId);
	if (dataChannel == null) {
		return defaultReturnValue;
	}
	const value = dataChannel[pProperty];
	if (value == null) {
		return defaultReturnValue;
	}
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- As intended.
	return value as Exclude<RTCDataChannel[T], U>;
}

export const _GodotRTCDataChannel = {
	// Our socket implementation that forwards events to C++.
	$GodotRTCDataChannel__deps: ["$IDHandler", "$GodotRuntime", "$GodotEventListeners", "$UTF8Decoder"] as const,
	$GodotRTCDataChannel: {
		connect: _godotRtcDataChannelConnect,
		close: _godotRtcDataChannelClose,
		getProperty: _godotRtcDataChannelGetProperty,
	},

	godot_js_rtc_datachannel_ready_state_get__proxy: "sync",
	godot_js_rtc_datachannel_ready_state_get__sig: "ii",
	godot_js_rtc_datachannel_ready_state_get: (pId: RTCDataChannelId): CInt => {
		const dataChannel = IDHandler.get(pId);
		if (dataChannel == null) {
			return GodotRuntime.asCInt(3); // CLOSED.
		}

		switch (dataChannel.readyState) {
			case "connecting":
				return GodotRuntime.asCInt(0);
			case "open":
				return GodotRuntime.asCInt(1);
			case "closing":
				return GodotRuntime.asCInt(2);
			case "closed":
				return GodotRuntime.asCInt(3);
		}
	},

	godot_js_rtc_datachannel_send__proxy: "sync",
	godot_js_rtc_datachannel_send__sig: "iipii",
	godot_js_rtc_datachannel_send: (
		pId: RTCDataChannelId,
		pBufferPtr: CUintPointer,
		pBufferLength: CInt,
		pRaw: CInt,
	): CInt => {
		const dataChannel = IDHandler.get(pId);
		if (dataChannel == null) {
			return GodotRuntime.CIntError.FAILED;
		}

		const bytesArray = new Uint8Array(pBufferLength);
		for (let i = 0; i < pBufferLength; i++) {
			bytesArray[i] = GodotRuntime.getHeapValue(GodotRuntime.asCType<CUintPointer>(pBufferPtr + i), "u8");
		}

		if (GodotRuntime.fromCTypeToBoolean(pRaw)) {
			dataChannel.send(bytesArray.buffer);
			return GodotRuntime.CIntError.OK;
		}

		const decodedString = UTF8Decoder.decode(bytesArray);
		dataChannel.send(decodedString);
		return GodotRuntime.CIntError.OK;
	},

	godot_js_rtc_datachannel_is_ordered__proxy: "sync",
	godot_js_rtc_datachannel_is_ordered__sig: "ii",
	godot_js_rtc_datachannel_is_ordered: (pId: RTCDataChannelId): CInt => {
		return GodotRuntime.asCIntBoolean(GodotRTCDataChannel.getProperty(pId, "ordered", true));
	},

	godot_js_rtc_datachannel_id_get__proxy: "sync",
	godot_js_rtc_datachannel_id_get__sig: "ii",
	godot_js_rtc_datachannel_id_get: (pId: RTCDataChannelId): CInt => {
		return GodotRuntime.asCInt(GodotRTCDataChannel.getProperty(pId, "id", $getMaxUInt16()));
	},

	godot_js_rtc_datachannel_max_packet_lifetime_get__proxy: "sync",
	godot_js_rtc_datachannel_max_packet_lifetime_get__sig: "ii",
	godot_js_rtc_datachannel_max_packet_lifetime_get: (pId: RTCDataChannelId): CInt => {
		const dataChannel = IDHandler.get(pId);
		if (dataChannel == null) {
			return GodotRuntime.asCInt($getMaxUInt16());
		}

		const maxPacketLifeTime = dataChannel.maxPacketLifeTime;
		if (maxPacketLifeTime != null) {
			return GodotRuntime.asCInt(maxPacketLifeTime);
		}

		const maxRetransmitTime = dataChannel.maxRetransmitTime;
		if (maxRetransmitTime != null) {
			// Guess someone didn't appreciate the standardization process.
			return GodotRuntime.asCInt(maxRetransmitTime);
		}

		return GodotRuntime.asCInt($getMaxUInt16());
	},

	godot_js_rtc_datachannel_max_retransmits_get__proxy: "sync",
	godot_js_rtc_datachannel_max_retransmits_get__sig: "ii",
	godot_js_rtc_datachannel_max_retransmits_get: (pId: RTCDataChannelId): CInt => {
		return GodotRuntime.asCInt(GodotRTCDataChannel.getProperty(pId, "maxRetransmits", $getMaxUInt16()));
	},

	godot_js_rtc_datachannel_is_negotiated__proxy: "sync",
	godot_js_rtc_datachannel_is_negotiated__sig: "ii",
	godot_js_rtc_datachannel_is_negotiated: (pId: RTCDataChannelId): CInt => {
		return GodotRuntime.asCIntBoolean(GodotRTCDataChannel.getProperty(pId, "negotiated", false));
	},

	godot_js_rtc_datachannel_get_buffered_amount__proxy: "sync",
	godot_js_rtc_datachannel_get_buffered_amount__sig: "ii",
	godot_js_rtc_datachannel_get_buffered_amount: (pId: RTCDataChannelId): CInt => {
		return GodotRuntime.asCInt(GodotRTCDataChannel.getProperty(pId, "bufferedAmount", 0));
	},

	godot_js_rtc_datachannel_label_get__proxy: "sync",
	godot_js_rtc_datachannel_label_get__sig: "pi",
	godot_js_rtc_datachannel_label_get: (pId: RTCDataChannelId): CCharPointer => {
		const dataChannel = IDHandler.get(pId);
		if (dataChannel?.label == null) {
			return GodotRuntime.asCType<CCharPointer>(GodotRuntime.NULLPTR);
		}
		return GodotRuntime.allocString(dataChannel.label);
	},

	godot_js_rtc_datachannel_protocol_get__sig: "pi",
	godot_js_rtc_datachannel_protocol_get: (pId: RTCDataChannelId): CCharPointer => {
		const dataChannel = IDHandler.get(pId);
		if (dataChannel?.protocol == null) {
			return GodotRuntime.asCType<CCharPointer>(GodotRuntime.NULLPTR);
		}
		return GodotRuntime.allocString(dataChannel.protocol);
	},

	godot_js_rtc_datachannel_destroy__proxy: "sync",
	godot_js_rtc_datachannel_destroy__sig: "vi",
	godot_js_rtc_datachannel_destroy: (pId: RTCDataChannelId): void => {
		GodotRTCDataChannel.close(pId);
		IDHandler.remove(pId);
	},

	godot_js_rtc_datachannel_connect__proxy: "sync",
	godot_js_rtc_datachannel_connect__sig: "vippppp",
	godot_js_rtc_datachannel_connect: (
		pId: RTCDataChannelId,
		pObjectPtr: CVoidPointer,
		pOnOpenCallbackPtr: CFunctionPointer<RTCChOnOpen>,
		pOnMessageCallbackPtr: CFunctionPointer<RTCChOnMessage>,
		pOnErrorCallbackPtr: CFunctionPointer<RTCChOnError>,
		pOnCloseCallbackPtr: CFunctionPointer<RTCChOnClose>,
	): void => {
		const onOpenCallback = GodotRuntime.getFunction(pOnOpenCallbackPtr);
		const onOpen: ConnectOnOpenCallback = () => {
			onOpenCallback(pObjectPtr);
		};

		const onMessageCallback = GodotRuntime.getFunction(pOnMessageCallbackPtr);
		const onMessage: ConnectOnMessageCallback = (pOutPtr, pOutLength, pIsString) => {
			onMessageCallback(
				pObjectPtr,
				pOutPtr,
				GodotRuntime.asCInt(pOutLength),
				GodotRuntime.asCIntBoolean(pIsString),
			);
		};

		const onErrorCallback = GodotRuntime.getFunction(pOnErrorCallbackPtr);
		const onError: ConnectOnErrorCallback = () => {
			onErrorCallback(pObjectPtr);
		};

		const onCloseCallback = GodotRuntime.getFunction(pOnCloseCallbackPtr);
		const onClose: ConnectOnErrorCallback = () => {
			onCloseCallback(pObjectPtr);
		};

		GodotRTCDataChannel.connect(pId, onOpen, onMessage, onError, onClose);
	},

	godot_js_rtc_datachannel_close__proxy: "sync",
	godot_js_rtc_datachannel_close__sig: "vi",
	godot_js_rtc_datachannel_close: (pId: RTCDataChannelId): void => {
		const dataChannel = IDHandler.get(pId);
		if (dataChannel == null) {
			return;
		}
		GodotRTCDataChannel.close(pId);
	},
};

autoAddDeps(_GodotRTCDataChannel, "$GodotRTCDataChannel");
addToLibrary(_GodotRTCDataChannel);
