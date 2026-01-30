/**************************************************************************/
/*  aliases.ts                                                            */
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

import type { Brand, BrandSuper, BrandSuperSuper, BrandSuperSuperSuper } from "./brand.ts";
import type { AnyFunction } from "@godotengine/utils/types";

export type CInt = Brand<number, "CInt">;
export type CUint = Brand<number, "CUint">;
export type CFloat = Brand<number, "CFloat">;
export type CDouble = Brand<number, "CDouble">;
export type CPointer = Brand<number, "CPointer">;

export type CInt64 = BrandSuper<number | bigint, "CInt", "CInt64">;

export type CVoidPointer = BrandSuper<number, "CPointer", "CVoidPointer">;
export type CCharPointer = BrandSuper<number, "CPointer", "CCharPointer">;
export type CIntPointer = BrandSuper<number, "CPointer", "CIntPointer">;
export type CInt64Pointer = BrandSuper<number, "CPointer", "CInt64Pointer">;
export type CUintPointer = BrandSuper<number, "CPointer", "CUintPointer">;
export type CFloatPointer = BrandSuper<number, "CPointer", "CFloatPointer">;
export type CDoublePointer = BrandSuper<number, "CPointer", "CDoublePointer">;
export type CIDHandlerId<T> = BrandSuperSuper<number, "CInt", "CIDHandlerId", T>;
export type CIDHandlerIdExtract<TKey> = TKey extends CIDHandlerId<infer T> ? T : never;

export type CFunctionPointer<T extends AnyFunction> = BrandSuperSuperSuper<
	number,
	"CPointer",
	"CVoidPointer",
	"CFunctionPointer",
	T
>;
export type CFunctionPointerExtract<TKey> = TKey extends CFunctionPointer<infer T> ? T : never;

export type CVoidArrayPointer = BrandSuperSuper<number, "CPointer", "CVoidPointer", "CVoidArrayPointer">;
export type CCharArrayPointer = BrandSuperSuper<number, "CPointer", "CCharPointer", "CCharArrayPointer">;
export type CIntArrayPointer = BrandSuperSuper<number, "CPointer", "CIntPointer", "CIntArrayPointer">;
export type CUintArrayPointer = BrandSuperSuper<number, "CPointer", "CUintPointer", "CUintArrayPointer">;
export type CFloatArrayPointer = BrandSuperSuper<number, "CPointer", "CFloatPointer", "CFloatArrayPointer">;
export type CDoubleArrayPointer = BrandSuperSuper<number, "CPointer", "CDoublePointer", "CDoubleArrayPointer">;

export type CPointerSize = 8 | 16 | 32 | 64;
export type CSignedIntegerPointerType = `i${CPointerSize}`;
export type CUnsignedIntegerPointerType = `u${CPointerSize}`;
export type CFloatPointerType = "f32" | "float" | "f64" | "double";
export type CPointerTypeAll = CSignedIntegerPointerType | CUnsignedIntegerPointerType | CFloatPointerType | "*";

export type CPointerAll =
	| CPointer
	| CVoidPointer
	| CCharPointer
	| CIntPointer
	| CInt64Pointer
	| CUintPointer
	| CFloatPointer
	| CDoublePointer
	| CVoidArrayPointer
	| CCharArrayPointer
	| CIntArrayPointer
	| CUintArrayPointer
	| CFloatArrayPointer
	| CDoubleArrayPointer;

export type CType =
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
	| CFunctionPointer<AnyFunction>;

export type CPointerAllWithoutCInt64Pointer = Exclude<CPointerAll, CInt64Pointer>;
export type CPointerTypeAllWithoutCInt64PointerType = Exclude<CPointerTypeAll, CInt64Pointer>;
export type CTypeWithoutCInt64 = Exclude<CType, CInt64>;
