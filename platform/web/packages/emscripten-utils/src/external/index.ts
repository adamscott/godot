/**************************************************************************/
/*  index.ts                                                              */
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

/* eslint-disable @typescript-eslint/no-deprecated -- Do not flag that items are deprecated. */

import type { CPointer, CPointerAll, CPointerTypeAll, ErrnoError } from "#/types/index.js";
import type { GLContext, GLContextHandle, GLTexture, TypedArray } from "#/types/browser/index.js";
import type { AnyFunction } from "@godotengine/utils/types";

export declare const addOnPostRun: (pFunctionToPostRun: AnyFunction) => void;
export declare const addToLibrary: (pElementToAdd: unknown) => void;
/**
 * @deprecated Use `addToLibrary()` instead.
 */
export declare const mergeInto: (pElement: unknown, pElementToAdd: object) => void;
export declare const autoAddDeps: (pTarget: unknown, pDeps: string) => void;
export declare const wasmTable: Map<CPointer, (...args: unknown[]) => unknown>;
export declare const err: Console["error"];
export declare const out: Console["log"];
export declare const _malloc: (pSize: number) => CPointer;
export declare const _free: (pPtr: CPointer) => void;

export declare const getValue: (pPtr: CPointerAll, pType: CPointerTypeAll) => number | bigint;
export declare const setValue: (pPtr: CPointerAll, pValue: number | bigint, pType: CPointerTypeAll) => void;
export declare const UTF8ToString: (pPtr: CPointer, pMaxBytesToRead?: number, pIgnoreNul?: boolean) => string;
export declare const lengthBytesUTF8: (pString: string) => number;
export declare const stringToUTF8: (pString: string, pStringPtr: CPointer, pLength: number) => number;
export declare const stringToUTF8Array: (
	pString: string,
	pArray: TypedArray,
	pPtr: CPointer,
	pLength: number,
) => number;
export declare const UTF8Decoder: TextDecoder;

export declare const HEAP8: Int8Array<ArrayBuffer>;
export declare const HEAP16: Int16Array<ArrayBuffer>;
export declare const HEAP32: Int32Array<ArrayBuffer>;
export declare const HEAPU8: Uint8Array<ArrayBuffer>;
export declare const HEAPU16: Uint16Array<ArrayBuffer>;
export declare const HEAPU32: Uint32Array<ArrayBuffer>;
export declare const HEAPF32: Float32Array<ArrayBuffer>;
export declare const HEAPF64: Float64Array<ArrayBuffer>;

export interface FS {
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
	syncfs: (pPopulate: boolean | ((pErrCode?: Error) => void), pCallback: (pErrCode?: Error) => void) => void;
	unlink: (pPath: string) => void;
	unmount: (pPath: string) => void;
	writeFile: (pPath: string, pTypedArray: TypedArray, pOptions?: { flags?: number }) => void;
	ErrnoError: ErrnoError;
}
export declare const FS: FS;

export interface IDBFS {
	dbs: Record<string, IDBDatabase>;
	mount: (pMount: string) => unknown;
	syncfs: (pMount: string, pPopulate: boolean, pCallback: (pError: Error) => void) => void;
}
export declare const IDBFS: IDBFS;

export interface MainLoop {
	requestAnimationFrame: Window["requestAnimationFrame"];
	pause: () => void;
	resume: () => void;
}
export declare const MainLoop: MainLoop;
export declare const runtimeKeepalivePush: () => void;
export declare const runtimeKeepalivePop: () => void;

// Reference: https://github.com/emscripten-core/emscripten/blob/main/src/lib/libwebgl.js.
export interface GL {
	getContext: (contextHandle: GLContextHandle) => GLContext | null;
	getSource: (shader: number, count: number, string: number, length?: number) => string;
	getNewId: (pTable: unknown[]) => number;
	resizeOffscreenFramebuffer: (pGLContext: GLContext) => void;
	currentContext: GLContext;
	textures: GLTexture[];
}
export declare const GL: GL;

// eslint-disable-next-line @typescript-eslint/naming-convention -- emscripten function, not ours.
export declare const _emscripten_webgl_get_current_context: () => GLContextHandle;

export declare const Module: Record<string, unknown>;

export interface LibraryManager {
	library: unknown;
}
/**
 * @deprecated Use `addToLibrary()` instead.
 */
export declare const LibraryManager: LibraryManager;
