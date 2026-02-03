/**************************************************************************/
/*  godot_display_screen.ts                                               */
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
	GL,
	GodotConfig,
	GodotDisplayScreen,
	_emscripten_webgl_get_current_context,
	addToLibrary,
	autoAddDeps,
} from "#/external/index.js";

export const _GodotDisplayScreen = {
	$GodotDisplayScreen__deps: ["$GodotOS", "$GodotConfig", "$GL", "emscripten_webgl_get_current_context"],
	$GodotDisplayScreen: {
		desiredSize: {
			width: 0,
			height: 0,
		},
		hiDPI: true,

		getPixelRatio: (): number => {
			// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- This property is not available in every browser.
			return GodotDisplayScreen.hiDPI ? (globalThis.devicePixelRatio ?? 1) : 1;
		},

		isFullscreen: (): boolean => {
			return document.fullscreenElement === GodotConfig.canvas;
		},

		hasFullscreen: (): boolean => {
			return document.fullscreenEnabled;
		},

		requestFullscreen: (): boolean => {
			const canvas = GodotConfig.canvas;
			if (canvas == null) {
				return false;
			}

			if (!GodotDisplayScreen.hasFullscreen()) {
				return false;
			}
			try {
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- This property is not available in every browser.
				canvas.requestFullscreen()?.catch((_pError: unknown) => {
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
				// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- This property is not available in every browser.
				document.exitFullscreen()?.catch((_pError: unknown) => {
					// Nothing to do.
				});
			} catch (_error) {
				return false;
			}
			return true;
		},

		updateSize: (): boolean => {
			const canvas = GodotConfig.canvas;
			if (canvas == null) {
				return false;
			}

			const isFullscreen = GodotDisplayScreen.isFullscreen();
			const wantsFullWindow = GodotConfig.canvasResizePolicy === 2;
			const noResize = GodotConfig.canvasResizePolicy === 0;
			const desiredWidth = GodotDisplayScreen.desiredSize.width;
			const desiredHeight = GodotDisplayScreen.desiredSize.height;
			let width = desiredWidth;
			let height = desiredHeight;

			if (noResize) {
				// Don't resize canvas, just update GL if needed.
				if (canvas.width !== width || canvas.height !== height) {
					GodotDisplayScreen.desiredSize.width = canvas.width;
					GodotDisplayScreen.desiredSize.height = canvas.height;
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
				canvas.width !== width ||
				canvas.height !== height
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
