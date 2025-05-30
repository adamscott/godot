/**************************************************************************/
/*  fetch.ts                                                              */
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

type RetryInitStrategy = "exponentialBackoff" | "immediate";

interface RetryInit {
	retry: {
		strategy?: RetryInitStrategy;
		maxAttempts?: number;
		baseDelayMs?: number;
		maxDelayMs?: number | null;
		statusAllowList?: number[];
		statusDenyList?: number[];
	};
}

export function fetchWithRetry<T>(
	input: RequestInfo | URL,
	onResponse: (response: Response) => Promise<T>,
	init?: RequestInit & Partial<RetryInit>,
): Promise<T | null> {
	const {
		strategy: retryStrategy = "exponentialBackoff",
		maxAttempts: retryMaxAttempts = 3,
		baseDelayMs: retryBaseDelayMs = 500,
		maxDelayMs: retryMaxDelayMs = null,
		statusAllowList: retryStatusAllowList = [],
		statusDenyList: retryStatusDenyList = [],
	} = init?.retry ?? {};
	delete init?.retry;

	if (retryMaxAttempts <= 0) {
		throw new Error("retry.maxAttempts cannot be `<= 0`");
	}

	switch (retryStrategy) {
		case "exponentialBackoff":
		case "immediate":
			// Do nothing.
			break;
		default:
			throw new Error(`Unknown retry strategy: "${retryStrategy}"`);
	}

	let retryCurrentDelay = retryBaseDelayMs;
	const waitAndRetryFetch = (targetAttempt: number): Promise<T | null> => {
		if (targetAttempt <= 0) {
			return Promise.resolve(null);
		}
		return new Promise((resolve, _reject) => {
			setTimeout(() => {
				if (retryStrategy === "exponentialBackoff") {
					retryCurrentDelay += retryCurrentDelay;
					if (retryMaxDelayMs != null) {
						retryCurrentDelay = Math.min(
							retryCurrentDelay,
							retryMaxDelayMs,
						);
					}
					resolve(retryFetch(targetAttempt));
				}
			}, retryCurrentDelay);
		});
	};

	const retryFetch = async (attempt: number): Promise<T | null> => {
		if (attempt <= 0) {
			return null;
		}
		try {
			const response = await fetch(input, init);
			if (!response.ok) {
				if (retryStatusDenyList.includes(response.status)) {
					return null;
				}
				if (
					retryStatusAllowList.length > 0 &&
					!retryStatusAllowList.includes(response.status)
				) {
					return null;
				}
				return waitAndRetryFetch(attempt - 1);
			}
			const result: T = await onResponse(response);
			return result;
		} catch (err) {
			if (err instanceof DOMException && err.name === "AbortError") {
				return null;
			}
			return waitAndRetryFetch(attempt - 1);
		}
	};

	return waitAndRetryFetch(retryMaxAttempts);
}
