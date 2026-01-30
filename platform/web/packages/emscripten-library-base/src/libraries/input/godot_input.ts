/**************************************************************************/
/*  godot_input.ts                                                        */
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
	CDouble,
	CDoublePointer,
	CFloat,
	CFloatArrayPointer,
	CFloatPointer,
	CFunctionPointer,
	CInt,
	CIntPointer,
	CUint,
	CUintPointer,
} from "@godotengine/emscripten-utils/types";

type InputMouseButtonCbCallback = (pPressed: CInt, pButton: CInt, pX: CDouble, pY: CDouble, pModifiers: CInt) => CInt;
type InputMouseMoveCbCallback = (
	pX: CDouble,
	pY: CDouble,
	pRelativeX: CDouble,
	pRelativeY: CDouble,
	pModifiers: CInt,
) => void;
type InputMouseWheelCbCallback = (pDeltaX: CDouble, pDeltaY: CDouble) => CInt;
type InputTouchCbCallback = (pType: CInt, pCount: CInt) => void;
type InputKeyCbCallback = (pType: CInt, pRepeat: CInt, pModifiers: CInt) => void;

type SetIMECbIMECallback = (pType: CInt, pTextPtr: CCharPointer) => void;
type SetIMECbKeyCallback = (pType: CInt, pRepeat: CInt, pModifiers: CInt) => void;

type InputGamepadCbCallback = (pIndex: CInt, pConnected: CInt, pIdPtr: CCharPointer, pGuidPtr: CCharPointer) => void;

type InputPasteCbCallback = (pTextPtr: CCharPointer) => void;
type InputDropFilesCbCallback = (pFileV: CCharArrayPointer, pFileC: CInt) => void;

export const GodotInputTouchType = {
	start: 0,
	end: 1,
	cancel: 2,
	move: 3,
} as const;

export const _GodotInput = {
	$GodotInput__deps: [
		"$GodotRuntime",
		"$GodotConfig",
		"$GodotEventListeners",
		"$GodotInputGamepads",
		"$GodotInputDragDrop",
		"$GodotIME",
	] as const,
	$GodotInput: {
		computePosition: (pEvent: MouseEvent | Touch, pRect: DOMRect): [number, number] => {
			const canvas = GodotConfig.canvas;
			if (canvas == null) {
				return [0, 0];
			}

			const rectWidth = canvas.width / pRect.width;
			const rectHeight = canvas.height / pRect.height;
			const x = (pEvent.clientX - pRect.x) * rectWidth;
			const y = (pEvent.clientY - pRect.y) * rectHeight;
			return [x, y];
		},
	},

	//
	// Mouse API.
	//
	godot_js_input_mouse_move_cb__proxy: "sync",
	godot_js_input_mouse_move_cb__sig: "vp",
	godot_js_input_mouse_move_cb: (pCallbackPtr: CFunctionPointer<InputMouseMoveCbCallback>): void => {
		const canvas = GodotConfig.canvas;
		if (canvas == null) {
			return;
		}

		const callback = GodotRuntime.getFunction(pCallbackPtr);
		const moveEventCallback = (pEvent: MouseEvent): void => {
			const rect = canvas.getBoundingClientRect();
			const position = GodotInput.computePosition(pEvent, rect);
			// Scale movement
			const rectWidth = canvas.width / rect.width;
			const rectHeight = canvas.height / rect.height;
			const relativePositionX = pEvent.movementX * rectWidth;
			const relativePositionY = pEvent.movementY * rectHeight;
			const modifiers = GodotIME.getModifiers(pEvent);
			callback(
				GodotRuntime.asCType<CDouble>(position[0]),
				GodotRuntime.asCType<CDouble>(position[1]),
				GodotRuntime.asCType<CDouble>(relativePositionX),
				GodotRuntime.asCType<CDouble>(relativePositionY),
				GodotRuntime.asCInt(modifiers),
			);
		};
		GodotEventListeners.add(window, "mousemove", moveEventCallback, false);
	},

	godot_js_input_mouse_wheel_cb__proxy: "sync",
	godot_js_input_mouse_wheel_cb__sig: "vp",
	godot_js_input_mouse_wheel_cb: (pCallbackPtr: CFunctionPointer<InputMouseWheelCbCallback>): void => {
		const callback = GodotRuntime.getFunction(pCallbackPtr);
		const wheelEventCallback = (pEvent: WheelEvent): void => {
			if (
				callback(GodotRuntime.asCType<CDouble>(pEvent.deltaX), GodotRuntime.asCType<CDouble>(pEvent.deltaY)) !==
				GodotRuntime.asCInt(0)
			) {
				pEvent.preventDefault();
			}
		};
		const canvas = GodotConfig.canvas;
		if (canvas != null) {
			GodotEventListeners.add(canvas, "wheel", wheelEventCallback, false);
		}
	},

	godot_js_input_mouse_button_cb__proxy: "sync",
	godot_js_input_mouse_button_cb__sig: "vp",
	godot_js_input_mouse_button_cb: (pCallbackPtr: CFunctionPointer<InputMouseButtonCbCallback>): void => {
		const canvas = GodotConfig.canvas;
		if (canvas == null) {
			return;
		}

		const callback = GodotRuntime.getFunction(pCallbackPtr);
		const mouseEventCallback = (pEvent: MouseEvent, pPressed: boolean): void => {
			const rect = canvas.getBoundingClientRect();
			const position = GodotInput.computePosition(pEvent, rect);
			const modifiers = GodotIME.getModifiers(pEvent);
			// Since the event is consumed, focus manually.
			// NOTE: The iframe container may not have focus yet, so focus even when already active.
			if (pPressed) {
				canvas.focus();
			}
			if (
				callback(
					GodotRuntime.asCIntBoolean(pPressed),
					GodotRuntime.asCInt(pEvent.button),
					GodotRuntime.asCType<CDouble>(position[0]),
					GodotRuntime.asCType<CDouble>(position[1]),
					GodotRuntime.asCInt(modifiers),
				) !== 0
			) {
				pEvent.preventDefault();
			}
		};
		GodotEventListeners.add(
			canvas,
			"mousedown",
			(pEvent: MouseEvent) => {
				mouseEventCallback(pEvent, true);
			},
			false,
		);
		GodotEventListeners.add(
			canvas,
			"mouseup",
			(pEvent: MouseEvent) => {
				mouseEventCallback(pEvent, false);
			},
			false,
		);
	},

	//
	// Touch API.
	//
	godot_js_input_touch_cb__proxy: "sync",
	godot_js_input_touch_cb__sig: "vppp",
	godot_js_input_touch_cb: (
		pCallbackPtr: CFunctionPointer<InputTouchCbCallback>,
		pIdsPtr: CUintPointer,
		pCoordsPtr: CDoublePointer,
	): void => {
		const canvas = GodotConfig.canvas;
		if (canvas == null) {
			return;
		}

		const callback = GodotRuntime.getFunction(pCallbackPtr);
		const touchEventCallback = (
			pEvent: TouchEvent,
			pType: (typeof GodotInputTouchType)[keyof typeof GodotInputTouchType],
		): void => {
			if (pType === GodotInputTouchType.start) {
				canvas.focus();
			}
			const rect = canvas.getBoundingClientRect();
			const touches = Array.from(pEvent.changedTouches);
			for (let i = 0; i < touches.length; i++) {
				const touch = touches[i];
				const position = GodotInput.computePosition(touch, rect);
				GodotRuntime.setHeapValue(
					GodotRuntime.asCType<CDoublePointer>(pCoordsPtr + i * 2 * Float64Array.BYTES_PER_ELEMENT),
					GodotRuntime.asCType<CDouble>(position[0]),
					"double",
				);
				GodotRuntime.setHeapValue(
					GodotRuntime.asCType<CDoublePointer>(pCoordsPtr + (i * 2 + 1) * Float64Array.BYTES_PER_ELEMENT),
					GodotRuntime.asCType<CDouble>(position[1]),
					"double",
				);
				GodotRuntime.setHeapValue(
					GodotRuntime.asCType<CUintPointer>(pIdsPtr + i * Uint32Array.BYTES_PER_ELEMENT),
					GodotRuntime.asCType<CUint>(touch.identifier),
					"i32",
				);
			}
			let callbackType = 0;
			switch (pType) {
				case GodotInputTouchType.start:
					callbackType = 0;
					break;
				case GodotInputTouchType.end:
				case GodotInputTouchType.cancel:
					callbackType = 1;
					break;
				case GodotInputTouchType.move:
					callbackType = 2;
					break;
			}
			callback(GodotRuntime.asCInt(callbackType), GodotRuntime.asCInt(touches.length));
			if (pEvent.cancelable) {
				pEvent.preventDefault();
			}
		};

		GodotEventListeners.add(
			canvas,
			"touchstart",
			(pEvent: TouchEvent) => {
				touchEventCallback(pEvent, GodotInputTouchType.start);
			},
			false,
		);
		GodotEventListeners.add(
			canvas,
			"touchend",
			(pEvent: TouchEvent) => {
				touchEventCallback(pEvent, GodotInputTouchType.end);
			},
			false,
		);
		GodotEventListeners.add(
			canvas,
			"touchcancel",
			(pEvent: TouchEvent) => {
				touchEventCallback(pEvent, GodotInputTouchType.cancel);
			},
			false,
		);
		GodotEventListeners.add(
			canvas,
			"touchmove",
			(pEvent: TouchEvent) => {
				touchEventCallback(pEvent, GodotInputTouchType.move);
			},
			false,
		);
	},

	//
	// Key API.
	//
	godot_js_input_key_cb__proxy: "sync",
	godot_js_input_key_cb__sig: "vppp",
	godot_js_input_key_cb: (
		pCallbackPtr: CFunctionPointer<InputKeyCbCallback>,
		pCodePtr: CCharArrayPointer,
		pKeyPtr: CCharArrayPointer,
	): void => {
		const canvas = GodotConfig.canvas;
		if (canvas == null) {
			return;
		}

		const callback = GodotRuntime.getFunction(pCallbackPtr);
		const keyboardEventHandler = (pEvent: KeyboardEvent, pPressed: boolean): void => {
			const modifiers = GodotIME.getModifiers(pEvent);
			GodotRuntime.stringToHeap(pEvent.code, pCodePtr, 32);
			GodotRuntime.stringToHeap(pEvent.key, pKeyPtr, 32);
			callback(
				GodotRuntime.asCIntBoolean(pPressed),
				GodotRuntime.asCIntBoolean(pEvent.repeat),
				GodotRuntime.asCInt(modifiers),
			);
			pEvent.preventDefault();
		};

		GodotEventListeners.add(
			canvas,
			"keydown",
			(pEvent: KeyboardEvent) => {
				keyboardEventHandler(pEvent, true);
			},
			false,
		);
		GodotEventListeners.add(
			canvas,
			"keyup",
			(pEvent: KeyboardEvent) => {
				keyboardEventHandler(pEvent, false);
			},
			false,
		);
	},

	//
	// IME API.
	//
	godot_js_set_ime_active__proxy: "sync",
	godot_js_set_ime_active__sig: "vi",
	godot_js_set_ime_active: (pActive: CInt): void => {
		GodotIME.setActive(Boolean(pActive));
	},

	godot_js_set_ime_position__proxy: "sync",
	godot_js_set_ime_position__sig: "vii",
	godot_js_set_ime_position: (pX: CInt, pY: CInt): void => {
		GodotIME.setPosition(pX, pY);
	},

	godot_js_set_ime_cb__proxy: "sync",
	godot_js_set_ime_cb__sig: "vpppp",
	godot_js_set_ime_cb: (
		pIMECallbackPtr: CFunctionPointer<SetIMECbIMECallback>,
		pKeyCallbackPtr: CFunctionPointer<SetIMECbKeyCallback>,
		pCodePtr: CCharArrayPointer,
		pKeyPtr: CCharArrayPointer,
	): void => {
		const imeCallback = GodotRuntime.getFunction(pIMECallbackPtr);
		const keyCallback = GodotRuntime.getFunction(pKeyCallbackPtr);

		const imeCallbackWrapper: Parameters<typeof GodotIME.initialize>[0] = (pCompositionType, pStringPtr): void => {
			imeCallback(
				GodotRuntime.asCInt(pCompositionType),
				GodotRuntime.asCType<CCharPointer>(pStringPtr ?? GodotRuntime.NULLPTR),
			);
		};
		const keyCallbackWrapper: Parameters<typeof GodotIME.initialize>[1] = (pPressed, pRepeat, pModifiers): void => {
			keyCallback(
				GodotRuntime.asCIntBoolean(pPressed),
				GodotRuntime.asCIntBoolean(pRepeat),
				GodotRuntime.asCInt(pModifiers),
			);
		};

		GodotIME.initialize(imeCallbackWrapper, keyCallbackWrapper, pCodePtr, pKeyPtr);
	},

	godot_js_is_ime_focused__proxy: "sync",
	godot_js_is_ime_focused__sig: "i",
	godot_js_is_ime_focused: (): CInt => {
		return GodotRuntime.asCIntBoolean(GodotIME.getActive());
	},

	//
	// Gamepad API.
	//
	godot_js_input_gamepad_cb__proxy: "sync",
	godot_js_input_gamepad_cb__sig: "vp",
	godot_js_input_gamepad_cb: (pOnChangeCallbackPtr: CFunctionPointer<InputGamepadCbCallback>): void => {
		const onChangeCallback = GodotRuntime.getFunction(pOnChangeCallbackPtr);
		const onChangeCallbackWrapper: Parameters<typeof GodotInputGamepads.initialize>[0] = (
			pPadIndex,
			pConnected,
			pIdPtr,
			pGuidPtr,
		) => {
			onChangeCallback(
				GodotRuntime.asCInt(pPadIndex),
				GodotRuntime.asCIntBoolean(pConnected),
				GodotRuntime.asCType<CCharPointer>(pIdPtr ?? GodotRuntime.NULLPTR),
				GodotRuntime.asCType<CCharPointer>(pGuidPtr ?? GodotRuntime.NULLPTR),
			);
		};
		GodotInputGamepads.initialize(onChangeCallbackWrapper);
	},

	godot_js_input_gamepad_sample_count__proxy: "sync",
	godot_js_input_gamepad_sample_count__sig: "i",
	godot_js_input_gamepad_sample_count: (): CInt => {
		return GodotRuntime.asCInt(GodotInputGamepads.getSamples().length);
	},

	godot_js_input_gamepad_sample__proxy: "sync",
	godot_js_input_gamepad_sample__sig: "i",
	godot_js_input_gamepad_sample: (): CInt => {
		return GodotRuntime.asCInt(GodotInputGamepads.sampleGamepads());
	},

	godot_js_input_gamepad_sample_get__proxy: "sync",
	godot_js_input_gamepad_sample_get__sig: "iippppp",
	godot_js_input_gamepad_sample_get: (
		pIndex: CInt,
		rButtonsPtr: CFloatArrayPointer,
		rButtonsCountPtr: CIntPointer,
		rAxesPtr: CFloatArrayPointer,
		rAxesCountPtr: CIntPointer,
		rStandardPtr: CIntPointer,
	): CInt => {
		const sample = GodotInputGamepads.getSample(pIndex);
		if (sample == null) {
			return GodotRuntime.CIntError.FAILED;
		}
		if (!sample.connected) {
			return GodotRuntime.CIntError.FAILED;
		}

		const buttons = sample.buttons;
		const buttonsCount = Math.min(buttons.length, 16);
		for (let i = 0; i < buttonsCount; i++) {
			GodotRuntime.setHeapValue(
				GodotRuntime.asCType<CFloatPointer>(rButtonsPtr + (i << 2)),
				GodotRuntime.asCType<CFloat>(buttons[i]),
				"float",
			);
		}
		GodotRuntime.setHeapValue(rButtonsCountPtr, GodotRuntime.asCInt(buttonsCount), "i32");

		const axes = sample.axes;
		const axesCount = Math.min(axes.length, 10);
		for (let i = 0; i < axesCount; i++) {
			GodotRuntime.setHeapValue(
				GodotRuntime.asCType<CFloatPointer>(rAxesPtr + (i << 2)),
				GodotRuntime.asCType<CFloat>(axes[i]),
				"float",
			);
		}
		GodotRuntime.setHeapValue(rAxesCountPtr, GodotRuntime.asCInt(axesCount), "i32");

		GodotRuntime.setHeapValue(rStandardPtr, GodotRuntime.asCIntBoolean(sample.standard), "i32");

		return GodotRuntime.CIntError.OK;
	},

	//
	// Paste API.
	//
	godot_js_input_paste_cb__proxy: "sync",
	godot_js_input_paste_cb__sig: "vp",
	godot_js_input_paste_cb: (pCallbackPtr: CFunctionPointer<InputPasteCbCallback>): void => {
		const callback = GodotRuntime.getFunction(pCallbackPtr);
		const pasteEventHandler = (pEvent: ClipboardEvent): void => {
			const text = pEvent.clipboardData?.getData("text");
			if (text == null) {
				return;
			}
			const textPtr = GodotRuntime.allocString(text);
			callback(textPtr);
			GodotRuntime.free(textPtr);
		};

		GodotEventListeners.add(globalThis, "paste", pasteEventHandler, false);
	},

	//
	// Drag&Drop API.
	//
	godot_js_input_drop_files_cb__proxy: "sync",
	godot_js_input_drop_files_cb__sig: "vp",
	godot_js_input_drop_files_cb: (pCallbackPtr: CFunctionPointer<InputDropFilesCbCallback>): void => {
		const canvas = GodotConfig.canvas;
		if (canvas == null) {
			return;
		}

		const callback = GodotRuntime.getFunction(pCallbackPtr);
		const dropEventHandler = (files: string[]): void => {
			const args = files;
			if (args.length === 0) {
				return;
			}
			const argc = GodotRuntime.asCInt(args.length);
			const argv = GodotRuntime.allocStringArray(args);
			callback(argv, argc);
			GodotRuntime.freeStringArray(argv, argc);
		};

		GodotEventListeners.add(canvas, "dragover", (pEvent: DragEvent) => {
			// Prevent default behavior (which would try to open the file(s)).
			pEvent.preventDefault();
		});
		GodotEventListeners.add(canvas, "drop", GodotInputDragDrop.handler(dropEventHandler));
	},

	//
	// Vibration API.
	//
	godot_js_input_vibrate_handheld__proxy: "sync",
	godot_js_input_vibrate_handheld__sig: "vi",
	godot_js_input_vibrate_handheld: (pDurationMs: CInt): void => {
		if (typeof navigator.vibrate !== "function") {
			GodotRuntime.print("This browser doesn't support vibration.");
			return;
		}
		navigator.vibrate(pDurationMs);
	},
};

autoAddDeps(_GodotInput, "$GodotInput");
addToLibrary(_GodotInput);
