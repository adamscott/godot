/**************************************************************************/
/*  display.ts                                                            */
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
	CCharArrayPointer,
	CCharPointer,
	CFloat,
	CFunctionPointer,
	CInt,
	CIntPointer,
	CUintPointer,
} from "./emscripten.ts";

type TTSGetVoicesCallback = (pSize: CInt, pVoices: CCharArrayPointer) => void;
type TTSSpeakCallback = (pEvent: CInt, pId: CInt, pPosition: CInt) => void;

type DisplayClipboardGetCallback = (pChar: CCharPointer) => void;

type DisplayFullscreenCbCallback = (pFullscreen: CInt) => void;
type DisplayWindowBlurCbCallback = () => void;
type DisplayNotificationCbCallback = (pNotification: CInt) => void;

type DisplayVkCbCallback = (pTextPtr: CCharPointer, pCursor: CInt) => void;

export const _GodotDisplayVK = {
	$GodotDisplayVK__deps: [
		"$GodotRuntime",
		"$GodotOS",
		"$GodotConfig",
		"$GodotEventListeners",
	],
	$GodotDisplayVK__postset: [
		"GodotOS.atExit(async() => { GodotDisplayVK.clear(); });",
	].join(";"),
	$GodotDisplayVK: {
		textInput: null as HTMLInputElement | null,
		textArea: null as HTMLTextAreaElement | null,

		initialize: (
			pInputCallback: (
				pInputPtr: CCharPointer,
				pSelectionEnd: number,
			) => void,
		) => {
			const create = <T extends "input" | "textarea">(
				pElementName: T,
			): T extends "input" ? HTMLInputElement : HTMLTextAreaElement => {
				const element = document.createElement(
					pElementName,
				) as (T extends "input" ? HTMLInputElement
					: HTMLTextAreaElement);
				element.style.display = "none";
				element.style.position = "absolute";
				element.style.zIndex = "-1";
				element.style.background = "transparent";
				element.style.padding = "0px";
				element.style.margin = "0px";
				element.style.overflow = "hidden";
				element.style.width = "0px";
				element.style.height = "0px";
				element.style.border = "0px";
				element.style.outline = "none";
				element.readOnly = true;
				element.disabled = true;

				GodotEventListeners.add(
					element,
					"input",
					(_pEvent: KeyboardEvent) => {
						const valuePtr = GodotRuntime.allocString(
							element.value,
						);
						pInputCallback(valuePtr, element.selectionEnd ?? 0);
						GodotRuntime.free(valuePtr);
					},
					false,
				);
				GodotEventListeners.add(
					element,
					"blur",
					(_pEvent: FocusEvent) => {
						element.style.display = "none";
						element.readOnly = true;
						element.disabled = true;
					},
					false,
				);

				GodotConfig.canvas.insertAdjacentElement(
					"beforebegin",
					element,
				);
				return element;
			};

			GodotDisplayVK.textInput = create("input");
			GodotDisplayVK.textArea = create("textarea");
			GodotDisplayVK.updateSize();
		},

		isAvailable: (): boolean => {
			return GodotConfig.virtualKeyboard && "ontouchstart" in globalThis;
		},

		show: (
			pText: string,
			pType: number,
			pStart: number,
			pEnd: number,
		): void => {
			if (
				GodotDisplayVK.textInput == null ||
				GodotDisplayVK.textArea == null
			) {
				return;
			}
			if (
				GodotDisplayVK.textInput.style.display !== "" ||
				GodotDisplayVK.textArea.style.display !== ""
			) {
				GodotDisplayVK.hide();
			}
			GodotDisplayVK.updateSize();

			let element: HTMLInputElement | HTMLTextAreaElement =
				GodotDisplayVK.textInput;
			switch (pType) {
				// KEYBOARD_TYPE_DEFAULT.
				case 0:
					element.type = "text";
					element.inputMode = "";
					break;
				// KEYBOARD_TYPE_MULTILINE.
				case 1:
					element = GodotDisplayVK.textArea;
					break;
				// KEYBOARD_TYPE_NUMBER.
				case 2:
					element.type = "text";
					element.inputMode = "numeric";
					break;
				// KEYBOARD_TYPE_NUMBER_DECIMAL.
				case 3:
					element.type = "text";
					element.inputMode = "decimal";
					break;
				// KEYBOARD_TYPE_PHONE.
				case 4:
					element.type = "tel";
					element.inputMode = "";
					break;
				// KEYBOARD_TYPE_EMAIL_ADDRESS.
				case 5:
					element.type = "email";
					element.inputMode = "";
					break;
				// KEYBOARD_TYPE_PASSWORD.
				case 6:
					element.type = "password";
					element.inputMode = "";
					break;
				// KEYBOARD_TYPE_URL.
				case 7:
					element.type = "url";
					element.inputMode = "";
					break;
				default:
					element.type = "text";
					element.inputMode = "";
			}

			element.readOnly = false;
			element.disabled = false;
			element.value = pText;
			element.style.display = "block";
			element.focus();
			element.setSelectionRange(pStart, pEnd);
		},

		hide: (): void => {
			if (
				GodotDisplayVK.textInput == null ||
				GodotDisplayVK.textArea == null
			) {
				return;
			}
			for (
				const element of [
					GodotDisplayVK.textArea,
					GodotDisplayVK.textInput,
				]
			) {
				element.blur();
				element.style.display = "none";
				element.value = "";
			}
		},

		updateSize: (): void => {
			if (
				GodotDisplayVK.textInput == null ||
				GodotDisplayVK.textArea == null
			) {
				return;
			}

			const rect = GodotConfig.canvas.getBoundingClientRect();
			const update = (
				element: HTMLInputElement | HTMLTextAreaElement,
			): void => {
				element.style.left = `${rect.left}px`;
				element.style.top = `${rect.top}px`;
				element.style.width = `${rect.width}px`;
				element.style.height = `${rect.height}px`;
			};
			update(GodotDisplayVK.textInput);
			update(GodotDisplayVK.textArea);
		},

		clear: (): void => {
			if (GodotDisplayVK.textInput != null) {
				GodotDisplayVK.textInput.remove();
				GodotDisplayVK.textInput = null;
			}
			if (GodotDisplayVK.textArea != null) {
				GodotDisplayVK.textArea.remove();
				GodotDisplayVK.textArea = null;
			}
		},
	},
};
autoAddDeps(_GodotDisplayVK, "$GodotDisplayVK");
addToLibrary(_GodotDisplayVK);

/*
 * Display server cursor helper.
 * Keeps track of cursor status and custom shapes.
 */
export const _GodotDisplayCursor = {
	$GodotDisplayCursor__deps: [
		"$GodotOS",
		"$GodotConfig",
	],
	$GodotDisplayCursor__postset: [
		"GodotOS.atExit(async() => { GodotDisplayCursor.clear(); });",
	].join(";"),
	$GodotDisplayCursor: {
		shape: "default",
		visible: true,
		cursors: {} as Record<string, { url: string; x: number; y: number }>,

		setStyle: (pStyle: string): void => {
			GodotConfig.canvas.style.cursor = pStyle;
		},

		setShape: (pShape: string): void => {
			GodotDisplayCursor.shape = pShape;
			let css = pShape;
			if (pShape in GodotDisplayCursor.cursors) {
				const cursor = GodotDisplayCursor.cursors[pShape];
				css = `url("${cursor.url}") ${cursor.x} ${cursor.y}, default`;
			}
			if (GodotDisplayCursor.visible) {
				GodotDisplayCursor.setStyle(css);
			}
		},

		clear: (): void => {
			GodotDisplayCursor.setStyle("");
			GodotDisplayCursor.shape = "default";
			GodotDisplayCursor.visible = true;
			for (const key of Object.keys(GodotDisplayCursor.cursors)) {
				URL.revokeObjectURL(GodotDisplayCursor.cursors[key].url);
				delete GodotDisplayCursor.cursors[key];
			}
		},

		lockPointer: (): void => {
			GodotConfig.canvas.requestPointerLock?.();
		},

		releasePointer: (): void => {
			document.exitPointerLock?.();
		},

		isPointerLocked: (): boolean => {
			return document.pointerLockElement === GodotConfig.canvas;
		},
	},
};
autoAddDeps(_GodotDisplayCursor, "$GodotDisplayCursor");
addToLibrary(_GodotDisplayCursor);

export const _GodotDisplayScreen = {
	$GodotDisplayScreen__deps: [
		"$GodotOS",
		"$GodotConfig",
		"$GL",
		"emscripten_webgl_get_current_context",
	],
	$GodotDisplayScreen: {
		desiredSize: [0, 0] as [number, number],
		hiDPI: true,

		getPixelRatio: (): number => {
			return GodotDisplayScreen.hiDPI
				? globalThis.devicePixelRatio ?? 1
				: 1;
		},

		isFullscreen: (): boolean => {
			return document.fullscreenElement === GodotConfig.canvas;
		},

		hasFullscreen: (): boolean => {
			return document.fullscreenEnabled;
		},

		requestFullscreen: (): boolean => {
			if (!GodotDisplayScreen.hasFullscreen()) {
				return false;
			}
			try {
				GodotConfig.canvas.requestFullscreen()?.catch((_error) => {
					// Nothing to do.
				});
			} catch (_error) {
				return false;
			}
			return true;
		},

		exitFullscreen: (): boolean => {
			if (!GodotDisplayScreen.isFullscreen()) {
				return true;
			}
			try {
				document.exitFullscreen()?.catch((_error) => {
					// Nothing to do.
				});
			} catch (_error) {
				return false;
			}
			return true;
		},

		updateSize: (): boolean => {
			const isFullscreen = GodotDisplayScreen.isFullscreen();
			const wantsFullWindow = GodotConfig.canvasResizePolicy === 2;
			const noResize = GodotConfig.canvasResizePolicy === 0;
			const desiredWidth = GodotDisplayScreen.desiredSize[0];
			const desiredHeight = GodotDisplayScreen.desiredSize[1];
			const canvas = GodotConfig.canvas;
			let width = desiredWidth;
			let height = desiredHeight;

			if (noResize) {
				// Don't resize canvas, just update GL if needed.
				if (canvas.width !== width || canvas.height !== height) {
					GodotDisplayScreen.desiredSize = [
						canvas.width,
						canvas.height,
					];
					GodotDisplayScreen._updateGL();
					return true;
				}
				return false;
			}

			const scale = GodotDisplayScreen.getPixelRatio();
			if (isFullscreen || wantsFullWindow) {
				// We need to match screen size.
				width = Math.floor(globalThis.innerWidth * scale);
				height = Math.floor(globalThis.innerHeight * scale);
			}

			const canvasStyleWidth = `${Math.floor(width / scale)}px`;
			const canvasStyleHeight = `${Math.floor(height / scale)}px`;
			if (
				canvas.style.width !== canvasStyleWidth ||
				canvas.style.height !== canvasStyleHeight ||
				canvas.width !== width || canvas.height !== height
			) {
				// Size doesn't match.
				// Resize canvas, set correct CSS pixel size, update GL.
				canvas.width = width;
				canvas.height = height;
				canvas.style.width = canvasStyleWidth;
				canvas.style.height = canvasStyleHeight;
				GodotDisplayScreen._updateGL();
				return true;
			}
			return false;
		},

		_updateGL: (): void => {
			const glContextHandle = _emscripten_webgl_get_current_context();
			const gl = GL.getContext(glContextHandle);
			if (gl != null) {
				GL.resizeOffscreenFramebuffer(gl);
			}
		},
	},
};
autoAddDeps(_GodotDisplayScreen, "$GodotDisplayScreen");
addToLibrary(_GodotDisplayScreen);

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
		return GodotRuntime.boolean(GodotOS.getCurrentOS() === "Windows");
	},

	godot_js_tts_is_speaking__proxy: "sync",
	godot_js_tts_is_speaking__sig: "i",
	godot_js_tts_is_speaking: (): CInt => {
		return GodotRuntime.boolean(globalThis.speechSynthesis.speaking);
	},

	godot_js_tts_is_paused__proxy: "sync",
	godot_js_tts_is_paused__sig: "i",
	godot_js_tts_is_paused: (): CInt => {
		return GodotRuntime.boolean(globalThis.speechSynthesis.paused);
	},

	godot_js_tts_get_voices__proxy: "sync",
	godot_js_tts_get_voices__sig: "vp",
	godot_js_tts_get_voices: (
		pCallbackPtr: CFunctionPointer<TTSGetVoicesCallback>,
	): void => {
		const callback = GodotRuntime.getFunction(
			pCallbackPtr,
		);
		try {
			const voicesStringArray = globalThis.speechSynthesis.getVoices()
				.map((pVoice) => {
					return `${pVoice.lang};${pVoice.name}`;
				});
			const voicesStringArrayPtr = GodotRuntime.allocStringArray(
				voicesStringArray,
			);
			callback(voicesStringArray.length as CInt, voicesStringArrayPtr);
			GodotRuntime.freeStringArray(
				voicesStringArrayPtr,
				voicesStringArray.length,
			);
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

		const utterance = new SpeechSynthesisUtterance(
			GodotRuntime.parseString(pTextPtr),
		);
		utterance.rate = pRate;
		utterance.pitch = pPitch;
		utterance.volume = pVolume / 100;
		GodotEventListeners.add(
			utterance,
			"end",
			(_pEvent: SpeechSynthesisEvent): void => {
				// TTS_UTTERANCE_ENDED.
				callback(1 as CInt, pUtteranceId as CInt, 0 as CInt);
			},
			false,
		);
		GodotEventListeners.add(
			utterance,
			"start",
			(_pEvent: SpeechSynthesisEvent): void => {
				// TTS_UTTERANCE_STARTED.
				callback(0 as CInt, pUtteranceId as CInt, 0 as CInt);
			},
			false,
		);
		GodotEventListeners.add(
			utterance,
			"error",
			(_pEvent: SpeechSynthesisEvent): void => {
				// TTS_UTTERANCE_CANCELED.
				callback(2 as CInt, pUtteranceId as CInt, 0 as CInt);
			},
			false,
		);
		GodotEventListeners.add(
			utterance,
			"boundary",
			(pEvent: SpeechSynthesisEvent): void => {
				// TTS_UTTERANCE_BOUNDARY.
				callback(
					3 as CInt,
					pUtteranceId as CInt,
					pEvent.charIndex as CInt,
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
		globalThis.alert(GodotRuntime.parseString(pTextPtr));
	},

	godot_js_display_screen_dpi_get__proxy: "sync",
	godot_js_display_screen_dpi_get__sig: "i",
	godot_js_display_screen_dpi_get: (): CInt => {
		return GodotDisplay.getDPI() as CInt;
	},

	godot_js_display_pixel_ratio_get__proxy: "sync",
	godot_js_display_pixel_ratio_get__sig: "f",
	godot_js_display_pixel_ratio_get: (): CFloat => {
		return GodotDisplayScreen.getPixelRatio() as CFloat;
	},

	godot_js_display_fullscreen_request__proxy: "sync",
	godot_js_display_fullscreen_request__sig: "i",
	godot_js_display_fullscreen_request: (): CInt => {
		return GodotDisplayScreen.requestFullscreen()
			? GodotRuntime.status.OK
			: GodotRuntime.status.FAILED;
	},

	godot_js_display_fullscreen_exit__proxy: "sync",
	godot_js_display_fullscreen_exit__sig: "i",
	godot_js_display_fullscreen_exit: (): CInt => {
		return GodotDisplayScreen.exitFullscreen()
			? GodotRuntime.status.OK
			: GodotRuntime.status.FAILED;
	},

	godot_js_display_desired_size_set__proxy: "sync",
	godot_js_display_desired_size_set__sig: "vii",
	godot_js_display_desired_size_set: (pWidth: CInt, pHeight: CInt): void => {
		GodotDisplayScreen.desiredSize = [pWidth, pHeight];
		GodotDisplayScreen.updateSize();
	},

	godot_js_display_size_update__proxy: "sync",
	godot_js_display_size_update__sig: "i",
	godot_js_display_size_update: (): CInt => {
		const updated = GodotDisplayScreen.updateSize();
		if (updated) {
			GodotDisplayVK.updateSize();
		}
		return GodotRuntime.boolean(updated);
	},

	godot_js_display_screen_size_get__proxy: "sync",
	godot_js_display_screen_size_get__sig: "vpp",
	godot_js_display_screen_size_get: (
		pWidthPtr: CIntPointer,
		pHeightPtr: CIntPointer,
	): void => {
		const scale = GodotDisplayScreen.getPixelRatio();
		GodotRuntime.setHeapValue(
			pWidthPtr,
			globalThis.screen.width * scale,
			"i32",
		);
		GodotRuntime.setHeapValue(
			pHeightPtr,
			globalThis.screen.height * scale,
			"i32",
		);
	},

	godot_js_display_window_size_get__proxy: "sync",
	godot_js_display_window_size_get__sig: "vpp",
	godot_js_display_window_size_get: function (
		pWidthPtr: CIntPointer,
		pHeightPtr: CIntPointer,
	) {
		GodotRuntime.setHeapValue(pWidthPtr, GodotConfig.canvas.width, "i32");
		GodotRuntime.setHeapValue(pHeightPtr, GodotConfig.canvas.height, "i32");
	},

	godot_js_display_has_webgl__proxy: "sync",
	godot_js_display_has_webgl__sig: "ii",
	godot_js_display_has_webgl: (pVersion: CInt): CInt => {
		if (![1, 2].includes(pVersion)) {
			return GodotRuntime.boolean(false);
		}
		try {
			return GodotRuntime.boolean(
				document.createElement("canvas").getContext(
					pVersion === 2 ? "webgl2" : "webgl",
				) != null,
			);
		} catch (_error) {
			// Not available.
		}
		return GodotRuntime.boolean(false);
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
		return GodotRuntime.boolean(
			document.activeElement === GodotConfig.canvas,
		);
	},

	//
	// Touchscreen
	//
	godot_js_display_touchscreen_is_available__proxy: "sync",
	godot_js_display_touchscreen_is_available__sig: "i",
	godot_js_display_touchscreen_is_available: (): CInt => {
		return GodotRuntime.boolean("ontouchstart" in window);
	},

	//
	// Clipboard
	//
	godot_js_display_clipboard_set__proxy: "sync",
	godot_js_display_clipboard_set__sig: "ip",
	godot_js_display_clipboard_set: (pTextPtr: CCharPointer): CInt => {
		const text = GodotRuntime.parseString(pTextPtr);
		if (navigator.clipboard?.writeText == null) {
			return GodotRuntime.status.FAILED;
		}
		navigator.clipboard.writeText(text).catch((pError) => {
			// Setting OS clipboard is only possible from an input callback.
			GodotRuntime.error(
				"Setting OS clipboard is only possible from an input callback for the Web platform. Exception:",
				pError,
			);
		});
		return GodotRuntime.status.OK;
	},

	godot_js_display_clipboard_get__proxy: "sync",
	godot_js_display_clipboard_get__sig: "ip",
	godot_js_display_clipboard_get: (
		pCallbackPtr: CFunctionPointer<DisplayClipboardGetCallback>,
	): CInt => {
		const callback = GodotRuntime.getFunction(
			pCallbackPtr,
		);
		navigator.clipboard.readText().then((pResult) => {
			const resultPtr = GodotRuntime.allocString(pResult);
			callback(resultPtr);
			GodotRuntime.free(resultPtr);
		}).catch((_pError) => {
			// Fail graciously.
		});
		return GodotRuntime.status.OK;
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
	godot_js_display_window_icon_set: (
		pIconPtr: CUintPointer,
		pLength: CInt,
	): void => {
		let link = document.getElementById("-gd-engine-icon") as
			| HTMLLinkElement
			| null;
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
			const png = new Blob([
				GodotRuntime.heapSlice(HEAPU8, pIconPtr, pLength),
			], { type: "image/png" });
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
		return GodotRuntime.boolean(!GodotDisplayCursor.visible);
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
		const old_shape = GodotDisplayCursor.cursors[shape];
		if (pDataLength > 0) {
			const png = new Blob([
				GodotRuntime.heapSlice(HEAPU8, pDataPtr, pDataLength),
			], { type: "image/png" });
			const url = URL.createObjectURL(png);
			GodotDisplayCursor.cursors[shape] = {
				url,
				x: pHotspotX,
				y: pHotspotY,
			};
		} else {
			delete GodotDisplayCursor.cursors[shape];
		}
		if (shape === GodotDisplayCursor.shape) {
			GodotDisplayCursor.setShape(GodotDisplayCursor.shape);
		}
		if (old_shape) {
			URL.revokeObjectURL(old_shape.url);
		}
	},

	godot_js_display_cursor_lock_set__proxy: "sync",
	godot_js_display_cursor_lock_set__sig: "vi",
	godot_js_display_cursor_lock_set: (pLock: CInt): void => {
		if (pLock) {
			GodotDisplayCursor.lockPointer();
		} else {
			GodotDisplayCursor.releasePointer();
		}
	},

	godot_js_display_cursor_is_locked__proxy: "sync",
	godot_js_display_cursor_is_locked__sig: "i",
	godot_js_display_cursor_is_locked: (): CInt => {
		return GodotRuntime.boolean(GodotDisplayCursor.isPointerLocked());
	},

	//
	// Listeners
	//
	godot_js_display_fullscreen_cb__proxy: "sync",
	godot_js_display_fullscreen_cb__sig: "vp",
	godot_js_display_fullscreen_cb: (
		pCallbackPtr: CFunctionPointer<DisplayFullscreenCbCallback>,
	): void => {
		const canvas = GodotConfig.canvas;
		const callback = GodotRuntime.getFunction(
			pCallbackPtr,
		);
		GodotEventListeners.add(
			document,
			"fullscreenchange",
			(pEvent: Event) => {
				if (pEvent.target === canvas) {
					callback(
						GodotRuntime.boolean(GodotDisplayScreen.isFullscreen()),
					);
				}
			},
			false,
		);
	},

	godot_js_display_window_blur_cb__proxy: "sync",
	godot_js_display_window_blur_cb__sig: "vp",
	godot_js_display_window_blur_cb: (
		pCallbackPtr: CFunctionPointer<DisplayWindowBlurCbCallback>,
	): void => {
		const callback = GodotRuntime.getFunction(
			pCallbackPtr,
		);
		GodotEventListeners.add(window, "blur", () => {
			callback();
		}, false);
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
		for (
			const [code, event] of [
				[pEnter, "mouseover"],
				[pExit, "mouseleave"],
				[pIn, "focus"],
				[pOut, "blur"],
			] as [CInt, string][]
		) {
			GodotEventListeners.add(
				canvas,
				event,
				(_pEvent: MouseEvent): void => {
					callback(code as CInt);
				},
			);
		}
	},

	godot_js_display_setup_canvas__proxy: "sync",
	godot_js_display_setup_canvas__sig: "viiii",
	godot_js_display_setup_canvas: (
		pWidth: CInt,
		pHeight: CInt,
		pFullscreen: CInt,
		pHiDPI: CInt,
	): void => {
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
				alert("WebGL context lost, please reload the page");
				pEvent.preventDefault();
			},
			false,
		);
		GodotDisplayScreen.hiDPI = Boolean(pHiDPI);
		switch (GodotConfig.canvasResizePolicy) {
			case 0: // None
				GodotDisplayScreen.desiredSize = [canvas.width, canvas.height];
				break;
			case 1: // Project
				GodotDisplayScreen.desiredSize = [pWidth, pHeight];
				break;
			default: // Full window
				// Ensure we display in the right place, the size will be handled by updateSize
				canvas.style.position = "absolute";
				canvas.style.top = "0";
				canvas.style.left = "0";
				break;
		}
		GodotDisplayScreen.updateSize();
		if (pFullscreen) {
			GodotDisplayScreen.requestFullscreen();
		}
	},

	//
	// Virtual keyboard
	//
	godot_js_display_vk_show__proxy: "sync",
	godot_js_display_vk_show__sig: "vpiii",
	godot_js_display_vk_show: (
		pTextPtr: CCharPointer,
		pType: CInt,
		pStart: CInt,
		pEnd: CInt,
	): void => {
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
		return GodotRuntime.boolean(GodotDisplayVK.isAvailable());
	},

	godot_js_display_tts_available__proxy: "sync",
	godot_js_display_tts_available__sig: "i",
	godot_js_display_tts_available: (): CInt => {
		return GodotRuntime.boolean("speechSynthesis" in window);
	},

	godot_js_display_vk_cb__proxy: "sync",
	godot_js_display_vk_cb__sig: "vp",
	godot_js_display_vk_cb: (
		pInputCallbackPtr: CFunctionPointer<DisplayVkCbCallback>,
	): void => {
		const inputCallback = GodotRuntime.getFunction(pInputCallbackPtr);
		if (GodotDisplayVK.isAvailable()) {
			GodotDisplayVK.initialize((pInputPtr, pSelectionEnd) => {
				inputCallback(pInputPtr, pSelectionEnd as CInt);
			});
		}
	},
};
autoAddDeps(_GodotDisplay, "$GodotDisplay");
addToLibrary(_GodotDisplay);
