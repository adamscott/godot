/**************************************************************************/
/*  libfetch.ts                                                           */
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
import { addToLibrary, autoAddDeps, HEAP8 } from "./libemscripten.ts";
import { GodotRuntime } from "./libruntime.ts";
import { IDHandler } from "./libos.ts";
// __emscripten_import_global_const_end

import { TypedArray } from "+browser/types/api.ts";

import {
	CCharArrayPointer,
	CCharPointer,
	CInt,
	CUintPointer,
	CVoidPointer,
} from "./libemscripten.ts";
import { IDHandlerId } from "./libos.ts";

export interface GodotFetchEntry {
	request: Promise<Response> | null;
	response: Response | null;
	abortController: AbortController | null;
	reader: ReadableStreamDefaultReader<Uint8Array<ArrayBufferLike>> | null;
	error: Error | null;
	done: boolean;
	reading: boolean;
	status: number;
	chunked: boolean;
	chunks: Uint8Array<ArrayBufferLike>[];
}

type FetchReadHeadersParseCallback = (
	pSize: CInt,
	pHeadersPtr: CCharArrayPointer,
	pReference: CVoidPointer,
) => void;

// __emscripten_declare_global_const_start
export declare const GodotFetch: typeof _GodotFetch.$GodotFetch;
// __emscripten_declare_global_const_end
const _GodotFetch = {
	$GodotFetch__deps: ["$IDHandler", "$GodotRuntime"],
	$GodotFetch: {
		onRead: (
			pId: IDHandlerId,
			pResult: ReadableStreamReadResult<Uint8Array<ArrayBufferLike>>,
		): void => {
			const reference = IDHandler.get<GodotFetchEntry>(pId);
			if (reference == null) {
				return;
			}
			if (pResult.value != null) {
				reference.chunks.push(pResult.value);
			}
			reference.reading = false;
			reference.done = pResult.done;
		},

		onResponse: (pId: IDHandlerId, pResponse: Response): void => {
			const reference = IDHandler.get<GodotFetchEntry>(pId);
			if (reference == null) {
				return;
			}
			let chunked = false;
			pResponse.headers.forEach((pValue, pHeader) => {
				if (chunked) {
					return;
				}
				const value = pValue.toLowerCase().trim();
				const header = pHeader.toLowerCase().trim();
				if (header === "transfer-encoding" && value === "chunked") {
					chunked = true;
				}
			});
			reference.status = pResponse.status;
			reference.response = pResponse;
			// `body` can be null per spec (for example, in cases where the request method is HEAD).
			// As of the time of writing, Chromium (127.0.6533.72) does not follow the spec but Firefox (131.0.3) does.
			// See godotengine/godot#76825 for more information.
			// See Chromium revert (of the change to follow the spec):
			// https://chromium.googlesource.com/chromium/src/+/135354b7bdb554cd03c913af7c90aceead03c4d4
			reference.reader = pResponse.body?.getReader() ?? null;
			reference.chunked = chunked;
		},

		onError: (pId: IDHandlerId, pError: Error): void => {
			if (!(pError instanceof Error)) {
				GodotRuntime.error("Received invalid error:", pError);
				return;
			}

			if (
				pError instanceof DOMException && pError.name === "AbortError"
			) {
				// The abortController did stop the request.
				// Let's do nothing.
				return;
			}

			GodotRuntime.error(pError);
			const reference = IDHandler.get<GodotFetchEntry>(pId);
			if (reference == null) {
				return;
			}
			reference.error = pError;
		},

		create: (
			pMethod: string,
			pUrl: string,
			pHeaders: HeadersInit,
			pBody: TypedArray | null,
		): IDHandlerId => {
			const reference: GodotFetchEntry = {
				request: null,
				response: null,
				abortController: null,
				reader: null,
				error: null,
				done: false,
				reading: false,
				chunked: false,
				status: 0,
				chunks: [],
			};
			const id = IDHandler.add(reference);
			reference.abortController = new AbortController();
			reference.request = fetch(pUrl, {
				method: pMethod,
				headers: pHeaders,
				body: pBody,
				signal: reference.abortController.signal,
			});
			reference.request.then((pResponse) =>
				GodotFetch.onResponse(id, pResponse)
			).catch((pError: Error) => GodotFetch.onError(id, pError));

			return id;
		},

		free: (pId: IDHandlerId): void => {
			const reference = IDHandler.get<GodotFetchEntry>(pId);
			if (reference == null) {
				return;
			}

			IDHandler.remove(pId);
			if (reference.request == null || reference.done) {
				return;
			}

			reference.abortController?.abort();
		},

		read: (pId: IDHandlerId): void => {
			const reference = IDHandler.get<GodotFetchEntry>(pId);
			if (reference == null) {
				return;
			}

			if (
				reference.reader != null && !reference.reading
			) {
				if (reference.done) {
					reference.reader = null;
					return;
				}
				reference.reading = true;
				reference.reader.read().then((pValue) =>
					GodotFetch.onRead(pId, pValue)
				).catch((pError: Error) => GodotFetch.onError(pId, pError));
			} else if (
				reference.reader == null &&
				reference.response?.body == null
			) {
				// Emulate a stream closure to maintain the request lifecycle.
				reference.reading = true;
				GodotFetch.onRead(pId, { done: true });
			}
		},
	},

	godot_js_fetch_create__proxy: "sync",
	godot_js_fetch_create__sig: "ipppipi",
	godot_js_fetch_create: (
		pMethodPtr: CCharPointer,
		pUrlPtr: CCharPointer,
		pHeadersPtr: CCharArrayPointer,
		pHeadersSize: CInt,
		pBodyPtr: CUintPointer,
		pBodySize: CInt,
	): CInt => {
		const method = GodotRuntime.parseString(pMethodPtr);
		const url = GodotRuntime.parseString(pUrlPtr);
		const headerStrings = GodotRuntime.parseStringArray(
			pHeadersPtr,
			pHeadersSize,
		);
		const body = pBodySize > 0
			? GodotRuntime.heapSlice(HEAP8, pBodyPtr, pBodySize)
			: null;

		const headerKeyValues = headerStrings.map(
			(pHeaderString) => {
				const index = pHeaderString.indexOf(":");
				if (index <= 0) {
					return [];
				}
				return [
					pHeaderString.slice(0, index).trim(),
					pHeaderString.slice(index + 1).trim(),
				] as [string, string];
			},
		).filter(
			(pHeaderKeyValue): pHeaderKeyValue is [string, string] => {
				return pHeaderKeyValue.length == 2;
			},
		);
		return GodotFetch.create(method, url, headerKeyValues, body) as CInt;
	},

	godot_js_fetch_state_get__proxy: "sync",
	godot_js_fetch_state_get__sig: "ii",
	godot_js_fetch_state_get: (pId: CInt): CInt => {
		const reference = IDHandler.get<GodotFetchEntry>(pId);
		if (reference == null) {
			return -1 as CInt;
		}
		if (reference.error != null) {
			return -1 as CInt;
		}
		if (reference.response == null) {
			return 0 as CInt;
		}

		// If the reader is nullish, but there is no body, and the request is not marked as done,
		// the same status should be returned as though the request is currently being read
		// so that the proper lifecycle closure can be handled in `read()`.
		if (
			reference.reader != null ||
			(reference.response?.body == null && !reference.done)
		) {
			return 1 as CInt;
		}
		if (reference.done) {
			return 2 as CInt;
		}
		return -1 as CInt;
	},

	godot_js_fetch_http_status_get__proxy: "sync",
	godot_js_fetch_http_status_get__sig: "ii",
	godot_js_fetch_http_status_get: (pId: CInt): CInt => {
		const reference = IDHandler.get<GodotFetchEntry>(pId);
		if (reference?.response == null) {
			return 0 as CInt;
		}
		return reference.status as CInt;
	},

	godot_js_fetch_read_headers__proxy: "sync",
	godot_js_fetch_read_headers__sig: "iipp",
	godot_js_fetch_read_headers: (
		pId: CInt,
		pParseCallbackPtr: CVoidPointer,
		pReference: CVoidPointer,
	): CInt => {
		const reference = IDHandler.get<GodotFetchEntry>(pId);
		if (reference?.response == null) {
			return 1 as CInt;
		}
		const parseCallback = GodotRuntime.getFunction<
			FetchReadHeadersParseCallback
		>(pParseCallbackPtr);
		const headersStringArray: string[] = [];
		reference.response.headers.forEach((pValue, pKey) => {
			headersStringArray.push(`${pKey}:${pValue}`);
		});
		const headersStringArrayPtr = GodotRuntime.allocStringArray(
			headersStringArray,
		);
		parseCallback(
			headersStringArray.length as CInt,
			headersStringArrayPtr,
			pReference,
		);
		GodotRuntime.freeStringArray(
			headersStringArrayPtr,
			headersStringArray.length,
		);
		return 0 as CInt;
	},

	godot_js_fetch_read_chunk__proxy: "sync",
	godot_js_fetch_read_chunk__sig: "iipi",
	godot_js_fetch_read_chunk: (
		pId: CInt,
		pBufferPtr: CUintPointer,
		pBufferSize: number,
	): CInt => {
		const reference = IDHandler.get<GodotFetchEntry>(pId);
		if (reference?.response == null) {
			return 0 as CInt;
		}
		let toRead = pBufferSize;
		const chunks = reference.chunks;
		while (toRead > 0 && chunks.length > 0) {
			const chunk = reference.chunks[0];

			if (chunk.length > toRead) {
				GodotRuntime.heapCopy(
					HEAP8,
					chunk.slice(0, toRead),
					pBufferPtr,
				);
				chunks[0] = chunk.slice(toRead);
				toRead = 0;
				continue;
			}

			GodotRuntime.heapCopy(HEAP8, chunk, pBufferPtr);
			toRead -= chunk.length;
			chunks.pop();
		}

		if (chunks.length === 0) {
			GodotFetch.read(pId);
		}

		return pBufferSize - toRead as CInt;
	},

	godot_js_fetch_is_chunked__proxy: "sync",
	godot_js_fetch_is_chunked__sig: "ii",
	godot_js_fetch_is_chunked: (pId: CInt): CInt => {
		const reference = IDHandler.get<GodotFetchEntry>(pId);
		if (reference?.response == null) {
			return -1 as CInt;
		}

		return Number(reference.chunked) as CInt;
	},

	godot_js_fetch_free__proxy: "sync",
	godot_js_fetch_free__sig: "vi",
	godot_js_fetch_free: (pId: CInt): void => {
		GodotFetch.free(pId);
	},
};
autoAddDeps(_GodotFetch, "$GodotFetch");
addToLibrary(_GodotFetch);
