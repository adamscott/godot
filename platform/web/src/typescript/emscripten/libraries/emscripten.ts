/**************************************************************************/
/*  emscripten.ts                                                         */
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
	CFunctionPointerExtract,
	CIDHandlerId,
	CIDHandlerIdExtract,
	CInt,
	CInt64,
	CInt64Pointer,
	CIntArrayPointer,
	CIntPointer,
	CPointer,
	CUint,
	CUintPointer,
	CVoidArrayPointer,
	CVoidPointer,
} from "+shared/types";

export type { TypedArray } from "+browser/types";

export {
	CCharArrayPointer,
	CCharPointer,
	CDouble,
	CDoublePointer,
	CFloat,
	CFloatArrayPointer,
	CFloatPointer,
	CFunctionPointer,
	CFunctionPointerExtract,
	CIDHandlerId,
	CIDHandlerIdExtract,
	CInt,
	CInt64,
	CInt64Pointer,
	CIntArrayPointer,
	CIntPointer,
	CPointer,
	CUint,
	CUintPointer,
	CVoidArrayPointer,
	CVoidPointer
};

export interface ErrnoError extends Error {
	errno: number;
}

export type CPointerSize = 8 | 16 | 32 | 64;
export type SignedIntegerCPointerType = `i${CPointerSize}`;
export type UnsignedIntegerCPointerType = `u${CPointerSize}`;
export type FloatCPointerType = "f32" | "float" | "f64" | "double";
export type CPointerType =
	| SignedIntegerCPointerType
	| UnsignedIntegerCPointerType
	| FloatCPointerType
	| "*";

export type GLContextHandle = unknown;
export type GLTexture = WebGLTexture & {
	name?: number;
};
export interface GLContext {
	handle: unknown;
	attributes: unknown;
	version: unknown;
	GLctx: WebGL2RenderingContext;
	multiviewExt?: OVR_multiview2;
	oculusMultiviewExt?: OCULUS_multiview;
}
