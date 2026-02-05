/**************************************************************************/
/*  godot_runtime.ts                                                      */
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
	CFloatPointer,
	CFunctionPointer,
	CFunctionPointerExtract,
	CInt,
	CInt64,
	CInt64Pointer,
	CIntPointer,
	CPointer,
	CPointerAll,
	CPointerAllWithoutCInt64Pointer,
	CPointerTypeAll,
	CPointerTypeAllWithoutCInt64PointerType,
	CType,
	CTypeWithoutCInt64,
	CUint,
	CUintPointer,
} from "@godotengine/emscripten-utils/types";
import { CIntBoolean, CIntError, NULLPTR } from "@godotengine/emscripten-utils/constants";
import {
	asCFunctionPointer,
	asCIDHandlerId,
	asCInt,
	asCInt64,
	asCIntBoolean,
	asCType,
	fromCInt64ToBigint,
	fromCInt64ToBoolean,
	fromCTypeToBoolean,
	fromCTypeToNumber,
} from "@godotengine/emscripten-utils/types";
import type { AnyFunction } from "@godotengine/utils/types";
import type { TypedArray } from "@godotengine/emscripten-utils/types/browser";

function getHeapValue(pPtr: CIntPointer, pType: Extract<CPointerTypeAll, "i8" | "i16" | "i32">): CInt;
function getHeapValue(pPtr: CUintPointer, pType: Extract<CPointerTypeAll, "i8" | "i16" | "i32">): CUint;
function getHeapValue(pPtr: CInt64Pointer, pType: Extract<CPointerTypeAll, "i64">): CInt64;
function getHeapValue(pPtr: CFloatPointer, pType: Extract<CPointerTypeAll, "f32" | "float">): CFloat;
function getHeapValue(pPtr: CDoublePointer, pType: Extract<CPointerTypeAll, "f64" | "double">): CDouble;
function getHeapValue(
	pPtr: CPointerAllWithoutCInt64Pointer,
	pType: CPointerTypeAllWithoutCInt64PointerType,
): CTypeWithoutCInt64;
function getHeapValue(
	pPtr: Parameters<typeof getValue>[0],
	pType: Parameters<typeof getValue>[1],
): ReturnType<typeof getValue> {
	return getValue(pPtr, pType);
}

function setHeapValue(pPtr: CIntPointer, pValue: CInt, pType: Extract<CPointerTypeAll, "i18" | "i16" | "i32">): void;
function setHeapValue(pPtr: CUintPointer, pValue: CUint, pType: Extract<CPointerTypeAll, "i18" | "i16" | "i32">): void;
function setHeapValue(pPtr: CInt64Pointer, pValue: CInt64, pType: Extract<CPointerTypeAll, "i64">): void;
function setHeapValue(pPtr: CFloatPointer, pValue: CFloat, pType: Extract<CPointerTypeAll, "f32" | "float">): void;
function setHeapValue(pPtr: CDoublePointer, pValue: CDouble, pType: Extract<CPointerTypeAll, "f64" | "double">): void;
function setHeapValue(pPtr: CPointerAll, pValue: CType, pType: CPointerTypeAll): void;
function setHeapValue(
	pPtr: Parameters<typeof setValue>[0],
	pValue: Parameters<typeof setValue>[1],
	pType: Parameters<typeof setValue>[2],
): ReturnType<typeof setValue> {
	setValue(pPtr, pValue, pType);
}

export const _GodotRuntime = {
	$GodotRuntime: {
		NULLPTR,
		CIntError,
		CIntBoolean,

		asCType,
		asCInt,
		asCInt64,
		asCFunctionPointer,
		asCIDHandlerId,
		asCIntBoolean,
		fromCInt64ToBigint,
		fromCInt64ToBoolean,
		fromCTypeToBoolean,
		fromCTypeToNumber,

		//
		getFunction: <T extends CFunctionPointer<AnyFunction>>(pPtr: T): CFunctionPointerExtract<T> => {
			const func = wasmTable.get(pPtr);
			if (func == null) {
				throw new Error("Function is null");
			}
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- We need to force the casting here.
			return func as CFunctionPointerExtract<T>;
		},

		// Print.
		error: (...args: unknown[]): void => {
			err(...args);
		},

		print: (...args: unknown[]): void => {
			out(...args);
		},

		// Memory.
		malloc: (pSize: number): CPointer => {
			return _malloc(pSize);
		},

		free: (pPtr: CPointer): void => {
			_free(pPtr);
		},

		getHeapValue,
		setHeapValue,

		heapSub: <T extends TypedArray>(pHeap: T, pPtr: CPointer, pLength: number): T => {
			const { BYTES_PER_ELEMENT } = pHeap;
			const index = pPtr / BYTES_PER_ELEMENT;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Make sure to match the `pHeap` type.
			return pHeap.subarray(index, index + pLength) as T;
		},

		heapSlice: <T extends TypedArray>(pHeap: T, pPtr: CPointer, pLength: number): T => {
			const { BYTES_PER_ELEMENT } = pHeap;
			const index = pPtr / BYTES_PER_ELEMENT;
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Make sure to match the `pHeap` type.
			return pHeap.slice(index, index + pLength) as T;
		},

		heapCopy: (pDestination: TypedArray, pSource: TypedArray, pPtr: CPointer): void => {
			const { BYTES_PER_ELEMENT } = pSource;
			const index = pPtr / BYTES_PER_ELEMENT;
			pDestination.set(pSource, index);
		},

		// Strings.
		parseString: (pPtr: CCharPointer): string => {
			return UTF8ToString(pPtr);
		},

		parseStringArray: (pPtr: CCharArrayPointer, pSize: number): string[] => {
			return Array.from(GodotRuntime.heapSub(HEAP32, pPtr, pSize)).map((pMappedPtr) =>
				GodotRuntime.parseString(asCType<CCharPointer>(pMappedPtr)),
			);
		},

		strlen: (pString: string): number => {
			return lengthBytesUTF8(pString);
		},

		allocString: (pString: string): CCharPointer => {
			const length = GodotRuntime.strlen(pString);
			const cStringPtr = GodotRuntime.malloc(length);
			stringToUTF8(pString, cStringPtr, length);
			return GodotRuntime.asCType<CCharPointer>(cStringPtr);
		},

		allocStringArray: (pStrings: string[]): CCharArrayPointer => {
			const size = pStrings.length;
			const cStringArrayPointer = GodotRuntime.asCType<CCharArrayPointer>(
				GodotRuntime.malloc(size * Uint32Array.BYTES_PER_ELEMENT),
			);
			for (let i = 0; i < size; i++) {
				HEAP32[(cStringArrayPointer >> 2) + i] = GodotRuntime.allocString(pStrings[i]);
			}
			return cStringArrayPointer;
		},

		freeStringArray: (pStringArrayPtr: CCharArrayPointer, pLength: number): void => {
			for (let i = 0; i < pLength; i++) {
				GodotRuntime.free(asCType<CCharArrayPointer>(HEAP32[((pStringArrayPtr as number) >> 2) + i]));
			}
			GodotRuntime.free(pStringArrayPtr);
		},

		stringToHeap: (pString: string, pPtr: CCharPointer, pLength: number): CPointer => {
			return GodotRuntime.asCType<CCharArrayPointer>(stringToUTF8Array(pString, HEAP8, pPtr, pLength));
		},
	},
};
autoAddDeps(_GodotRuntime, "$GodotRuntime");
addToLibrary(_GodotRuntime);
