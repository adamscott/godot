/**************************************************************************/
/*  godot_webxr.ts                                                        */
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
	convertFunctionToIifeString as $convertFunctionToIifeString,
	getNullishErrorString as $getNullishErrorString,
} from "@godotengine/utils/macros";
import type {
	CCharPointer,
	CFloat,
	CFloatArrayPointer,
	CFloatPointer,
	CFunctionPointer,
	CInt,
	CIntPointer,
} from "@godotengine/emscripten-utils/types";
import type { GLTexture } from "@godotengine/emscripten-utils/types/browser";

interface XRInputSourceWithName extends XRInputSource {
	name?: number | null;
	touchIndex?: number | null;
}

type GodotWebXRIsSessionSupportedCallback = (pSessionMode: CCharPointer, pSupported: CInt) => void;
type GodotWebXRStartedCallback = (
	pReferenceSpaceType: CCharPointer,
	pEnabledFeatures: CCharPointer,
	pEnvironmentBlendMode: CCharPointer,
) => void;
type GodotWebXREndedCallback = () => void;
type GodotWebXRFailedCallback = (pMessage: CCharPointer) => void;
type GodotWebXRInputEventCallback = (pEventType: CInt, pInputSourceId: CInt) => void;
type GodotWebXRSimpleEventCallback = (pSignalName: CCharPointer) => void;

function isXRSessionMode(pValue: string): pValue is XRSessionMode {
	const xrSessionModeValues = ["inline", "immersive-vr", "immersive-ar"];
	return xrSessionModeValues.includes(pValue);
}

function isXRReferenceSpaceTypeArray(pValue: string[]): pValue is XRReferenceSpaceType[] {
	const xrReferenceSpaceTypeArrayValues = ["viewer", "local", "local-floor", "bounded-floor", "unbounded"];
	return pValue.every((pEntry) => xrReferenceSpaceTypeArrayValues.includes(pEntry));
}

export const _GodotWebXR = {
	$GodotWebXR__deps: ["$MainLoop", "$GL", "$GodotRuntime", "$runtimeKeepalivePush", "$runtimeKeepalivePop"] as const,
	$GodotWebXR__postset: $convertFunctionToIifeString(() => {
		GodotWebXR.clear();
	}),
	$GodotWebXR: {
		gl: null as WebGL2RenderingContext | null,
		session: null as XRSession | null,
		glBinding: null as XRWebGLBinding | null,
		layer: null as XRProjectionLayer | null,
		space: null as XRReferenceSpace | null,
		frame: null as XRFrame | null,
		pose: null as XRViewerPose | null,
		viewCount: 1,
		inputSources: [] as Array<XRInputSourceWithName | null>,
		touches: [] as Array<XRInputSourceWithName | null>,
		onSimpleEventCallback: null as GodotWebXRSimpleEventCallback | null,
		// Monkey-patch the requestAnimationFrame() used by Emscripten for the main
		// loop, so that we can swap it out for XRSession.requestAnimationFrame()
		// when an XR session is started.
		originalRequestAnimationFrame: null as AnimationFrameProvider["requestAnimationFrame"] | null,

		isXRSessionMode,
		isXRReferenceSpaceTypeArray,

		clear: (): void => {
			if (GodotWebXR.session != null) {
				GodotWebXR.session.end().catch((_eError: unknown) => {
					// Prevent exception when session has already ended.
				});
			}
			GodotWebXR.session = null;
			GodotWebXR.glBinding = null;
			GodotWebXR.layer = null;
			GodotWebXR.space = null;
			GodotWebXR.frame = null;
			GodotWebXR.pose = null;
			GodotWebXR.viewCount = 1;
			GodotWebXR.inputSources = new Array(16).map(() => null);
			GodotWebXR.touches = new Array(5).map(() => null);
			GodotWebXR.onSimpleEventCallback = null;
			// Disable the monkey-patched window.requestAnimationFrame() and
			// pause/restart the main loop to activate it on all platforms.
			GodotWebXR.monkeyPatchRequestAnimationFrame(false);
			GodotWebXR.pauseResumeMainLoop();
		},

		requestAnimationFrame: (pCallback: FrameRequestCallback): number => {
			const session = GodotWebXR.session;
			const space = GodotWebXR.space;
			const originalRequestAnimationFrame = GodotWebXR.originalRequestAnimationFrame;
			if (session != null && space != null) {
				const onFrame: XRFrameRequestCallback = (pTime, pFrame) => {
					GodotWebXR.frame = pFrame;
					GodotWebXR.pose = pFrame.getViewerPose(space) ?? null;
					pCallback(pTime);
					GodotWebXR.frame = null;
					GodotWebXR.pose = null;
				};
				return session.requestAnimationFrame(onFrame);
			} else if (originalRequestAnimationFrame != null) {
				return originalRequestAnimationFrame(pCallback);
			}
			return -1;
		},

		monkeyPatchRequestAnimationFrame: (pEnable: boolean): void => {
			GodotWebXR.originalRequestAnimationFrame ??= MainLoop.requestAnimationFrame;
			MainLoop.requestAnimationFrame = pEnable
				? GodotWebXR.requestAnimationFrame
				: GodotWebXR.originalRequestAnimationFrame;
		},

		pauseResumeMainLoop: (): void => {
			// Once both GodotWebXR.session and GodotWebXR.space are set or
			// unset, our monkey-patched requestAnimationFrame() should be
			// enabled or disabled. When using the WebXR API Emulator, this
			// gets picked up automatically, however, in the Oculus Browser
			// on the Quest, we need to pause and resume the main loop.
			MainLoop.pause();
			runtimeKeepalivePush();
			window.setTimeout(() => {
				runtimeKeepalivePop();
				MainLoop.resume();
			}, 0);
		},

		getLayer: (): XRProjectionLayer | null => {
			const newViewCount = GodotWebXR.pose?.views.length ?? 1;
			let layer = GodotWebXR.layer;
			// If the view count hasn't changed since creating this layer, then
			// we can simply return it.
			if (layer != null && GodotWebXR.viewCount === newViewCount) {
				return layer;
			}
			const session = GodotWebXR.session;
			if (session == null || GodotWebXR.glBinding?.createProjectionLayer == null) {
				return null;
			}
			const gl = GodotWebXR.gl;
			if (gl == null) {
				throw new TypeError($getNullishErrorString("GodotWebXR.gl"));
			}
			layer = GodotWebXR.glBinding.createProjectionLayer({
				textureType: newViewCount > 1 ? "texture-array" : "texture",
				colorFormat: gl.RGBA8,
				depthFormat: gl.DEPTH_COMPONENT24,
			});
			session.updateRenderState({ layers: [layer] }).catch((eError: unknown) => {
				GodotRuntime.error("Error while updating render state:", eError);
			});
			GodotWebXR.layer = layer;
			GodotWebXR.viewCount = newViewCount;
			return layer;
		},

		getSubImage: (): XRWebGLSubImage | null => {
			const pose = GodotWebXR.pose;
			if (pose == null) {
				return null;
			}
			const layer = GodotWebXR.getLayer();
			if (layer === null) {
				return null;
			}
			const glBinding = GodotWebXR.glBinding;
			if (glBinding == null) {
				return null;
			}
			// Because we always use "texture-array" for multiview and "texture"
			// when there is only 1 view, it should be safe to only grab the
			// subimage for the first view.
			return glBinding.getViewSubImage(layer, pose.views[0]);
		},

		getTextureId: (pTexture: GLTexture): number => {
			if (pTexture.name !== undefined) {
				return pTexture.name;
			}
			const id = GL.getNewId(GL.textures);
			pTexture.name = id;
			GL.textures[id] = pTexture;
			return id;
		},

		addInputSource: (pInputSource: XRInputSourceWithName): number => {
			let name = -1;
			if (pInputSource.targetRayMode === "tracked-pointer" && pInputSource.handedness === "left") {
				name = 0;
			} else if (pInputSource.targetRayMode === "tracked-pointer" && pInputSource.handedness === "right") {
				name = 1;
			} else {
				for (let i = 2; i < 16; i++) {
					if (GodotWebXR.inputSources[i] == null) {
						name = i;
						break;
					}
				}
			}
			if (name >= 0) {
				GodotWebXR.inputSources[name] = pInputSource;
				pInputSource.name = name;
				// Find a free touch index for screen sources.
				if (pInputSource.targetRayMode === "screen") {
					let touchIndex = -1;
					for (let i = 0; i < 5; i++) {
						if (GodotWebXR.touches[i] == null) {
							touchIndex = i;
							break;
						}
					}
					if (touchIndex >= 0) {
						GodotWebXR.touches[touchIndex] = pInputSource;
						pInputSource.touchIndex = touchIndex;
					}
				}
			}
			return name;
		},

		removeInputSource: (pInputSource: XRInputSourceWithName | null | undefined): number => {
			if (pInputSource?.name == null) {
				return -1;
			}
			const name = pInputSource.name;
			if (name >= 0 && name < GodotWebXR.inputSources.length) {
				GodotWebXR.inputSources[name] = null;
			}
			if (pInputSource.touchIndex != null) {
				const touchIndex = pInputSource.touchIndex;
				if (touchIndex >= 0 && touchIndex < GodotWebXR.touches.length) {
					GodotWebXR.touches[touchIndex] = null;
				}
			}
			return name;
		},

		getInputSourceId: (pInputSource: XRInputSourceWithName | null | undefined): number => {
			if (pInputSource?.name == null) {
				return -1;
			}
			return pInputSource.name;
		},

		getTouchIndex: (pInputSource: XRInputSourceWithName | null | undefined): number => {
			if (pInputSource?.touchIndex == null) {
				return -1;
			}
			return pInputSource.touchIndex;
		},
	},

	godot_webxr_is_supported__proxy: "sync",
	godot_webxr_is_supported__sig: "i",
	godot_webxr_is_supported: (): CInt => {
		return GodotRuntime.asCIntBoolean(navigator.xr != null);
	},

	godot_webxr_is_session_supported__proxy: "sync",
	godot_webxr_is_session_supported__sig: "vpp",
	godot_webxr_is_session_supported: async (
		pSessionModeStrPtr: CCharPointer,
		pCallbackPtr: CFunctionPointer<GodotWebXRIsSessionSupportedCallback>,
	): Promise<void> => {
		const sessionMode = GodotRuntime.parseString(pSessionModeStrPtr);
		if (!GodotWebXR.isXRSessionMode(sessionMode)) {
			throw new TypeError(`\`"${sessionMode}"\` is not part of \`XRSessionMode\`.`);
		}
		const callback = GodotRuntime.getFunction(pCallbackPtr);

		const navigatorXR = navigator.xr;
		if (navigatorXR == null) {
			const cStrPtr = GodotRuntime.allocString(sessionMode);
			callback(cStrPtr, GodotRuntime.asCInt(0));
			GodotRuntime.free(cStrPtr);
			return;
		}

		const supported = await navigatorXR.isSessionSupported(sessionMode);
		const cStrPtr = GodotRuntime.allocString(sessionMode);
		callback(cStrPtr, GodotRuntime.asCIntBoolean(supported));
		GodotRuntime.free(cStrPtr);
	},
	godot_webxr_initialize__deps: ["emscripten_webgl_get_current_context"] as const,
	godot_webxr_initialize__proxy: "sync",
	godot_webxr_initialize__sig: "vppppppppp",
	godot_webxr_initialize: async function (
		pSessionModeStrPtr: CCharPointer,
		pRequiredFeaturesStrPtr: CCharPointer,
		pOptionalFeaturesStrPtr: CCharPointer,
		pRequestedReferenceSpaceTypesStrPtr: CCharPointer,
		pOnSessionStartedCallbackPtr: CFunctionPointer<GodotWebXRStartedCallback>,
		pOnSessionEndedCallbackPtr: CFunctionPointer<GodotWebXREndedCallback>,
		pOnSessionFailedCallbackPtr: CFunctionPointer<GodotWebXRFailedCallback>,
		pOnInputEventCallbackPtr: CFunctionPointer<GodotWebXRInputEventCallback>,
		pOnSimpleEventCallbackPtr: CFunctionPointer<GodotWebXRSimpleEventCallback>,
	): Promise<void> {
		const navigatorXR = navigator.xr;
		if (navigatorXR == null) {
			throw new TypeError($getNullishErrorString("navigator.xr"));
		}

		GodotWebXR.monkeyPatchRequestAnimationFrame(true);

		const sessionMode = GodotRuntime.parseString(pSessionModeStrPtr);
		if (!GodotWebXR.isXRSessionMode(sessionMode)) {
			throw new TypeError(`\`"${sessionMode}"\` is not part of \`XRSessionMode\`.`);
		}

		const requiredFeatures = GodotRuntime.parseString(pRequiredFeaturesStrPtr)
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s !== "");
		const optionalFeatures = GodotRuntime.parseString(pOptionalFeaturesStrPtr)
			.split(",")
			.map((s) => s.trim())
			.filter((s) => s !== "");
		const requestedReferenceSpaceTypes = GodotRuntime.parseString(pRequestedReferenceSpaceTypesStrPtr)
			.split(",")
			.map((s) => s.trim());
		if (!GodotWebXR.isXRReferenceSpaceTypeArray(requestedReferenceSpaceTypes)) {
			throw new TypeError("Invalid `pRequestedReferenceSpacesTypes` array.");
		}

		const onStartedCallback = GodotRuntime.getFunction(pOnSessionStartedCallbackPtr);
		const onEndedCallback = GodotRuntime.getFunction(pOnSessionEndedCallbackPtr);
		const onFailedCallback = GodotRuntime.getFunction(pOnSessionFailedCallbackPtr);
		const onInputEventCallback = GodotRuntime.getFunction(pOnInputEventCallbackPtr);
		const onSimpleEventCallback = GodotRuntime.getFunction(pOnSimpleEventCallbackPtr);

		const sessionInit: XRSessionInit = {};
		if (requiredFeatures.length > 0) {
			sessionInit.requiredFeatures = requiredFeatures;
		}
		if (optionalFeatures.length > 0) {
			sessionInit.optionalFeatures = optionalFeatures;
		}
		try {
			const session = await navigatorXR.requestSession(sessionMode, sessionInit);
			GodotWebXR.session = session;
			session.addEventListener("end", (_pEvent) => {
				onEndedCallback();
			});
			session.addEventListener("inputsourceschange", (pEvent) => {
				for (const eventAdded of pEvent.added) {
					GodotWebXR.addInputSource(eventAdded);
				}
				for (const eventRemoved of pEvent.removed) {
					GodotWebXR.removeInputSource(eventRemoved);
				}
			});

			const xrInputEventNames = ["selectstart", "selectend", "squeezestart", "squeezeend"] as const;

			for (const [index, xrInputEventName] of xrInputEventNames.entries()) {
				session.addEventListener(xrInputEventName, (pEvent) => {
					// Since this happens in-between normal frames, we need to
					// grab the frame from the event in order to get poses for
					// the input sources.
					GodotWebXR.frame = pEvent.frame;
					onInputEventCallback(
						GodotRuntime.asCInt(index),
						GodotRuntime.asCInt(GodotWebXR.getInputSourceId(pEvent.inputSource)),
					);
					GodotWebXR.frame = null;
				});
			}
			session.addEventListener("visibilitychange", (_pEvent) => {
				const cStrPtr = GodotRuntime.allocString("visibility_state_changed");
				onSimpleEventCallback(cStrPtr);
				GodotRuntime.free(cStrPtr);
			});

			// Store onsimpleevent so we can use it later.
			GodotWebXR.onSimpleEventCallback = onSimpleEventCallback;

			const glContextHandle = _emscripten_webgl_get_current_context();
			const gl = GL.getContext(glContextHandle)?.GLctx ?? null;
			GodotWebXR.gl = gl;
			if (gl == null) {
				throw new TypeError($getNullishErrorString("GodotWebXR.gl"));
			}

			try {
				await gl.makeXRCompatible();
				const throwNoWebXRLayersError = (): never => {
					throw new Error(
						"This browser doesn't support WebXR Layers (which Godot requires) nor is the polyfill in use. If you are the developer of this application, please consider including the polyfill.",
					);
				};

				try {
					GodotWebXR.glBinding = new XRWebGLBinding(session, gl);
					const glBinding = GodotWebXR.glBinding;

					// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- We really want to check.
					if (glBinding.createProjectionLayer == null) {
						// On other browsers, XRWebGLBinding exists and works, but it doesn't support creating projection layers (which is
						// contrary to the spec, which says this MUST be supported) and so the polyfill is required.
						throwNoWebXRLayersError();
					}

					// This will trigger the layer to get created.
					const layer = GodotWebXR.getLayer();
					if (layer == null) {
						throw new Error("Unable to create WebXR Layer.");
					}

					const onReferenceSpaceSuccess = (
						pReferenceSpace: XRReferenceSpace | XRBoundedReferenceSpace,
						pReferenceSpaceType: XRReferenceSpaceType,
					): void => {
						GodotWebXR.space = pReferenceSpace;
						// Using reference_space.addEventListener() crashes when
						// using the polyfill with the WebXR Emulator extension,
						// so we set the event property instead.
						pReferenceSpace.onreset = (_pEvent) => {
							const cStrPtr = GodotRuntime.allocString("reference_space_reset");
							onSimpleEventCallback(cStrPtr);
							GodotRuntime.free(cStrPtr);
						};
						// Now that both GodotWebXR.session and GodotWebXR.space are
						// set, we need to pause and resume the main loop for the XR
						// main loop to kick in.
						GodotWebXR.pauseResumeMainLoop();
						// Call in setTimeout() so that errors in the onstarted()
						// callback don't bubble up here and cause Godot to try the
						// next reference space.
						window.setTimeout(() => {
							const referenceSpaceStrPtr = GodotRuntime.allocString(pReferenceSpaceType);
							const enabledFeatures = "enabledFeatures" in session ? (session.enabledFeatures ?? []) : [];
							const enabledFeaturesStrPtr = GodotRuntime.allocString(enabledFeatures.join(","));
							const environmentBlendMode =
								"environmentBlendMode" in session ? session.environmentBlendMode : "";
							const environmentBlendModeStrPtr = GodotRuntime.allocString(environmentBlendMode);
							onStartedCallback(referenceSpaceStrPtr, enabledFeaturesStrPtr, environmentBlendModeStrPtr);
							GodotRuntime.free(referenceSpaceStrPtr);
							GodotRuntime.free(enabledFeaturesStrPtr);
							GodotRuntime.free(environmentBlendModeStrPtr);
						}, 0);
					};

					const handleRequestReferenceSpaceFailure = (): void => {
						const messageStrPtr = GodotRuntime.allocString(
							"Unable to get any of the requested reference space types",
						);
						onFailedCallback(messageStrPtr);
						GodotRuntime.free(messageStrPtr);
					};

					const requestReferenceSpace = async (): Promise<void> => {
						const referenceSpaceType = requestedReferenceSpaceTypes.shift();
						if (referenceSpaceType == null) {
							handleRequestReferenceSpaceFailure();
							return;
						}

						try {
							const referenceSpace = await session.requestReferenceSpace(referenceSpaceType);
							onReferenceSpaceSuccess(referenceSpace, referenceSpaceType);
						} catch (_eError: unknown) {
							await requestReferenceSpace();
						}
					};
					await requestReferenceSpace();
				} catch (_eError: unknown) {
					// We'll end up here for browsers that don't have XRWebGLBinding at all, or if the browser does support WebXR Layers,
					// but is using the WebXR polyfill, so calling native XRWebGLBinding with the polyfilled XRSession won't work.
					throwNoWebXRLayersError();
				}
			} catch (eError: unknown) {
				let errorMessage = "Unable to make WebGL context compatible with WebXR";
				if (eError instanceof Error) {
					errorMessage += `: ${eError}`;
				}
				const cStrPtr = GodotRuntime.allocString(errorMessage);
				onFailedCallback(cStrPtr);
				GodotRuntime.free(cStrPtr);
			}
		} catch (eError: unknown) {
			let errorMessage = "Unable to start session";
			if (eError instanceof Error) {
				errorMessage += `: ${eError}`;
			}
			const cStrPtr = GodotRuntime.allocString(errorMessage);
			onFailedCallback(cStrPtr);
			GodotRuntime.free(cStrPtr);
		}
	},

	godot_webxr_uninitialize__proxy: "sync",
	godot_webxr_uninitialize__sig: "v",
	godot_webxr_uninitialize: (): void => {
		GodotWebXR.clear();
	},

	godot_webxr_get_view_count__proxy: "sync",
	godot_webxr_get_view_count__sig: "i",
	godot_webxr_get_view_count: (): CInt => {
		if (GodotWebXR.session == null || GodotWebXR.pose == null) {
			return GodotRuntime.asCInt(1);
		}
		const viewCount = GodotWebXR.pose.views.length;
		return viewCount > 0 ? GodotRuntime.asCInt(viewCount) : GodotRuntime.asCInt(1);
	},

	godot_webxr_get_render_target_size__proxy: "sync",
	godot_webxr_get_render_target_size__sig: "ip",
	godot_webxr_get_render_target_size: (rSize: CIntPointer): CInt => {
		const subimage = GodotWebXR.getSubImage();
		if (subimage === null) {
			return GodotRuntime.asCIntBoolean(false);
		}
		GodotRuntime.setHeapValue(
			GodotRuntime.asCType<CIntPointer>(rSize + 0),
			GodotRuntime.asCInt(subimage.viewport.width),
			"i32",
		);
		GodotRuntime.setHeapValue(
			GodotRuntime.asCType<CIntPointer>(rSize + 4),
			GodotRuntime.asCInt(subimage.viewport.height),
			"i32",
		);
		return GodotRuntime.asCIntBoolean(true);
	},

	godot_webxr_get_transform_for_view__proxy: "sync",
	godot_webxr_get_transform_for_view__sig: "iip",
	godot_webxr_get_transform_for_view: (pView: CInt, rTransform: CFloatPointer): CInt => {
		if (GodotWebXR.session == null || GodotWebXR.pose == null) {
			return GodotRuntime.asCIntBoolean(false);
		}
		const views = GodotWebXR.pose.views;
		// eslint-disable-next-line @typescript-eslint/init-declarations -- No need to init, it will be initialized just afterwards.
		let matrix: Float32Array;
		if (pView >= 0) {
			matrix = views[pView].transform.matrix;
		} else {
			// For -1 (or any other negative value) return the HMD transform.
			matrix = GodotWebXR.pose.transform.matrix;
		}
		for (let i = 0; i < 16; i++) {
			GodotRuntime.setHeapValue(
				GodotRuntime.asCType<CFloatPointer>(rTransform + i * 4),
				GodotRuntime.asCType<CFloat>(matrix[i]),
				"float",
			);
		}
		return GodotRuntime.asCIntBoolean(true);
	},

	godot_webxr_get_projection_for_view__proxy: "sync",
	godot_webxr_get_projection_for_view__sig: "iip",
	godot_webxr_get_projection_for_view: function (pView: CInt, rTransform: CFloatPointer): CInt {
		if (GodotWebXR.session == null || GodotWebXR.pose == null) {
			return GodotRuntime.asCIntBoolean(false);
		}
		const matrix = GodotWebXR.pose.views[pView].projectionMatrix;
		for (let i = 0; i < 16; i++) {
			GodotRuntime.setHeapValue(
				GodotRuntime.asCType<CFloatPointer>(rTransform + i * 4),
				GodotRuntime.asCType<CFloat>(matrix[i]),
				"float",
			);
		}
		return GodotRuntime.asCIntBoolean(true);
	},

	godot_webxr_get_color_texture__proxy: "sync",
	godot_webxr_get_color_texture__sig: "i",
	godot_webxr_get_color_texture: (): CInt => {
		const subimage = GodotWebXR.getSubImage();
		if (subimage === null) {
			return GodotRuntime.asCInt(0);
		}
		return GodotRuntime.asCInt(GodotWebXR.getTextureId(subimage.colorTexture));
	},

	godot_webxr_get_depth_texture__proxy: "sync",
	godot_webxr_get_depth_texture__sig: "i",
	godot_webxr_get_depth_texture: (): CInt => {
		const subimage = GodotWebXR.getSubImage();
		if (subimage === null) {
			return GodotRuntime.asCInt(0);
		}

		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- We really want to make sure.
		if (subimage.depthStencilTexture == null) {
			return GodotRuntime.asCInt(0);
		}
		return GodotRuntime.asCInt(GodotWebXR.getTextureId(subimage.depthStencilTexture));
	},

	godot_webxr_get_velocity_texture__proxy: "sync",
	godot_webxr_get_velocity_texture__sig: "i",
	godot_webxr_get_velocity_texture: (): CInt => {
		const subimage = GodotWebXR.getSubImage();
		if (subimage === null) {
			return GodotRuntime.asCInt(0);
		}
		const motionVectorTexture = subimage.motionVectorTexture;
		if (motionVectorTexture == null) {
			return GodotRuntime.asCInt(0);
		}
		return GodotRuntime.asCInt(GodotWebXR.getTextureId(motionVectorTexture));
	},

	godot_webxr_update_input_source__proxy: "sync",
	godot_webxr_update_input_source__sig: "iippppppppppppp",
	// eslint-disable-next-line complexity -- This is a complex function.
	godot_webxr_update_input_source: (
		pInputSourceId: CInt,
		rTargetPose: CFloatPointer,
		rTargetRayMode: CIntPointer,
		rTouchIndex: CIntPointer,
		rHasGripPose: CIntPointer,
		rGripPose: CFloatPointer,
		rHasStandardMapping: CIntPointer,
		rButtonCount: CIntPointer,
		rButtons: CFloatPointer,
		rAxesCount: CIntPointer,
		rAxes: CFloatPointer,
		rHasHandData: CIntPointer,
		rHandJoints: CFloatPointer,
		rHandRadii: CFloatPointer,
	): CInt => {
		const session = GodotWebXR.session;
		const frame = GodotWebXR.frame;
		const space = GodotWebXR.space;
		if (session == null || frame == null || space == null) {
			return GodotRuntime.asCIntBoolean(false);
		}
		if (
			pInputSourceId < 0 ||
			pInputSourceId >= GodotWebXR.inputSources.length ||
			GodotWebXR.inputSources[pInputSourceId] == null
		) {
			return GodotRuntime.asCIntBoolean(false);
		}

		const inputSource = GodotWebXR.inputSources[pInputSourceId];
		// Target pose.
		const targetPose = frame.getPose(inputSource.targetRaySpace, space);
		if (targetPose == null) {
			// This can mean that the controller lost tracking.
			return GodotRuntime.asCIntBoolean(false);
		}

		const targetPoseMatrix = targetPose.transform.matrix;
		for (let i = 0; i < 16; i++) {
			GodotRuntime.setHeapValue(
				GodotRuntime.asCType<CFloatPointer>(rTargetPose + i * 4),
				GodotRuntime.asCType<CFloat>(targetPoseMatrix[i]),
				"float",
			);
		}

		// Target ray mode.
		let targetRayMode = 0;
		switch (inputSource.targetRayMode) {
			case "gaze":
				targetRayMode = 1;
				break;
			case "tracked-pointer":
				targetRayMode = 2;
				break;
			case "screen":
				targetRayMode = 3;
				break;
			default:
		}

		GodotRuntime.setHeapValue(rTargetRayMode, GodotRuntime.asCInt(targetRayMode), "i32");

		// Touch index.
		GodotRuntime.setHeapValue(rTouchIndex, GodotRuntime.asCInt(GodotWebXR.getTouchIndex(inputSource)), "i32");

		// Grip pose.
		let hasGripPose = false;
		if (inputSource.gripSpace != null) {
			const gripPose = frame.getPose(inputSource.gripSpace, space);
			if (gripPose != null) {
				const gripPoseMatrix = gripPose.transform.matrix;
				for (let i = 0; i < 16; i++) {
					GodotRuntime.setHeapValue(
						GodotRuntime.asCType<CFloatPointer>(rGripPose + i * 4),
						GodotRuntime.asCType<CFloat>(gripPoseMatrix[i]),
						"float",
					);
				}
				hasGripPose = true;
			}
		}

		GodotRuntime.setHeapValue(rHasGripPose, GodotRuntime.asCIntBoolean(hasGripPose), "i32");

		// Gamepad data (mapping, buttons and axes).
		let hasStandardMapping = false;
		let buttonCount = 0;
		let axesCount = 0;
		if (inputSource.gamepad != null) {
			if (inputSource.gamepad.mapping === "xr-standard") {
				hasStandardMapping = true;
			}
			buttonCount = Math.min(inputSource.gamepad.buttons.length, 10);
			for (let i = 0; i < buttonCount; i++) {
				GodotRuntime.setHeapValue(
					GodotRuntime.asCType<CFloatPointer>(rButtons + i * 4),
					GodotRuntime.asCType<CFloat>(inputSource.gamepad.buttons[i].value),
					"float",
				);
			}
			axesCount = Math.min(inputSource.gamepad.axes.length, 10);
			for (let i = 0; i < axesCount; i++) {
				GodotRuntime.setHeapValue(
					GodotRuntime.asCType<CFloatPointer>(rAxes + i * 4),
					GodotRuntime.asCType<CFloat>(inputSource.gamepad.axes[i]),
					"float",
				);
			}
		}

		GodotRuntime.setHeapValue(rHasStandardMapping, GodotRuntime.asCIntBoolean(hasStandardMapping), "i32");
		GodotRuntime.setHeapValue(rButtonCount, GodotRuntime.asCInt(buttonCount), "i32");
		GodotRuntime.setHeapValue(rAxesCount, GodotRuntime.asCInt(axesCount), "i32");

		// Hand tracking data.
		let hasHandData = false;
		if (inputSource.hand != null && rHandJoints !== 0 && rHandRadii !== 0) {
			const handJointArray = new Float32Array(25 * 16);
			const handRadiiArray = new Float32Array(25);
			if (
				frame.fillPoses(Array.from(inputSource.hand.values()), space, handJointArray) &&
				frame.fillJointRadii(Array.from(inputSource.hand.values()), handRadiiArray)
			) {
				GodotRuntime.heapCopy(HEAPF32, handJointArray, rHandJoints);
				GodotRuntime.heapCopy(HEAPF32, handRadiiArray, rHandRadii);
				hasHandData = true;
			}
		}

		GodotRuntime.setHeapValue(rHasHandData, GodotRuntime.asCIntBoolean(hasHandData), "i32");

		return GodotRuntime.asCIntBoolean(true);
	},

	godot_webxr_get_visibility_state__proxy: "sync",
	godot_webxr_get_visibility_state__sig: "p",
	godot_webxr_get_visibility_state: (): CCharPointer => {
		const visibilityState = GodotWebXR.session?.visibilityState;
		if (visibilityState == null) {
			return GodotRuntime.asCType<CCharPointer>(GodotRuntime.NULLPTR);
		}
		return GodotRuntime.allocString(visibilityState);
	},

	godot_webxr_get_bounds_geometry__proxy: "sync",
	godot_webxr_get_bounds_geometry__sig: "ip",
	godot_webxr_get_bounds_geometry: function (rPoints: CFloatArrayPointer): CInt {
		const space = GodotWebXR.space;
		if (space == null) {
			return GodotRuntime.asCInt(0);
		}
		const boundsGeometry = space.boundsGeometry;
		if (boundsGeometry == null) {
			return GodotRuntime.asCInt(0);
		}
		const pointCount = boundsGeometry.length;
		if (pointCount === 0) {
			return GodotRuntime.asCInt(0);
		}

		const bufferPtr = GodotRuntime.malloc(pointCount * 3 * 4);
		for (let i = 0; i < pointCount; i++) {
			const point = boundsGeometry[i];
			GodotRuntime.setHeapValue(
				GodotRuntime.asCType<CFloatPointer>(bufferPtr + (i * 3 + 0) * 4),
				GodotRuntime.asCType<CFloat>(point.x),
				"float",
			);
			GodotRuntime.setHeapValue(
				GodotRuntime.asCType<CFloatPointer>(bufferPtr + (i * 3 + 1) * 4),
				GodotRuntime.asCType<CFloat>(point.y),
				"float",
			);
			GodotRuntime.setHeapValue(
				GodotRuntime.asCType<CFloatPointer>(bufferPtr + (i * 3 + 2) * 4),
				GodotRuntime.asCType<CFloat>(point.z),
				"float",
			);
		}
		GodotRuntime.setHeapValue(rPoints, bufferPtr, "*");

		return GodotRuntime.asCInt(pointCount);
	},

	godot_webxr_get_frame_rate__proxy: "sync",
	godot_webxr_get_frame_rate__sig: "i",
	godot_webxr_get_frame_rate: (): CInt => {
		const frameRate = GodotWebXR.session?.frameRate;
		if (frameRate == null) {
			return GodotRuntime.asCInt(0);
		}
		return GodotRuntime.asCInt(frameRate);
	},

	godot_webxr_update_target_frame_rate__proxy: "sync",
	godot_webxr_update_target_frame_rate__sig: "vi",
	godot_webxr_update_target_frame_rate: async (pFrameRate: CInt): Promise<void> => {
		const session = GodotWebXR.session;
		if (session == null) {
			return;
		}

		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- We really want to make sure.
		if (session.updateTargetFrameRate == null) {
			return;
		}

		await session.updateTargetFrameRate(pFrameRate);

		const messageStrPtr = GodotRuntime.allocString("display_refresh_rate_changed");
		const onSimpleEventCallback = GodotWebXR.onSimpleEventCallback;
		if (onSimpleEventCallback == null) {
			return;
		}
		onSimpleEventCallback(messageStrPtr);
		GodotRuntime.free(messageStrPtr);
	},

	godot_webxr_get_supported_frame_rates__proxy: "sync",
	godot_webxr_get_supported_frame_rates__sig: "pp",
	godot_webxr_get_supported_frame_rates: (rFrameRates: CIntPointer): CInt => {
		const session = GodotWebXR.session;
		if (session == null) {
			return GodotRuntime.asCInt(0);
		}
		const supportedFrameRates = session.supportedFrameRates;
		if (supportedFrameRates == null) {
			return GodotRuntime.asCInt(0);
		}

		const frameRateCount = supportedFrameRates.length;
		if (frameRateCount === 0) {
			return GodotRuntime.asCInt(0);
		}
		const bufferPtr = GodotRuntime.malloc(frameRateCount * 4);
		for (let i = 0; i < frameRateCount; i++) {
			GodotRuntime.setHeapValue(
				GodotRuntime.asCType<CFloatPointer>(bufferPtr + i * 4),
				GodotRuntime.asCType<CFloat>(supportedFrameRates[i]),
				"float",
			);
		}
		GodotRuntime.setHeapValue(rFrameRates, bufferPtr, "*");

		return GodotRuntime.asCInt(frameRateCount);
	},
};

autoAddDeps(_GodotWebXR, "$GodotWebXR");
addToLibrary(_GodotWebXR);
