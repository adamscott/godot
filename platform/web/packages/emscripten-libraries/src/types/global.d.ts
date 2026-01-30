/**************************************************************************/
/*  global.d.ts                                                           */
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

import type { CPointer, CPointerType, ErrnoError } from "@godotengine/emscripten-utils/types";

import type { TypedArray, GLContext, GLContextHandle, GLTexture } from "@godotengine/emscripten-utils/types/browser";

import type { _GodotAudio, _GodotAudioScript, _GodotAudioWorklet } from "../libraries/audio";
import type { _GodotFetch } from "../libraries/fetch";
import type { _IDHandler, _GodotConfig, _GodotFS, _GodotOS, _GodotEventListeners, _GodotPWA } from "../libraries/os";
import type { _GodotRuntime } from "../libraries/runtime";

export {};

declare global {
	const addToLibrary: (pElementToAdd: object) => void;
	const mergeInto: (pElement: object, pElementToAdd: object) => void;
	const autoAddDeps: (pTarget: object, pDeps: string) => void;
	const wasmTable: Map<CPointer, (...args: unknown[]) => unknown>;
	const err: Console["error"];
	const out: Console["log"];
	const _malloc: (pSize: number) => CPointer;
	const _free: (pPtr: CPointer) => void;

	const getValue: (pPtr: CPointer, pType: CPointerType) => number;
	const setValue: (pPtr: CPointer, pValue: number, pType: CPointerType) => void;
	const UTF8ToString: (pPtr: CPointer) => string;
	const lengthBytesUTF8: (pString: string) => number;
	const stringToUTF8: (pString: string, pStringPtr: CPointer, pLength: number) => number;
	const stringToUTF8Array: (pString: string, pArray: TypedArray, pPtr: CPointer, pLength: number) => number;

	const HEAP8: Int8Array<ArrayBuffer>;
	const HEAP16: Int16Array<ArrayBuffer>;
	const HEAP32: Int32Array<ArrayBuffer>;
	const HEAPU8: Uint8Array<ArrayBuffer>;
	const HEAPU16: Uint16Array<ArrayBuffer>;
	const HEAPU32: Uint32Array<ArrayBuffer>;
	const HEAPF32: Float32Array<ArrayBuffer>;
	const HEAPF64: Float64Array<ArrayBuffer>;

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
		syncfs: (pPopulate: boolean | ((pErrCode?: Error) => void), pCallback: (pErrCode?: Error) => void) => void;
		unlink: (pPath: string) => void;
		unmount: (pPath: string) => void;
		writeFile: (pPath: string, pTypedArray: TypedArray, pOptions?: { flags?: number }) => void;
		ErrnoError: ErrnoError;
	};
	const IDBFS: {
		dbs: Record<string, IDBDatabase>;
		mount: (pMount: string) => unknown;
		syncfs: (pMount: string, pPopulate: boolean, pCallback: (pError: Error) => void) => void;
	};
	const MainLoop: {
		requestAnimationFrame: typeof requestAnimationFrame;
		pause: () => void;
		resume: () => void;
	};

	const runtimeKeepalivePush: () => void;
	const runtimeKeepalivePop: () => void;

	const GL: {
		getContext: (pContextHandle: GLContextHandle) => GLContext;
		getNewId: (pTable: unknown[]) => number;
		resizeOffscreenFramebuffer: (pGLContext: GLContext) => void;
		currentContext: GLContext;
		textures: GLTexture[];
	};

	// eslint-disable-next-line @typescript-eslint/naming-convention -- emscripten function.
	const _emscripten_webgl_get_current_context: () => GLContextHandle;

	const Module: object;

	const GodotRuntime: typeof _GodotRuntime.$GodotRuntime;
	const GodotOS: typeof _GodotOS.$GodotOS;
	const GodotFS: typeof _GodotFS.$GodotFS;
	const GodotAudio: typeof _GodotAudio.$GodotAudio;
	const GodotAudioWorklet: typeof _GodotAudioWorklet.$GodotAudioWorklet;
	const GodotAudioScript: typeof _GodotAudioScript.$GodotAudioScript;
	const GodotDisplayVK: typeof _GodotDisplayVK.$GodotDisplayVK;
	const GodotDisplayCursor: typeof _GodotDisplayCursor.$GodotDisplayCursor;
	const GodotDisplayScreen: typeof _GodotDisplayScreen.$GodotDisplayScreen;
	const GodotDisplay: typeof _GodotDisplay.$GodotDisplay;
	const GodotFetch: typeof _GodotFetch.$GodotFetch;
	const GodotJSWrapper: typeof _GodotJSWrapper.$GodotJSWrapper;
	const GodotEventListeners: typeof _GodotEventListeners.$GodotEventListeners;
	const GodotConfig: typeof _GodotConfig.$GodotConfig;
	const GodotPWA: typeof _GodotPWA.$GodotPWA;
	const IDHandler: typeof _IDHandler.$IDHandler;
	const GodotIME: typeof _GodotIME.$GodotIME;
	const GodotInputGamepads: typeof _GodotInputGamepads.$GodotInputGamepads;
	const GodotInputDragDrop: typeof _GodotInputDragDrop.$GodotInputDragDrop;
	const GodotInput: typeof _GodotInput.$GodotInput;
	const GodotWebGL2: typeof _GodotWebGL2.$GodotWebGL2;
	const GodotWebMidi: typeof _GodotWebMidi.$GodotWebMidi;
}
