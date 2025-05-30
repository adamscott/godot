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

import type { Brand, SubBrand, SubSubBrand, SubSubSubBrand } from "./brand.ts";

// deno-lint-ignore no-explicit-any
export type AnyFunction = (...args: any[]) => any;

export type CInt = Brand<number, "CInt">;
export type CUint = Brand<number, "CUint">;
export type CFloat = Brand<number, "CFloat">;
export type CDouble = Brand<number, "CDouble">;
export type CPointer = Brand<number, "CPointer">;

export type CInt64 = SubBrand<bigint, "CInt", "CInt64">;

export type CVoidPointer = SubBrand<number, "CPointer", "CVoidPointer">;
export type CCharPointer = SubBrand<number, "CPointer", "CCharPointer">;
export type CIntPointer = SubBrand<number, "CPointer", "CIntPointer">;
export type CInt64Pointer = SubBrand<number, "CPointer", "CInt64Pointer">;
export type CUintPointer = SubBrand<number, "CPointer", "CUintPointer">;
export type CFloatPointer = SubBrand<number, "CPointer", "CFloatPointer">;
export type CDoublePointer = SubBrand<number, "CPointer", "CDoublePointer">;

export type CIDHandlerId<T> = SubSubBrand<number, "CInt", "CIDHandlerId", T>;
export type CIDHandlerIdExtract<TKey> = TKey extends CIDHandlerId<infer T> ? T
	: never;

export type CFunctionPointer<T extends AnyFunction> = SubSubSubBrand<
	number,
	"CPointer",
	"CVoidPointer",
	"CFunctionPointer",
	T
>;
export type CFunctionPointerExtract<TKey> = TKey extends
	CFunctionPointer<infer T> ? T : never;

export type CVoidArrayPointer = SubSubBrand<
	number,
	"CPointer",
	"CVoidPointer",
	"CVoidArrayPointer"
>;
export type CCharArrayPointer = SubSubBrand<
	number,
	"CPointer",
	"CCharPointer",
	"CCharArrayPointer"
>;
export type CIntArrayPointer = SubSubBrand<
	number,
	"CPointer",
	"CIntPointer",
	"CIntArrayPointer"
>;
export type CUintArrayPointer = SubSubBrand<
	number,
	"CPointer",
	"CUintPointer",
	"CUintArrayPointer"
>;
export type CFloatArrayPointer = SubSubBrand<
	number,
	"CPointer",
	"CFloatPointer",
	"CFloatArrayPointer"
>;
export type CDoubleArrayPointer = SubSubBrand<
	number,
	"CPointer",
	"CDoublePointer",
	"CDoubleArrayPointer"
>;
