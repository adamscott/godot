/**************************************************************************/
/*  service-worker.ts                                                     */
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

import type { ServiceWorkerData } from "./service-worker/types.ts";
import {
	fetchAndCache,
	getFullCache,
	wrapResponseWithCrossOriginIsolationHeaders,
} from "./service-worker/utils.ts";

// This service worker is required to expose an exported Godot project as a
// Progressive Web App. It provides an offline fallback page telling the user
// that they need an Internet connection to run the project if desired.
// Incrementing CACHE_VERSION will kick off the install event and force
// previously cached resources to be updated from the network.

async function onInstall(data: ServiceWorkerData): Promise<void> {
	const cache = await caches.open(data.cache.name);
	await cache.addAll(data.cache.files);
}

async function onActivate(data: ServiceWorkerData): Promise<void> {
	const keys = await caches.keys();
	await Promise.all(
		keys.filter((key) =>
			key.startsWith(data.cache.prefix) && key !== data.cache.name
		).map((key) => caches.delete(key)),
	);
	await self.registration.navigationPreload.enable();
}

async function respondForNavigatableOrCacheable(
	event: FetchEvent,
	data: ServiceWorkerData,
	isNavigate: boolean,
	isCacheable: boolean,
): Promise<Response | null> {
	// Try to use cache first.
	const cache = await caches.open(data.cache.name);
	if (isNavigate) {
		const fullCache = await Promise.all(
			getFullCache(data).map((name) => cache.match(name)),
		);
		const missing = fullCache.some((name) => name === undefined);
		if (missing) {
			try {
				// Try the network if some cached file are missing.
				// (so we can display the offline page)
				const response = await fetchAndCache(event, cache, {
					isCacheable,
					ensureCrossOriginIsolationHeaders:
						data.ensureCrossOriginIsolationHeaders,
				});
				return response;
			} catch (err) {
				// And return the hopefully always cached offline page in case of network failure.
				console.error("Network error:", err);
				const cacheMatch = await caches.match(data.offlineUrl);
				if (cacheMatch == null) {
					return null;
				}
				return cacheMatch;
			}
		}
	}

	let cached = await cache.match(event.request);
	if (cached != null) {
		if (data.ensureCrossOriginIsolationHeaders) {
			cached = wrapResponseWithCrossOriginIsolationHeaders(cached);
		}
		return cached;
	}

	// Try network if don't have it in cache.
	const response = await fetchAndCache(event, cache, {
		isCacheable,
		ensureCrossOriginIsolationHeaders:
			data.ensureCrossOriginIsolationHeaders,
	});
	if (response == null) {
		return null;
	}
	return response;
}

async function respondEnsuringCrossOriginIsolationHeaders(
	event: FetchEvent,
): Promise<Response> {
	let response = await fetch(event.request);
	response = wrapResponseWithCrossOriginIsolationHeaders(response);
	return response;
}

async function onMessage(
	event: ExtendableMessageEvent,
	data: ServiceWorkerData,
): Promise<void> {
	// No cross origin
	if (event.origin !== self.origin) {
		return;
	}
	const id = (event.source as Client | null)?.id ?? "";
	const msg: string = event.data ?? "";
	// Ensure it's one of our clients.
	const client = await self.clients.get(id);
	if (client == null) {
		return; // Not a valid client.
	}

	switch (msg) {
		case "claim":
			await self.skipWaiting();
			self.clients.claim();
			break;
		case "clear":
			caches.delete(data.cache.name);
			break;
		case "update":
			{
				await self.skipWaiting();
				await self.clients.claim();
				const allClients = await self.clients.matchAll();
				for (const client of allClients) {
					const windowClient = client as WindowClient;
					windowClient.navigate(windowClient.url);
				}
			}
			break;
	}
}

async function main(): Promise<void> {
	const serviceWorkerDataResponse = await fetch("service-worker-data.json");
	const serviceWorkerDataRaw: string | undefined =
		await serviceWorkerDataResponse
			?.text();
	if (serviceWorkerDataRaw == null) {
		console.error("Could not get service worker data. Aborting.");
		return;
	}
	const data: ServiceWorkerData = JSON.parse(serviceWorkerDataRaw);

	// Install.
	self.addEventListener<"install">("install", (event) => {
		event.waitUntil(onInstall(data));
	});

	// Activate.
	self.addEventListener<"activate">("activate", (event) => {
		event.waitUntil(onActivate(data));
	});

	self.addEventListener<"fetch">("fetch", async (event) => {
		const isNavigate = event.request.mode === "navigate";
		const url = event.request.url || "";
		const referrer = event.request.referrer || "";
		const base = referrer.slice(0, referrer.lastIndexOf("/") + 1);
		const local = url.startsWith(base) ? url.replace(base, "") : "";
		const isCacheable = getFullCache(data).some((cache) =>
			cache === local
		) || (base === referrer && base.endsWith(data.cache.files[0]));

		if (isNavigate || isCacheable) {
			const response = await respondForNavigatableOrCacheable(
				event,
				data,
				isNavigate,
				isCacheable,
			);
			if (response == null) {
				return;
			}
			event.respondWith(response);
		} else if (data.ensureCrossOriginIsolationHeaders) {
			event.respondWith(
				respondEnsuringCrossOriginIsolationHeaders(event),
			);
		}
	});

	self.addEventListener<"message">("message", async (event) => {
		try {
			await onMessage(event, data);
		} catch (err) {
			console.error("Error while handling a message", err);
		}
	});
}

try {
	await main();
} catch (err) {
	console.error(err);
}
