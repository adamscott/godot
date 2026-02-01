/**************************************************************************/
/*  godot_event_listeners.ts                                              */
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

import type { AnyFunction } from "@godotengine/utils/types";

import { convertFunctionToIifeString as $convertFunctionToIifeString } from "@godotengine/utils" with { type: "macro" };

class Handler {
	target: EventTarget;
	event: string;
	method: AnyFunction;
	capture: Parameters<EventTarget["addEventListener"]>[2];

	constructor(
		pTarget: typeof this.target,
		pEvent: typeof this.event,
		pMethod: typeof this.method,
		pCapture?: typeof this.capture,
	) {
		this.target = pTarget;
		this.event = pEvent;
		this.method = pMethod;
		this.capture = pCapture;
	}

	isSame(
		pTarget: typeof this.target,
		pEvent?: typeof this.event,
		pMethod?: typeof this.method,
		pCapture?: typeof this.capture,
	): boolean {
		if (this.target !== pTarget) {
			return false;
		}
		if (pEvent == null) {
			return true;
		}
		if (this.event !== pEvent) {
			return false;
		}
		if (pMethod == null) {
			return true;
		}
		if (this.method !== pMethod) {
			return false;
		}
		if (pCapture == null) {
			return true;
		}
		return this.isCaptureSame(pCapture);
	}

	isCaptureSame(pCapture: typeof this.capture): boolean {
		if (pCapture == null) {
			return this.capture == null;
		}

		if (typeof pCapture === "boolean") {
			if (typeof this.capture !== "boolean") {
				return false;
			}
			return pCapture === this.capture;
		}

		// `pCapture` is of type `AddEventListenerOptions`
		if (typeof this.capture !== "object") {
			return false;
		}
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- We know the exact type.
		const captureKeys = Object.keys(pCapture) as Array<keyof typeof pCapture>;
		if (captureKeys.length !== Object.keys(this.capture).length) {
			return false;
		}
		for (const key of captureKeys) {
			if (pCapture[key] !== this.capture[key]) {
				return false;
			}
		}
		return true;
	}

	addTargetEventListnener(): void {
		this.target.addEventListener(this.event, this.method, this.capture);
	}

	removeTargetEventListener(): void {
		this.target.removeEventListener(this.event, this.method, this.capture);
	}
}

type RemoveEventListeners = (
	pTarget: InstanceType<typeof Handler>["target"],
	pEvent?: InstanceType<typeof Handler>["event"],
	pMethod?: InstanceType<typeof Handler>["method"],
	pCapture?: InstanceType<typeof Handler>["capture"],
) => void;

export const _GodotEventListeners = {
	$GodotEventListeners__deps: ["$GodotOS"],
	$GodotEventListeners__postset: $convertFunctionToIifeString(() => {
		GodotOS.atExit(async () => {
			GodotEventListeners.clear();
		});
	}),
	$GodotEventListeners: {
		handlers: [] as Handler[],
		Handler,

		has: (
			pTarget: InstanceType<typeof Handler>["target"],
			pEvent: InstanceType<typeof Handler>["event"],
			pMethod: InstanceType<typeof Handler>["method"],
			pCapture?: InstanceType<typeof Handler>["capture"],
		) => {
			return (
				GodotEventListeners.handlers.findIndex((pHandler) => {
					return pHandler.isSame(pTarget, pEvent, pMethod, pCapture);
				}) !== -1
			);
		},

		add: (
			pTarget: InstanceType<typeof Handler>["target"],
			pEvent: InstanceType<typeof Handler>["event"],
			pMethod: InstanceType<typeof Handler>["method"],
			pCapture?: InstanceType<typeof Handler>["capture"],
		) => {
			if (GodotEventListeners.has(pTarget, pEvent, pMethod, pCapture)) {
				return;
			}
			const handler = new GodotEventListeners.Handler(pTarget, pEvent, pMethod, pCapture);
			GodotEventListeners.handlers.push(handler);
			handler.addTargetEventListnener();
		},

		remove: ((pTarget, pEvent, pMethod, pCapture) => {
			GodotEventListeners.handlers = GodotEventListeners.handlers.filter((pHandler) => {
				if (pHandler.isSame(pTarget, pEvent, pMethod, pCapture)) {
					pHandler.removeTargetEventListener();
					return false;
				}
				return true;
			});
		}) as RemoveEventListeners,

		clear: () => {
			for (const handler of GodotEventListeners.handlers) {
				handler.removeTargetEventListener();
			}
			GodotEventListeners.handlers.length = 0;
		},
	},
};

autoAddDeps(_GodotEventListeners, "$GodotEventListeners");
addToLibrary(_GodotEventListeners);
