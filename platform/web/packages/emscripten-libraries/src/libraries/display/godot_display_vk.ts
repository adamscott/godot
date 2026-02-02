/**************************************************************************/
/*  godot_display_vk.ts                                                   */
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

import type { CCharPointer } from "@godotengine/emscripten-utils/types";

import { convertFunctionToIifeString as $convertFunctionToIifeString } from "@godotengine/utils" with { type: "macro" };

export const _GodotDisplayVK = {
	$GodotDisplayVK__deps: ["$GodotRuntime", "$GodotOS", "$GodotConfig", "$GodotEventListeners"],
	$GodotDisplayVK__postset: $convertFunctionToIifeString(() => {
		GodotOS.atExit(async () => {
			GodotDisplayVK.clear();
		});
	}),
	$GodotDisplayVK: {
		textInput: null as HTMLInputElement | null,
		textArea: null as HTMLTextAreaElement | null,

		initialize: (pInputCallback: (pInputPtr: CCharPointer, pSelectionEnd: number) => void) => {
			const create = <T extends "input" | "textarea">(pElementName: T): HTMLElementTagNameMap[T] => {
				const element = document.createElement(pElementName);
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
						const valuePtr = GodotRuntime.allocString(element.value);
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

				GodotConfig.canvas?.insertAdjacentElement("beforebegin", element);
				return element;
			};

			GodotDisplayVK.textInput = create("input");
			GodotDisplayVK.textArea = create("textarea");
			GodotDisplayVK.updateSize();
		},

		isAvailable: (): boolean => {
			return GodotConfig.virtualKeyboard && "ontouchstart" in globalThis;
		},

		show: (pText: string, pType: number, pStart: number, pEnd: number): void => {
			if (GodotDisplayVK.textInput == null || GodotDisplayVK.textArea == null) {
				return;
			}
			if (GodotDisplayVK.textInput.style.display !== "" || GodotDisplayVK.textArea.style.display !== "") {
				GodotDisplayVK.hide();
			}
			GodotDisplayVK.updateSize();

			let element: HTMLInputElement | HTMLTextAreaElement = GodotDisplayVK.textInput;
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
			if (GodotDisplayVK.textInput == null || GodotDisplayVK.textArea == null) {
				return;
			}
			for (const element of [GodotDisplayVK.textArea, GodotDisplayVK.textInput]) {
				element.blur();
				element.style.display = "none";
				element.value = "";
			}
		},

		updateSize: (): void => {
			if (GodotDisplayVK.textInput == null || GodotDisplayVK.textArea == null) {
				return;
			}

			const canvas = GodotConfig.canvas;
			if (canvas == null) {
				return;
			}

			const rect = canvas.getBoundingClientRect();
			const update = (element: HTMLInputElement | HTMLTextAreaElement): void => {
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
