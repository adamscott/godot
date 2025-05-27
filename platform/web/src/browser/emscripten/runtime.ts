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

import {
	_free,
	_malloc,
	addToLibrary,
	autoAddDeps,
	CPointer,
	CPointerType,
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
} from "./emscripten-lib.ts";

import { TypedArray } from "+browser/types/api.ts";
import { AnyFunction } from "+shared/types/aliases.ts";

export declare const GodotRuntime: typeof _GodotRuntime.$GodotRuntime;
const _GodotRuntime = {
	$GodotRuntime: {
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
		malloc: (pSize: number): CPointer => {
			return _malloc(pSize) as CPointer;
		},

		free: (pPtr: CPointer): void => {
			_free(pPtr);
		},

		getHeapValue: (pPtr: CPointer, pType: CPointerType): number => {
			return getValue(pPtr, pType);
		},

		setHeapValue: (
			pPtr: CPointer,
			pValue: number,
			pType: CPointerType,
		): void => {
			setValue(pPtr, pValue, pType);
		},

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
		parseString: (pPtr: CPointer): string => {
			return UTF8ToString(pPtr);
		},

		parseStringArray: (pPtr: CPointer, pSize: number): string[] => {
			return Array.from(GodotRuntime.heapSub(HEAP32, pPtr, pSize)).map((
				pMappedPtr,
			) => GodotRuntime.parseString(pMappedPtr as CPointer));
		},

		strlen: (pString: string): number => {
			return lengthBytesUTF8(pString);
		},

		allocString: (pString: string): CPointer => {
			const length = GodotRuntime.strlen(pString);
			const cStringPtr = GodotRuntime.malloc(length);
			stringToUTF8(pString, cStringPtr, length);
			return cStringPtr;
		},

		allocStringArray: (pStrings: string[]): CPointer => {
			const size = pStrings.length;
			const cStringArrayPointer = GodotRuntime.malloc(
				size * Uint32Array.BYTES_PER_ELEMENT,
			);
			for (let i = 0; i < size; i++) {
				HEAP32[(cStringArrayPointer >> 2) + i] = GodotRuntime
					.allocString(
						pStrings[i],
					);
			}
			return cStringArrayPointer;
		},

		freeStringArray: (pStringArrayPtr: CPointer, pLength: number): void => {
			for (let i = 0; i < pLength; i++) {
				GodotRuntime.free(
					HEAP32[((pStringArrayPtr as number) >> 2) + i] as CPointer,
				);
			}
			GodotRuntime.free(pStringArrayPtr);
		},

		stringToHeap: (
			pString: string,
			pPtr: CPointer,
			pLength: number,
		): number => {
			return stringToUTF8Array(pString, HEAP8, pPtr, pLength);
		},
	},
};
autoAddDeps(_GodotRuntime, "$GodotRuntime");
addToLibrary(_GodotRuntime);
