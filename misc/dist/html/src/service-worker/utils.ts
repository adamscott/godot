/**************************************************************************/
/*  utils.ts                                                              */
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

/// <reference types="npm:@types/serviceworker" />

import type { ServiceWorkerData } from "./types.ts";

export function getFullCache(data: ServiceWorkerData): string[] {
	return data.cache.files.concat(data.cache.cacheableFiles);
}

export function wrapResponseWithCrossOriginIsolationHeaders(
	response: Response,
): Response {
	if (
		response.headers.get("Cross-Origin-Embedder-Policy") ===
			"require-corp" &&
		response.headers.get("Cross-Origin-Opener-Policy") === "same-origin"
	) {
		return response;
	}

	const crossOriginIsolatedHeaders = new Headers(response.headers);
	crossOriginIsolatedHeaders.set(
		"Cross-Origin-Embedder-Policy",
		"require-corp",
	);
	crossOriginIsolatedHeaders.set("Cross-Origin-Opener-Policy", "same-origin");
	const newResponse = new Response(response.body, {
		status: response.status,
		statusText: response.statusText,
		headers: crossOriginIsolatedHeaders,
	});

	return newResponse;
}

export async function fetchAndCache(
	event: FetchEvent,
	cache: Cache,
	options: {
		isCacheable?: boolean;
		ensureCrossOriginIsolationHeaders?: boolean;
	} = {},
): Promise<Response> {
	const { isCacheable = false, ensureCrossOriginIsolationHeaders = false } =
		options;

	let response = await event.preloadResponse;
	if (response == null) {
		response = await fetch(event.request);
	}

	if (ensureCrossOriginIsolationHeaders) {
		response = wrapResponseWithCrossOriginIsolationHeaders(response);
	}

	if (isCacheable) {
		cache.put(event.request, response.clone());
	}

	return response;
}
