/**************************************************************************/
/*  webrtc.ts                                                             */
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

import "+browser/lib.ts";

import {
	addToLibrary,
	autoAddDeps,
	CPointer,
	HEAPU8,
	NULLPTR,
} from "./emscripten-lib.ts";
import { GodotRuntime } from "./runtime.ts";
import { IDHandler, IDHandlerId } from "./os.ts";

export declare const GodotRTCDataChannel:
	typeof _GodotRTCDataChannel.$GodotRTCDataChannel;
const _GodotRTCDataChannel = {
	// Our socket implementation that forwards events to C++.
	$GodotRTCDataChannel__deps: ["$IDHandler", "$GodotRuntime"],
	$GodotRTCDataChannel: {
		MAX_UNSIGNED_SHORT: (1 << 16) - 1,

		connect: (
			pId: IDHandlerId,
			pOnOpen: () => void,
			pOnMessage: (
				pOutPtr: CPointer,
				pOutLength: number,
				pIsString: boolean,
			) => void,
			pOnError: () => void,
			pOnClose: () => void,
		): void => {
			const reference = IDHandler.get<RTCDataChannel>(pId);
			if (reference == null) {
				return;
			}

			reference.binaryType = "arraybuffer";

			reference.onopen = (_pEvent) => {
				pOnOpen();
			};
			reference.onerror = (_pEvent) => {
				pOnError();
			};
			reference.onclose = (_pEvent) => {
				pOnClose();
			};
			reference.onmessage = (pEvent) => {
				let buffer: Uint8Array;
				let isString = false;
				if (pEvent.data instanceof ArrayBuffer) {
					buffer = new Uint8Array(pEvent.data);
				} else if (pEvent.data instanceof Blob) {
					GodotRuntime.error("Blob type not supported.");
					return;
				} else if (typeof pEvent.data === "string") {
					isString = true;
					buffer = new Uint8Array(
						new TextEncoder().encode(pEvent.data),
					);
				} else {
					GodotRuntime.error("Unknown message type.");
					return;
				}

				const outLength = buffer.length * buffer.BYTES_PER_ELEMENT;
				const outPtr = GodotRuntime.malloc(outLength);
				HEAPU8.set(buffer, outPtr);
				pOnMessage(outPtr, outLength, isString);
				GodotRuntime.free(outPtr);
			};
		},

		close: (pId: IDHandlerId): void => {
			const reference = IDHandler.get<RTCDataChannel>(pId);
			if (reference == null) {
				return;
			}

			reference.onopen = null;
			reference.onerror = null;
			reference.onclose = null;
			reference.onmessage = null;

			reference.close();
		},

		getProperty: <T extends keyof RTCDataChannel, U>(
			pId: IDHandlerId,
			pProperty: T,
			pDefault: U,
		): RTCDataChannel[T] | U => {
			const reference = IDHandler.get<RTCDataChannel>(pId);
			if (reference == null) {
				return pDefault;
			}
			const value = reference[pProperty];
			if (typeof value === "undefined") {
				return pDefault;
			}
			return value as Exclude<RTCDataChannel[T], undefined>;
		},
	},

	godot_js_rtc_datachannel_ready_state_get__proxy: "sync",
	godot_js_rtc_datachannel_ready_state_get__sig: "ii",
	godot_js_rtc_datachannel_ready_state_get: (pId: IDHandlerId): number => {
		const reference = IDHandler.get<RTCDataChannel>(pId);
		if (reference == null) {
			return 3;
		}

		switch (reference.readyState) {
			case "connecting":
				return 0;
			case "open":
				return 1;
			case "closing":
				return 2;
			case "closed":
			default:
				return 3;
		}
	},

	godot_js_rtc_datachannel_send__proxy: "sync",
	godot_js_rtc_datachannel_send__sig: "iipii",
	godot_js_rtc_datachannel_send: (
		pId: IDHandlerId,
		pBufferPtr: CPointer,
		pLength: number,
		pRaw: number,
	): number => {
		const reference = IDHandler.get<RTCDataChannel>(pId);
		if (reference == null) {
			return 1;
		}

		const bytesArray = new Uint8Array(pLength);
		for (let i = 0; i < pLength; i++) {
			bytesArray[i] = GodotRuntime.getHeapValue(
				(pBufferPtr + i) as CPointer,
				"i8",
			);
		}

		const raw = Boolean(pRaw);
		if (raw) {
			reference.send(bytesArray.buffer);
			return 0;
		}

		const decodedString = new TextDecoder().decode(bytesArray);
		reference.send(decodedString);
		return 0;
	},

	godot_js_rtc_datachannel_is_ordered__proxy: "sync",
	godot_js_rtc_datachannel_is_ordered__sig: "ii",
	godot_js_rtc_datachannel_is_ordered: (pId: IDHandlerId): number => {
		return Number(
			GodotRTCDataChannel.getProperty(pId, "ordered", true),
		);
	},

	godot_js_rtc_datachannel_id_get__proxy: "sync",
	godot_js_rtc_datachannel_id_get__sig: "ii",
	godot_js_rtc_datachannel_id_get: (pId: IDHandlerId): number => {
		// TODO: Validate what to do when `id === null`.
		return Number(GodotRTCDataChannel.getProperty(
			pId,
			"id",
			GodotRTCDataChannel.MAX_UNSIGNED_SHORT,
		));
	},

	godot_js_rtc_datachannel_max_packet_lifetime_get__proxy: "sync",
	godot_js_rtc_datachannel_max_packet_lifetime_get__sig: "ii",
	godot_js_rtc_datachannel_max_packet_lifetime_get: (
		pId: IDHandlerId,
	): number => {
		// TODO: Check if it's ok to remove "maxRetransmitTime".
		// TODO: Validate what to do when `id === null`.
		return Number(
			GodotRTCDataChannel.getProperty(
				pId,
				"maxPacketLifeTime",
				GodotRTCDataChannel.MAX_UNSIGNED_SHORT,
			),
		);
	},

	godot_js_rtc_datachannel_max_retransmits_get__proxy: "sync",
	godot_js_rtc_datachannel_max_retransmits_get__sig: "ii",
	godot_js_rtc_datachannel_max_retransmits_get: (
		pId: IDHandlerId,
	): number => {
		return Number(
			GodotRTCDataChannel.getProperty(
				pId,
				"maxRetransmits",
				GodotRTCDataChannel.MAX_UNSIGNED_SHORT,
			),
		);
	},

	godot_js_rtc_datachannel_is_negotiated__proxy: "sync",
	godot_js_rtc_datachannel_is_negotiated__sig: "ii",
	godot_js_rtc_datachannel_is_negotiated: (
		pId: IDHandlerId,
	): number => {
		return Number(
			GodotRTCDataChannel.getProperty(
				pId,
				"negotiated",
				GodotRTCDataChannel.MAX_UNSIGNED_SHORT,
			),
		);
	},

	godot_js_rtc_datachannel_get_buffered_amount__proxy: "sync",
	godot_js_rtc_datachannel_get_buffered_amount__sig: "ii",
	godot_js_rtc_datachannel_get_buffered_amount: (
		pId: IDHandlerId,
	): number => {
		return Number(
			GodotRTCDataChannel.getProperty(
				pId,
				"bufferedAmount",
				GodotRTCDataChannel.MAX_UNSIGNED_SHORT,
			),
		);
	},

	godot_js_rtc_datachannel_label_get__proxy: "sync",
	godot_js_rtc_datachannel_label_get__sig: "pi",
	godot_js_rtc_datachannel_label_get: (pId: IDHandlerId): CPointer => {
		const reference = IDHandler.get<RTCDataChannel>(pId);
		if (reference?.label == null) {
			return NULLPTR;
		}
		return GodotRuntime.allocString(reference.label);
	},

	godot_js_rtc_datachannel_protocol_get__proxy: "sync",
	godot_js_rtc_datachannel_protocol_get__sig: "pi",
	godot_js_rtc_datachannel_protocol_get: (pId: IDHandlerId): CPointer => {
		const reference = IDHandler.get<RTCDataChannel>(pId);
		if (reference?.protocol == null) {
			return NULLPTR;
		}
		return GodotRuntime.allocString(reference.protocol);
	},

	godot_js_rtc_datachannel_destroy__proxy: "sync",
	godot_js_rtc_datachannel_destroy__sig: "vi",
	godot_js_rtc_datachannel_destroy: (pId: IDHandlerId): void => {
		GodotRTCDataChannel.close(pId);
		IDHandler.remove(pId);
	},

	godot_js_rtc_datachannel_connect__proxy: "sync",
	godot_js_rtc_datachannel_connect__sig: "viipppp",
	godot_js_rtc_datachannel_connect: (
		pId: IDHandlerId,
		pReference: number,
		pOnOpenCallbackPtr: CPointer,
		pOnMessageCallbackPtr: CPointer,
		pOnErrorCallbackPtr: CPointer,
		pOnCloseCallbackPtr: CPointer,
	): void => {
		const onOpenCallback = GodotRuntime.getFunction(pOnOpenCallbackPtr);
		const onMessageCallback = GodotRuntime.getFunction(
			pOnMessageCallbackPtr,
		);
		const onErrorCallback = GodotRuntime.getFunction(pOnErrorCallbackPtr);
		const onCloseCallback = GodotRuntime.getFunction(pOnCloseCallbackPtr);

		const onOpen: Parameters<typeof GodotRTCDataChannel.connect>[1] =
			() => {
				onOpenCallback(pReference);
			};
		const onMessage: Parameters<typeof GodotRTCDataChannel.connect>[2] = (
			pOutPtr,
			pOutLength,
			pIsString,
		) => {
			onMessageCallback(
				pReference,
				pOutPtr,
				pOutLength,
				Number(pIsString),
			);
		};
		const onError: Parameters<typeof GodotRTCDataChannel.connect>[3] =
			() => {
				onErrorCallback(pReference);
			};
		const onClose: Parameters<typeof GodotRTCDataChannel.connect>[4] =
			() => {
				onCloseCallback(pReference);
			};

		GodotRTCDataChannel.connect(pId, onOpen, onMessage, onError, onClose);
	},

	godot_js_rtc_datachannel_close__proxy: "sync",
	godot_js_rtc_datachannel_close__sig: "vi",
	godot_js_rtc_datachannel_close: (pId: IDHandlerId): void => {
		const reference = IDHandler.get<RTCDataChannel>(pId);
		if (reference == null) {
			return;
		}
		GodotRTCDataChannel.close(pId);
	},
};
autoAddDeps(_GodotRTCDataChannel, "$GodotRTCDataChannel");
addToLibrary(_GodotRTCDataChannel);
