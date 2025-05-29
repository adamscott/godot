/**************************************************************************/
/*  libwebgl2.ts                                                          */
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

// __emscripten_import_global_const_start
import {
	_emscripten_webgl_get_current_context,
	addToLibrary,
	autoAddDeps,
	GL,
	HEAPU8,
} from "+browser/emscripten/emscripten_lib.ts";
import { GodotRuntime } from "+browser/emscripten/libruntime.ts";
// __emscripten_import_global_const_end

import {
	CInt,
	CIntPointer,
	CUint,
	CVoidPointer,
} from "+browser/emscripten/emscripten_lib.ts";

// __emscripten_declare_global_const_start
export declare const GodotWebGL2: typeof _GodotWebGL2.$GodotWebGL2;
// __emscripten_declare_global_const_end
const _GodotWebGL2 = {
	$GodotWebGL2__deps: ["$GL", "$GodotRuntime"],
	$GodotWebGL2: {},

	// This is implemented as "glGetBufferSubData" in new emscripten versions.
	// Since we have to support older (pre 2.0.17) emscripten versions, we add this wrapper function instead.
	godot_webgl2_glGetBufferSubData__proxy: "sync",
	godot_webgl2_glGetBufferSubData__sig: "vippp",
	godot_webgl2_glGetBufferSubData__deps: [
		"$GL",
		"emscripten_webgl_get_current_context",
	],
	godot_webgl2_glGetBufferSubData: (
		pTarget: CInt,
		pOffset: CIntPointer,
		pSize: CIntPointer,
		pData: CVoidPointer,
	): void => {
		const glContextHandle = _emscripten_webgl_get_current_context();
		const gl = GL.getContext(glContextHandle);
		if (gl == null) {
			return;
		}

		gl.GLctx.getBufferSubData(pTarget, pOffset, HEAPU8, pSize, pData);
	},

	godot_webgl2_glFramebufferTextureMultiviewOVR__deps: [
		"emscripten_webgl_get_current_context",
	],
	godot_webgl2_glFramebufferTextureMultiviewOVR__proxy: "sync",
	godot_webgl2_glFramebufferTextureMultiviewOVR__sig: "viiiiii",
	godot_webgl2_glFramebufferTextureMultiviewOVR: (
		pTarget: CInt,
		pAttachment: CInt,
		pTexture: CUint,
		pLevel: CInt,
		pBaseViewIndex: CInt,
		pNumViews: CUint,
	): void => {
		const context = GL.currentContext;
		context.multiviewExt ??= context.GLctx.getExtension("OVR_multiview2") ??
			undefined;
		if (context.multiviewExt == null) {
			GodotRuntime.error(
				"Trying to call glFramebufferTextureMultiviewOVR() without the OVR_multiview2 extension",
			);
			return;
		}
		context.multiviewExt.framebufferTextureMultiviewOVR(
			pTarget,
			pAttachment,
			GL.textures[pTexture],
			pLevel,
			pBaseViewIndex,
			pNumViews,
		);
	},

	godot_webgl2_glFramebufferTextureMultisampleMultiviewOVR__deps: [
		"emscripten_webgl_get_current_context",
	],
	godot_webgl2_glFramebufferTextureMultisampleMultiviewOVR__proxy: "sync",
	godot_webgl2_glFramebufferTextureMultisampleMultiviewOVR__sig: "viiiiiii",
	godot_webgl2_glFramebufferTextureMultisampleMultiviewOVR: (
		pTarget: CInt,
		pAttachment: CInt,
		pTexture: CUint,
		pLevel: CInt,
		pSamples: CUint,
		pBaseViewIndex: CInt,
		pNumViews: CUint,
	): void => {
		const context = GL.currentContext;
		context.oculusMultiviewExt ??=
			context.GLctx.getExtension("OCULUS_multiview") ??
				undefined;
		if (context.oculusMultiviewExt == null) {
			GodotRuntime.error(
				"Trying to call glFramebufferTextureMultisampleMultiviewOVR() without the OCULUS_multiview extension",
			);
			return;
		}
		context.oculusMultiviewExt.framebufferTextureMultisampleMultiviewOVR(
			pTarget,
			pAttachment,
			GL.textures[pTexture],
			pLevel,
			pSamples,
			pBaseViewIndex,
			pNumViews,
		);
	},
};
autoAddDeps(_GodotWebGL2, "$GodotWebGL2");
addToLibrary(_GodotWebGL2);
