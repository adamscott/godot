/**************************************************************************/
/*  godot_websocket.ts                                                    */
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

type WebSocketId = CIDHandlerId<WebSocket>;

type WebSocketOnOpenCCallback = (pReferencePtr: CVoidPointer, pProtocolPtr: CCharPointer) => void;
type WebSocketOnMessageCCallback = (
	pReferencePtr: CVoidPointer,
	pBufferPtr: CUintPointer,
	pBufferLength: CInt,
	pIsString: CInt,
) => void;
type WebSocketOnCloseCCallback = (
	pReferencePtr: CVoidPointer,
	pCode: CInt,
	pReasonPtr: CCharPointer,
	pIsClean: CInt,
) => void;
type WebSocketOnErrorCCallback = (pReferencePtr: CVoidPointer) => void;

type OnOpenCallback = (pProtocol: string) => void;
type OnMessageCallback = (pBuffer: Uint8Array, pIsString: boolean) => void;
type OnErrorCallback = () => void;
type OnCloseCallback = (pCode: number, pReason: string, pWasClean: boolean) => void;

// Connection opened, report selected protocol.
function _godotWebSocketOnOpen(pId: WebSocketId, pCallback: OnOpenCallback, _pEvent: Event): void {
	const webSocket = IDHandler.get(pId);
	if (webSocket == null) {
		return;
	}
	pCallback(webSocket.protocol);
}

// Message received, report content and type (UTF8 vs binary).
function _godotWebSocketOnMessage(pId: WebSocketId, pCallback: OnMessageCallback, pEvent: MessageEvent): void {
	const webSocket = IDHandler.get(pId);
	if (webSocket == null) {
		return; // Godot object is gone.
	}

	// eslint-disable-next-line @typescript-eslint/init-declarations -- We're covering every case.
	let buffer: Uint8Array;
	let isString = false;
	if (pEvent.data instanceof ArrayBuffer) {
		buffer = new Uint8Array(pEvent.data);
	} else if (pEvent.data instanceof Blob) {
		GodotRuntime.error("Blob type not supported");
		return;
	} else if (typeof pEvent.data === "string") {
		isString = true;
		// TextEncoder constructor doesn't take arguments since Firefox 48 and Chrome 53.
		buffer = new TextEncoder().encode(pEvent.data);
	} else {
		GodotRuntime.error("Unknown message type");
		return;
	}

	pCallback(buffer, isString);
}

// An error happened, '_onClose' will be called after this.
function _godotWebSocketOnError(pId: WebSocketId, pCallback: OnErrorCallback, _pEvent: Event): void {
	const reference = IDHandler.get(pId);
	if (reference == null) {
		return;
	}
	pCallback();
}

// Connection is closed, this is always fired. Report close code, reason, and clean status.
function _godotWebSocketOnClose(pId: WebSocketId, pCallback: OnCloseCallback, pEvent: CloseEvent): void {
	const webSocket = IDHandler.get(pId);
	if (webSocket == null) {
		return;
	}
	pCallback(pEvent.code, pEvent.reason, pEvent.wasClean);
}

// Send a message.
function _godotWebSocketSend(pId: WebSocketId, pData: Parameters<WebSocket["send"]>[0]): boolean {
	const webSocket = IDHandler.get(pId);
	if (webSocket == null) {
		return false;
	}
	if (webSocket.readyState !== WebSocket.OPEN) {
		return false;
	}
	webSocket.send(pData);
	return true;
}

// Get current bufferedAmount.
function _godotWebSocketBufferedAmount(pId: WebSocketId): number {
	const webSocket = IDHandler.get(pId);
	if (webSocket == null) {
		return 0; // Godot object is gone.
	}
	return webSocket.bufferedAmount;
}

function _godotWebSocketCreate(
	pWebSocket: WebSocket,
	pOnOpen: OnOpenCallback,
	pOnMessage: OnMessageCallback,
	pOnError: OnErrorCallback,
	pOnClose: OnCloseCallback,
): WebSocketId {
	const id = IDHandler.add(pWebSocket);

	GodotEventListeners.add(pWebSocket, "open", (pEvent) => {
		GodotWebSocket._onOpen(id, pOnOpen, pEvent);
	});

	GodotEventListeners.add(pWebSocket, "message", (pEvent) => {
		GodotWebSocket._onMessage(id, pOnMessage, pEvent);
	});

	GodotEventListeners.add(pWebSocket, "error", (pEvent) => {
		GodotWebSocket._onError(id, pOnError, pEvent);
	});

	GodotEventListeners.add(pWebSocket, "close", (pEvent) => {
		GodotWebSocket._onClose(id, pOnClose, pEvent);
	});

	return id;
}

// Closes the JavaScript WebSocket (if not already closing) associated to a given C++ object.
function _godotWebSocketClose(pId: WebSocketId, pCode: number, pReason: string): void {
	const webSocket = IDHandler.get(pId);
	if (webSocket == null) {
		return;
	}
	if (webSocket.readyState >= WebSocket.CLOSING) {
		return;
	}
	webSocket.close(pCode, pReason);
}

// Deletes the reference to a C++ object (closing any connected socket if necessary).
function _godotWebSocketDestroy(pId: WebSocketId): void {
	const webSocket = IDHandler.get(pId);
	if (webSocket == null) {
		return;
	}
	GodotWebSocket.close(pId, 3001, "destroyed");
	IDHandler.remove(pId);
	GodotEventListeners.remove(webSocket);
}

export const _GodotWebSocket = {
	// Our socket implementation that forwards events to C++.
	$GodotWebSocket__deps: ["$IDHandler", "$GodotRuntime", "$UTF8Decoder"] as const,
	$GodotWebSocket: {
		_onOpen: _godotWebSocketOnOpen,
		_onMessage: _godotWebSocketOnMessage,
		_onError: _godotWebSocketOnError,
		_onClose: _godotWebSocketOnClose,

		send: _godotWebSocketSend,
		bufferedAmount: _godotWebSocketBufferedAmount,

		create: _godotWebSocketCreate,
		close: _godotWebSocketClose,
		destroy: _godotWebSocketDestroy,
	},

	godot_js_websocket_create__proxy: "sync",
	godot_js_websocket_create__sig: "ippppppp",
	godot_js_websocket_create: (
		pReferencePtr: CVoidPointer,
		pUrlPtr: CCharPointer,
		pProtoPtr: CCharPointer,
		pOnOpenCCallbackPtr: CFunctionPointer<WebSocketOnOpenCCallback>,
		pOnMessageCCallbackPtr: CFunctionPointer<WebSocketOnMessageCCallback>,
		pOnErrorCCallbackPtr: CFunctionPointer<WebSocketOnErrorCCallback>,
		pOnCloseCCallbackPtr: CFunctionPointer<WebSocketOnCloseCCallback>,
	): CInt => {
		const onOpenCCallback = GodotRuntime.getFunction(pOnOpenCCallbackPtr);
		const onOpenCallback: OnOpenCallback = () => {
			onOpenCCallback(pReferencePtr, pProtoPtr);
		};

		const onMessageCCallback = GodotRuntime.getFunction(pOnMessageCCallbackPtr);
		const onMessageCallback: OnMessageCallback = (pBuffer, pIsString) => {
			const bufferPtr = GodotRuntime.malloc<CUintPointer>(pBuffer.byteLength);
			HEAPU8.set(pBuffer, bufferPtr);
			onMessageCCallback(
				pReferencePtr,
				bufferPtr,
				GodotRuntime.asCInt(pBuffer.byteLength),
				GodotRuntime.asCIntBoolean(pIsString),
			);
		};

		const onErrorCCallback = GodotRuntime.getFunction(pOnErrorCCallbackPtr);
		const onErrorCallback: OnErrorCallback = () => {
			onErrorCCallback(pReferencePtr);
		};

		const onCloseCCallback = GodotRuntime.getFunction(pOnCloseCCallbackPtr);
		const onCloseCallback: OnCloseCallback = (pCode, pReason, pWasClean) => {
			const reasonPtr = GodotRuntime.allocString(pReason);
			onCloseCCallback(
				pReferencePtr,
				GodotRuntime.asCInt(pCode),
				reasonPtr,
				GodotRuntime.asCIntBoolean(pWasClean),
			);
			GodotRuntime.free(reasonPtr);
		};

		const url = GodotRuntime.parseString(pUrlPtr);
		const proto = GodotRuntime.parseString(pProtoPtr);
		// eslint-disable-next-line @typescript-eslint/init-declarations -- We initialize `socket` in the try/catch.
		let socket: WebSocket;
		try {
			if (proto === "") {
				socket = new WebSocket(url);
			} else {
				socket = new WebSocket(url, proto.split(","));
			}
		} catch (_eError: unknown) {
			return GodotRuntime.asCInt(0);
		}
		socket.binaryType = "arraybuffer";
		return GodotRuntime.asCInt(
			GodotWebSocket.create(socket, onOpenCallback, onMessageCallback, onErrorCallback, onCloseCallback),
		);
	},

	godot_js_websocket_send__proxy: "sync",
	godot_js_websocket_send__sig: "iipii",
	godot_js_websocket_send: (pId: WebSocketId, pBufferPtr: CUintPointer, pBufferLength: CInt, pRaw: CInt): CInt => {
		// UTF8Decoder();
		let out: Uint8Array<ArrayBuffer> | string = GodotRuntime.heapSlice(HEAPU8, pBufferPtr, pBufferLength);

		// eslint-disable-next-line no-extra-boolean-cast -- Cyclic rules (one rule's fix triggers another rule), chose to disable this one.
		if (!Boolean(pRaw as number)) {
			out = UTF8Decoder.decode(out);
		}
		return GodotRuntime.asCIntBoolean(GodotWebSocket.send(pId, out));
	},

	godot_js_websocket_buffered_amount__proxy: "sync",
	godot_js_websocket_buffered_amount__sig: "ii",
	godot_js_websocket_buffered_amount: (pId: WebSocketId): CInt => {
		return GodotRuntime.asCInt(GodotWebSocket.bufferedAmount(pId));
	},

	godot_js_websocket_close__proxy: "sync",
	godot_js_websocket_close__sig: "viip",
	godot_js_websocket_close: (pId: WebSocketId, pCode: CInt, pReasonPtr: CCharPointer): void => {
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
