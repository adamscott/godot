/**************************************************************************/
/*  godot_display.ts                                                      */
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
	CCharArrayPointer,
	CCharPointer,
	CFloat,
	CFunctionPointer,
	CInt,
	CIntPointer,
	CUintPointer,
} from "@godotengine/emscripten-utils/types";

type TTSGetVoicesCallback = (pSize: CInt, pVoices: CCharArrayPointer) => void;
type TTSSpeakCallback = (pEvent: CInt, pId: CInt, pPosition: CInt) => void;

type DisplayClipboardGetCallback = (pChar: CCharPointer) => void;

type DisplayFullscreenCbCallback = (pFullscreen: CInt) => void;
type DisplayWindowBlurCbCallback = () => void;
type DisplayNotificationCbCallback = (pNotification: CInt) => void;

type DisplayVkCbCallback = (pTextPtr: CCharPointer, pCursor: CInt) => void;

/**
 * Display server interface.
 *
 * Exposes all the functions needed by DisplayServer implementation.
 */
export const _GodotDisplay = {
	$GodotDisplay__deps: [
		"$GodotOS",
		"$GodotConfig",
		"$GodotRuntime",
		"$GodotEventListeners",
		"$GodotDisplayCursor",
		"$GodotDisplayScreen",
		"$GodotDisplayVK",
	],
	$GodotDisplay: {
		windowIcon: "" as string | null,

		getDPI: (): number => {
			// devicePixelRatio is given in dppx
			// https://drafts.csswg.org/css-values/#resolution
			// > due to the 1:96 fixed ratio of CSS *in* to CSS *px*, 1dppx is equivalent to 96dpi.
			const dpi = Math.round(globalThis.devicePixelRatio * 96);
			return dpi >= 96 ? dpi : 96;
		},
	},

	godot_js_display_is_swap_ok_cancel__proxy: "sync",
	godot_js_display_is_swap_ok_cancel__sig: "i",
	godot_js_display_is_swap_ok_cancel: (): CInt => {
		return GodotRuntime.asCIntBoolean(GodotOS.getCurrentOS() === "Windows");
	},

	godot_js_tts_is_speaking__proxy: "sync",
	godot_js_tts_is_speaking__sig: "i",
	godot_js_tts_is_speaking: (): CInt => {
		return GodotRuntime.asCIntBoolean(globalThis.speechSynthesis.speaking);
	},

	godot_js_tts_is_paused__proxy: "sync",
	godot_js_tts_is_paused__sig: "i",
	godot_js_tts_is_paused: (): CInt => {
		return GodotRuntime.asCIntBoolean(globalThis.speechSynthesis.paused);
	},

	godot_js_tts_get_voices__proxy: "sync",
	godot_js_tts_get_voices__sig: "vp",
	godot_js_tts_get_voices: (pCallbackPtr: CFunctionPointer<TTSGetVoicesCallback>): void => {
		const callback = GodotRuntime.getFunction(pCallbackPtr);
		try {
			const voicesStringArray = globalThis.speechSynthesis.getVoices().map((pVoice) => {
				return `${pVoice.lang};${pVoice.name}`;
			});
			const voicesStringArrayPtr = GodotRuntime.allocStringArray(voicesStringArray);
			callback(GodotRuntime.asCInt(voicesStringArray.length), voicesStringArrayPtr);
			GodotRuntime.freeStringArray(voicesStringArrayPtr, voicesStringArray.length);
		} catch (_error) {
			// Fail graciously.
		}
	},

	godot_js_tts_speak__proxy: "sync",
	godot_js_tts_speak__sig: "vppiffip",
	godot_js_tts_speak: (
		pTextPtr: CCharPointer,
		pVoicePtr: CCharPointer,
		pVolume: CInt,
		pPitch: CFloat,
		pRate: CFloat,
		pUtteranceId: CInt,
		pCallbackPtr: CFunctionPointer<TTSSpeakCallback>,
	) => {
		const callback = GodotRuntime.getFunction(pCallbackPtr);

		const utterance = new SpeechSynthesisUtterance(GodotRuntime.parseString(pTextPtr));
		utterance.rate = pRate;
		utterance.pitch = pPitch;
		utterance.volume = pVolume / 100;
		GodotEventListeners.add(
			utterance,
			"end",
			(_pEvent: SpeechSynthesisEvent): void => {
				// TTS_UTTERANCE_ENDED.
				callback(GodotRuntime.asCInt(1), GodotRuntime.asCInt(pUtteranceId), GodotRuntime.asCInt(0));
			},
			false,
		);
		GodotEventListeners.add(
			utterance,
			"start",
			(_pEvent: SpeechSynthesisEvent): void => {
				// TTS_UTTERANCE_STARTED.
				callback(GodotRuntime.asCInt(0), GodotRuntime.asCInt(pUtteranceId), GodotRuntime.asCInt(0));
			},
			false,
		);
		GodotEventListeners.add(
			utterance,
			"error",
			(_pEvent: SpeechSynthesisEvent): void => {
				// TTS_UTTERANCE_CANCELED.
				callback(GodotRuntime.asCInt(2), GodotRuntime.asCInt(pUtteranceId), GodotRuntime.asCInt(0));
			},
			false,
		);
		GodotEventListeners.add(
			utterance,
			"boundary",
			(pEvent: SpeechSynthesisEvent): void => {
				// TTS_UTTERANCE_BOUNDARY.
				callback(
					GodotRuntime.asCInt(3),
					GodotRuntime.asCInt(pUtteranceId),
					GodotRuntime.asCInt(pEvent.charIndex),
				);
			},
			false,
		);

		const desiredVoice = GodotRuntime.parseString(pVoicePtr);
		const voices = globalThis.speechSynthesis.getVoices();
		for (const voice of voices) {
			if (voice.name === desiredVoice) {
				utterance.voice = voice;
				break;
			}
		}

		globalThis.speechSynthesis.resume();
		globalThis.speechSynthesis.speak(utterance);
	},

	godot_js_tts_pause__proxy: "sync",
	godot_js_tts_pause__sig: "v",
	godot_js_tts_pause: (): void => {
		globalThis.speechSynthesis.pause();
	},

	godot_js_tts_resume__proxy: "sync",
	godot_js_tts_resume__sig: "v",
	godot_js_tts_resume: (): void => {
		globalThis.speechSynthesis.resume();
	},

	godot_js_tts_stop__proxy: "sync",
	godot_js_tts_stop__sig: "v",
	godot_js_tts_stop: (): void => {
		globalThis.speechSynthesis.cancel();
		globalThis.speechSynthesis.resume();
	},

	godot_js_display_alert__proxy: "sync",
	godot_js_display_alert__sig: "vp",
	godot_js_display_alert: (pTextPtr: CCharPointer): void => {
		// eslint-disable-next-line no-alert -- As intended.
		globalThis.alert(GodotRuntime.parseString(pTextPtr));
	},

	godot_js_display_screen_dpi_get__proxy: "sync",
	godot_js_display_screen_dpi_get__sig: "i",
	godot_js_display_screen_dpi_get: (): CInt => {
		return GodotRuntime.asCInt(GodotDisplay.getDPI());
	},

	godot_js_display_pixel_ratio_get__proxy: "sync",
	godot_js_display_pixel_ratio_get__sig: "f",
	godot_js_display_pixel_ratio_get: (): CFloat => {
		return GodotRuntime.asCType<CFloat>(GodotDisplayScreen.getPixelRatio());
	},

	godot_js_display_fullscreen_request__proxy: "sync",
	godot_js_display_fullscreen_request__sig: "i",
	godot_js_display_fullscreen_request: (): CInt => {
		return GodotDisplayScreen.requestFullscreen() ? GodotRuntime.CIntError.OK : GodotRuntime.CIntError.FAILED;
	},

	godot_js_display_fullscreen_exit__proxy: "sync",
	godot_js_display_fullscreen_exit__sig: "i",
	godot_js_display_fullscreen_exit: (): CInt => {
		return GodotDisplayScreen.exitFullscreen() ? GodotRuntime.CIntError.OK : GodotRuntime.CIntError.FAILED;
	},

	godot_js_display_desired_size_set__proxy: "sync",
	godot_js_display_desired_size_set__sig: "vii",
	godot_js_display_desired_size_set: (pWidth: CInt, pHeight: CInt): void => {
		GodotDisplayScreen.desiredSize.width = GodotRuntime.fromCTypeToNumber(pWidth);
		GodotDisplayScreen.desiredSize.height = GodotRuntime.fromCTypeToNumber(pHeight);
		GodotDisplayScreen.updateSize();
	},

	godot_js_display_size_update__proxy: "sync",
	godot_js_display_size_update__sig: "i",
	godot_js_display_size_update: (): CInt => {
		const updated = GodotDisplayScreen.updateSize();
		if (updated) {
			GodotDisplayVK.updateSize();
		}
		return GodotRuntime.asCIntBoolean(updated);
	},

	godot_js_display_screen_size_get__proxy: "sync",
	godot_js_display_screen_size_get__sig: "vpp",
	godot_js_display_screen_size_get: (pWidthPtr: CIntPointer, pHeightPtr: CIntPointer): void => {
		const scale = GodotDisplayScreen.getPixelRatio();
		GodotRuntime.setHeapValue(pWidthPtr, GodotRuntime.asCInt(globalThis.screen.width * scale), "i32");
		GodotRuntime.setHeapValue(pHeightPtr, GodotRuntime.asCInt(globalThis.screen.height * scale), "i32");
	},

	godot_js_display_window_size_get__proxy: "sync",
	godot_js_display_window_size_get__sig: "vpp",
	godot_js_display_window_size_get: function (pWidthPtr: CIntPointer, pHeightPtr: CIntPointer) {
		GodotRuntime.setHeapValue(pWidthPtr, GodotRuntime.asCInt(GodotConfig.canvas.width), "i32");
		GodotRuntime.setHeapValue(pHeightPtr, GodotRuntime.asCInt(GodotConfig.canvas.height), "i32");
	},

	godot_js_display_has_webgl__proxy: "sync",
	godot_js_display_has_webgl__sig: "ii",
	godot_js_display_has_webgl: (pVersion: CInt): CInt => {
		if (![1, 2].includes(pVersion)) {
			return GodotRuntime.asCIntBoolean(false);
		}
		try {
			return GodotRuntime.asCIntBoolean(
				document.createElement("canvas").getContext(pVersion === 2 ? "webgl2" : "webgl") != null,
			);
		} catch (_error) {
			// Not available.
		}
		return GodotRuntime.asCIntBoolean(false);
	},

	//
	// Canvas.
	//
	godot_js_display_canvas_focus__proxy: "sync",
	godot_js_display_canvas_focus__sig: "v",
	godot_js_display_canvas_focus: (): void => {
		GodotConfig.canvas.focus();
	},

	godot_js_display_canvas_is_focused__proxy: "sync",
	godot_js_display_canvas_is_focused__sig: "i",
	godot_js_display_canvas_is_focused: (): CInt => {
		return GodotRuntime.asCIntBoolean(document.activeElement === GodotConfig.canvas);
	},

	//
	// Touchscreen
	//
	godot_js_display_touchscreen_is_available__proxy: "sync",
	godot_js_display_touchscreen_is_available__sig: "i",
	godot_js_display_touchscreen_is_available: (): CInt => {
		return GodotRuntime.asCIntBoolean("ontouchstart" in window);
	},

	//
	// Clipboard
	//
	godot_js_display_clipboard_set__proxy: "sync",
	godot_js_display_clipboard_set__sig: "ip",
	godot_js_display_clipboard_set: (pTextPtr: CCharPointer): CInt => {
		const text = GodotRuntime.parseString(pTextPtr);
		navigator.clipboard.writeText(text).catch((pError: unknown) => {
			// Setting OS clipboard is only possible from an input callback.
			GodotRuntime.error(
				"Setting OS clipboard is only possible from an input callback for the Web platform. Exception:",
				pError,
			);
		});
		return GodotRuntime.CIntError.OK;
	},

	godot_js_display_clipboard_get__proxy: "sync",
	godot_js_display_clipboard_get__sig: "ip",
	godot_js_display_clipboard_get: (pCallbackPtr: CFunctionPointer<DisplayClipboardGetCallback>): CInt => {
		const callback = GodotRuntime.getFunction(pCallbackPtr);
		navigator.clipboard
			.readText()
			.then((pResult) => {
				const resultPtr = GodotRuntime.allocString(pResult);
				callback(resultPtr);
				GodotRuntime.free(resultPtr);
			})
			.catch((_pError: unknown) => {
				// Fail graciously.
			});
		return GodotRuntime.CIntError.OK;
	},

	//
	// Window
	//
	godot_js_display_window_title_set__proxy: "sync",
	godot_js_display_window_title_set__sig: "vp",
	godot_js_display_window_title_set: (pTextPtr: CCharPointer): void => {
		document.title = GodotRuntime.parseString(pTextPtr);
	},

	godot_js_display_window_icon_set__proxy: "sync",
	godot_js_display_window_icon_set__sig: "vpi",
	godot_js_display_window_icon_set: (pIconPtr: CUintPointer, pLength: CInt): void => {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- We know the type.
		let link = document.getElementById("-gd-engine-icon") as HTMLLinkElement | null;
		const oldIcon = GodotDisplay.windowIcon;

		if (pIconPtr === GodotRuntime.NULLPTR) {
			if (link != null) {
				link.remove();
			}
			GodotDisplay.windowIcon = null;
		} else {
			if (link == null) {
				link = document.createElement("link");
				link.rel = "icon";
				link.id = "-gd-engine-icon";
				document.head.appendChild(link);
			}
			const png = new Blob([GodotRuntime.heapSlice(HEAPU8, pIconPtr, pLength)], { type: "image/png" });
			GodotDisplay.windowIcon = URL.createObjectURL(png);
			link.href = GodotDisplay.windowIcon;
		}

		if (oldIcon != null) {
			URL.revokeObjectURL(oldIcon);
		}
	},

	//
	// Cursor
	//
	godot_js_display_cursor_set_visible__proxy: "sync",
	godot_js_display_cursor_set_visible__sig: "vi",
	godot_js_display_cursor_set_visible: (pVisible: CInt): void => {
		const visible = Boolean(pVisible);
		if (visible === GodotDisplayCursor.visible) {
			return;
		}
		GodotDisplayCursor.visible = visible;
		if (visible) {
			GodotDisplayCursor.setShape(GodotDisplayCursor.shape);
		} else {
			GodotDisplayCursor.setStyle("none");
		}
	},

	godot_js_display_cursor_is_hidden__proxy: "sync",
	godot_js_display_cursor_is_hidden__sig: "i",
	godot_js_display_cursor_is_hidden: (): CInt => {
		return GodotRuntime.asCIntBoolean(!GodotDisplayCursor.visible);
	},

	godot_js_display_cursor_set_shape__proxy: "sync",
	godot_js_display_cursor_set_shape__sig: "vp",
	godot_js_display_cursor_set_shape: (pCursorPtr: CCharPointer): void => {
		GodotDisplayCursor.setShape(GodotRuntime.parseString(pCursorPtr));
	},

	godot_js_display_cursor_set_custom_shape__proxy: "sync",
	godot_js_display_cursor_set_custom_shape__sig: "vppiii",
	godot_js_display_cursor_set_custom_shape: (
		pShapePtr: CCharPointer,
		pDataPtr: CUintPointer,
		pDataLength: CInt,
		pHotspotX: CInt,
		pHotspotY: CInt,
	): void => {
		const shape = GodotRuntime.parseString(pShapePtr);
		const oldShape = GodotDisplayCursor.cursors.get(shape);
		if (pDataLength > 0) {
			const png = new Blob([GodotRuntime.heapSlice(HEAPU8, pDataPtr, pDataLength)], { type: "image/png" });
			const url = URL.createObjectURL(png);
			GodotDisplayCursor.cursors.set(shape, {
				url,
				x: pHotspotX,
				y: pHotspotY,
			});
		} else {
			GodotDisplayCursor.cursors.delete(shape);
		}
		if (shape === GodotDisplayCursor.shape) {
			GodotDisplayCursor.setShape(GodotDisplayCursor.shape);
		}
		if (oldShape != null) {
			URL.revokeObjectURL(oldShape.url);
		}
	},

	godot_js_display_cursor_lock_set__proxy: "sync",
	godot_js_display_cursor_lock_set__sig: "vi",
	godot_js_display_cursor_lock_set: (pLock: CInt): void => {
		if (GodotRuntime.fromCTypeToBoolean(pLock)) {
			GodotDisplayCursor.lockPointer();
		} else {
			GodotDisplayCursor.releasePointer();
		}
	},

	godot_js_display_cursor_is_locked__proxy: "sync",
	godot_js_display_cursor_is_locked__sig: "i",
	godot_js_display_cursor_is_locked: (): CInt => {
		return GodotRuntime.asCIntBoolean(GodotDisplayCursor.isPointerLocked());
	},

	//
	// Listeners
	//
	godot_js_display_fullscreen_cb__proxy: "sync",
	godot_js_display_fullscreen_cb__sig: "vp",
	godot_js_display_fullscreen_cb: (pCallbackPtr: CFunctionPointer<DisplayFullscreenCbCallback>): void => {
		const canvas = GodotConfig.canvas;
		const callback = GodotRuntime.getFunction(pCallbackPtr);
		GodotEventListeners.add(
			document,
			"fullscreenchange",
			(pEvent: Event) => {
				if (pEvent.target === canvas) {
					callback(GodotRuntime.asCIntBoolean(GodotDisplayScreen.isFullscreen()));
				}
			},
			false,
		);
	},

	godot_js_display_window_blur_cb__proxy: "sync",
	godot_js_display_window_blur_cb__sig: "vp",
	godot_js_display_window_blur_cb: (pCallbackPtr: CFunctionPointer<DisplayWindowBlurCbCallback>): void => {
		const callback = GodotRuntime.getFunction(pCallbackPtr);
		GodotEventListeners.add(
			window,
			"blur",
			() => {
				callback();
			},
			false,
		);
	},

	godot_js_display_notification_cb__proxy: "sync",
	godot_js_display_notification_cb__sig: "vpiiii",
	godot_js_display_notification_cb: (
		pCallbackPtr: CFunctionPointer<DisplayNotificationCbCallback>,
		pEnter: CInt,
		pExit: CInt,
		pIn: CInt,
		pOut: CInt,
	): void => {
		const canvas = GodotConfig.canvas;
		const callback = GodotRuntime.getFunction(pCallbackPtr);
		const list: Array<[CInt, string]> = [
			[pEnter, "mouseover"],
			[pExit, "mouseleave"],
			[pIn, "focus"],
			[pOut, "blur"],
		];
		for (const [code, event] of list) {
			GodotEventListeners.add(canvas, event, (_pEvent: MouseEvent): void => {
				callback(GodotRuntime.asCInt(code));
			});
		}
	},

	godot_js_display_setup_canvas__proxy: "sync",
	godot_js_display_setup_canvas__sig: "viiii",
	godot_js_display_setup_canvas: (pWidth: CInt, pHeight: CInt, pFullscreen: CInt, pHiDPI: CInt): void => {
		const canvas = GodotConfig.canvas;
		GodotEventListeners.add(
			canvas,
			"contextmenu",
			(pEvent: PointerEvent): void => {
				pEvent.preventDefault();
			},
			false,
		);
		GodotEventListeners.add(
			canvas,
			"webglcontextlost",
			(pEvent: WebGLContextEvent): void => {
				// eslint-disable-next-line no-alert -- TODO: Move to a less intrusive way to tell the user to reload.
				alert("WebGL context lost, please reload the page");
				pEvent.preventDefault();
			},
			false,
		);
		GodotDisplayScreen.hiDPI = Boolean(pHiDPI);
		switch (GodotConfig.canvasResizePolicy) {
			case 0: // None
				GodotDisplayScreen.desiredSize.width = canvas.width;
				GodotDisplayScreen.desiredSize.height = canvas.height;
				break;
			case 1: // Project
				GodotDisplayScreen.desiredSize.width = pWidth;
				GodotDisplayScreen.desiredSize.height = pHeight;
				break;
			default: // Full window
				// Ensure we display in the right place, the size will be handled by updateSize
				canvas.style.position = "absolute";
				canvas.style.top = "0";
				canvas.style.left = "0";
				break;
		}
		GodotDisplayScreen.updateSize();
		if (GodotRuntime.fromCTypeToBoolean(pFullscreen)) {
			GodotDisplayScreen.requestFullscreen();
		}
	},

	//
	// Virtual keyboard
	//
	godot_js_display_vk_show__proxy: "sync",
	godot_js_display_vk_show__sig: "vpiii",
	godot_js_display_vk_show: (pTextPtr: CCharPointer, pType: CInt, pStart: CInt, pEnd: CInt): void => {
		const text = GodotRuntime.parseString(pTextPtr);
		const start = Math.max(pStart, 0);
		const end = pEnd > 0 ? pEnd : start;
		GodotDisplayVK.show(text, pType, start, end);
	},

	godot_js_display_vk_hide__proxy: "sync",
	godot_js_display_vk_hide__sig: "v",
	godot_js_display_vk_hide: (): void => {
		GodotDisplayVK.hide();
	},

	godot_js_display_vk_available__proxy: "sync",
	godot_js_display_vk_available__sig: "i",
	godot_js_display_vk_available: (): CInt => {
		return GodotRuntime.asCIntBoolean(GodotDisplayVK.isAvailable());
	},

	godot_js_display_tts_available__proxy: "sync",
	godot_js_display_tts_available__sig: "i",
	godot_js_display_tts_available: (): CInt => {
		return GodotRuntime.asCIntBoolean("speechSynthesis" in window);
	},

	godot_js_display_vk_cb__proxy: "sync",
	godot_js_display_vk_cb__sig: "vp",
	godot_js_display_vk_cb: (pInputCallbackPtr: CFunctionPointer<DisplayVkCbCallback>): void => {
		const inputCallback = GodotRuntime.getFunction(pInputCallbackPtr);
		if (GodotDisplayVK.isAvailable()) {
			GodotDisplayVK.initialize((pInputPtr, pSelectionEnd) => {
				inputCallback(pInputPtr, GodotRuntime.asCInt(pSelectionEnd));
			});
		}
	},
};
autoAddDeps(_GodotDisplay, "$GodotDisplay");
addToLibrary(_GodotDisplay);
