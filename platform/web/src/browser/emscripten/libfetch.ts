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
	CFunctionPointer,
	CIDHandlerId,
	CInt,
	CUintPointer,
	CVoidPointer,
} from "./libemscripten.ts";

type GodotFetchEntryId = CIDHandlerId<GodotFetchEntry>;

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
			pId: GodotFetchEntryId,
			pResult: ReadableStreamReadResult<Uint8Array<ArrayBufferLike>>,
		): void => {
			const fetchEntry = IDHandler.get(pId);
			if (fetchEntry == null) {
				return;
			}
			if (pResult.value != null) {
				fetchEntry.chunks.push(pResult.value);
			}
			fetchEntry.reading = false;
			fetchEntry.done = pResult.done;
		},

		onResponse: (pId: GodotFetchEntryId, pResponse: Response): void => {
			const fetchEntry = IDHandler.get(pId);
			if (fetchEntry == null) {
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
			fetchEntry.status = pResponse.status;
			fetchEntry.response = pResponse;
			// `body` can be null per spec (for example, in cases where the request method is HEAD).
			// As of the time of writing, Chromium (127.0.6533.72) does not follow the spec but Firefox (131.0.3) does.
			// See godotengine/godot#76825 for more information.
			// See Chromium revert (of the change to follow the spec):
			// https://chromium.googlesource.com/chromium/src/+/135354b7bdb554cd03c913af7c90aceead03c4d4
			fetchEntry.reader = pResponse.body?.getReader() ?? null;
			fetchEntry.chunked = chunked;
		},

		onError: (pId: GodotFetchEntryId, pError: Error): void => {
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
			const fetchEntry = IDHandler.get(pId);
			if (fetchEntry == null) {
				return;
			}
			fetchEntry.error = pError;
		},

		create: (
			pMethod: string,
			pUrl: string,
			pHeaders: HeadersInit,
			pBody: TypedArray | null,
		): GodotFetchEntryId => {
			const fetchEntry: GodotFetchEntry = {
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
			const id = IDHandler.add(fetchEntry);
			fetchEntry.abortController = new AbortController();
			fetchEntry.request = fetch(pUrl, {
				method: pMethod,
				headers: pHeaders,
				body: pBody,
				signal: fetchEntry.abortController.signal,
			});
			fetchEntry.request.then((pResponse) =>
				GodotFetch.onResponse(id, pResponse)
			).catch((pError: Error) => GodotFetch.onError(id, pError));

			return id;
		},

		free: (pId: GodotFetchEntryId): void => {
			const fetchEntry = IDHandler.get(pId);
			if (fetchEntry == null) {
				return;
			}

			IDHandler.remove(pId);
			if (fetchEntry.request == null || fetchEntry.done) {
				return;
			}

			fetchEntry.abortController?.abort();
		},

		read: (pId: GodotFetchEntryId): void => {
			const fetchEntry = IDHandler.get(pId);
			if (fetchEntry == null) {
				return;
			}

			if (
				fetchEntry.reader != null && !fetchEntry.reading
			) {
				if (fetchEntry.done) {
					fetchEntry.reader = null;
					return;
				}
				fetchEntry.reading = true;
				fetchEntry.reader.read().then((pValue) =>
					GodotFetch.onRead(pId, pValue)
				).catch((pError: Error) => GodotFetch.onError(pId, pError));
			} else if (
				fetchEntry.reader == null &&
				fetchEntry.response?.body == null
			) {
				// Emulate a stream closure to maintain the request lifecycle.
				fetchEntry.reading = true;
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
	godot_js_fetch_state_get: (pId: GodotFetchEntryId): CInt => {
		const fetchEntry = IDHandler.get(pId);
		if (fetchEntry == null) {
			return -1 as CInt;
		}
		if (fetchEntry.error != null) {
			return -1 as CInt;
		}
		if (fetchEntry.response == null) {
			return 0 as CInt;
		}

		// If the reader is nullish, but there is no body, and the request is not marked as done,
		// the same status should be returned as though the request is currently being read
		// so that the proper lifecycle closure can be handled in `read()`.
		if (
			fetchEntry.reader != null ||
			(fetchEntry.response?.body == null && !fetchEntry.done)
		) {
			return 1 as CInt;
		}
		if (fetchEntry.done) {
			return 2 as CInt;
		}
		return -1 as CInt;
	},

	godot_js_fetch_http_status_get__proxy: "sync",
	godot_js_fetch_http_status_get__sig: "ii",
	godot_js_fetch_http_status_get: (pId: GodotFetchEntryId): CInt => {
		const fetchEntry = IDHandler.get(pId);
		if (fetchEntry?.response == null) {
			return 0 as CInt;
		}
		return fetchEntry.status as CInt;
	},

	godot_js_fetch_read_headers__proxy: "sync",
	godot_js_fetch_read_headers__sig: "iipp",
	godot_js_fetch_read_headers: (
		pId: GodotFetchEntryId,
		pParseCallbackPtr: CFunctionPointer<FetchReadHeadersParseCallback>,
		pReferencePtr: CVoidPointer,
	): CInt => {
		const fetchEntry = IDHandler.get(pId);
		if (fetchEntry?.response == null) {
			return 1 as CInt;
		}
		const parseCallback = GodotRuntime.getFunction(pParseCallbackPtr);
		const headersStringArray: string[] = [];
		fetchEntry.response.headers.forEach((pValue, pKey) => {
			headersStringArray.push(`${pKey}:${pValue}`);
		});
		const headersStringArrayPtr = GodotRuntime.allocStringArray(
			headersStringArray,
		);
		parseCallback(
			headersStringArray.length as CInt,
			headersStringArrayPtr,
			pReferencePtr,
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
		pId: GodotFetchEntryId,
		pBufferPtr: CUintPointer,
		pBufferSize: number,
	): CInt => {
		const fetchEntry = IDHandler.get(pId);
		if (fetchEntry?.response == null) {
			return 0 as CInt;
		}
		let toRead = pBufferSize;
		const chunks = fetchEntry.chunks;
		while (toRead > 0 && chunks.length > 0) {
			const chunk = fetchEntry.chunks[0];

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

		return (pBufferSize - toRead) as CInt;
	},

	godot_js_fetch_is_chunked__proxy: "sync",
	godot_js_fetch_is_chunked__sig: "ii",
	godot_js_fetch_is_chunked: (pId: GodotFetchEntryId): CInt => {
		const fetchEntry = IDHandler.get(pId);
		if (fetchEntry?.response == null) {
			return -1 as CInt;
		}

		return Number(fetchEntry.chunked) as CInt;
	},

	godot_js_fetch_free__proxy: "sync",
	godot_js_fetch_free__sig: "vi",
	godot_js_fetch_free: (pId: GodotFetchEntryId): void => {
		GodotFetch.free(pId);
	},
};
autoAddDeps(_GodotFetch, "$GodotFetch");
addToLibrary(_GodotFetch);
