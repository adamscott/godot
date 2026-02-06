/**************************************************************************/
/*  godot_rtc_peer_connection.ts                                          */
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
	CVoidPointer,
} from "@godotengine/emscripten-utils/types";

type RTCPeerConnectionId = CIDHandlerId<RTCPeerConnection>;

type RTCOnIceConnectionStateChange = (pReferencePtr: CVoidPointer, pState: CInt) => void;
type RTCOnIceGatheringStateChange = (pReferencePtr: CVoidPointer, pState: CInt) => void;
type RTCOnSignallingStateChange = (pReferencePtr: CVoidPointer, pState: CInt) => void;
type RTCOnIceCandidate = (
	pReferencePtr: CVoidPointer,
	pMidPtr: CCharPointer,
	pMLineIndex: CInt,
	pCandidatePtr: CCharPointer,
) => void;
type RTCOnDataChannel = (pReferencePtr: CVoidPointer, pId: CInt) => void;
type RTCOnSession = (pReferencePtr: CVoidPointer, pTypePtr: CCharPointer, pSdpPtr: CCharPointer) => void;
type RTCOnError = (pReferencePtr: CVoidPointer) => void;

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- `GodotRuntime` is not available yet. */
const _godotRtcPeerConnectionConnectionState = {
	new: 0 as CInt,
	connecting: 1 as CInt,
	connected: 2 as CInt,
	disconnected: 3 as CInt,
	failed: 4 as CInt,
	closed: 5 as CInt,
} as const;
type ConnectionState = typeof _godotRtcPeerConnectionConnectionState;
type ConnectionStateValue = ConnectionState[keyof ConnectionState];

// Using values from IceConnectionState for browsers that do not support ConnectionState (notably Firefox).
const _godotRtcPeerConnectionConnectionStateCompat = {
	new: 0 as CInt,
	checking: 1 as CInt,
	connected: 2 as CInt,
	completed: 2 as CInt,
	disconnected: 3 as CInt,
	failed: 4 as CInt,
	closed: 5 as CInt,
} as const;
type _ConnectionStateCompat = typeof _godotRtcPeerConnectionConnectionStateCompat;

const _godotRtcPeerConnectionIceGatheringState = {
	new: 0 as CInt,
	gathering: 1 as CInt,
	complete: 2 as CInt,
} as const;
type IceGatheringState = typeof _godotRtcPeerConnectionIceGatheringState;
type IceGatheringStateValue = IceGatheringState[keyof IceGatheringState];

const _godotRtcPeerConnectionSignalingState = {
	stable: 0 as CInt,
	"have-local-offer": 1 as CInt,
	"have-remote-offer": 2 as CInt,
	"have-local-pranswer": 3 as CInt,
	"have-remote-pranswer": 4 as CInt,
	closed: 5 as CInt,
} as const;
type SignalingState = typeof _godotRtcPeerConnectionSignalingState;
type SignalingStateValue = SignalingState[keyof SignalingState];
/* eslint-enable @typescript-eslint/no-unsafe-type-assertion */

type CreateOnConnectionChangeCallback = (pConnectionState: ConnectionStateValue) => void;
type CreateOnSignalingChangeCallback = (pSignalingState: SignalingStateValue) => void;
type CreateOnIceGatheringChangeCallback = (pIceGatheringState: IceGatheringStateValue) => void;
type CreateOnIceCandidate = (pMidPtr: CCharPointer, pMLineIndex: number, pCandidatePtr: CCharPointer) => void;
type CreateOnDataChannel = (pId: number) => void;

function create(
	pConfig: RTCConfiguration,
	pOnConnectionChange: CreateOnConnectionChangeCallback,
	pOnSignalingChange: CreateOnSignalingChangeCallback,
	pOnIceGatheringChange: CreateOnIceGatheringChangeCallback,
	pOnIceCandidate: CreateOnIceCandidate,
	pOnDataChannel: CreateOnDataChannel,
): number {
	// eslint-disable-next-line @typescript-eslint/init-declarations -- We init in the try method.
	let connection: RTCPeerConnection;
	try {
		connection = new RTCPeerConnection(pConfig);
	} catch (error) {
		GodotRuntime.error("Error while establishing RTCPeerConnection", error);
		return 0;
	}

	const id = IDHandler.add(connection);

	// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- We want to be sure.
	if (connection.connectionState == null) {
		// Fallback to using "iceConnectionState" when "connectionState" is not supported (notably Firefox).
		// TODO: Refactor this code as it is supported by Firefox since May 8, 2023.
		//       See https://caniuse.com/mdn-api_rtcpeerconnection_connectionstate
		GodotEventListeners.add(connection, "iceconnectionstatechange", (_pEvent: Event) => {
			if (IDHandler.get(id) == null) {
				return;
			}
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- We really want to make sure.
			pOnConnectionChange(GodotRTCPeerConnection.ConnectionStateCompat[connection.iceConnectionState] ?? 0);
		});
	} else {
		GodotEventListeners.add(connection, "connectionstatechange", (_pEvent: Event) => {
			if (IDHandler.get(id) == null) {
				return;
			}
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- We really want to make sure.
			pOnConnectionChange(GodotRTCPeerConnection.ConnectionState[connection.connectionState] ?? 0);
		});
	}

	GodotEventListeners.add(connection, "icegatheringstatechange", (_pEvent: Event) => {
		if (IDHandler.get(id) == null) {
			return;
		}
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- We really want to make sure.
		pOnIceGatheringChange(GodotRTCPeerConnection.IceGatheringState[connection.iceGatheringState] ?? 0);
	});

	GodotEventListeners.add(connection, "signalingstatechange", (_pEvent: Event) => {
		if (IDHandler.get(id) == null) {
			return;
		}
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- We really want to make sure.
		pOnSignalingChange(GodotRTCPeerConnection.SignalingState[connection.signalingState] ?? 0);
	});

	GodotEventListeners.add(connection, "icecandidate", (pEvent: RTCPeerConnectionIceEvent) => {
		if (IDHandler.get(id) == null) {
			return;
		}

		const candidate = pEvent.candidate;
		if (candidate == null) {
			return;
		}

		if (candidate.sdpMid == null || candidate.sdpMLineIndex == null) {
			// TODO: Validate returning here.
			return;
		}

		const candidateStrPtr = GodotRuntime.allocString(candidate.candidate);
		const midPtr = GodotRuntime.allocString(candidate.sdpMid);
		pOnIceCandidate(midPtr, candidate.sdpMLineIndex, candidateStrPtr);
		GodotRuntime.free(candidateStrPtr);
		GodotRuntime.free(midPtr);
	});

	GodotEventListeners.add(connection, "datachannel", (pEvent: RTCDataChannelEvent) => {
		if (IDHandler.get(id) == null) {
			return;
		}
		const cId = IDHandler.add(pEvent.channel);
		pOnDataChannel(cId);
	});

	return id;
}

function destroy(pId: RTCPeerConnectionId): void {
	const connection = IDHandler.get(pId);
	if (connection == null) {
		return;
	}
	GodotEventListeners.remove(connection);
	IDHandler.remove(pId);
}

function onSession(
	pId: RTCPeerConnectionId,
	pCallback: (pTypePtr: CCharPointer, pSdpPtr: CCharPointer) => void,
	pSessionDescription: RTCSessionDescriptionInit,
): void {
	if (IDHandler.get(pId) == null) {
		return;
	}
	const sessionTypeStrPtr = GodotRuntime.allocString(pSessionDescription.type);
	// TODO: Verify if this is the right thing to do, `?? ""`.
	const sessionSdpStrPtr = GodotRuntime.allocString(pSessionDescription.sdp ?? "");
	pCallback(sessionTypeStrPtr, sessionSdpStrPtr);
	GodotRuntime.free(sessionTypeStrPtr);
	GodotRuntime.free(sessionSdpStrPtr);
}

function onError(pId: RTCPeerConnectionId, pCallback: () => void, pError: Error): void {
	if (IDHandler.get(pId) == null) {
		return;
	}
	GodotRuntime.error(pError);
	pCallback();
}

export const _GodotRTCPeerConnection = {
	$GodotRTCPeerConnection__deps: ["$IDHandler", "$GodotRuntime", "$GodotRTCDataChannel"] as const,
	$GodotRTCPeerConnection: {
		// Enums
		ConnectionState: _godotRtcPeerConnectionConnectionState,
		ConnectionStateCompat: _godotRtcPeerConnectionConnectionStateCompat,
		IceGatheringState: _godotRtcPeerConnectionIceGatheringState,
		SignalingState: _godotRtcPeerConnectionSignalingState,

		// Callbacks
		create,
		destroy,
		onSession,
		onError,
	},

	godot_js_rtc_pc_create__proxy: "sync",
	godot_js_rtc_pc_create__sig: "ippppppp",
	godot_js_rtc_pc_create: (
		pConfigPtr: CCharPointer,
		pReferencePtr: CVoidPointer,
		pOnConnectionStateChangePtr: CFunctionPointer<RTCOnIceConnectionStateChange>,
		pOnIceGatheringStateChangePtr: CFunctionPointer<RTCOnIceGatheringStateChange>,
		pOnSignalingStateChangePtr: CFunctionPointer<RTCOnSignallingStateChange>,
		pOnIceCandidatePtr: CFunctionPointer<RTCOnIceCandidate>,
		pOnDataChannelPtr: CFunctionPointer<RTCOnDataChannel>,
	): CInt => {
		const onConnectionStateChangeCallback = GodotRuntime.getFunction(pOnConnectionStateChangePtr);
		const onConnectionStateChange: CreateOnConnectionChangeCallback = (pConnectionState) => {
			onConnectionStateChangeCallback(pReferencePtr, pConnectionState);
		};

		const onIceGatheringStateChangeCallback = GodotRuntime.getFunction(pOnIceGatheringStateChangePtr);
		const onIceGatheringStateChange: CreateOnIceGatheringChangeCallback = (pIceGatheringState) => {
			onIceGatheringStateChangeCallback(pReferencePtr, pIceGatheringState);
		};

		const onSignalingStateChangeCallback = GodotRuntime.getFunction(pOnSignalingStateChangePtr);
		const onSignalingStateChange: CreateOnSignalingChangeCallback = (pSignalingState) => {
			onSignalingStateChangeCallback(pReferencePtr, pSignalingState);
		};

		const onIceCandidateCallback = GodotRuntime.getFunction(pOnIceCandidatePtr);
		const onIceCandidate: CreateOnIceCandidate = (pMidPtr, pMLineIndex, pCandidatePtr) => {
			onIceCandidateCallback(pReferencePtr, pMidPtr, GodotRuntime.asCInt(pMLineIndex), pCandidatePtr);
		};

		const onDataChannelCallback = GodotRuntime.getFunction(pOnDataChannelPtr);
		const onDataChannel: CreateOnDataChannel = (pId: number) => {
			onDataChannelCallback(pReferencePtr, GodotRuntime.asCInt(pId));
		};

		return GodotRuntime.asCInt(
			GodotRTCPeerConnection.create(
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Let's hope it matches.
				JSON.parse(GodotRuntime.parseString(pConfigPtr)) as RTCConfiguration,
				onConnectionStateChange,
				onSignalingStateChange,
				onIceGatheringStateChange,
				onIceCandidate,
				onDataChannel,
			),
		);
	},

	godot_js_rtc_pc_close__proxy: "sync",
	godot_js_rtc_pc_close__sig: "vi",
	godot_js_rtc_pc_close: (pId: RTCPeerConnectionId) => {
		const connection = IDHandler.get(pId);
		if (connection == null) {
			return;
		}
		connection.close();
	},

	godot_js_rtc_pc_destroy__proxy: "sync",
	godot_js_rtc_pc_destroy__sig: "vi",
	godot_js_rtc_pc_destroy: (pId: RTCPeerConnectionId) => {
		GodotRTCPeerConnection.destroy(pId);
	},

	godot_js_rtc_pc_offer_create__proxy: "sync",
	godot_js_rtc_pc_offer_create__sig: "vippp",
	godot_js_rtc_pc_offer_create: async (
		pId: RTCPeerConnectionId,
		pReferencePtr: CVoidPointer,
		pOnSessionCallbackPtr: CFunctionPointer<RTCOnSession>,
		pOnErrorCallbackPtr: CFunctionPointer<RTCOnError>,
	): Promise<void> => {
		const connection = IDHandler.get(pId);
		if (connection == null) {
			return;
		}

		const onSessionCallback = GodotRuntime.getFunction(pOnSessionCallbackPtr);
		const onErrorCallback = GodotRuntime.getFunction(pOnErrorCallbackPtr);

		try {
			const session = await connection.createOffer();
			GodotRTCPeerConnection.onSession(
				pId,
				(pTypePtr, pSdpPtr) => {
					onSessionCallback(pReferencePtr, pTypePtr, pSdpPtr);
				},
				session,
			);
		} catch (eError: unknown) {
			const error = new Error("Error while offering to create RTC peer connection.");
			error.cause = eError;
			GodotRTCPeerConnection.onError(
				pId,
				() => {
					onErrorCallback(pReferencePtr);
				},
				error,
			);
		}
	},

	godot_js_rtc_pc_local_description_set__proxy: "sync",
	godot_js_rtc_pc_local_description_set__sig: "vipppp",
	godot_js_rtc_pc_local_description_set: async (
		pId: RTCPeerConnectionId,
		pTypePtr: CCharPointer,
		pSdpPtr: CCharPointer,
		pReferencePtr: CVoidPointer,
		pOnErrorCallbackPtr: CFunctionPointer<RTCOnError>,
	): Promise<void> => {
		const connection = IDHandler.get(pId);
		if (connection == null) {
			return;
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Let's hope.
		const connectionType = GodotRuntime.parseString(pTypePtr) as RTCSdpType;
		const connectionSdp = GodotRuntime.parseString(pSdpPtr);
		const onErrorCallback = GodotRuntime.getFunction(pOnErrorCallbackPtr);

		try {
			await connection.setLocalDescription({
				sdp: connectionSdp,
				type: connectionType,
			});
		} catch (eError: unknown) {
			const error = new Error("Error while setting local description of RTC peer connection.");
			error.cause = eError;
			GodotRTCPeerConnection.onError(
				pId,
				() => {
					onErrorCallback(pReferencePtr);
				},
				error,
			);
		}
	},

	godot_js_rtc_pc_remote_description_set__proxy: "sync",
	godot_js_rtc_pc_remote_description_set__sig: "vippppp",
	godot_js_rtc_pc_remote_description_set: async (
		pId: RTCPeerConnectionId,
		pTypePtr: CCharPointer,
		pSdpPtr: CCharPointer,
		pReferencePtr: CVoidPointer,
		pOnSessionCreatedCallbackPtr: CFunctionPointer<RTCOnSession>,
		pOnErrorCallbackPtr: CFunctionPointer<RTCOnError>,
	): Promise<void> => {
		const connection = IDHandler.get(pId);
		if (connection == null) {
			return;
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Let's hope.
		const connectionType = GodotRuntime.parseString(pTypePtr) as RTCSdpType;
		const connectionSdp = GodotRuntime.parseString(pSdpPtr);
		const onErrorCallback = GodotRuntime.getFunction(pOnErrorCallbackPtr);
		const onSessionCallback = GodotRuntime.getFunction(pOnSessionCreatedCallbackPtr);

		try {
			await connection.setRemoteDescription({
				sdp: connectionSdp,
				type: connectionType,
			});
			if (connectionType !== "offer") {
				return;
			}
			const session = await connection.createAnswer();
			GodotRTCPeerConnection.onSession(
				pId,
				(pSessionTypePtr, pSessionSdbPtr) => {
					onSessionCallback(pReferencePtr, pSessionTypePtr, pSessionSdbPtr);
				},
				session,
			);
		} catch (eError: unknown) {
			const error = new Error("Error while setting remote description of RTC peer connection.");
			error.cause = eError;
			GodotRTCPeerConnection.onError(
				pId,
				() => {
					onErrorCallback(pReferencePtr);
				},
				error,
			);
		}
	},

	godot_js_rtc_pc_ice_candidate_add__proxy: "sync",
	godot_js_rtc_pc_ice_candidate_add__sig: "vipip",
	godot_js_rtc_pc_ice_candidate_add: async (
		pId: RTCPeerConnectionId,
		pMidNamePtr: CCharPointer,
		pMLineIndex: CInt,
		pSdpPtr: CCharPointer,
	): Promise<void> => {
		const connection = IDHandler.get(pId);
		if (connection == null) {
			return;
		}
		const sdpMidName = GodotRuntime.parseString(pMidNamePtr);
		const sdpName = GodotRuntime.parseString(pSdpPtr);

		try {
			await connection.addIceCandidate(
				new RTCIceCandidate({
					candidate: sdpName,
					sdpMid: sdpMidName,
					sdpMLineIndex: pMLineIndex,
				}),
			);
		} catch (eError) {
			const error = new Error("Error while adding Ice candidate of RTC peer connection.");
			error.cause = eError;
			GodotRuntime.error(error);
		}
	},

	godot_js_rtc_pc_datachannel_create__deps: ["$GodotRTCDataChannel"],
	godot_js_rtc_pc_datachannel_create__proxy: "sync",
	godot_js_rtc_pc_datachannel_create__sig: "iipp",
	godot_js_rtc_pc_datachannel_create: (
		pId: RTCPeerConnectionId,
		pLabelPtr: CCharPointer,
		pConfigPtr: CCharPointer,
	): CInt => {
		try {
			const connection = IDHandler.get(pId);
			if (connection == null) {
				return GodotRuntime.asCInt(0);
			}

			const label = GodotRuntime.parseString(pLabelPtr);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Let's hope.
			const config = JSON.parse(GodotRuntime.parseString(pConfigPtr)) as RTCDataChannelInit;

			const channel = connection.createDataChannel(label, config);
			return IDHandler.add(channel);
		} catch (eError: unknown) {
			const error = new Error("Error while creating DataChannel for RTC peer connection.");
			error.cause = eError;
			GodotRuntime.error(error);
			return GodotRuntime.asCInt(0);
		}
	},
};

autoAddDeps(_GodotRTCPeerConnection, "$GodotRTCPeerConnection");
addToLibrary(_GodotRTCPeerConnection);
