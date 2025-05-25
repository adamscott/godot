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

import "./lib.ts";
import type { TypedArray } from "+browser/types/api.ts";

declare global {
	const GodotRuntime: typeof _GodotRuntime.$GodotRuntime;
}

const _GodotRuntime = {
	$GodotRuntime: {
		// Functions.
		getFunc: (pPtr: number): (...args: unknown[]) => unknown => {
			const func = wasmTable.get(pPtr);
			if (func == null) {
				throw new Error("Function is null");
			}
			return func;
		},

		// Print.
		error: (...args: unknown[]): void => {
			err(...args);
		},

		print: (...args: unknown[]): void => {
			out(...args);
		},

		// Memory.
		malloc: (pSize: number): number => {
			return _malloc(pSize);
		},

		free: (pPtr: number): void => {
			_free(pPtr);
		},

		getHeapValue: (pPtr: number, pType: PointerType): number => {
			return getValue(pPtr, pType);
		},

		setHeapValue: (
			pPtr: number,
			pValue: number,
			pType: PointerType,
		): void => {
			setValue(pPtr, pValue, pType);
		},

		heapSub: <T extends TypedArray>(
			pHeap: T,
			pPtr: number,
			pLength: number,
		): T => {
			const bytes = pHeap.BYTES_PER_ELEMENT;
			const index = pPtr / bytes;
			return pHeap.subarray(index, index + pLength) as T;
		},

		heapSlice: <T extends TypedArray>(
			pHeap: T,
			pPtr: number,
			pLength: number,
		): T => {
			const bytes = pHeap.BYTES_PER_ELEMENT;
			const index = pPtr / bytes;
			return pHeap.slice(index, index + pLength) as T;
		},

		heapCopy: <T extends TypedArray, U extends TypedArray>(
			pDestination: U,
			pSource: T,
			pPtr: number,
		): void => {
			const bytes = pSource.BYTES_PER_ELEMENT;
			const index = pPtr / bytes;
			pDestination.set(pSource, index);
		},

		// Strings.
		parseString: (pPtr: number): string => {
			return UTF8ToString(pPtr);
		},

		parseStringArray: (pPtr: number, pSize: number): string[] => {
			return Array.from(GodotRuntime.heapSub(HEAP32, pPtr, pSize)).map((
				pMappedPtr,
			) => GodotRuntime.parseString(pMappedPtr));
		},

		strlen: (pString: string): number => {
			return lengthBytesUTF8(pString);
		},

		allocString: (pString: string): number => {
			const length = GodotRuntime.strlen(pString);
			const cStringPtr = GodotRuntime.malloc(length);
			stringToUTF8(pString, cStringPtr, length);
			return cStringPtr;
		},

		allocStringArray: (pStrings: string[]): number => {
			const size = pStrings.length;
			const cPointer = GodotRuntime.malloc(
				size * Uint32Array.BYTES_PER_ELEMENT,
			);
			for (let i = 0; i < size; i++) {
				HEAP32[(cPointer >> 2) + i] = GodotRuntime.allocString(
					pStrings[i],
				);
			}
			return cPointer;
		},

		freeStringArray: (pPtr: number, pLength: number): void => {
			for (let i = 0; i < pLength; i++) {
				GodotRuntime.free(HEAP32[(pPtr >> 2) + i]);
			}
			GodotRuntime.free(pPtr);
		},

		stringToHeap: (
			pString: string,
			pPtr: number,
			pLength: number,
		): number => {
			return stringToUTF8Array(pString, HEAP8, pPtr, pLength);
		},
	},
};
autoAddDeps(_GodotRuntime, "$GodotRuntime");
addToLibrary(_GodotRuntime);
