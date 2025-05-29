/**************************************************************************/
/*  libwebxr.ts                                                           */
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

// __emscripten_import_global_const_start
import "npm:@types/webxr";
// __emscripten_import_global_const_end

import "+browser/types/extensions/xrinputsource_name.ts";
import "+browser/types/extensions/xrwebglsubimage_motionvectortexture.ts";
import "+browser/types/extensions/xrframe_fillposes.ts";
import "+browser/types/extensions/xrframe_filljointradii.ts";

// __emscripten_import_global_const_start
import {
	_emscripten_webgl_get_current_context,
	addToLibrary,
	autoAddDeps,
	GL,
	HEAPF32,
	MainLoop,
	runtimeKeepalivePop,
	runtimeKeepalivePush,
} from "+browser/emscripten/libemscripten.ts";
import { GodotRuntime } from "+browser/emscripten/libruntime.ts";
import { GodotEventListeners } from "+browser/emscripten/libos.ts";
// __emscripten_import_global_const_end

import {
	CCharPointer,
	CFloat,
	CFloatArrayPointer,
	CFloatPointer,
	CFunctionPointer,
	CInt,
	CIntPointer,
	CUint,
	GLTexture,
} from "+browser/emscripten/libemscripten.ts";

type GodotWebXRSupportedCallback = (
	pSessionMode: CCharPointer,
	pSupported: CInt,
) => void;
type GodotWebXRStartedCallback = (
	pReferenceSpaceType: CCharPointer,
	pEnabledFeatures: CCharPointer,
	pEnvironmentBlendMode: CCharPointer,
) => void;
type GodotWebXREndedCallback = () => void;
type GodotWebXRFailedCallback = (pMessage: CCharPointer) => void;
type GodotWebXRInputEventCallback = (
	pEventType: CInt,
	pInputSourceId: CInt,
) => void;
type GodotWebXRSimpleEventCallback = (pSignalName: CCharPointer) => void;

// __emscripten_declare_global_const_start
export declare const GodotWebXR: typeof _GodotWebXR.$GodotWebXR;
// __emscripten_declare_global_const_end
const _GodotWebXR = {
	$GodotWebXR__deps: [
		"$MainLoop",
		"$GL",
		"$GodotRuntime",
		"$GodotEventListeners",
		"$runtimeKeepalivePush",
		"$runtimeKeepalivePop",
	],
	$GodotWebXR__postset: [
		"GodotWebXR.inputSources = new Array(16).fill(null);",
		"GodotWebXR.touches = new Array(5).fill(null);",
	].join(";"),
	$GodotWebXR: {
		gl: null as WebGL2RenderingContext | null,

		session: null as unknown as XRSession | null,
		glBinding: null as XRWebGLBinding | null,
		layer: null as XRProjectionLayer | null,
		referenceSpace: null as
			| XRReferenceSpace
			| XRBoundedReferenceSpace
			| null,
		frame: null as XRFrame | null,
		viewerPose: null as XRViewerPose | null,
		viewCount: 1,
		inputSources: null as unknown as (XRInputSource | null)[],
		touches: null as unknown as (XRInputSource | null)[],
		onSimpleEvent: null as GodotWebXRSimpleEventCallback | null,

		originalRequestAnimationFrame:
			null as unknown as typeof requestAnimationFrame,

		// Monkey-patch the requestAnimationFrame() used by Emscripten for the main
		// loop, so that we can swap it out for XRSession.requestAnimationFrame()
		// when an XR session is started.
		xrReadyRequestAnimationFrame: (
			pCallback: FrameRequestCallback,
		): number => {
			if (
				GodotWebXR.session == null || GodotWebXR.referenceSpace == null
			) {
				return GodotWebXR.originalRequestAnimationFrame(
					pCallback,
				);
			}

			const animationFrameHandler: XRFrameRequestCallback = (
				pTime,
				pFrame,
			) => {
				if (GodotWebXR.referenceSpace == null) {
					return;
				}

				GodotWebXR.frame = pFrame;
				GodotWebXR.viewerPose =
					pFrame.getViewerPose(GodotWebXR.referenceSpace) ??
						null;
				pCallback(pTime);
				GodotWebXR.frame = null;
				GodotWebXR.viewerPose = null;
			};
			return GodotWebXR.session.requestAnimationFrame(
				animationFrameHandler,
			);
		},

		monkeyPatchRequestAnimationFrame: (pEnable: boolean): void => {
			if (GodotWebXR.originalRequestAnimationFrame == null) {
				GodotWebXR.originalRequestAnimationFrame =
					MainLoop.requestAnimationFrame;
			}
			MainLoop.requestAnimationFrame = pEnable
				? GodotWebXR.xrReadyRequestAnimationFrame
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
			setTimeout(() => {
				runtimeKeepalivePop();
				MainLoop.resume();
			});
		},

		getLayer: (): XRProjectionLayer | null => {
			const newViewCount = GodotWebXR.viewerPose?.views.length ?? 1;
			let layer = GodotWebXR.layer;

			// If the view count hasn't changed since creating this layer, then
			// we can simply return it.
			if (layer != null && GodotWebXR.viewCount === newViewCount) {
				return layer;
			}

			if (
				GodotWebXR.session == null || GodotWebXR.glBinding == null ||
				GodotWebXR.gl == null
			) {
				return null;
			}

			const gl = GodotWebXR.gl;
			layer = GodotWebXR.glBinding.createProjectionLayer({
				textureType: newViewCount > 1 ? "texture-array" : "texture",
				colorFormat: gl.RGBA8,
				depthFormat: gl.DEPTH_COMPONENT24,
			});
			GodotWebXR.session.updateRenderState({ layers: [layer] });

			GodotWebXR.layer = layer;
			GodotWebXR.viewCount = newViewCount;

			return layer;
		},

		getSubImage: (): XRWebGLSubImage | null => {
			if (GodotWebXR.viewerPose == null) {
				return null;
			}
			const layer = GodotWebXR.getLayer();
			if (layer == null) {
				return null;
			}

			// Because we always use "texture-array" for multiview and "texture"
			// when there is only 1 view, it should be safe to only grab the
			// subimage for the first view.
			return GodotWebXR.glBinding?.getViewSubImage(
				layer,
				GodotWebXR.viewerPose.views[0],
			) ?? null;
		},

		getTextureId: (pTexture: GLTexture): number => {
			if (pTexture.name != null) {
				return pTexture.name;
			}

			const id = GL.getNewId(GL.textures);
			pTexture.name = id;
			GL.textures[id] = pTexture;

			return id;
		},

		addInputSource: (pInputSource: XRInputSource): number => {
			let name = -1;

			if (
				pInputSource.targetRayMode === "tracked-pointer" &&
				pInputSource.handedness === "left"
			) {
				name = 0;
			} else if (
				pInputSource.targetRayMode === "tracked-pointer" &&
				pInputSource.handedness === "right"
			) {
				name = 1;
			} else {
				for (let i = 2; i < 16; i++) {
					if (GodotWebXR.inputSources[i] == null) {
						name = i;
						break;
					}
				}
			}

			if (name < 0) {
				return name;
			}

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

			return name;
		},

		removeInputSource: (pInputSource: XRInputSource): number => {
			if (pInputSource.name == null) {
				return -1;
			}

			const name = pInputSource.name;
			if (name >= 0 && name < 16) {
				GodotWebXR.inputSources[name] = null;
			}

			if (pInputSource.touchIndex != null) {
				const touchIndex = pInputSource.touchIndex;
				if (touchIndex >= 0 && touchIndex < 5) {
					GodotWebXR.touches[touchIndex] = null;
				}
			}

			return name;
		},

		getInputSourceId: (pInputSource: XRInputSource): number => {
			// TODO: Validate if fix is OK.
			if (pInputSource.name == null) {
				return -1;
			}
			return pInputSource.name;
		},

		getTouchIndex: (pInputSource: XRInputSource): number => {
			if (pInputSource.touchIndex == null) {
				return -1;
			}
			return pInputSource.touchIndex;
		},
	},

	godot_webxr_is_supported__proxy: "sync",
	godot_webxr_is_supported__sig: "i",
	godot_webxr_is_supported: (): CInt => {
		return Number("xr" in navigator) as CInt;
	},

	godot_webxr_is_session_supported__proxy: "sync",
	godot_webxr_is_session_supported__sig: "vpp",
	godot_webxr_is_session_supported: (
		pSessionModePtr: CCharPointer,
		pCallbackPtr: CFunctionPointer<GodotWebXRSupportedCallback>,
	): void => {
		const sessionMode = GodotRuntime.parseString(
			pSessionModePtr,
		) as XRSessionMode;
		const callback = GodotRuntime.getFunction(pCallbackPtr);

		if (!("xr" in navigator)) {
			// TODO: Check if necessary to realloc string.
			// Why not just return the same pointer?
			const returnSessionMode = GodotRuntime.allocString(sessionMode);
			callback(returnSessionMode, 0 as CInt);
			GodotRuntime.free(returnSessionMode);
			return;
		}

		navigator.xr!.isSessionSupported(sessionMode).then((pSupported) => {
			const returnSessionMode = GodotRuntime.allocString(sessionMode);
			callback(returnSessionMode, Number(pSupported) as CInt);
			GodotRuntime.free(returnSessionMode);
		});
	},

	godot_webxr_initialize__deps: ["emscripten_webgl_get_current_context"],
	godot_webxr_initialize__proxy: "sync",
	godot_webxr_initialize__sig: "vppppppppp",
	godot_webxr_initialize: (
		pSessionModePtr: CCharPointer,
		pRequiredFeaturesPtr: CCharPointer,
		pOptionalFeaturesPtr: CCharPointer,
		pRequestedReferenceSpaceTypesPtr: CCharPointer,
		pOnSessionStartedCallbackPtr: CFunctionPointer<
			GodotWebXRStartedCallback
		>,
		pOnSessionEndedCallbackPtr: CFunctionPointer<GodotWebXREndedCallback>,
		pOnSessionFailedCallbackPtr: CFunctionPointer<GodotWebXRFailedCallback>,
		pOnInputEventCallbackPtr: CFunctionPointer<
			GodotWebXRInputEventCallback
		>,
		pOnSimpleEventCallbackPtr: CFunctionPointer<
			GodotWebXRSimpleEventCallback
		>,
	): void => {
		GodotWebXR.monkeyPatchRequestAnimationFrame(true);

		const sessionMode = GodotRuntime.parseString(
			pSessionModePtr,
		) as XRSessionMode;
		const requiredFeatures = GodotRuntime.parseString(pRequiredFeaturesPtr)
			.split(",").map((s) => s.trim()).filter((s) => s !== "");
		const optionalFeatures = GodotRuntime.parseString(pOptionalFeaturesPtr)
			.split(",").map((s) => s.trim()).filter((s) => s !== "");
		const requestedReferenceSpaceTypes = GodotRuntime.parseString(
			pRequestedReferenceSpaceTypesPtr,
		).split(",").map((s) => s.trim());
		const onSessionStartedCallback = GodotRuntime.getFunction(
			pOnSessionStartedCallbackPtr,
		);
		const onSessionEndedCallback = GodotRuntime.getFunction(
			pOnSessionEndedCallbackPtr,
		);
		const onSessionFailedCallback = GodotRuntime.getFunction(
			pOnSessionFailedCallbackPtr,
		);
		const onInputEventCallback = GodotRuntime.getFunction(
			pOnInputEventCallbackPtr,
		);
		const onSimpleEventCallback = GodotRuntime.getFunction(
			pOnSimpleEventCallbackPtr,
		);

		const sessionInit: XRSessionInit = {};
		if (requiredFeatures.length > 0) {
			sessionInit["requiredFeatures"] = requiredFeatures;
		}
		if (optionalFeatures.length > 0) {
			sessionInit["optionalFeatures"] = optionalFeatures;
		}

		navigator.xr!.requestSession(sessionMode, sessionInit).then(
			(pSession) => {
				GodotWebXR.session = pSession;

				GodotEventListeners.add(
					pSession,
					"end",
					((_pEvent) => {
						onSessionEndedCallback();
					}) as XRSessionEventHandler,
				);

				GodotEventListeners.add(
					pSession,
					"inputsourcechange",
					((pEvent): void => {
						for (const inputSourceAdded of pEvent.added) {
							GodotWebXR.addInputSource(inputSourceAdded);
						}
						for (const inputSourceRemoved of pEvent.removed) {
							GodotWebXR.removeInputSource(inputSourceRemoved);
						}
					}) as XRInputSourcesChangeEventHandler,
				);

				for (
					const [index, inputEvent] of [
						"selectstart",
						"selectend",
						"squeezestart",
						"squeezeend",
					].entries()
				) {
					GodotEventListeners.add(
						pSession,
						inputEvent,
						((pEvent) => {
							// Since this happens in-between normal frames, we need to
							// grab the frame from the event in order to get poses for
							// the input sources.
							GodotWebXR.frame = pEvent.frame;
							onInputEventCallback(
								index as CInt,
								GodotWebXR.getInputSourceId(
									pEvent.inputSource,
								) as CInt,
							);
						}) as XRInputSourceEventHandler,
					);
				}

				GodotEventListeners.add(
					pSession,
					"visibilitychange",
					((_pEvent) => {
						const simpleEventIdPtr = GodotRuntime.allocString(
							"visibility_state_changed",
						);
						onSimpleEventCallback(simpleEventIdPtr);
						GodotRuntime.free(simpleEventIdPtr);
					}) as XRSessionEventHandler,
				);

				// Store onsimpleevent so we can use it later.
				GodotWebXR.onSimpleEvent = onSimpleEventCallback;

				const glContextHandle = _emscripten_webgl_get_current_context();
				const gl = GL.getContext(glContextHandle).GLctx;
				GodotWebXR.gl = gl;

				gl.makeXRCompatible().then(() => {
					GodotWebXR.glBinding = new XRWebGLBinding(pSession, gl);

					// This will trigger the layer to get created.
					GodotWebXR.getLayer();

					const onReferenceSpaceSuccess = (
						pReferenceSpace:
							| XRReferenceSpace
							| XRBoundedReferenceSpace,
						pReferenceSpaceType: XRReferenceSpaceType,
					): void => {
						GodotWebXR.referenceSpace = pReferenceSpace;

						// Using reference_space.addEventListener() crashes when
						// using the polyfill with the WebXR Emulator extension,
						// so we set the event property instead.
						pReferenceSpace.onreset = (_pEvent) => {
							const simpleEventTypePtr = GodotRuntime.allocString(
								"reference_space_reset",
							);
							onSimpleEventCallback(simpleEventTypePtr);
							GodotRuntime.free(simpleEventTypePtr);
						};

						// Now that both GodotWebXR.session and GodotWebXR.referenceSpace are
						// set, we need to pause and resume the main loop for the XR
						// main loop to kick in.
						GodotWebXR.pauseResumeMainLoop();

						// Call in setTimeout() so that errors in the onstarted()
						// callback don't bubble up here and cause Godot to try the
						// next reference space.
						setTimeout(() => {
							const referenceSpaceTypePtr = GodotRuntime
								.allocString(pReferenceSpaceType);
							const enabledFeatures = Array.from(
								pSession.enabledFeatures ?? [],
							);
							const enabledFeaturesPtr = GodotRuntime.allocString(
								enabledFeatures.join(","),
							);
							const environmentBlendMode =
								pSession.environmentBlendMode ?? "";
							const environmentBlendModePtr = GodotRuntime
								.allocString(environmentBlendMode);

							onSessionStartedCallback(
								referenceSpaceTypePtr,
								enabledFeaturesPtr,
								environmentBlendModePtr,
							);

							GodotRuntime.free(referenceSpaceTypePtr);
							GodotRuntime.free(enabledFeaturesPtr);
							GodotRuntime.free(environmentBlendModePtr);
						}, 0);
					};

					const requestReferenceSpace = (): void => {
						const referenceSpaceType = requestedReferenceSpaceTypes
							.shift()! as XRReferenceSpaceType;
						pSession.requestReferenceSpace(referenceSpaceType)
							.then(
								(referenceSpace) => {
									onReferenceSpaceSuccess(
										referenceSpace,
										referenceSpaceType,
									);
								},
							).catch((_pError) => {
								if (requestedReferenceSpaceTypes.length === 0) {
									const messagePtr = GodotRuntime.allocString(
										"Unable to get any of the requested reference space types",
									);
									onSessionFailedCallback(messagePtr);
									GodotRuntime.free(messagePtr);
									return;
								}

								requestReferenceSpace();
							});
					};

					requestReferenceSpace();
				}).catch((pError) => {
					const messagePtr = GodotRuntime.allocString(
						`Unable to make WebGL context compatible with WebXR: ${pError}`,
					);
					onSessionFailedCallback(messagePtr);
					GodotRuntime.free(messagePtr);
				});
			},
		).catch((pError) => {
			const messagePtr = GodotRuntime.allocString(
				`Unable to start session: ${pError}`,
			);
			onSessionFailedCallback(messagePtr);
			GodotRuntime.free(messagePtr);
		});
	},

	godot_webxr_uninitialize__proxy: "sync",
	godot_webxr_uninitialize__sig: "v",
	godot_webxr_uninitialize: (): void => {
		if (GodotWebXR.session != null) {
			GodotWebXR.session.end()
				// Prevent exception when session has already ended.
				.catch((_error) => {});
		}

		GodotWebXR.session = null;
		GodotWebXR.glBinding = null;
		GodotWebXR.layer = null;
		GodotWebXR.referenceSpace = null;
		GodotWebXR.frame = null;
		GodotWebXR.viewerPose = null;
		GodotWebXR.viewCount = 1;
		GodotWebXR.inputSources = new Array(16).fill(null);
		GodotWebXR.touches = new Array(5).fill(null);
		GodotWebXR.onSimpleEvent = null;

		// Disable the monkey-patched window.requestAnimationFrame() and
		// pause/restart the main loop to activate it on all platforms.
		GodotWebXR.monkeyPatchRequestAnimationFrame(false);
		GodotWebXR.pauseResumeMainLoop();
	},

	godot_webxr_get_view_count__proxy: "sync",
	godot_webxr_get_view_count__sig: "i",
	godot_webxr_get_view_count: (): CInt => {
		if (GodotWebXR.session == null || GodotWebXR.viewerPose == null) {
			return 1 as CInt;
		}
		const viewCount = GodotWebXR.viewerPose.views.length;
		return Math.max(viewCount, 1) as CInt;
	},

	godot_webxr_get_render_target_size__proxy: "sync",
	godot_webxr_get_render_target_size__sig: "ii",
	godot_webxr_get_render_target_size: (rSize: CIntPointer): CInt => {
		const subimage = GodotWebXR.getSubImage();
		if (subimage == null) {
			return GodotRuntime.boolean(false);
		}

		GodotRuntime.setHeapValue(
			(rSize + (Int32Array.BYTES_PER_ELEMENT * 0)) as CIntPointer,
			subimage.viewport.width,
			"i32",
		);
		GodotRuntime.setHeapValue(
			(rSize + (Int32Array.BYTES_PER_ELEMENT * 1)) as CIntPointer,
			subimage.viewport.width,
			"i32",
		);

		return GodotRuntime.boolean(true);
	},

	godot_webxr_get_transform_for_view__proxy: "sync",
	godot_webxr_get_transform_for_view__sig: "iip",
	godot_webxr_get_transform_for_view: (
		pView: CInt,
		rTransform: CFloatPointer,
	): CInt => {
		if (GodotWebXR.session == null || GodotWebXR.viewerPose == null) {
			return GodotRuntime.boolean(false);
		}

		const views = GodotWebXR.viewerPose.views;
		let matrix: Float32Array;
		if (pView >= 0) {
			matrix = views[pView].transform.matrix;
		} else {
			// For -1 (or any other negative value) return the HMD transform.
			matrix = GodotWebXR.viewerPose.transform.matrix;
		}

		for (let i = 0; i < 16; i++) {
			GodotRuntime.setHeapValue(
				(rTransform +
					(i * Float32Array.BYTES_PER_ELEMENT)) as CFloatPointer,
				matrix[i],
				"float",
			);
		}

		return GodotRuntime.boolean(true);
	},

	godot_webxr_get_projection_for_view__proxy: "sync",
	godot_webxr_get_projection_for_view__sig: "iip",
	godot_webxr_get_projection_for_view: (
		pView: CInt,
		rTransform: CFloatPointer,
	): CInt => {
		if (GodotWebXR.session == null || GodotWebXR.viewerPose == null) {
			return GodotRuntime.boolean(false);
		}

		const matrix = GodotWebXR.viewerPose.views[pView].projectionMatrix;
		for (let i = 0; i < 16; i++) {
			GodotRuntime.setHeapValue(
				(rTransform +
					(i * Float32Array.BYTES_PER_ELEMENT)) as CFloatPointer,
				matrix[i],
				"float",
			);
		}

		return GodotRuntime.boolean(true);
	},

	godot_webxr_get_color_texture__proxy: "sync",
	godot_webxr_get_color_texture__sig: "i",
	godot_webxr_get_color_texture: (): CUint => {
		const subimage = GodotWebXR.getSubImage();
		if (subimage == null) {
			return 0 as CUint;
		}
		return GodotWebXR.getTextureId(subimage.colorTexture) as CUint;
	},

	godot_webxr_get_depth_texture__proxy: "sync",
	godot_webxr_get_depth_texture__sig: "i",
	godot_webxr_get_depth_texture: (): CUint => {
		const subimage = GodotWebXR.getSubImage();
		if (subimage == null) {
			return 0 as CUint;
		}
		if (subimage.depthStencilTexture == null) {
			return 0 as CUint;
		}
		return GodotWebXR.getTextureId(subimage.depthStencilTexture) as CUint;
	},

	godot_webxr_get_velocity_texture__proxy: "sync",
	godot_webxr_get_velocity_texture__sig: "i",
	godot_webxr_get_velocity_texture: (): CUint => {
		const subimage = GodotWebXR.getSubImage();
		if (subimage == null) {
			return 0 as CUint;
		}
		if (subimage.motionVectorTexture == null) {
			return 0 as CUint;
		}
		return GodotWebXR.getTextureId(subimage.motionVectorTexture) as CUint;
	},

	godot_webxr_update_input_source__proxy: "sync",
	godot_webxr_update_input_source__sig: "iippppppppppppp",
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
		if (GodotWebXR.session == null || GodotWebXR.frame == null) {
			return GodotRuntime.boolean(false);
		}

		if (
			pInputSourceId < 0 ||
			pInputSourceId >= GodotWebXR.inputSources.length ||
			GodotWebXR.inputSources[pInputSourceId] == null
		) {
			return GodotRuntime.boolean(false);
		}

		const inputSource = GodotWebXR.inputSources[pInputSourceId];
		const frame = GodotWebXR.frame;
		const referenceSpace = GodotWebXR.referenceSpace;

		// Target pose.
		// TODO: Check if this fix is OK:
		if (referenceSpace == null) {
			return GodotRuntime.boolean(false);
		}
		const targetPose = frame.getPose(
			inputSource.targetRaySpace,
			referenceSpace,
		);
		if (targetPose == null) {
			// This can mean that the controller lost tracking.
			return GodotRuntime.boolean(false);
		}

		const target_pose_matrix = targetPose.transform.matrix;
		for (let i = 0; i < 16; i++) {
			GodotRuntime.setHeapValue(
				(rTargetPose +
					(i * Float32Array.BYTES_PER_ELEMENT)) as CFloatPointer,
				target_pose_matrix[i],
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
				// Do nothing.
		}
		GodotRuntime.setHeapValue(rTargetRayMode, targetRayMode, "i32");

		// Touch index.
		GodotRuntime.setHeapValue(
			rTouchIndex,
			GodotWebXR.getTouchIndex(inputSource),
			"i32",
		);

		// Grip pose.
		let hasGripPose = false;
		if (inputSource.gripSpace != null) {
			const gripPose = frame.getPose(
				inputSource.gripSpace,
				referenceSpace,
			);
			if (gripPose != null) {
				const gripPoseMatrix = gripPose.transform.matrix;
				for (let i = 0; i < 16; i++) {
					GodotRuntime.setHeapValue(
						(rGripPose +
							(i *
								Float32Array
									.BYTES_PER_ELEMENT)) as CFloatPointer,
						gripPoseMatrix[i],
						"float",
					);
					hasGripPose = true;
				}
			}
		}
		GodotRuntime.setHeapValue(
			rHasGripPose,
			GodotRuntime.boolean(hasGripPose),
			"i32",
		);

		// Gamepad data (mapping, buttons and axes).
		let hasStandardMapping = false;
		let buttonCount = 0;
		let axesCount = 0;
		if (inputSource.gamepad != null) {
			if (inputSource.gamepad.mapping === "xr-standard") {
				hasStandardMapping = true;
			}

			buttonCount = Math.min(inputSource.gamepad!.buttons.length, 10);
			for (let i = 0; i < buttonCount; i++) {
				GodotRuntime.setHeapValue(
					(rButtons +
						(i * Float32Array.BYTES_PER_ELEMENT)) as CFloatPointer,
					inputSource.gamepad!.buttons[i].value,
					"float",
				);
			}

			axesCount = Math.min(inputSource.gamepad!.buttons.length, 10);
			for (let i = 0; i < axesCount; i++) {
				GodotRuntime.setHeapValue(
					(rAxes +
						(i * Float32Array.BYTES_PER_ELEMENT)) as CFloatPointer,
					inputSource.gamepad!.axes[i],
					"float",
				);
			}
		}
		GodotRuntime.setHeapValue(
			rHasStandardMapping,
			GodotRuntime.boolean(hasStandardMapping),
			"i32",
		);
		GodotRuntime.setHeapValue(rButtonCount, buttonCount, "i32");
		GodotRuntime.setHeapValue(rAxesCount, axesCount, "i32");

		// Hand tracking data.
		let hasHandData = false;
		if (
			inputSource.hand != null && rHandJoints !== GodotRuntime.NULLPTR &&
			rHandJoints !== GodotRuntime.NULLPTR
		) {
			const handJointArray = new Float32Array(25 * 16);
			const handRadiiArray = new Float32Array(25);

			if (
				(frame.fillPoses?.(
					Array.from(inputSource.hand!.values()),
					referenceSpace,
					handJointArray,
				) ?? false) &&
				(frame.fillJointRadii?.(
					Array.from(inputSource.hand!.values()),
					handRadiiArray,
				) ?? false)
			) {
				GodotRuntime.heapCopy(HEAPF32, handJointArray, rHandJoints);
				GodotRuntime.heapCopy(HEAPF32, handRadiiArray, rHandRadii);
				hasHandData = true;
			}
		}
		GodotRuntime.setHeapValue(
			rHasHandData,
			GodotRuntime.boolean(hasHandData),
			"i32",
		);

		return GodotRuntime.boolean(true);
	},

	godot_webxr_get_visibility_state__proxy: "sync",
	godot_webxr_get_visibility_state__sig: "p",
	godot_webxr_get_visibility_state: (): CCharPointer => {
		if (GodotWebXR.session == null) {
			return GodotRuntime.NULLPTR as CCharPointer;
		}
		return GodotRuntime.allocString(GodotWebXR.session.visibilityState);
	},

	godot_webxr_get_bounds_geometry__proxy: "sync",
	godot_webxr_get_bounds_geometry__sig: "ip",
	godot_webxr_get_bounds_geometry: (rPoints: CFloatArrayPointer): CInt => {
		if (!(GodotWebXR.referenceSpace instanceof XRBoundedReferenceSpace)) {
			return 0 as CInt;
		}

		const pointCount = GodotWebXR.referenceSpace.boundsGeometry.length;
		if (pointCount === 0) {
			return 0 as CInt;
		}

		const bufferPtr = GodotRuntime.malloc<CFloatPointer>(
			pointCount * 3 * Float32Array.BYTES_PER_ELEMENT,
		);
		for (let i = 0; i < pointCount; i++) {
			const point = GodotWebXR.referenceSpace.boundsGeometry[i];
			GodotRuntime.setHeapValue(
				(bufferPtr +
					((i * 3) + 0) *
						Float32Array.BYTES_PER_ELEMENT) as CFloatPointer,
				point.x,
				"float",
			);
			GodotRuntime.setHeapValue(
				(bufferPtr +
					((i * 3) + 1) *
						Float32Array.BYTES_PER_ELEMENT) as CFloatPointer,
				point.y,
				"float",
			);
			GodotRuntime.setHeapValue(
				(bufferPtr +
					((i * 3) + 2) *
						Float32Array.BYTES_PER_ELEMENT) as CFloatPointer,
				point.z,
				"float",
			);
		}
		GodotRuntime.setHeapValue(rPoints, bufferPtr, "*");

		return pointCount as CInt;
	},

	godot_webxr_get_frame_rate__proxy: "sync",
	godot_webxr_get_frame_rate__sig: "f",
	godot_webxr_get_frame_rate: (): CFloat => {
		if (GodotWebXR.session?.frameRate == null) {
			return 0 as CFloat;
		}
		return GodotWebXR.session.frameRate as CFloat;
	},

	godot_webxr_update_target_frame_rate__proxy: "sync",
	godot_webxr_update_target_frame_rate__sig: "vf",
	godot_webxr_update_target_frame_rate: (pFrameRate: CFloat): void => {
		if (GodotWebXR.session == null) {
			return;
		}

		GodotWebXR.session.updateTargetFrameRate(pFrameRate).then(() => {
			const simpleEventPtr = GodotRuntime.allocString(
				"display_refresh_rate_changed",
			);
			GodotWebXR.onSimpleEvent!(simpleEventPtr);
			GodotRuntime.free(simpleEventPtr);
		});
	},

	godot_webxr_get_supported_frame_rates__proxy: "sync",
	godot_webxr_get_supported_frame_rates__sig: "ip",
	godot_webxr_get_supported_frame_rates: (
		rFrameRates: CFloatArrayPointer,
	): CInt => {
		if (GodotWebXR.session?.supportedFrameRates == null) {
			return 0 as CInt;
		}

		const frameRateCount = GodotWebXR.session.supportedFrameRates.length;
		if (frameRateCount === 0) {
			return 0 as CInt;
		}

		const bufferPtr = GodotRuntime.malloc<CFloatPointer>(
			frameRateCount * Float32Array.BYTES_PER_ELEMENT,
		);
		for (let i = 0; i < frameRateCount; i++) {
			GodotRuntime.setHeapValue(
				(bufferPtr +
					(i * Float32Array.BYTES_PER_ELEMENT)) as CFloatPointer,
				GodotWebXR.session.supportedFrameRates[i],
				"float",
			);
		}
		GodotRuntime.setHeapValue(rFrameRates, bufferPtr, "*");

		return frameRateCount as CInt;
	},
};
autoAddDeps(_GodotWebXR, "$GodotWebXR");
addToLibrary(_GodotWebXR);
