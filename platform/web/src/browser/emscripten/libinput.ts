/**************************************************************************/
/*  libinput.ts                                                           */
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
import "+browser/types/extensions/datatransferitem_getasentry.ts";

// __emscripten_import_global_const_start
import { addToLibrary, autoAddDeps, CPointer, FS } from "./emscripten_lib.ts";
import { GodotRuntime } from "./runtime.ts";
import { GodotConfig, GodotEventListeners, GodotFS, GodotOS } from "./os.ts";
// __emscripten_import_global_const_end

import {
	CCharArrayPointer,
	CCharPointer,
	CDouble,
	CDoublePointer,
	CFloatArrayPointer,
	CInt,
	CIntPointer,
	CUintPointer,
	CVoidPointer,
} from "./emscripten_lib.ts";

const getModifiers = (pEvent: KeyboardEvent | MouseEvent): number => {
	return (Number(pEvent.shiftKey) << 0) +
		(Number(pEvent.altKey) << 1) + (Number(pEvent.ctrlKey) << 2) +
		(Number(pEvent.metaKey) << 3);
};

export const GodotIMECompositionType = Object.freeze({
	start: 0,
	update: 1,
	end: 2,
});

type InputMouseButtonCbCallback = (
	pPressed: CInt,
	pButton: CInt,
	pX: CDouble,
	pY: CDouble,
	pModifiers: CInt,
) => CInt;
type InputMouseMoveCbCallback = (
	pX: CDouble,
	pY: CDouble,
	pRelativeX: CDouble,
	pRelativeY: CDouble,
	pModifiers: CInt,
) => void;
type InputMouseWheelCbCallback = (
	pDeltaX: CDouble,
	pDeltaY: CDouble,
) => CInt;
type InputTouchCbCallback = (pType: CInt, pCount: CInt) => void;
type InputKeyCbCallback = (
	pType: CInt,
	pRepeat: CInt,
	pModifiers: CInt,
) => void;

type SetIMECbIMECallback = (pType: CInt, pTextPtr: CCharPointer) => void;
type SetIMECbKeyCallback = (
	pType: CInt,
	pRepeat: CInt,
	pModifiers: CInt,
) => void;

type InputGamepadCbCallback = (
	pIndex: CInt,
	pConnected: CInt,
	pIdPtr: CCharPointer,
	pGuidPtr: CCharPointer,
) => void;

type InputPasteCbCallback = (pTextPtr: CCharPointer) => void;
type InputDropFilesCbCallback = (
	pFileV: CCharArrayPointer,
	pFileC: CInt,
) => void;

// __emscripten_declare_global_const_start
export declare const GodotIME: typeof _GodotIME.$GodotIME;
// __emscripten_declare_global_const_end
const _GodotIME = {
	$GodotIME__deps: ["$GodotRuntime", "$GodotEventListeners"],
	$GodotIME__postset: "GodotOS.atExit(async () => { GodotIME.clear(); });",
	$GodotIME: {
		imeElement: null as HTMLDivElement | null,
		_active: false,
		focusTimerIntervalId: -1,

		initialize: (
			pIMECallback: (
				pCompositionType: typeof GodotIMECompositionType[
					keyof typeof GodotIMECompositionType
				],
				pStringPtr: CPointer | null,
			) => void,
			pKeyCallback: (
				pPressed: boolean,
				pRepeat: boolean,
				pModifiers: number,
			) => void,
			pCodePtr: CCharPointer,
			pKeyPtr: CCharPointer,
		): void => {
			const keyEventCallback = (
				pPressed: boolean,
				pEvent: KeyboardEvent,
			): void => {
				const modifiers = GodotIME.getModifiers(pEvent);
				GodotRuntime.stringToHeap(pEvent.code, pCodePtr, 32);
				GodotRuntime.stringToHeap(pEvent.key, pKeyPtr, 32);
				pKeyCallback(pPressed, pEvent.repeat, modifiers);
				pEvent.preventDefault();
			};

			const imeEventCallback = (pEvent: CompositionEvent): void => {
				if (GodotIME.imeElement == null) {
					return;
				}
				switch (pEvent.type) {
					case "compositionstart":
						pIMECallback(0, null);
						GodotIME.imeElement.innerHTML = "";
						break;
					case "compositionupdate":
						{
							const stringPtr = GodotRuntime.allocString(
								pEvent.data,
							);
							pIMECallback(1, stringPtr);
							GodotRuntime.free(stringPtr);
						}
						break;
					case "compositionend":
						{
							const stringPtr = GodotRuntime.allocString(
								pEvent.data,
							);
							pIMECallback(2, stringPtr);
							GodotRuntime.free(stringPtr);
							GodotIME.imeElement.innerHTML = "";
						}
						break;
					default:
						// Do nothing.
				}
			};

			const imeElement = document.createElement("div");
			imeElement.className = "ime";
			imeElement.style.background = "none";
			imeElement.style.opacity = "0";
			imeElement.style.position = "fixed";
			imeElement.style.textAlign = "left";
			imeElement.style.fontSize = "1px";
			imeElement.style.left = "0px";
			imeElement.style.top = "0px";
			imeElement.style.width = "100%";
			imeElement.style.height = "40px";
			imeElement.style.pointerEvents = "none";
			imeElement.style.display = "none";
			imeElement.contentEditable = "true";

			GodotEventListeners.add(
				imeElement,
				"compositionstart",
				imeEventCallback,
				false,
			);
			GodotEventListeners.add(
				imeElement,
				"compositionupdate",
				imeEventCallback,
				false,
			);
			GodotEventListeners.add(
				imeElement,
				"compositionend",
				imeEventCallback,
				false,
			);
			GodotEventListeners.add(
				imeElement,
				"keydown",
				keyEventCallback.bind(null, true),
				false,
			);
			GodotEventListeners.add(
				imeElement,
				"keyup",
				keyEventCallback.bind(null, false),
				false,
			);

			imeElement.addEventListener("blur", () => {
				imeElement.style.display = "none";
				GodotConfig.canvas.focus();
				GodotIME._active = false;
			});

			GodotConfig.canvas.parentElement?.appendChild(imeElement);
			GodotIME.imeElement = imeElement;
		},

		getModifiers,

		setActive: (pActive: boolean): void => {
			const clearFocusTimerInterval = (): void => {
				clearInterval(GodotIME.focusTimerIntervalId);
				GodotIME.focusTimerIntervalId = -1;
			};

			const focusTimer = (): void => {
				if (GodotIME.imeElement == null) {
					clearFocusTimerInterval();
					return;
				}
				GodotIME.imeElement.focus();
			};

			if (GodotIME.focusTimerIntervalId > -1) {
				clearFocusTimerInterval();
			}

			if (GodotIME.imeElement == null) {
				return;
			}

			GodotIME._active = pActive;
			if (pActive) {
				GodotIME.imeElement.style.display = "block";
				GodotIME.focusTimerIntervalId = setInterval(focusTimer, 100);
			} else {
				GodotIME.imeElement.style.display = "none";
				GodotConfig.canvas.focus();
			}
		},

		getActive: (): boolean => {
			return GodotIME._active;
		},

		setPosition: (pX: number, pY: number): void => {
			if (GodotIME.imeElement == null) {
				return;
			}
			const canvas = GodotConfig.canvas;
			const rect = canvas.getBoundingClientRect();
			const rectWidth = canvas.width / rect.width;
			const rectHeight = canvas.height / rect.height;
			const clX = (pX / rectWidth) + rect.x;
			const clY = (pY / rectHeight) + rect.y;

			GodotIME.imeElement.style.left = `${clX}px`;
			GodotIME.imeElement.style.top = `${clY}px`;
		},

		clear: function () {
			if (GodotIME.imeElement == null) {
				return;
			}
			if (GodotIME.focusTimerIntervalId > -1) {
				clearInterval(GodotIME.focusTimerIntervalId);
				GodotIME.focusTimerIntervalId = -1;
			}
			GodotIME.imeElement.remove();
			GodotIME.imeElement = null;
		},
	},
};
autoAddDeps(_GodotIME, "$GodotIME");
addToLibrary(_GodotIME);

export interface GodotInputGamepadSample {
	standard: boolean;
	buttons: number[];
	axes: number[];
	connected: boolean;
}

// __emscripten_declare_global_const_start
export declare const GodotInputGamepads:
	typeof _GodotInputGamepads.$GodotInputGamepads;
// __emscripten_declare_global_const_end
const _GodotInputGamepads = {
	$GodotInputGamepads__deps: ["$GodotRuntime", "$GodotEventListeners"],
	$GodotInputGamepads: {
		samples: [] as (GodotInputGamepadSample | null)[],

		initialize: (
			pOnChange: (
				pPadIndex: number,
				pConnected: boolean,
				pIdPtr?: CPointer,
				pGuidPtr?: CPointer,
			) => void,
		): void => {
			GodotInputGamepads.samples = [];

			const addPad = (pPad: Gamepad): void => {
				const guid = GodotInputGamepads.getGUID(pPad);
				const idPtr = GodotRuntime.allocString(pPad.id);
				const guidPtr = GodotRuntime.allocString(guid);
				pOnChange(pPad.index, true, idPtr, guidPtr);
			};

			const pads = GodotInputGamepads.getGamepads();
			for (const pad of pads) {
				if (pad == null) {
					continue;
				}
				addPad(pad);
			}

			GodotEventListeners.add(
				globalThis,
				"gamepadconnected",
				(pEvent: GamepadEvent) => {
					if (pEvent.gamepad != null) {
						addPad(pEvent.gamepad);
					}
				},
			);

			GodotEventListeners.add(
				globalThis,
				"gamepaddisconnected",
				(pEvent: GamepadEvent) => {
					if (pEvent.gamepad != null) {
						pOnChange(pEvent.gamepad.index, false);
					}
				},
			);
		},

		getGamepads: (): (Gamepad | null)[] => {
			try {
				// Will throw in iframe when permission is denied.
				// Will throw/warn in the future for insecure contexts.
				// See https://github.com/w3c/gamepad/pull/120
				const pads = navigator.getGamepads();
				if (pads) {
					return pads;
				}
				return [];
			} catch (_error) {
				return [];
			}
		},

		getSample: (pIndex: number): GodotInputGamepadSample | null => {
			const samples = GodotInputGamepads.samples;
			return pIndex < samples.length ? samples[pIndex] : null;
		},

		getSamples: (): (GodotInputGamepadSample | null)[] => {
			return GodotInputGamepads.samples;
		},

		sampleGamepads: (): number => {
			const gamepads = GodotInputGamepads.getGamepads();
			const samples: (GodotInputGamepadSample | null)[] = [];
			let activeGamepads = 0;
			for (const gamepad of gamepads) {
				if (gamepad == null) {
					samples.push(null);
					continue;
				}

				const gamepadSample = {
					standard: gamepad.mapping === "standard",
					buttons: gamepad.buttons.map((gamepadButtons) =>
						gamepadButtons.value
					),
					axes: [...gamepad.axes],
					connected: gamepad.connected,
				} satisfies GodotInputGamepadSample;

				samples.push(gamepadSample);
				activeGamepads += 1;
			}
			GodotInputGamepads.samples = samples;
			return activeGamepads;
		},

		getGUID: (pGamepad: Gamepad): string => {
			if (pGamepad.mapping) {
				return pGamepad.mapping;
			}
			const operatingSystem = GodotOS.getCurrentOS();
			const id = pGamepad.id;
			// Chrom* style: NAME (Vendor: xxxx Product: xxxx).
			const chromiumRegExp =
				/vendor: ([0-9a-f]{4}) product: ([0-9a-f]{4})/i;
			// Firefox/Safari style (Safari may remove leading zeroes).
			const nonChromiumRegExp = /^([0-9a-f]+)-([0-9a-f]+)-/i;
			let vendor = "";
			let product = "";
			const [match] = Array.from(
				id.matchAll(chromiumRegExp) ??
					id.matchAll(nonChromiumRegExp ?? []),
			);
			if (match != null) {
				vendor = match[1].padStart(4, "0");
				product = match[2].padStart(4, "0");
			}
			if (vendor === "" || product === "") {
				return `${operatingSystem}Unknown`;
			}
			return operatingSystem + vendor + product;
		},
	},
};
autoAddDeps(_GodotInputGamepads, "$GodotInputGamepads");
addToLibrary(_GodotInputGamepads);

export interface GodotInputFile {
	path: string;
	name: string;
	type: string;
	size: number;
	data: ArrayBuffer;
}

/*
 * Drag and drop helper.
 * This is pretty big, but basically detect dropped files on GodotConfig.canvas,
 * process them one by one (recursively for directories), and copies them to
 * the temporary FS path '/tmp/drop-[random]/' so it can be emitted as a godot
 * event (that requires a string array of paths).
 *
 * NOTE: The temporary files are removed after the callback. This means that
 * deferred callbacks won't be able to access the files.
 */
// __emscripten_declare_global_const_start
export declare const GodotInputDragDrop:
	typeof _GodotInputDragDrop.$GodotInputDragDrop;
// __emscripten_declare_global_const_end
const _GodotInputDragDrop = {
	$GodotInputDragDrop__deps: ["$FS", "$GodotFS"],
	$GodotInputDragDrop: {
		_promises: [] as Promise<void>[],
		_pendingFiles: [] as GodotInputFile[],

		addEntry: (pEntry: FileSystemEntry): void => {
			if (pEntry.isDirectory) {
				GodotInputDragDrop.addDirectory(
					pEntry as FileSystemDirectoryEntry,
				);
			} else if (pEntry.isFile) {
				GodotInputDragDrop.addFile(pEntry as FileSystemFileEntry);
			} else {
				GodotRuntime.error(
					"Unrecognized input drag&drop entry:",
					pEntry,
				);
			}
		},

		addDirectory: (pEntry: FileSystemDirectoryEntry): void => {
			GodotInputDragDrop._promises.push(
				new Promise((pResolve, pReject) => {
					const reader = pEntry.createReader();
					reader.readEntries((pEntries) => {
						for (const entry of pEntries) {
							GodotInputDragDrop.addEntry(entry);
						}
						pResolve(undefined);
					}, (pError) => {
						pReject(pError);
					});
				}),
			);
		},

		addFile: (pEntry: FileSystemFileEntry): void => {
			GodotInputDragDrop._promises.push(
				new Promise((pResolve, pReject) => {
					pEntry.file((pFile) => {
						const fileRelativePath = "relativePath" in pFile
							? pFile.relativePath as string
							: pFile.webkitRelativePath;
						const reader = new FileReader();
						reader.addEventListener("load", (_pEvent) => {
							const file = {
								path: fileRelativePath,
								name: pFile.name,
								type: pFile.type,
								size: pFile.size,
								data: reader.result as ArrayBuffer,
							} satisfies GodotInputFile;
							GodotInputDragDrop._pendingFiles.push(file);
							pResolve(undefined);
						});
						reader.addEventListener("error", (_pEvent) => {
							GodotRuntime.print(
								`Error reading file ${fileRelativePath}`,
							);
							pReject(reader.error);
						});
						reader.readAsArrayBuffer(pFile);
					}, (pError) => {
						GodotRuntime.error("Error parsing entry file", pError);
						pReject(pError);
					});
				}),
			);
		},

		processEvent: (
			pEvent: DragEvent,
			pCallback: (pFiles: string[]) => void,
		) => {
			pEvent.preventDefault();

			if (pEvent.dataTransfer?.items == null) {
				GodotRuntime.error("File upload is not supported.");
				return;
			}

			// Use DataTransferItemList interface to access the file(s)
			const dataTransferItems = Array.from(pEvent.dataTransfer.items);
			for (const dataTransferItem of dataTransferItems) {
				const entry = dataTransferItem.getAsEntry?.() ??
					dataTransferItem.webkitGetAsEntry();
				if (entry == null) {
					continue;
				}
				GodotInputDragDrop.addEntry(entry);
			}
			Promise.allSettled(GodotInputDragDrop._promises).then(() => {
				const dropTemporaryDirectoryPath = `/tmp/drop-${
					(Math.random() * (1 << 30)).toString(10)
				}/`;
				const dropPaths = [] as string[];
				const filePaths = [] as string[];

				// Without trailing slash
				FS.mkdir(dropTemporaryDirectoryPath.slice(0, -1));
				for (const pendingFile of GodotInputDragDrop._pendingFiles) {
					const path = pendingFile.path;
					GodotFS.copyToFS(
						dropTemporaryDirectoryPath + path,
						pendingFile.data,
					);
					let index = path.indexOf("/");
					if (index === -1) {
						// Root file.
						dropPaths.push(dropTemporaryDirectoryPath + path);
					} else {
						// Subdirectory.
						const subdirectory = path.substring(0, index);
						index = subdirectory.indexOf("/");
						if (
							index < 0 &&
							dropPaths.indexOf(
									dropTemporaryDirectoryPath + subdirectory,
								) === -1
						) {
							dropPaths.push(
								dropTemporaryDirectoryPath + subdirectory,
							);
						}
					}
					filePaths.push(dropTemporaryDirectoryPath + path);
				}

				GodotInputDragDrop._promises = [];
				GodotInputDragDrop._pendingFiles = [];
				pCallback(dropPaths);
			});
		},

		removeDrop: (pFiles: string[], pDropPath: string): void => {
			const directories = [pDropPath.substring(0, pDropPath.length - 1)];

			// Remove temporary files.
			for (const file of pFiles) {
				FS.unlink(file);
				const directory = file.replace(pDropPath, "");
				let index = directory.lastIndexOf("/");
				while (index > 0) {
					if (directories.indexOf(pDropPath + directory) === -1) {
						directories.push(pDropPath + directory);
					}
					index = directory.lastIndexOf("/");
				}
			}

			// Remove directories.
			directories.sort((a, b) => {
				const al = (a.match(/\//g) || []).length;
				const bl = (b.match(/\//g) || []).length;
				return al > bl ? -1 : Number(al < bl);
			});
			for (const directory of directories) {
				FS.rmdir(directory);
			}
		},

		handler:
			(pCallback: (pFiles: string[]) => void) => (pEvent: DragEvent) => {
				GodotInputDragDrop.processEvent(pEvent, pCallback);
			},
	},
};
autoAddDeps(_GodotInputDragDrop, "$GodotInputDragDrop");
addToLibrary(_GodotInputDragDrop);

export const GodotInputTouchType = Object.freeze({
	start: 0,
	end: 1,
	cancel: 2,
	move: 3,
});
// __emscripten_declare_global_const_start
export declare const GodotInput: typeof _GodotInput.$GodotInput;
// __emscripten_declare_global_const_end
const _GodotInput = {
	$GodotInput__deps: [
		"$GodotRuntime",
		"$GodotConfig",
		"$GodotEventListeners",
		"$GodotInputGamepads",
		"$GodotInputDragDrop",
		"$GodotIME",
	],
	$GodotInput: {
		getModifiers,

		computePosition: (
			pEvent: MouseEvent | Touch,
			pRect: DOMRect,
		): [number, number] => {
			const canvas = GodotConfig.canvas;
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
	godot_js_input_mouse_move_cb: (pCallbackPtr: CVoidPointer): void => {
		const canvas = GodotConfig.canvas;
		const callback = GodotRuntime.getFunction<InputMouseMoveCbCallback>(
			pCallbackPtr,
		);
		const moveEventCallback = (pEvent: MouseEvent): void => {
			const rect = canvas.getBoundingClientRect();
			const position = GodotInput.computePosition(pEvent, rect);
			// Scale movement
			const rectWidth = canvas.width / rect.width;
			const rectHeight = canvas.height / rect.height;
			const relativePositionX = pEvent.movementX * rectWidth;
			const relativePositionY = pEvent.movementY * rectHeight;
			const modifiers = GodotInput.getModifiers(pEvent);
			callback(
				position[0] as CDouble,
				position[1] as CDouble,
				relativePositionX as CDouble,
				relativePositionY as CDouble,
				modifiers as CInt,
			);
		};
		GodotEventListeners.add(window, "mousemove", moveEventCallback, false);
	},

	godot_js_input_mouse_wheel_cb__proxy: "sync",
	godot_js_input_mouse_wheel_cb__sig: "vp",
	godot_js_input_mouse_wheel_cb: (pCallbackPtr: CVoidPointer): void => {
		const callback = GodotRuntime.getFunction<InputMouseWheelCbCallback>(
			pCallbackPtr,
		);
		const wheelEventCallback = (pEvent: WheelEvent): void => {
			if (
				callback(
					(pEvent.deltaX ?? 0) as CDouble,
					(pEvent.deltaY ?? 0) as CDouble,
				) !== 0
			) {
				pEvent.preventDefault();
			}
		};
		GodotEventListeners.add(
			GodotConfig.canvas,
			"wheel",
			wheelEventCallback,
			false,
		);
	},

	godot_js_input_mouse_button_cb__proxy: "sync",
	godot_js_input_mouse_button_cb__sig: "vp",
	godot_js_input_mouse_button_cb: (pCallbackPtr: CVoidPointer): void => {
		const canvas = GodotConfig.canvas;
		const callback = GodotRuntime.getFunction<InputMouseButtonCbCallback>(
			pCallbackPtr,
		);
		const mouseEventCallback = (
			pEvent: MouseEvent,
			pPressed: boolean,
		): void => {
			const rect = canvas.getBoundingClientRect();
			const position = GodotInput.computePosition(pEvent, rect);
			const modifiers = GodotInput.getModifiers(pEvent);
			// Since the event is consumed, focus manually.
			// NOTE: The iframe container may not have focus yet, so focus even when already active.
			if (pPressed) {
				canvas.focus();
			}
			if (
				callback(
					Number(pPressed) as CInt,
					pEvent.button as CInt,
					position[0] as CDouble,
					position[1] as CDouble,
					modifiers as CInt,
				) !== 0
			) {
				pEvent.preventDefault();
			}
		};
		GodotEventListeners.add(
			canvas,
			"mousedown",
			(pEvent: MouseEvent) => mouseEventCallback(pEvent, true),
			false,
		);
		GodotEventListeners.add(
			canvas,
			"mouseup",
			(pEvent: MouseEvent) => mouseEventCallback(pEvent, false),
			false,
		);
	},

	//
	// Touch API.
	//
	godot_js_input_touch_cb__proxy: "sync",
	godot_js_input_touch_cb__sig: "vppp",
	godot_js_input_touch_cb: (
		pCallbackPtr: CVoidPointer,
		pIdsPtr: CUintPointer,
		pCoordsPtr: CDoublePointer,
	): void => {
		const canvas = GodotConfig.canvas;
		const callback = GodotRuntime.getFunction<InputTouchCbCallback>(
			pCallbackPtr,
		);
		const touchEventCallback = (
			pEvent: TouchEvent,
			pType: typeof GodotInputTouchType[keyof typeof GodotInputTouchType],
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
					(pCoordsPtr +
						(i * 2) * Float64Array.BYTES_PER_ELEMENT) as CPointer,
					position[0],
					"double",
				);
				GodotRuntime.setHeapValue(
					(pCoordsPtr +
						(i * 2 + 1) *
							Float64Array.BYTES_PER_ELEMENT) as CPointer,
					position[1],
					"double",
				);
				GodotRuntime.setHeapValue(
					(pIdsPtr + i * Int32Array.BYTES_PER_ELEMENT) as CPointer,
					touch.identifier,
					"i32",
				);
			}
			let callbackType: number;
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
			callback(callbackType as CInt, touches.length as CInt);
			if (pEvent.cancelable) {
				pEvent.preventDefault();
			}
		};

		GodotEventListeners.add(
			canvas,
			"touchstart",
			(pEvent: TouchEvent) =>
				touchEventCallback(pEvent, GodotInputTouchType.start),
			false,
		);
		GodotEventListeners.add(
			canvas,
			"touchend",
			(pEvent: TouchEvent) =>
				touchEventCallback(pEvent, GodotInputTouchType.end),
			false,
		);
		GodotEventListeners.add(
			canvas,
			"touchcancel",
			(pEvent: TouchEvent) =>
				touchEventCallback(pEvent, GodotInputTouchType.cancel),
			false,
		);
		GodotEventListeners.add(
			canvas,
			"touchmove",
			(pEvent: TouchEvent) =>
				touchEventCallback(pEvent, GodotInputTouchType.move),
			false,
		);
	},

	//
	// Key API.
	//
	godot_js_input_key_cb__proxy: "sync",
	godot_js_input_key_cb__sig: "vppp",
	godot_js_input_key_cb: (
		pCallbackPtr: CVoidPointer,
		pCodePtr: CCharArrayPointer,
		pKeyPtr: CCharArrayPointer,
	): void => {
		const canvas = GodotConfig.canvas;
		const callback = GodotRuntime.getFunction<InputKeyCbCallback>(
			pCallbackPtr,
		);
		const keyboardEventHandler = (
			pEvent: KeyboardEvent,
			pPressed: boolean,
		): void => {
			const modifiers = GodotInput.getModifiers(pEvent);
			GodotRuntime.stringToHeap(pEvent.code, pCodePtr, 32);
			GodotRuntime.stringToHeap(pEvent.key, pKeyPtr, 32);
			callback(
				Number(pPressed) as CInt,
				Number(pEvent.repeat) as CInt,
				modifiers as CInt,
			);
			pEvent.preventDefault();
		};

		GodotEventListeners.add(
			canvas,
			"keydown",
			(pEvent: KeyboardEvent) => keyboardEventHandler(pEvent, true),
			false,
		);
		GodotEventListeners.add(
			canvas,
			"keyup",
			(pEvent: KeyboardEvent) => keyboardEventHandler(pEvent, false),
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
		pIMECallbackPtr: CVoidPointer,
		pKeyCallbackPtr: CVoidPointer,
		pCodePtr: CCharArrayPointer,
		pKeyPtr: CCharArrayPointer,
	): void => {
		const imeCallback = GodotRuntime.getFunction<SetIMECbIMECallback>(
			pIMECallbackPtr,
		);
		const keyCallback = GodotRuntime.getFunction<SetIMECbKeyCallback>(
			pKeyCallbackPtr,
		);

		const imeCallbackWrapper: Parameters<typeof GodotIME.initialize>[0] = (
			pCompositionType,
			pStringPtr,
		): void => {
			imeCallback(
				pCompositionType as CInt,
				(pStringPtr ?? GodotRuntime.NULLPTR) as CCharPointer,
			);
		};
		const keyCallbackWrapper: Parameters<typeof GodotIME.initialize>[1] = (
			pPressed,
			pRepeat,
			pModifiers,
		): void => {
			keyCallback(
				Number(pPressed) as CInt,
				Number(pRepeat) as CInt,
				pModifiers as CInt,
			);
		};

		GodotIME.initialize(
			imeCallbackWrapper,
			keyCallbackWrapper,
			pCodePtr,
			pKeyPtr,
		);
	},

	godot_js_is_ime_focused__proxy: "sync",
	godot_js_is_ime_focused__sig: "i",
	godot_js_is_ime_focused: (): CInt => {
		return Number(GodotIME.getActive()) as CInt;
	},

	//
	// Gamepad API.
	//
	godot_js_input_gamepad_cb__proxy: "sync",
	godot_js_input_gamepad_cb__sig: "vp",
	godot_js_input_gamepad_cb: (pOnChangeCallbackPtr: CVoidPointer): void => {
		const onChangeCallback = GodotRuntime.getFunction<
			InputGamepadCbCallback
		>(pOnChangeCallbackPtr);
		const onChangeCallbackWrapper: Parameters<
			typeof GodotInputGamepads.initialize
		>[0] = (pPadIndex, pConnected, pIdPtr, pGuidPtr) => {
			onChangeCallback(
				pPadIndex as CInt,
				Number(pConnected) as CInt,
				(pIdPtr ?? GodotRuntime.NULLPTR) as CCharPointer,
				(pGuidPtr ?? GodotRuntime.NULLPTR) as CCharPointer,
			);
		};
		GodotInputGamepads.initialize(onChangeCallbackWrapper);
	},

	godot_js_input_gamepad_sample_count__proxy: "sync",
	godot_js_input_gamepad_sample_count__sig: "i",
	godot_js_input_gamepad_sample_count: (): CInt => {
		return GodotInputGamepads.getSamples().length as CInt;
	},

	godot_js_input_gamepad_sample__proxy: "sync",
	godot_js_input_gamepad_sample__sig: "i",
	godot_js_input_gamepad_sample: (): CInt => {
		return GodotInputGamepads.sampleGamepads() as CInt;
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
		if (sample == null || !sample.connected) {
			return 1 as CInt;
		}

		const buttons = sample.buttons;
		const buttonsCount = Math.min(buttons.length, 16);
		for (let i = 0; i < buttonsCount; i++) {
			GodotRuntime.setHeapValue(
				(rButtonsPtr + (i << 2)) as CPointer,
				buttons[i],
				"float",
			);
		}
		GodotRuntime.setHeapValue(rButtonsCountPtr, buttonsCount, "i32");

		const axes = sample.axes;
		const axesCount = Math.min(axes.length, 10);
		for (let i = 0; i < axesCount; i++) {
			GodotRuntime.setHeapValue(
				(rAxesPtr + (i << 2)) as CPointer,
				axes[i],
				"float",
			);
		}
		GodotRuntime.setHeapValue(rAxesCountPtr, axesCount, "i32");

		GodotRuntime.setHeapValue(rStandardPtr, Number(sample.standard), "i32");

		return 0 as CInt;
	},

	//
	// Paste API.
	//
	godot_js_input_paste_cb__proxy: "sync",
	godot_js_input_paste_cb__sig: "vp",
	godot_js_input_paste_cb: (pCallbackPtr: CVoidPointer): void => {
		const callback = GodotRuntime.getFunction<InputPasteCbCallback>(
			pCallbackPtr,
		);
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
	godot_js_input_drop_files_cb: (pCallbackPtr: CVoidPointer): void => {
		const canvas = GodotConfig.canvas;
		const callback = GodotRuntime.getFunction<InputDropFilesCbCallback>(
			pCallbackPtr,
		);
		const dropEventHandler = (files: string[]): void => {
			const args = files ?? [];
			if (args.length === 0) {
				return;
			}
			const argc = args.length as CInt;
			const argv = GodotRuntime.allocStringArray(args);
			callback(argv, argc);
			GodotRuntime.freeStringArray(argv, argc);
		};

		GodotEventListeners.add(canvas, "dragover", (pEvent: DragEvent) => {
			// Prevent default behavior (which would try to open the file(s)).
			pEvent.preventDefault();
		});
		GodotEventListeners.add(
			canvas,
			"drop",
			GodotInputDragDrop.handler(dropEventHandler),
		);
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
