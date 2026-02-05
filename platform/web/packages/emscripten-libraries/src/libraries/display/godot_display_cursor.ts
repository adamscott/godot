/**************************************************************************/
/*  godot_display_cursor.ts                                               */
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

import { convertFunctionToIifeString as $convertFunctionToIifeString } from "@godotengine/utils" with { type: "macro" };

interface Cursor {
	url: string;
	x: number;
	y: number;
}

/*
 * Display server cursor helper.
 * Keeps track of cursor status and custom shapes.
 */
export const _GodotDisplayCursor = {
	$GodotDisplayCursor__deps: ["$GodotOS", "$GodotConfig"] as const,
	$GodotDisplayCursor__postset: $convertFunctionToIifeString(() => {
		GodotDisplayCursor.init();
		GodotOS.atExit(async () => {
			GodotDisplayCursor.clear();
		});
	}),
	$GodotDisplayCursor: {
		shape: "default",
		visible: true,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- We want to type `cursors:`, `satisfies` doesn't.
		cursors: null as unknown as Map<string, Cursor>,

		init: (): void => {
			GodotDisplayCursor.cursors = new Map();
		},

		setStyle: (pStyle: string): void => {
			const canvas = GodotConfig.canvas;
			if (canvas == null) {
				return;
			}
			canvas.style.cursor = pStyle;
		},

		setShape: (pShape: string): void => {
			GodotDisplayCursor.shape = pShape;
			let css = pShape;
			const cursor = GodotDisplayCursor.cursors.get(pShape);
			if (cursor != null) {
				GodotDisplayCursor.cursors.delete(pShape);
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
			for (const [key, cursor] of GodotDisplayCursor.cursors) {
				URL.revokeObjectURL(cursor.url);
				GodotDisplayCursor.cursors.delete(key);
			}
		},

		lockPointer: (): void => {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- The lock is not supported by all browsers. It may not be available.
			GodotConfig.canvas?.requestPointerLock?.().catch((pError: unknown) => {
				GodotRuntime.error("Error while requesting pointer lock:", pError);
			});
		},

		releasePointer: (): void => {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- The lock is not supported by all browsers. It may not be available.
			document.exitPointerLock?.();
		},

		isPointerLocked: (): boolean => {
			return document.pointerLockElement === GodotConfig.canvas;
		},
	},
};
autoAddDeps(_GodotDisplayCursor, "$GodotDisplayCursor");
addToLibrary(_GodotDisplayCursor);
