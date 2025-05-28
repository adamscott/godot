/**************************************************************************/
/*  runtime.ts                                                            */
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
import {
	_free,
	_malloc,
	addToLibrary,
	autoAddDeps,
	err,
	getValue,
	HEAP32,
	HEAP8,
	lengthBytesUTF8,
	out,
	setValue,
	stringToUTF8,
	stringToUTF8Array,
	UTF8ToString,
	wasmTable,
} from "./emscripten_lib.ts";
// __emscripten_import_global_const_end

import {
	CCharArrayPointer,
	CCharPointer,
	CDouble,
	CDoublePointer,
	CFloat,
	CFloatPointer,
	CInt,
	CIntPointer,
	CPointer,
	CPointerType,
} from "./emscripten_lib.ts";

import { TypedArray } from "+browser/types/api.ts";
import { AnyFunction } from "+shared/types/aliases.ts";

interface GetHeapValue {
	(
		pPtr: CIntPointer,
		pType: Extract<CPointerType, "i8" | "i16" | "i32" | "i64">,
	): CInt;
	(
		pPtr: CFloatPointer,
		pType: Extract<CPointerType, "f32" | "float">,
	): CFloat;
	(
		pPtr: CDoublePointer,
		pType: Extract<CPointerType, "f64" | "double">,
	): CDouble;
	(pPtr: CPointer, pType: CPointerType): number;
}
interface SetHeapValue {
	(
		pPtr: CIntPointer,
		pValue: CInt,
		pType: Extract<CPointerType, "i18" | "i16" | "i32" | "i64">,
	): void;
	(
		pPtr: CFloatPointer,
		pValue: CFloat,
		pType: Extract<CPointerType, "f32" | "float">,
	): void;
	(
		pPtr: CDoublePointer,
		pValue: CDouble,
		pType: Extract<CPointerType, "f64" | "double">,
	): void;
	(
		pPtr: CPointer,
		pValue: number,
		pType: CPointerType,
	): void;
}

// __emscripten_declare_global_const_start
export declare const GodotRuntime: typeof _GodotRuntime.$GodotRuntime;
// __emscripten_declare_global_const_end
const _GodotRuntime = {
	$GodotRuntime: {
		NULLPTR: 0 as CPointer,

		// Functions.
		getFunction: <T extends AnyFunction>(
			pPtr: CPointer,
		): T => {
			const func = wasmTable.get(pPtr);
			if (func == null) {
				throw new Error("Function is null");
			}
			return func as T;
		},

		// Print.
		error: (...args: unknown[]): void => {
			err(...args);
		},

		print: (...args: unknown[]): void => {
			out(...args);
		},

		// Memory.
		malloc: <T extends CPointer>(pSize: number): T => {
			return _malloc(pSize) as T;
		},

		free: (pPtr: CPointer): void => {
			_free(pPtr);
		},

		getHeapValue: ((pPtr, pType) => {
			return getValue(pPtr, pType);
		}) as GetHeapValue,

		setHeapValue: ((
			pPtr: CPointer,
			pValue: number,
			pType: CPointerType,
		): void => {
			setValue(pPtr, pValue, pType);
		}) as SetHeapValue,

		heapSub: <T extends TypedArray>(
			pHeap: T,
			pPtr: CPointer,
			pLength: number,
		): T => {
			const bytes = pHeap.BYTES_PER_ELEMENT;
			const index = pPtr / bytes;
			return pHeap.subarray(index, index + pLength) as T;
		},

		heapSlice: <T extends TypedArray>(
			pHeap: T,
			pPtr: CPointer,
			pLength: number,
		): T => {
			const bytes = pHeap.BYTES_PER_ELEMENT;
			const index = pPtr / bytes;
			return pHeap.slice(index, index + pLength) as T;
		},

		heapCopy: <T extends TypedArray, U extends TypedArray>(
			pDestination: U,
			pSource: T,
			pPtr: CPointer,
		): void => {
			const bytes = pSource.BYTES_PER_ELEMENT;
			const index = pPtr / bytes;
			pDestination.set(pSource, index);
		},

		// Strings.
		parseString: (pPtr: CCharPointer): string => {
			return UTF8ToString(pPtr);
		},

		parseStringArray: (
			pPtr: CCharArrayPointer,
			pSize: number,
		): string[] => {
			return Array.from(GodotRuntime.heapSub(HEAP32, pPtr, pSize)).map((
				pMappedPtr,
			) => GodotRuntime.parseString(pMappedPtr as CCharPointer));
		},

		strlen: (pString: string): number => {
			return lengthBytesUTF8(pString);
		},

		allocString: (pString: string): CCharPointer => {
			const length = GodotRuntime.strlen(pString);
			const cStringPtr = GodotRuntime.malloc(length);
			stringToUTF8(pString, cStringPtr, length);
			return cStringPtr as CCharPointer;
		},

		allocStringArray: (pStrings: string[]): CCharArrayPointer => {
			const size = pStrings.length;
			const cStringArrayPointer = GodotRuntime.malloc(
				size * Uint32Array.BYTES_PER_ELEMENT,
			) as CCharArrayPointer;
			for (let i = 0; i < size; i++) {
				HEAP32[(cStringArrayPointer >> 2) + i] = GodotRuntime
					.allocString(
						pStrings[i],
					);
			}
			return cStringArrayPointer;
		},

		freeStringArray: (
			pStringArrayPtr: CCharArrayPointer,
			pLength: number,
		): void => {
			for (let i = 0; i < pLength; i++) {
				GodotRuntime.free(
					HEAP32[((pStringArrayPtr as number) >> 2) + i] as CPointer,
				);
			}
			GodotRuntime.free(pStringArrayPtr);
		},

		stringToHeap: (
			pString: string,
			pPtr: CCharPointer,
			pLength: number,
		): CInt => {
			return stringToUTF8Array(pString, HEAP8, pPtr, pLength) as CInt;
		},

		boolean: (pValue: boolean): CInt => {
			return Number(pValue) as CInt;
		},
	},
};
autoAddDeps(_GodotRuntime, "$GodotRuntime");
addToLibrary(_GodotRuntime);
