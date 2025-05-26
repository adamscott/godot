/**************************************************************************/
/*  emscripten-lib.ts                                                     */
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

import type { CPointer as CPointerAlias } from "+shared/types/aliases.ts";

import type { TypedArray } from "+browser/types/api.ts";

interface ErrnoError extends Error {
	errno: number;
}

declare global {
	const addToLibrary: (pElementToAdd: object) => void;
	const mergeInto: (pElement: object, pElementToAdd: object) => void;
	const autoAddDeps: (pTarget: object, pDeps: string) => void;

	// Global objects.
	const wasmTable: Map<number, (...args: unknown[]) => unknown>;
	const err: Console["error"];
	const out: Console["log"];
	const _malloc: (pSize: number) => number;
	const _free: (pPtr: number) => void;

	type CPointer = CPointerAlias;
	type CPointerSize = 8 | 16 | 32 | 64;
	type SignedIntegerCPointerType = `i${CPointerSize}`;
	type UnsignedIntegerCPointerType = `u${CPointerSize}`;
	type FloatCPointerType = "f32" | "float" | "f64" | "double";
	export type CPointerType =
		| SignedIntegerCPointerType
		| UnsignedIntegerCPointerType
		| FloatCPointerType
		| "*";

	const getValue: (pPtr: CPointer, pType: CPointerType) => number;
	const setValue: (
		pPtr: CPointer,
		pValue: number,
		pType: CPointerType,
	) => void;

	const UTF8ToString: (pPtr: CPointer) => string;
	const lengthBytesUTF8: (pString: string) => number;
	const stringToUTF8: (
		pString: string,
		pStringPtr: CPointer,
		pLength: number,
	) => number;
	const stringToUTF8Array: (
		pString: string,
		pArray: TypedArray,
		pPtr: CPointer,
		pLength: number,
	) => number;

	const HEAP8: Int8Array;
	const HEAP16: Int16Array;
	const HEAP32: Int32Array;
	const HEAPU8: Uint8Array;
	const HEAPU16: Uint16Array;
	const HEAPU32: Uint32Array;
	const HEAPF32: Float32Array;
	const HEAPF64: Float64Array;

	const FS: {
		mkdir: (pPath: string, pMode?: number) => void;
		mkdirTree: (pPath: string, pMode?: number) => void;
		mount: (pType: object, pOpts: object, pMountPoint: string) => void;
		rmdir: (pDir: string) => void;
		stat: (
			pPath: string,
			pDontFollow?: boolean,
		) => {
			dev: number;
			ino: number;
			mode: number;
			nlink: number;
			uid: number;
			gid: number;
			rdev: number;
			size: number;
			atime: number;
			mtime: number;
			ctime: number;
			blksize: number;
			blocks: number;
		};
		syncfs: (
			pPopulate: boolean | ((pErrCode: Error) => void),
			pCallback: (pErrCode: Error) => void,
		) => void;
		unlink: (pPath: string) => void;
		unmount: (pPath: string) => void;
		writeFile: (
			pPath: string,
			pTypedArray: TypedArray,
			pOptions?: { flags?: number },
		) => void;
		ErrnoError: ErrnoError;
	};

	const IDBFS: {
		dbs: Record<string, IDBDatabase>;
		mount: (pMount: string) => unknown;
		syncfs: (
			pMount: string,
			pPopulate: boolean,
			pCallback: (pError: Error) => void,
		) => void;
	};

	// TODO: Remove in favor of the new ESM engine module.
	const Module: object;
}
