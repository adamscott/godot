/**************************************************************************/
/*  libwebrtc.ts                                                          */
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

type RTCDataChannelId = CIDHandlerId<RTCDataChannel>;
type RTCPeerConnectionId = CIDHandlerId<RTCPeerConnection>;

type RTCChOnOpen = (pObjectPtr: CVoidPointer) => void;
type RTCChOnMessage = (
	pObjectPtr: CVoidPointer,
	pBufferPtr: CUintPointer,
	pBufferSize: CInt,
	pIsString: CInt,
) => void;
type RTCChOnClose = (pObjectPtr: CVoidPointer) => void;
type RTCChOnError = (pObjectPtr: CVoidPointer) => void;

type RTCOnIceConnectionStateChange = (
	pReferencePtr: CVoidPointer,
	pState: CInt,
) => void;
type RTCOnIceGatheringStateChange = (
	pReferencePtr: CVoidPointer,
	pState: CInt,
) => void;
type RTCOnSignallingStateChange = (
	pReferencePtr: CVoidPointer,
	pState: CInt,
) => void;
type RTCOnIceCandidate = (
	pReferencePtr: CVoidPointer,
	pMidPtr: CCharPointer,
	pMLineIndex: CInt,
	pCandidatePtr: CCharPointer,
) => void;
type RTCOnDataChannel = (
	pReferencePtr: CVoidPointer,
	pId: CInt,
) => void;
type RTCOnSession = (
	pReferencePtr: CVoidPointer,
	pTypePtr: CCharPointer,
	pSdpPtr: CCharPointer,
) => void;
type RTCOnError = (
	pReferencePtr: CVoidPointer,
) => void;

export const _GodotRTCDataChannel = {
	// Our socket implementation that forwards events to C++.
	$GodotRTCDataChannel__deps: [
		"$IDHandler",
		"$GodotRuntime",
		"$GodotEventListeners",
	],
	$GodotRTCDataChannel: {
		MAX_UNSIGNED_SHORT: (1 << 16) - 1,

		connect: (
			pId: RTCDataChannelId,
			pOnOpen: () => void,
			pOnMessage: (
				pOutPtr: CUintPointer,
				pOutLength: number,
				pIsString: boolean,
			) => void,
			pOnError: () => void,
			pOnClose: () => void,
		): void => {
			const dataChannel = IDHandler.get(pId);
			if (dataChannel == null) {
				return;
			}

			dataChannel.binaryType = "arraybuffer";

			GodotEventListeners.add(
				dataChannel,
				"open",
				(_pEvent: RTCDataChannelEvent) => {
					pOnOpen();
				},
			);
			GodotEventListeners.add(
				dataChannel,
				"error",
				(_pEvent: RTCErrorEvent) => {
					pOnError();
				},
			);
			GodotEventListeners.add(dataChannel, "close", (_pEvent: Event) => {
				pOnClose();
			});
			GodotEventListeners.add(
				dataChannel,
				"message",
				(pEvent: MessageEvent) => {
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

					const outPtr = GodotRuntime.malloc(buffer.byteLength);
					HEAPU8.set(buffer, outPtr);
					pOnMessage(
						outPtr as CUintPointer,
						buffer.byteLength,
						isString,
					);
					GodotRuntime.free(outPtr);
				},
			);
		},

		close: (pId: RTCDataChannelId): void => {
			const dataChannel = IDHandler.get(pId);
			if (dataChannel == null) {
				return;
			}
			GodotEventListeners.remove(dataChannel);
			dataChannel.close();
		},

		getProperty: <T extends keyof RTCDataChannel, U>(
			pId: RTCDataChannelId,
			pProperty: T,
			pDefault: U,
		): RTCDataChannel[T] | U => {
			const dataChannel = IDHandler.get(pId);
			if (dataChannel == null) {
				return pDefault;
			}
			const value = dataChannel[pProperty];
			if (typeof value === "undefined") {
				return pDefault;
			}
			return value as Exclude<RTCDataChannel[T], undefined>;
		},
	},

	godot_js_rtc_datachannel_ready_state_get__proxy: "sync",
	godot_js_rtc_datachannel_ready_state_get__sig: "ii",
	godot_js_rtc_datachannel_ready_state_get: (pId: RTCDataChannelId): CInt => {
		const dataChannel = IDHandler.get(pId);
		if (dataChannel == null) {
			return 3 as CInt;
		}

		switch (dataChannel.readyState) {
			case "connecting":
				return 0 as CInt;
			case "open":
				return 1 as CInt;
			case "closing":
				return 2 as CInt;
			case "closed":
			default:
				return 3 as CInt;
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
			return GodotRuntime.status.FAILED;
		}

		const bytesArray = new Uint8Array(pBufferLength);
		for (let i = 0; i < pBufferLength; i++) {
			bytesArray[i] = GodotRuntime.getHeapValue(
				(pBufferPtr + i) as CUintPointer,
				"u8",
			);
		}

		const raw = Boolean(pRaw);
		if (raw) {
			dataChannel.send(bytesArray.buffer);
			return GodotRuntime.status.OK;
		}

		const decodedString = new TextDecoder().decode(bytesArray);
		dataChannel.send(decodedString);
		return GodotRuntime.status.OK;
	},

	godot_js_rtc_datachannel_is_ordered__proxy: "sync",
	godot_js_rtc_datachannel_is_ordered__sig: "ii",
	godot_js_rtc_datachannel_is_ordered: (pId: RTCDataChannelId): CInt => {
		return Number(
			GodotRTCDataChannel.getProperty(pId, "ordered", true),
		) as CInt;
	},

	godot_js_rtc_datachannel_id_get__proxy: "sync",
	godot_js_rtc_datachannel_id_get__sig: "ii",
	godot_js_rtc_datachannel_id_get: (pId: RTCDataChannelId): CInt => {
		// TODO: Validate what to do when `id === null`.
		return Number(GodotRTCDataChannel.getProperty(
			pId,
			"id",
			GodotRTCDataChannel.MAX_UNSIGNED_SHORT,
		)) as CInt;
	},

	godot_js_rtc_datachannel_max_packet_lifetime_get__proxy: "sync",
	godot_js_rtc_datachannel_max_packet_lifetime_get__sig: "ii",
	godot_js_rtc_datachannel_max_packet_lifetime_get: (
		pId: RTCDataChannelId,
	): CInt => {
		// TODO: Check if it's ok to remove "maxRetransmitTime".
		// TODO: Validate what to do when `id === null`.
		return Number(
			GodotRTCDataChannel.getProperty(
				pId,
				"maxPacketLifeTime",
				GodotRTCDataChannel.MAX_UNSIGNED_SHORT,
			),
		) as CInt;
	},

	godot_js_rtc_datachannel_max_retransmits_get__proxy: "sync",
	godot_js_rtc_datachannel_max_retransmits_get__sig: "ii",
	godot_js_rtc_datachannel_max_retransmits_get: (
		pId: RTCDataChannelId,
	): CInt => {
		return Number(
			GodotRTCDataChannel.getProperty(
				pId,
				"maxRetransmits",
				GodotRTCDataChannel.MAX_UNSIGNED_SHORT,
			),
		) as CInt;
	},

	godot_js_rtc_datachannel_is_negotiated__proxy: "sync",
	godot_js_rtc_datachannel_is_negotiated__sig: "ii",
	godot_js_rtc_datachannel_is_negotiated: (
		pId: RTCDataChannelId,
	): CInt => {
		return Number(
			GodotRTCDataChannel.getProperty(
				pId,
				"negotiated",
				GodotRTCDataChannel.MAX_UNSIGNED_SHORT,
			),
		) as CInt;
	},

	godot_js_rtc_datachannel_get_buffered_amount__proxy: "sync",
	godot_js_rtc_datachannel_get_buffered_amount__sig: "ii",
	godot_js_rtc_datachannel_get_buffered_amount: (
		pId: RTCDataChannelId,
	): CInt => {
		return Number(
			GodotRTCDataChannel.getProperty(
				pId,
				"bufferedAmount",
				GodotRTCDataChannel.MAX_UNSIGNED_SHORT,
			),
		) as CInt;
	},

	godot_js_rtc_datachannel_label_get__proxy: "sync",
	godot_js_rtc_datachannel_label_get__sig: "pi",
	godot_js_rtc_datachannel_label_get: (
		pId: RTCDataChannelId,
	): CCharPointer => {
		const reference = IDHandler.get(pId);
		if (reference?.label == null) {
			return GodotRuntime.NULLPTR as CCharPointer;
		}
		return GodotRuntime.allocString(reference.label);
	},

	godot_js_rtc_datachannel_protocol_get__proxy: "sync",
	godot_js_rtc_datachannel_protocol_get__sig: "pi",
	godot_js_rtc_datachannel_protocol_get: (
		pId: RTCDataChannelId,
	): CCharPointer => {
		const dataChannel = IDHandler.get(pId);
		if (dataChannel?.protocol == null) {
			return GodotRuntime.NULLPTR as CCharPointer;
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
		const onOpenCallback = GodotRuntime.getFunction(
			pOnOpenCallbackPtr,
		);
		const onMessageCallback = GodotRuntime.getFunction(
			pOnMessageCallbackPtr,
		);
		const onErrorCallback = GodotRuntime.getFunction(
			pOnErrorCallbackPtr,
		);
		const onCloseCallback = GodotRuntime.getFunction(
			pOnCloseCallbackPtr,
		);

		const onOpen: Parameters<typeof GodotRTCDataChannel.connect>[1] =
			() => {
				onOpenCallback(pObjectPtr);
			};
		const onMessage: Parameters<typeof GodotRTCDataChannel.connect>[2] = (
			pOutPtr,
			pOutLength,
			pIsString,
		) => {
			onMessageCallback(
				pObjectPtr,
				pOutPtr,
				pOutLength as CInt,
				Number(pIsString) as CInt,
			);
		};
		const onError: Parameters<typeof GodotRTCDataChannel.connect>[3] =
			() => {
				onErrorCallback(pObjectPtr);
			};
		const onClose: Parameters<typeof GodotRTCDataChannel.connect>[4] =
			() => {
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

const ConnectionState = Object.freeze({
	new: 0,
	connecting: 1,
	connected: 2,
	disconnected: 3,
	failed: 4,
	closed: 5,
});
type ConnectionStateValues =
	(typeof ConnectionState)[keyof typeof ConnectionState];

const ConnectionStateCompat = Object.freeze({
	// Using values from IceConnectionState for browsers that do not support ConnectionState (notably Firefox).
	// TODO: Refactor this code as it is supported by Firefox since May 8, 2023.
	//       See https://caniuse.com/mdn-api_rtcpeerconnection_connectionstate
	new: 0,
	checking: 1,
	connected: 2,
	completed: 2,
	disconnected: 3,
	failed: 4,
	closed: 5,
});

const IceGatheringState = Object.freeze({
	new: 0,
	gathering: 1,
	complete: 2,
});
type IceGatheringStateValues =
	(typeof IceGatheringState)[keyof typeof IceGatheringState];

const SignalingState = Object.freeze({
	stable: 0,
	"have-local-offer": 1,
	"have-remote-offer": 2,
	"have-local-pranswer": 3,
	"have-remote-pranswer": 4,
	closed: 5,
});
type SignalingStateValues =
	(typeof SignalingState)[keyof typeof SignalingState];

export const _GodotRTCPeerConnection = {
	// Our socket implementation that forwards events to C++.
	$GodotRTCPeerConnection__deps: [
		"$IDHandler",
		"$GodotRuntime",
		"$GodotRTCDataChannel",
		"$GodotEventListeners",
	],
	$GodotRTCPeerConnection: {
		ConnectionState,
		ConnectionStateCompat,
		IceGatheringState,
		SignalingState,

		create: (
			pConfig: RTCConfiguration,
			pOnConnectionChange: (
				pConnectionState: ConnectionStateValues,
			) => void,
			pOnSignalingChange: (pSignalingState: SignalingStateValues) => void,
			pOnIceGatheringChange: (
				pIceGatheringState: IceGatheringStateValues,
			) => void,
			pOnIceCandidate: (
				pMidPtr: CCharPointer,
				pMLineIndex: number,
				pCandidatePtr: CCharPointer,
			) => void,
			pOnDataChannel: (pId: number) => void,
		): number => {
			let connection = null as RTCPeerConnection | null;
			try {
				connection = new RTCPeerConnection(pConfig);
			} catch (error) {
				GodotRuntime.error(
					"Error while establishing RTCPeerConnection",
					error,
				);
				return 0;
			}

			const id = IDHandler.add(connection);

			if (connection.connectionState != null) {
				GodotEventListeners.add(
					connection,
					"connectionstatechange",
					(_pEvent: Event) => {
						if (IDHandler.get(id) == null) {
							return;
						}
						pOnConnectionChange(
							GodotRTCPeerConnection
								.ConnectionState[connection.connectionState] ??
								0,
						);
					},
				);
			} else {
				// Fallback to using "iceConnectionState" when "connectionState" is not supported (notably Firefox).
				// TODO: Refactor this code as it is supported by Firefox since May 8, 2023.
				//       See https://caniuse.com/mdn-api_rtcpeerconnection_connectionstate
				GodotEventListeners.add(
					connection,
					"iceconnectionstatechange",
					(_pEvent: Event) => {
						if (IDHandler.get(id) == null) {
							return;
						}
						pOnConnectionChange(
							GodotRTCPeerConnection
								.ConnectionStateCompat[
									connection.iceConnectionState
								] ?? 0,
						);
					},
				);
			}

			GodotEventListeners.add(
				connection,
				"icegatheringstatechange",
				(_pEvent: Event) => {
					if (IDHandler.get(id) == null) {
						return;
					}
					pOnIceGatheringChange(
						GodotRTCPeerConnection
							.IceGatheringState[connection.iceGatheringState] ??
							0,
					);
				},
			);

			GodotEventListeners.add(
				connection,
				"signalingstatechange",
				(_pEvent: Event) => {
					if (IDHandler.get(id) == null) {
						return;
					}
					pOnSignalingChange(
						GodotRTCPeerConnection
							.SignalingState[connection.signalingState] ??
							0,
					);
				},
			);

			GodotEventListeners.add(
				connection,
				"icecandidate",
				(pEvent: RTCPeerConnectionIceEvent) => {
					if (IDHandler.get(id) == null) {
						return;
					}
					if (pEvent.candidate == null) {
						return;
					}

					const candidate = pEvent.candidate;

					if (
						candidate.sdpMid == null ||
						candidate.sdpMLineIndex == null
					) {
						// TODO: Validate returning here.
						return;
					}

					const candidatePtr = GodotRuntime.allocString(
						candidate.candidate,
					);
					const midPtr = GodotRuntime.allocString(candidate.sdpMid);
					pOnIceCandidate(
						midPtr,
						candidate.sdpMLineIndex,
						candidatePtr,
					);
					GodotRuntime.free(candidatePtr);
					GodotRuntime.free(midPtr);
				},
			);

			GodotEventListeners.add(
				connection,
				"datachannel",
				(pEvent: RTCDataChannelEvent) => {
					if (IDHandler.get(id) == null) {
						return;
					}
					const cId = IDHandler.add(pEvent.channel);
					pOnDataChannel(cId);
				},
			);

			return id;
		},

		destroy: (pId: RTCPeerConnectionId): void => {
			const connection = IDHandler.get(pId);
			if (connection == null) {
				return;
			}
			GodotEventListeners.remove(connection);
			IDHandler.remove(pId);
		},

		onSession: (
			pId: RTCPeerConnectionId,
			pCallback: (pTypePtr: CCharPointer, pSdpPtr: CCharPointer) => void,
			pSessionDescription: RTCSessionDescriptionInit,
		): void => {
			if (IDHandler.get(pId) == null) {
				return;
			}
			const sessionTypePtr = GodotRuntime.allocString(
				pSessionDescription.type,
			);
			// TODO: Verify if this is the right thing to do, `?? ""`.
			const sessionSdpPtr = GodotRuntime.allocString(
				pSessionDescription.sdp ?? "",
			);
			pCallback(sessionTypePtr, sessionSdpPtr);
			GodotRuntime.free(sessionTypePtr);
			GodotRuntime.free(sessionSdpPtr);
		},

		onError: (
			pId: RTCPeerConnectionId,
			pCallback: () => void,
			pError: Error,
		): void => {
			if (IDHandler.get(pId) == null) {
				return;
			}
			GodotRuntime.error(pError);
			pCallback();
		},
	},

	godot_js_rtc_pc_create__proxy: "sync",
	godot_js_rtc_pc_create__sig: "ippiiiii",
	godot_js_rtc_pc_create: (
		pConfigPtr: CCharPointer,
		pReferencePtr: CVoidPointer,
		pOnConnectionStateChangePtr: CFunctionPointer<
			RTCOnIceConnectionStateChange
		>,
		pOnIceGatheringStateChangePtr: CFunctionPointer<
			RTCOnIceGatheringStateChange
		>,
		pOnSignalingStateChangePtr: CFunctionPointer<
			RTCOnSignallingStateChange
		>,
		pOnIceCandidatePtr: CFunctionPointer<RTCOnIceCandidate>,
		pOnDataChannelPtr: CFunctionPointer<RTCOnDataChannel>,
	): CInt => {
		const onConnectionStateChange = GodotRuntime.getFunction(
			pOnConnectionStateChangePtr,
		);
		const onIceGatheringStateChange = GodotRuntime.getFunction(
			pOnIceGatheringStateChangePtr,
		);
		const onSignalingStateChange = GodotRuntime.getFunction(
			pOnSignalingStateChangePtr,
		);
		const onIceCandidate = GodotRuntime.getFunction(pOnIceCandidatePtr);
		const onDataChannel = GodotRuntime.getFunction(pOnDataChannelPtr);

		return GodotRTCPeerConnection.create(
			JSON.parse(GodotRuntime.parseString(pConfigPtr)),
			(pConnectionState) => {
				onConnectionStateChange(
					pReferencePtr,
					pConnectionState as CInt,
				);
			},
			(pSignalingState) => {
				onSignalingStateChange(pReferencePtr, pSignalingState as CInt);
			},
			(pIceGatheringState) => {
				onIceGatheringStateChange(
					pReferencePtr,
					pIceGatheringState as CInt,
				);
			},
			(pMidPtr, pMLineIndex, pCandidatePtr) => {
				onIceCandidate(
					pReferencePtr,
					pMidPtr,
					pMLineIndex as CInt,
					pCandidatePtr,
				);
			},
			(pId) => {
				onDataChannel(pReferencePtr, pId as CInt);
			},
		) as CInt;
	},

	godot_js_rtc_pc_close__proxy: "sync",
	godot_js_rtc_pc_close__sig: "vi",
	godot_js_rtc_pc_close: function (pId: RTCPeerConnectionId) {
		const connection = IDHandler.get(pId);
		connection?.close();
	},

	godot_js_rtc_pc_destroy__proxy: "sync",
	godot_js_rtc_pc_destroy__sig: "vi",
	godot_js_rtc_pc_destroy: (pId: RTCPeerConnectionId): void => {
		GodotRTCPeerConnection.destroy(pId);
	},

	godot_js_rtc_pc_offer_create__proxy: "sync",
	godot_js_rtc_pc_offer_create__sig: "vippp",
	godot_js_rtc_pc_offer_create: (
		pId: RTCPeerConnectionId,
		pReferencePtr: CVoidPointer,
		pOnSessionCallbackPtr: CFunctionPointer<RTCOnSession>,
		pOnErrorCallbackPtr: CFunctionPointer<RTCOnError>,
	): void => {
		const connection = IDHandler.get(pId);
		if (connection == null) {
			return;
		}
		const onSessionCallback = GodotRuntime.getFunction(
			pOnSessionCallbackPtr,
		);
		const onErrorCallback = GodotRuntime.getFunction(pOnErrorCallbackPtr);
		connection.createOffer().then(function (pSession) {
			GodotRTCPeerConnection.onSession(pId, (pTypePtr, pSdpPtr) => {
				onSessionCallback(pReferencePtr, pTypePtr, pSdpPtr);
			}, pSession);
		}).catch(function (error) {
			GodotRTCPeerConnection.onError(pId, () => {
				onErrorCallback(pReferencePtr);
			}, error);
		});
	},

	godot_js_rtc_pc_local_description_set__proxy: "sync",
	godot_js_rtc_pc_local_description_set__sig: "vipppp",
	godot_js_rtc_pc_local_description_set: (
		pId: RTCPeerConnectionId,
		pTypePtr: CCharPointer,
		pSdpPtr: CCharPointer,
		pReferencePtr: CVoidPointer,
		pOnErrorCallbackPtr: CFunctionPointer<RTCOnError>,
	): void => {
		const connection = IDHandler.get(pId);
		if (connection == null) {
			return;
		}
		const connectionType = GodotRuntime.parseString(pTypePtr) as RTCSdpType;
		const connectionSdp = GodotRuntime.parseString(pSdpPtr);
		const onErrorCallback = GodotRuntime.getFunction(pOnErrorCallbackPtr);
		connection.setLocalDescription({
			sdp: connectionSdp,
			type: connectionType,
		}).catch((pError) => {
			GodotRTCPeerConnection.onError(
				pId,
				() => onErrorCallback(pReferencePtr),
				pError,
			);
		});
	},

	godot_js_rtc_pc_remote_description_set__proxy: "sync",
	godot_js_rtc_pc_remote_description_set__sig: "vippppp",
	godot_js_rtc_pc_remote_description_set: (
		pId: RTCPeerConnectionId,
		pTypePtr: CCharPointer,
		pSdpPtr: CCharPointer,
		pReferencePtr: CVoidPointer,
		pOnSessionCreatedCallbackPtr: CFunctionPointer<RTCOnSession>,
		pOnErrorCallbackPtr: CFunctionPointer<RTCOnError>,
	): void => {
		const connection = IDHandler.get(pId);
		if (connection == null) {
			return;
		}
		const connectionType = GodotRuntime.parseString(pTypePtr);
		const connectionSdp = GodotRuntime.parseString(pSdpPtr) as RTCSdpType;
		const onErrorCallback = GodotRuntime.getFunction(pOnErrorCallbackPtr);
		const onSessionCallback = GodotRuntime.getFunction(
			pOnSessionCreatedCallbackPtr,
		);
		connection.setRemoteDescription({
			sdp: connectionSdp,
			type: connectionType as RTCSdpType,
		}).then(async () => {
			if (connectionType !== "offer") {
				return;
			}
			const session = await connection.createAnswer();
			GodotRTCPeerConnection.onSession(
				pId,
				(pSessionTypePtr, pSessionSdbPtr) => {
					onSessionCallback(
						pReferencePtr,
						pSessionTypePtr,
						pSessionSdbPtr,
					);
				},
				session,
			);
		}).catch(function (error) {
			GodotRTCPeerConnection.onError(
				pId,
				() => onErrorCallback(pReferencePtr),
				error,
			);
		});
	},

	godot_js_rtc_pc_ice_candidate_add__proxy: "sync",
	godot_js_rtc_pc_ice_candidate_add__sig: "vipip",
	godot_js_rtc_pc_ice_candidate_add: (
		pId: RTCPeerConnectionId,
		pMidNamePtr: CCharPointer,
		pMLineIndex: CInt,
		pSdpPtr: CCharPointer,
	): void => {
		const connection = IDHandler.get(pId);
		if (connection == null) {
			return;
		}
		const sdpMidName = GodotRuntime.parseString(pMidNamePtr);
		const sdpName = GodotRuntime.parseString(pSdpPtr);
		connection.addIceCandidate(
			new RTCIceCandidate({
				candidate: sdpName,
				sdpMid: sdpMidName,
				sdpMLineIndex: pMLineIndex,
			}),
		);
	},

	godot_js_rtc_pc_datachannel_create__deps: ["$GodotRTCDataChannel"],
	godot_js_rtc_pc_datachannel_create__proxy: "sync",
	godot_js_rtc_pc_datachannel_create__sig: "iiii",
	godot_js_rtc_pc_datachannel_create: (
		pId: RTCPeerConnectionId,
		pLabelPtr: CCharPointer,
		pConfigPtr: CCharPointer,
	): RTCDataChannelId => {
		try {
			const connection = IDHandler.get(pId);
			if (connection == null) {
				return 0 as RTCDataChannelId;
			}

			const label = GodotRuntime.parseString(pLabelPtr);
			const config = JSON.parse(GodotRuntime.parseString(pConfigPtr));

			const channel = connection.createDataChannel(label, config);
			return IDHandler.add(channel);
		} catch (error) {
			GodotRuntime.error(error);
			return 0 as RTCDataChannelId;
		}
	},
};
autoAddDeps(_GodotRTCPeerConnection, "$GodotRTCPeerConnection");
addToLibrary(_GodotRTCPeerConnection);
