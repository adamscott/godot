/**************************************************************************/
/*  libwebsocket.ts                                                       */
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

import {
	CCharPointer,
	CFunctionPointer,
	CIDHandlerId,
	CInt,
	CUintPointer,
	CVoidPointer,
} from "+platform-web-emscripten/libraries";

type WebSocketId = CIDHandlerId<WebSocket>;

type WSOnOpen = (
	pReferencePtr: CVoidPointer,
	pProtocolPtr: CCharPointer,
) => void;
type WSOnMessage = (
	pReferencePtr: CVoidPointer,
	pBufferPtr: CUintPointer,
	pBufferLength: CInt,
	pIsString: CInt,
) => void;
type WSOnClose = (
	pReferencePtr: CVoidPointer,
	pCode: CInt,
	pReasonPtr: CCharPointer,
	pIsClean: CInt,
) => void;
type WSOnError = (pReferencePtr: CVoidPointer) => void;

type OnOpenCallback = (pProtocolPtr: CCharPointer) => void;
type OnMessageCallback = (
	pBufferPtr: CUintPointer,
	pBufferLength: number,
	pIsString: boolean,
) => void;
type OnErrorCallback = () => void;
type OnCloseCallback = (
	pCode: number,
	pReasonPtr: CCharPointer,
	pWasClean: boolean,
) => void;

export const _GodotWebSocket = {
	// Our socket implementation that forwards events to C++.
	$GodotWebSocket__deps: ["$IDHandler", "$GodotRuntime"],
	$GodotWebSocket: {
		// Connection opened, report selected protocol
		_onOpen: (
			pId: WebSocketId,
			pCallback: OnOpenCallback,
			_pEvent: Event,
		): void => {
			const webSocket = IDHandler.get(pId);
			if (webSocket == null) {
				return;
			}
			const protocolPtr = GodotRuntime.allocString(
				webSocket.protocol,
			);
			pCallback(protocolPtr);
			GodotRuntime.free(protocolPtr);
		},

		_onMessage: (
			pId: WebSocketId,
			pCallback: OnMessageCallback,
			pEvent: MessageEvent,
		): void => {
			const webSocket = IDHandler.get(pId);
			if (webSocket == null) {
				return;
			}
			let buffer: Uint8Array;
			let isString = false;
			if (pEvent.data instanceof ArrayBuffer) {
				buffer = new Uint8Array(pEvent.data);
			} else if (pEvent.data instanceof Blob) {
				GodotRuntime.error("Blob type is not supported");
				return;
			} else if (typeof pEvent.data === "string") {
				isString = true;
				buffer = new Uint8Array(new TextEncoder().encode(pEvent.data));
			} else {
				GodotRuntime.error("Unknown message type");
				return;
			}

			const bufferPtr = GodotRuntime.malloc<CUintPointer>(
				buffer.byteLength,
			);
			HEAPU8.set(buffer, bufferPtr);
			pCallback(bufferPtr, buffer.byteLength, isString);
		},

		_onError: (
			pId: WebSocketId,
			pCallback: OnErrorCallback,
			_pEvent: Event,
		): void => {
			const reference = IDHandler.get(pId);
			if (reference == null) {
				return;
			}
			pCallback();
		},

		_onClose: (
			pId: WebSocketId,
			pCallback: OnCloseCallback,
			pEvent: CloseEvent,
		): void => {
			const webSocket = IDHandler.get(pId);
			if (webSocket == null) {
				return;
			}
			const reasonStringPtr = GodotRuntime.allocString(pEvent.reason);
			pCallback(pEvent.code, reasonStringPtr, pEvent.wasClean);
		},

		create: (
			pSocket: WebSocket,
			pOnOpen: OnOpenCallback,
			pOnMessage: OnMessageCallback,
			pOnError: OnErrorCallback,
			pOnClose: OnCloseCallback,
		): WebSocketId => {
			const id = IDHandler.add(pSocket);
			pSocket.onopen = (pEvent) => {
				GodotWebSocket._onOpen(id, pOnOpen, pEvent);
			};
			pSocket.onmessage = (pEvent) => {
				GodotWebSocket._onMessage(id, pOnMessage, pEvent);
			};
			pSocket.onerror = (pEvent) => {
				GodotWebSocket._onError(id, pOnError, pEvent);
			};
			pSocket.onclose = (pEvent) => {
				GodotWebSocket._onClose(id, pOnClose, pEvent);
			};
			return id;
		},

		getBufferedAmount: (pId: WebSocketId): number => {
			const webSocket = IDHandler.get(pId);
			if (webSocket == null) {
				// Godot object is gone.
				return 0;
			}
			return webSocket.bufferedAmount;
		},

		send: (
			pId: WebSocketId,
			pData: Parameters<WebSocket["send"]>[0],
		): boolean => {
			const webSocket = IDHandler.get(pId);
			if (webSocket == null) {
				return false;
			}
			if (webSocket.readyState !== WebSocket.OPEN) {
				// Godot object is gone or socket is not in a ready state.
				return false;
			}
			webSocket.send(pData);
			return true;
		},

		// Closes the JavaScript WebSocket (if not already closing) associated to a given C++ object.
		close: (pId: WebSocketId, pCode: number, pReason: string): void => {
			const webSocket = IDHandler.get(pId);
			if (webSocket == null) {
				return;
			}
			if (webSocket.readyState >= WebSocket.CLOSING) {
				return;
			}
			webSocket.close(pCode, pReason);
		},

		// Deletes the reference to a C++ object (closing any connected socket if necessary).
		destroy: (pId: WebSocketId): void => {
			const webSocket = IDHandler.get(pId);
			if (webSocket == null) {
				return;
			}
			GodotWebSocket.close(pId, 3001, "destroyed");

			IDHandler.remove(pId);
			webSocket.onopen = null;
			webSocket.onmessage = null;
			webSocket.onerror = null;
			webSocket.onclose = null;
		},
	},

	godot_js_websocket_create__proxy: "sync",
	godot_js_websocket_create__sig: "ippppppp",
	godot_js_websocket_create: (
		pReferencePtr: CVoidPointer,
		pUrlPtr: CCharPointer,
		pProtoPtr: CCharPointer,
		pOnOpenCallbackPtr: CFunctionPointer<WSOnOpen>,
		pOnMessageCallbackPtr: CFunctionPointer<WSOnMessage>,
		pOnErrorCallbackPtr: CFunctionPointer<WSOnError>,
		pOnCloseCallbackPtr: CFunctionPointer<WSOnClose>,
	): CInt => {
		const onOpenCallback = GodotRuntime.getFunction(pOnOpenCallbackPtr);
		const onMessageCallback = GodotRuntime.getFunction(
			pOnMessageCallbackPtr,
		);
		const onErrorCallback = GodotRuntime.getFunction(pOnErrorCallbackPtr);
		const onCloseCallback = GodotRuntime.getFunction(pOnCloseCallbackPtr);

		const url = GodotRuntime.parseString(pUrlPtr);
		const proto = GodotRuntime.parseString(pProtoPtr);
		let socket: WebSocket;
		try {
			if (proto == null) {
				socket = new WebSocket(url);
			} else {
				socket = new WebSocket(url, proto.split(","));
			}
		} catch (_error) {
			return 0 as CInt;
		}
		socket.binaryType = "arraybuffer";

		const onOpen: OnOpenCallback = (pProtocolPtr) => {
			onOpenCallback(pReferencePtr, pProtocolPtr);
		};
		const onMessage: OnMessageCallback = (
			pBufferPtr,
			pBufferLength,
			pIsString,
		) => {
			onMessageCallback(
				pReferencePtr,
				pBufferPtr,
				pBufferLength as CInt,
				Number(pIsString) as CInt,
			);
		};
		const onError: OnErrorCallback = () => {
			onErrorCallback(pReferencePtr);
		};
		const onClose: OnCloseCallback = (pCode, pReasonPtr, pWasClean) => {
			onCloseCallback(
				pReferencePtr,
				pCode as CInt,
				pReasonPtr,
				Number(pWasClean) as CInt,
			);
		};

		return GodotWebSocket.create(
			socket,
			onOpen,
			onMessage,
			onError,
			onClose,
		) as CInt;
	},

	godot_js_websocket_send__proxy: "sync",
	godot_js_websocket_send__sig: "iipii",
	godot_js_websocket_send: (
		pId: WebSocketId,
		pBufferPtr: CUintPointer,
		pBufferLength: CInt,
		pRaw: CInt,
	): CInt => {
		const bytesArray = new Uint8Array(pBufferLength);
		for (let i = 0; i < pBufferLength; i++) {
			bytesArray[i] = GodotRuntime.getHeapValue(
				(pBufferPtr + i) as CUintPointer,
				"u8",
			);
		}
		let outBuffer: ArrayBuffer | string = bytesArray.buffer;
		if (!pRaw) {
			outBuffer = new TextDecoder().decode(bytesArray);
		}
		// It expects the OK/FAILED format.
		return Number(!GodotWebSocket.send(pId, outBuffer)) as CInt;
	},

	godot_js_websocket_buffered_amount__proxy: "sync",
	godot_js_websocket_buffered_amount__sig: "ii",
	godot_js_websocket_buffered_amount: (pId: WebSocketId): CInt => {
		return GodotWebSocket.getBufferedAmount(pId) as CInt;
	},

	godot_js_websocket_close__proxy: "sync",
	godot_js_websocket_close__sig: "viip",
	godot_js_websocket_close: (
		pId: WebSocketId,
		pCode: CInt,
		pReasonPtr: CCharPointer,
	): void => {
		const reason = GodotRuntime.parseString(pReasonPtr);
		GodotWebSocket.close(pId, pCode, reason);
	},

	godot_js_websocket_destroy__proxy: "sync",
	godot_js_websocket_destroy__sig: "vi",
	godot_js_websocket_destroy: (pId: WebSocketId): void => {
		GodotWebSocket.destroy(pId);
	},
};
autoAddDeps(_GodotWebSocket, "$GodotWebSocket");
addToLibrary(_GodotWebSocket);
