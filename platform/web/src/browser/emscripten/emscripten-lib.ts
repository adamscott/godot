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

import "+browser/lib.ts";

import type { CPointer as CPointerAlias } from "+shared/types/aliases.ts";

import type { TypedArray } from "+browser/types/api.ts";

export interface ErrnoError extends Error {
	errno: number;
}

export declare const addToLibrary: (pElementToAdd: object) => void;
export declare const mergeInto: (
	pElement: object,
	pElementToAdd: object,
) => void;
export declare const autoAddDeps: (pTarget: object, pDeps: string) => void;

// Global objects.
export declare const wasmTable: Map<number, (...args: unknown[]) => unknown>;
export declare const err: Console["error"];
export declare const out: Console["log"];
export declare const _malloc: (pSize: number) => number;
export declare const _free: (pPtr: number) => void;

export type CPointer = CPointerAlias;
export type CPointerSize = 8 | 16 | 32 | 64;
export type SignedIntegerCPointerType = `i${CPointerSize}`;
export type UnsignedIntegerCPointerType = `u${CPointerSize}`;
export type FloatCPointerType = "f32" | "float" | "f64" | "double";
export type CPointerType =
	| SignedIntegerCPointerType
	| UnsignedIntegerCPointerType
	| FloatCPointerType
	| "*";

export declare const getValue: (pPtr: CPointer, pType: CPointerType) => number;
export declare const setValue: (
	pPtr: CPointer,
	pValue: number,
	pType: CPointerType,
) => void;

export declare const UTF8ToString: (pPtr: CPointer) => string;
export declare const lengthBytesUTF8: (pString: string) => number;
export declare const stringToUTF8: (
	pString: string,
	pStringPtr: CPointer,
	pLength: number,
) => number;
export declare const stringToUTF8Array: (
	pString: string,
	pArray: TypedArray,
	pPtr: CPointer,
	pLength: number,
) => number;

export declare const HEAP8: Int8Array;
export declare const HEAP16: Int16Array;
export declare const HEAP32: Int32Array;
export declare const HEAPU8: Uint8Array;
export declare const HEAPU16: Uint16Array;
export declare const HEAPU32: Uint32Array;
export declare const HEAPF32: Float32Array;
export declare const HEAPF64: Float64Array;

export declare const FS: {
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

export declare const IDBFS: {
	dbs: Record<string, IDBDatabase>;
	mount: (pMount: string) => unknown;
	syncfs: (
		pMount: string,
		pPopulate: boolean,
		pCallback: (pError: Error) => void,
	) => void;
};

// TODO: Remove in favor of the new ESM engine module.
export declare const Module: object;
