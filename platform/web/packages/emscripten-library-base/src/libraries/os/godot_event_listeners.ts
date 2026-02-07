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

import type { GetEventTargetEventMap, GetEventTargetListener } from "@godotengine/utils-browser/types";
import { convertFunctionToIifeString as $convertFunctionToIifeString } from "@godotengine/utils/macros" with { type: "macro" };

const _GodotEventListenersHandlerDefaultOptions = {
	capture: false,
	once: false,
	passive: false,
	signal: undefined,
} as const;

class _GodotEventListenersHandler<
	ET extends EventTarget = EventTarget,
	// Without the `Extract`, `keyof` of extended types can return `number` and `symbol`.
	T extends Extract<keyof GetEventTargetEventMap<ET>, string> = Extract<keyof GetEventTargetEventMap<ET>, string>,
> {
	target: ET;
	type: T;
	listener: GetEventTargetListener<ET, T>;
	options: AddEventListenerOptions;
	_registeredMethod: typeof this.listener | undefined;

	constructor(
		pTarget: typeof this.target,
		pType: typeof this.type,
		pListener: typeof this.listener,
		pOptions?: boolean | typeof this.options,
	) {
		this.target = pTarget;
		this.type = pType;
		this.listener = pListener;
		this._registeredMethod = undefined;

		if (typeof pOptions === "boolean") {
			this.options = {
				...GodotEventListeners._handlerDefaultOptions,
				capture: pOptions,
			};
		} else {
			this.options = {
				...GodotEventListeners._handlerDefaultOptions,
				...pOptions,
			};
		}
	}

	// @ts-expect-error: If `isSame()` passes, yes, pHandler is of type `this`.
	isSame(pHandler: _GodotEventListenersHandler): pHandler is typeof this;
	isSame(pTarget: EventTarget, pType?: undefined, pListener?: undefined, pOptions?: undefined): boolean;
	isSame<NET extends EventTarget, NT extends Extract<keyof GetEventTargetEventMap<NET>, string>>(
		pTarget: NET,
		pType?: NT,
		pListener?: undefined,
		pOptions?: undefined,
	): this is _GodotEventListenersHandler<NET, NT>;
	isSame<NET extends EventTarget, NT extends Extract<keyof GetEventTargetEventMap<NET>, string>>(
		pTarget: NET,
		pType?: NT,
		pListener?: GetEventTargetListener<NET, NT>,
		pOptions?: boolean | AddEventListenerOptions,
	): this is _GodotEventListenersHandler<NET, NT>;
	isSame(pTarget: unknown, pType?: unknown, pListener?: unknown, pOptions?: unknown): unknown {
		/* eslint-disable @typescript-eslint/init-declarations -- We are initializing all values just after. */
		let target: EventTarget | null;
		let type: string | null;
		let listener: EventListenerOrEventListenerObject | null;
		let options: boolean | AddEventListenerOptions | null;
		/* eslint-enable @typescript-eslint/init-declarations */

		if (pTarget instanceof GodotEventListeners.Handler) {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- We just checked.
			const handler: _GodotEventListenersHandler = pTarget;
			target = handler.target;
			type = handler.type;
			listener = handler.listener;
			options = handler.options;
		} else {
			/* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- We are casting unknown types. */
			target = pTarget as EventTarget | null;
			type = pType as string | null;
			listener = pListener as EventListenerOrEventListenerObject | null;
			options = pOptions as boolean | AddEventListenerOptions | null;
			/* eslint-enable @typescript-eslint/no-unsafe-type-assertion */
		}

		if ((this.target as EventTarget) !== target) {
			return false;
		}
		if (type == null) {
			return true;
		}
		if ((this.type as string) !== type) {
			return false;
		}
		if (listener == null) {
			return true;
		}

		if (this.listener !== listener) {
			return false;
		}

		return this.areOptionsSame(options ?? GodotEventListeners._handlerDefaultOptions);
	}

	areOptionsSame(pOptions: boolean | AddEventListenerOptions): boolean {
		if (typeof pOptions === "boolean") {
			return this._compareOptions({ capture: pOptions });
		}
		return this._compareOptions(pOptions);
	}

	_compareOptions(pOptions: AddEventListenerOptions): boolean {
		const defaultOptions = GodotEventListeners._handlerDefaultOptions;
		return (
			this.options.capture === (pOptions.capture ?? defaultOptions.capture) &&
			this.options.once === (pOptions.once ?? defaultOptions.once) &&
			this.options.passive === (pOptions.passive ?? defaultOptions.passive) &&
			this.options.signal === (pOptions.signal ?? defaultOptions.signal)
		);
	}

	addTargetEventListnener(): void {
		this.target.addEventListener(
			this.type as string,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Yes, we know it's narrower.
			this.listener as EventListenerOrEventListenerObject | null,
			this.options,
		);
	}

	removeTargetEventListener(): void {
		this.target.removeEventListener(
			this.type as string,
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Yes, we know it's narrower.
			this.listener as EventListenerOrEventListenerObject | null,
			this.options,
		);
	}

	clear(): void {
		this.removeTargetEventListener();
	}
}

class _GodotEventListenersHandlerMap {
	_internalHandlerMap = new Map<
		unknown,
		Map<string, Set<_GodotEventListenersHandler<EventTarget, string>> | undefined> | undefined
	>();

	set<ET extends EventTarget, T extends Extract<keyof GetEventTargetEventMap<ET>, string>>(
		pTarget: ET,
		pType: T,
		pHandler: _GodotEventListenersHandler<ET, T>,
	): void {
		let targetMap = this._internalHandlerMap.get(pTarget);
		if (targetMap == null) {
			targetMap = new Map();
			this._internalHandlerMap.set(pTarget, targetMap);
		}

		let typeSetInTargetMap = targetMap.get(pType);
		if (typeSetInTargetMap == null) {
			typeSetInTargetMap = new Set();
			targetMap.set(pType, typeSetInTargetMap);
		}

		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- We force the type for the generic container.
		typeSetInTargetMap.add(pHandler as unknown as _GodotEventListenersHandler<EventTarget, string>);
	}

	get<ET extends EventTarget, T extends Extract<keyof GetEventTargetEventMap<ET>, string>>(
		pTarget: ET,
		pType: T,
		pListener: GetEventTargetListener<ET, T>,
		pOptions?: boolean | AddEventListenerOptions,
	): _GodotEventListenersHandler<ET, T> | null {
		const targetMap = this._internalHandlerMap.get(pTarget);
		if (targetMap == null) {
			return null;
		}

		const typeSetInTargetMap = targetMap.get(pType);
		if (typeSetInTargetMap == null) {
			return null;
		}

		for (const handler of typeSetInTargetMap) {
			if (handler.isSame(pTarget, pType, pListener, pOptions)) {
				return handler;
			}
		}

		return null;
	}

	has<ET extends EventTarget, T extends Extract<keyof GetEventTargetEventMap<ET>, string>>(
		pTarget: ET,
		pType: T,
		pListener: GetEventTargetListener<ET, T>,
		pOptions?: boolean | AddEventListenerOptions,
	): boolean {
		return this.get(pTarget, pType, pListener, pOptions) != null;
	}

	remove<ET extends EventTarget, T extends Extract<keyof GetEventTargetEventMap<ET>, string>>(
		pTarget: ET,
		pType?: T,
		pListener?: GetEventTargetListener<ET, T>,
		pOptions?: boolean | AddEventListenerOptions,
	): void {
		for (const [target, targetMap] of this._internalHandlerMap.entries()) {
			if (targetMap == null) {
				continue;
			}
			for (const [type, handlerSet] of targetMap.entries()) {
				if (handlerSet == null) {
					continue;
				}
				for (const handler of handlerSet) {
					if (handler.isSame(pTarget, pType, pListener, pOptions)) {
						handlerSet.delete(handler);
						handler.clear();
					}
				}
				if (handlerSet.size === 0) {
					targetMap.delete(type);
				}
			}
			if (targetMap.size === 0) {
				this._internalHandlerMap.delete(target);
			}
		}
	}

	clear(): void {
		for (const [_target, targetMap] of this._internalHandlerMap.entries()) {
			if (targetMap == null) {
				continue;
			}
			for (const [_type, handlerSet] of targetMap.entries()) {
				if (handlerSet == null) {
					continue;
				}
				for (const handler of handlerSet) {
					handler.clear();
				}
				handlerSet.clear();
			}
			targetMap.clear();
		}
		this._internalHandlerMap.clear();
	}

	*[Symbol.iterator](): Generator<_GodotEventListenersHandler> {
		for (const [_target, targetMap] of this._internalHandlerMap.entries()) {
			if (targetMap == null) {
				continue;
			}
			for (const [_type, handlerSet] of targetMap.entries()) {
				if (handlerSet == null) {
					continue;
				}
				for (const handler of handlerSet) {
					yield handler;
				}
			}
		}
	}
}

export const _GodotEventListeners = {
	$GodotEventListeners__deps: ["$GodotOS"] as const,
	$GodotEventListeners__postset: $convertFunctionToIifeString(() => {
		GodotEventListeners.handlers = new GodotEventListeners.HandlerMap();
		GodotOS.atExit(async () => {
			GodotEventListeners.clear();
		});
	}),
	$GodotEventListeners: {
		Handler: _GodotEventListenersHandler,
		_handlerDefaultOptions: _GodotEventListenersHandlerDefaultOptions,
		HandlerMap: _GodotEventListenersHandlerMap,
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- We're setting it in the postset.
		handlers: null as unknown as InstanceType<typeof _GodotEventListenersHandlerMap>,

		has: <ET extends EventTarget, T extends Extract<keyof GetEventTargetEventMap<ET>, string>>(
			pTarget: ET,
			pType: T,
			pListener: GetEventTargetListener<ET, T>,
			pCapture?: boolean | AddEventListenerOptions,
		): boolean => {
			for (const handler of GodotEventListeners.handlers) {
				if (handler.isSame(pTarget, pType, pListener, pCapture)) {
					return true;
				}
			}
			return false;
		},

		add: <ET extends EventTarget, T extends Extract<keyof GetEventTargetEventMap<ET>, string>>(
			pTarget: ET,
			pType: T,
			pListener: GetEventTargetListener<ET, T>,
			pOptions?: boolean | AddEventListenerOptions,
		): void => {
			if (GodotEventListeners.has(pTarget, pType, pListener, pOptions)) {
				return;
			}
			const handler = new GodotEventListeners.Handler(pTarget, pType, pListener, pOptions);
			GodotEventListeners.handlers.set(pTarget, pType, handler);
			handler.addTargetEventListnener();
		},

		remove: <ET extends EventTarget, T extends Extract<keyof GetEventTargetEventMap<ET>, string>>(
			pTarget: ET,
			pType?: T,
			pListener?: GetEventTargetListener<ET, T>,
			pOptions?: boolean | AddEventListenerOptions,
		): void => {
			GodotEventListeners.handlers.remove(pTarget, pType, pListener, pOptions);
		},

		clear: (): void => {
			GodotEventListeners.handlers.clear();
		},
	},
};

autoAddDeps(_GodotEventListeners, "$GodotEventListeners");
addToLibrary(_GodotEventListeners);
