/**************************************************************************/
/*  cast.ts                                                               */
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

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- Need to cast to emscripten types. */

import type { AnyFunction } from "@godotengine/utils/types";

import type {
	CInt,
	CInt64,
	CInt64Pointer,
	CUint,
	CCharArrayPointer,
	CCharPointer,
	CDouble,
	CDoubleArrayPointer,
	CDoublePointer,
	CFloat,
	CFloatArrayPointer,
	CFloatPointer,
	CFunctionPointer,
	CIntArrayPointer,
	CIntPointer,
	CPointer,
	CUintArrayPointer,
	CUintPointer,
	CVoidArrayPointer,
	CVoidPointer,
	CFloatPointerType,
	CIDHandlerId,
	CPointerSize,
	CPointerType,
	CSignedIntegerPointerType,
	CUnsignedIntegerPointerType,
} from "./aliases.js";

// `CFunctionPointer` and `CIDHandlerId` need generic parameters.
type CType =
	| CInt
	| CInt64
	| CInt64Pointer
	| CUint
	| CCharArrayPointer
	| CCharPointer
	| CDouble
	| CDoubleArrayPointer
	| CDoublePointer
	| CFloat
	| CFloatArrayPointer
	| CFloatPointer
	| CIntArrayPointer
	| CIntPointer
	| CPointer
	| CUintArrayPointer
	| CUintPointer
	| CVoidArrayPointer
	| CVoidPointer
	| CFloatPointerType
	| CPointerSize
	| CPointerType
	| CSignedIntegerPointerType
	| CUnsignedIntegerPointerType;

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We want the developer to specify the generic type.
export function asCType<T extends CType>(pValue: number): T {
	return pValue as T;
}

export function asCFunctionPointer<T extends AnyFunction>(pFunctionPointer: number): CFunctionPointer<T> {
	return pFunctionPointer as CFunctionPointer<T>;
}

export function asCIDHandlerId<T>(pId: number): CIDHandlerId<T> {
	return pId as CIDHandlerId<T>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- We really want to test any value to `Boolean()`.
export function asCIntBoolean(pValue: any): CInt {
	// eslint-disable-next-line no-extra-boolean-cast -- Need to cast as boolean here.
	return Boolean(pValue) ? asCType<CInt>(1) : asCType<CInt>(0);
}
