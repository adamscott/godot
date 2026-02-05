/**************************************************************************/
/*  godot_jswrapper.ts                                                    */
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

import type {
	CCharPointer,
	CDouble,
	CDoublePointer,
	CFunctionPointer,
	CIDHandlerId,
	CInt,
	CInt64Pointer,
	CPointer,
	CVoidArrayPointer,
	CVoidPointer,
} from "@godotengine/emscripten-utils/types";
import { convertFunctionToIifeString as $convertFunctionToIifeString } from "@godotengine/utils/macros" with { type: "macro" };

type GodotJSWrapperProxyId = CIDHandlerId<GodotJSWrapperProxy<unknown>>;

type GodotJSWrapperVariant2JSCallback = (
	pArgs: CVoidArrayPointer,
	pPosition: CInt,
	rValue: CVoidPointer,
	pLock: CVoidArrayPointer,
) => CInt;
type GodotJSWrapperFreeLockCallback = (pLock: CVoidArrayPointer, pType: CInt) => void;
type GodotJSWrapperCreateCbCallback = (pReference: CVoidPointer, pArgumentId: CInt, pArgumentCount: CInt) => void;
type GodotJSWrapperObjectTransferBufferCallback = (
	pPtr: CVoidPointer,
	pPtr2: CVoidPointer,
	pLength: CInt,
) => CVoidPointer;

type VariantToJSReturnValue<T extends number> = T extends 0
	? null
	: T extends 1
		? boolean
		: T extends 2
			? number | bigint
			: T extends 3
				? number
				: T extends 4
					? string
					: T extends 24
						? object | null
						: undefined;

function variantToJS<T extends number>(pType: T, pValuePtr: CPointer): VariantToJSReturnValue<T> {
	// We ensure the return value with `satisfies VariantToJSReturnValue<index>`.
	switch (pType) {
		case 0:
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Force typescript to accept the dynamic return value.
			return null satisfies VariantToJSReturnValue<0> as VariantToJSReturnValue<T>;
		case 1:
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Force typescript to accept the dynamic return value.
			return GodotRuntime.fromCInt64ToBoolean(
				GodotRuntime.getHeapValue(GodotRuntime.asCType<CInt64Pointer>(pValuePtr), "i64"),
			) satisfies VariantToJSReturnValue<1> as VariantToJSReturnValue<T>;
		case 2: {
			// `heapValue` may be a bigint.
			const heapValue = GodotRuntime.getHeapValue(GodotRuntime.asCType<CInt64Pointer>(pValuePtr), "i64");
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Force typescript to accept the dynamic return value.
			return (heapValue >= Number.MIN_SAFE_INTEGER && heapValue <= Number.MAX_SAFE_INTEGER
				? Number(GodotRuntime.fromCInt64ToBigint(heapValue))
				: GodotRuntime.fromCTypeToNumber(
						GodotRuntime.asCInt(heapValue),
					)) satisfies VariantToJSReturnValue<2> as VariantToJSReturnValue<T>;
		}
		case 3:
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Force typescript to accept the dynamic return value.
			return Number(
				GodotRuntime.getHeapValue(GodotRuntime.asCType<CDoublePointer>(pValuePtr), "double"),
			) satisfies VariantToJSReturnValue<3> as VariantToJSReturnValue<T>;
		case 4:
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Force typescript to accept the dynamic return value.
			return GodotRuntime.parseString(
				GodotRuntime.asCType<CCharPointer>(GodotRuntime.getHeapValue(pValuePtr, "*")),
			) satisfies VariantToJSReturnValue<4> as VariantToJSReturnValue<T>;
		case 24: {
			// OBJECT
			const proxy = GodotJSWrapper.getProxiedValue<object>(
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Force typing as `GodotJSWrapperProxyId`.
				GodotRuntime.getHeapValue(pValuePtr, "i64") as GodotJSWrapperProxyId,
			);
			if (proxy == null) {
				throw new Error("Couldn't convert object to proxy.");
			}
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Force typescript to accept the dynamic return value.
			return proxy satisfies VariantToJSReturnValue<24> as VariantToJSReturnValue<T>;
		}
		default:
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Force typescript to accept the dynamic return value.
			return undefined satisfies VariantToJSReturnValue<9999> as VariantToJSReturnValue<T>;
	}
}

type JSToVariantReturnValue<T> = T extends undefined | null
	? 0
	: T extends boolean
		? 1
		: T extends number
			? 2 | 3
			: T extends bigint
				? 2
				: T extends string
					? 4
					: 24;

function jsToVariant<T>(pValue: T, pExchangePtr: CPointer): JSToVariantReturnValue<T> {
	if (pValue === undefined || pValue === null) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Force typescript to accept the dynamic return value.
		return 0 satisfies JSToVariantReturnValue<undefined | null> as JSToVariantReturnValue<T>; // NIL
	}
	if (typeof pValue === "boolean") {
		GodotRuntime.setHeapValue(pExchangePtr, GodotRuntime.asCInt64(Number(pValue)), "i64");
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Force typescript to accept the dynamic return value.
		return 1 satisfies JSToVariantReturnValue<boolean> as JSToVariantReturnValue<T>; // BOOL
	} else if (typeof pValue === "number") {
		if (Number.isInteger(pValue)) {
			GodotRuntime.setHeapValue(pExchangePtr, GodotRuntime.asCInt64(pValue), "i64");
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Force typescript to accept the dynamic return value.
			return 2 satisfies JSToVariantReturnValue<number> as JSToVariantReturnValue<T>; // INT
		}
		GodotRuntime.setHeapValue(pExchangePtr, GodotRuntime.asCType<CDouble>(pValue), "double");
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Force typescript to accept the dynamic return value.
		return 3 satisfies JSToVariantReturnValue<number> as JSToVariantReturnValue<T>; // FLOAT
	} else if (typeof pValue === "bigint") {
		GodotRuntime.setHeapValue(pExchangePtr, GodotRuntime.asCInt64(pValue), "i64");
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Force typescript to accept the dynamic return value.
		return 2 satisfies JSToVariantReturnValue<bigint> as JSToVariantReturnValue<T>; // INT
	} else if (typeof pValue === "string") {
		const valuePtr = GodotRuntime.allocString(pValue);
		GodotRuntime.setHeapValue(pExchangePtr, valuePtr, "*");
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Force typescript to accept the dynamic return value.
		return 4 satisfies JSToVariantReturnValue<string> as JSToVariantReturnValue<T>; // STRING
	}
	const id = GodotJSWrapper.getProxied(pValue);
	GodotRuntime.setHeapValue(pExchangePtr, id, "i64");
	// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Force typescript to accept the dynamic return value.
	return 24 satisfies JSToVariantReturnValue<object> as JSToVariantReturnValue<T>; // OBJECT
}

class GodotJSWrapperProxy<T> {
	_value: T;
	_id: GodotJSWrapperProxyId;
	_references: number;

	constructor(pValue: T) {
		this._references = 1;
		this._value = pValue;
		this._id = IDHandler.add(this);
		GodotJSWrapper.proxies.set(pValue, this._id);
	}

	reference(): void {
		this._references += 1;
	}

	unreference(): void {
		this._references -= 1;
		if (this._references <= 0) {
			IDHandler.remove(this._id);
			GodotJSWrapper.proxies.delete(this._value);
		}
	}

	getValue(): T {
		return this._value;
	}

	getId(): GodotJSWrapperProxyId {
		return this._id;
	}
}

export const _GodotJSWrapper = {
	$GodotJSWrapper__deps: ["$GodotRuntime", "$IDHandler"] as const,
	$GodotJSWrapper__postset: $convertFunctionToIifeString(() => {
		GodotJSWrapper.proxies = new Map();
	}),
	$GodotJSWrapper: {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- It will be set at `$GodotJSWrapper.init()`.
		proxies: null as unknown as Map<unknown, GodotJSWrapperProxyId>,
		callbackReturnValue: null as unknown,

		GodotJSWrapperProxy,

		variantToJS,
		jsToVariant,

		getProxied: (pValue: object): GodotJSWrapperProxyId => {
			const id = GodotJSWrapper.proxies.get(pValue);
			if (id === undefined) {
				const proxy = new GodotJSWrapper.GodotJSWrapperProxy(pValue);
				return proxy.getId();
			}
			const element = IDHandler.get(id);
			if (element == null) {
				throw new Error("Proxied element is null.");
			}

			element.reference();
			return id;
		},

		// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- We really want to keep `T` here in order to cast at the return.
		getProxiedValue: <T>(pId: GodotJSWrapperProxyId): T | null => {
			const proxy = IDHandler.get(pId);
			if (proxy == null) {
				return null;
			}
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- Controlled risk here.
			return proxy.getValue() as T;
		},

		isBuffer: (pObject: unknown): pObject is ArrayBuffer | ArrayBufferView => {
			return pObject instanceof ArrayBuffer || ArrayBuffer.isView(pObject);
		},
	},

	godot_js_wrapper_interface_get__proxy: "sync",
	godot_js_wrapper_interface_get__sig: "ip",
	godot_js_wrapper_interface_get: (pNamePtr: CCharPointer): CInt => {
		const name = GodotRuntime.parseString(pNamePtr);
		if (!(name in globalThis)) {
			return GodotRuntime.asCInt(0);
		}
		// @ts-expect-error Accessing `globalThis` with a string.
		// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Unsafe by design.
		return GodotRuntime.asCInt(GodotJSWrapper.getProxied(globalThis[name]));
	},

	godot_js_wrapper_object_call__proxy: "sync",
	godot_js_wrapper_object_call__sig: "iippipppp",
	godot_js_wrapper_object_call: (
		pId: GodotJSWrapperProxyId,
		pMethodPtr: CCharPointer,
		pArgsPtr: CVoidArrayPointer,
		pArgc: CInt,
		pConvertCallbackPtr: CFunctionPointer<GodotJSWrapperVariant2JSCallback>,
		pConvertCallbackReturnValuePtr: CVoidPointer,
		pLockPtr: CVoidArrayPointer,
		pFreeLockCallbackPtr: CFunctionPointer<GodotJSWrapperFreeLockCallback>,
	): CInt => {
		const value = GodotJSWrapper.getProxiedValue(pId);
		if (value == null) {
			return GodotRuntime.asCInt(-1);
		}
		const method = GodotRuntime.parseString(pMethodPtr);
		const convertCallback = GodotRuntime.getFunction(pConvertCallbackPtr);
		const freeLockCallback = GodotRuntime.getFunction(pFreeLockCallbackPtr);
		const args = new Array<unknown>(pArgc).fill(null);
		for (let i = 0; i < pArgc; i++) {
			const convertedType = convertCallback(
				pArgsPtr,
				GodotRuntime.asCInt(i),
				pConvertCallbackReturnValuePtr,
				pLockPtr,
			);
			const lockPtr = GodotRuntime.asCType<CVoidPointer>(GodotRuntime.getHeapValue(pLockPtr, "*"));
			// eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- It doesn't really return undefined.
			args[i] = GodotJSWrapper.variantToJS(
				GodotRuntime.fromCTypeToNumber(convertedType),
				pConvertCallbackReturnValuePtr,
			);
			if (lockPtr !== GodotRuntime.NULLPTR) {
				freeLockCallback(pLockPtr, convertedType);
			}
		}
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call -- Unsafe by design.
			const res = value[method](...args);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- We don't really know in advance what it returns.
			return GodotJSWrapper.jsToVariant(res, pConvertCallbackReturnValuePtr);
		} catch (e) {
			GodotRuntime.error(`Error calling method ${method} on:`, value, "error:", e);
			return GodotRuntime.asCInt(-1);
		}
	},

	godot_js_wrapper_object_get__proxy: "sync",
	godot_js_wrapper_object_get__sig: "iipp",
	godot_js_wrapper_object_get: (
		pId: GodotJSWrapperProxyId,
		pExchangePtr: CVoidPointer,
		pPropertyPtr: CCharPointer,
	): CInt => {
		const value = GodotJSWrapper.getProxiedValue(pId);
		if (value == null) {
			return GodotRuntime.asCInt(0);
		}

		if (pPropertyPtr === GodotRuntime.NULLPTR) {
			return GodotRuntime.asCInt(GodotJSWrapper.jsToVariant(value, pExchangePtr));
		}

		const property = GodotRuntime.parseString(pPropertyPtr);
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-argument -- Unsafe by design.
			return GodotRuntime.asCInt(GodotJSWrapper.jsToVariant(value[property], pExchangePtr));
		} catch (_error) {
			GodotRuntime.error(`Error getting variable ${property} on object`, value);
			return GodotRuntime.asCInt(0); // NIL
		}
	},

	godot_js_wrapper_object_set__proxy: "sync",
	godot_js_wrapper_object_set__sig: "vipip",
	godot_js_wrapper_object_set: (
		pId: GodotJSWrapperProxyId,
		pNamePtr: CCharPointer,
		pType: CInt,
		pExchangePtr: CVoidPointer,
	): void => {
		const value = GodotJSWrapper.getProxiedValue(pId);
		if (value == null) {
			return;
		}
		const name = GodotRuntime.parseString(pNamePtr);
		try {
			// eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- It doesn't really return undefined.
			value[name] = GodotJSWrapper.variantToJS(pType, pExchangePtr);
		} catch (_error) {
			GodotRuntime.error(`Error setting variable ${name} on object`, value);
		}
	},

	godot_js_wrapper_object_unref__proxy: "sync",
	godot_js_wrapper_object_unref__sig: "vi",
	godot_js_wrapper_object_unref: (pId: GodotJSWrapperProxyId): void => {
		const proxy = IDHandler.get(pId);
		proxy?.unreference();
	},

	godot_js_wrapper_create_cb__proxy: "sync",
	godot_js_wrapper_create_cb__sig: "ipp",
	godot_js_wrapper_create_cb: (
		pReferencePtr: CVoidPointer,
		pCallbackPtr: CFunctionPointer<GodotJSWrapperCreateCbCallback>,
	): CInt => {
		const cCallback = GodotRuntime.getFunction(pCallbackPtr);
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- We force the casting here.
		let id = 0 as GodotJSWrapperProxyId;
		const callback = (...args: unknown[]): unknown => {
			if (GodotJSWrapper.getProxiedValue(id) == null) {
				return undefined;
			}
			// The callback will store the returned value in this variable via
			// "godot_js_wrapper_object_set_cb_ret" upon calling the user function.
			// This is safe! JavaScript is single threaded (and using it in threads is not a good idea anyway).
			GodotJSWrapper.callbackReturnValue = null;
			const argsProxy = new GodotJSWrapper.GodotJSWrapperProxy(args);
			cCallback(pReferencePtr, argsProxy.getId() as CInt, GodotRuntime.asCInt(args.length));
			argsProxy.unreference();
			const returnValue = GodotJSWrapper.callbackReturnValue;
			GodotJSWrapper.callbackReturnValue = null;
			return returnValue;
		};
		id = GodotJSWrapper.getProxied(callback);
		return id as CInt;
	},

	godot_js_wrapper_object_set_cb_ret__proxy: "sync",
	godot_js_wrapper_object_set_cb_ret__sig: "vip",
	godot_js_wrapper_object_set_cb_ret: (pValueType: CInt, pValueExchangePtr: CVoidPointer): void => {
		// eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- It doesn't really return undefined.
		GodotJSWrapper.callbackReturnValue = GodotJSWrapper.variantToJS(pValueType, pValueExchangePtr);
	},

	godot_js_wrapper_object_getvar__proxy: "sync",
	godot_js_wrapper_object_getvar__sig: "iiip",
	godot_js_wrapper_object_getvar: (pId: GodotJSWrapperProxyId, pType: CInt, pExchangePtr: CVoidPointer): CInt => {
		const value = GodotJSWrapper.getProxiedValue(pId);
		if (value == null) {
			return GodotRuntime.asCInt(-1);
		}
		// eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- It doesn't really return undefined.
		const property = GodotJSWrapper.variantToJS(pType, pExchangePtr) as unknown;
		if (property == null) {
			return GodotRuntime.asCInt(-1);
		}
		try {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- We don't really know what it returns.
			return GodotJSWrapper.jsToVariant(value[property], pExchangePtr);
		} catch (error) {
			// eslint-disable-next-line @typescript-eslint/no-base-to-string, @typescript-eslint/restrict-template-expressions -- It's due to the `unknown` typing.
			GodotRuntime.error(`Error getting variable ${property} on object`, value, error);
			return GodotRuntime.asCInt(-1);
		}
	},

	godot_js_wrapper_object_setvar__proxy: "sync",
	godot_js_wrapper_object_setvar__sig: "iiipip",
	godot_js_wrapper_object_setvar: function (
		pId: GodotJSWrapperProxyId,
		pKeyType: CInt,
		pKeyExchangePtr: CVoidPointer,
		pValueType: CInt,
		pValueExchangePtr: CVoidPointer,
	): CInt {
		const value = GodotJSWrapper.getProxiedValue(pId);
		if (value == null) {
			return GodotRuntime.asCInt(-1);
		}
		// eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- It doesn't really return undefined.
		const key = GodotJSWrapper.variantToJS(pKeyType, pKeyExchangePtr);
		try {
			// eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- It doesn't really return undefined.
			value[key] = GodotJSWrapper.variantToJS(pValueType, pValueExchangePtr);
			return GodotRuntime.asCInt(0);
		} catch (_error) {
			GodotRuntime.error(`Error setting variable ${key} on object`, value);
			return GodotRuntime.asCInt(-1);
		}
	},

	godot_js_wrapper_create_object__proxy: "sync",
	godot_js_wrapper_create_object__sig: "ipiiiiii",
	godot_js_wrapper_create_object: (
		pMethodNamePtr: CCharPointer,
		pArgsPtr: CVoidArrayPointer,
		pArgc: CInt,
		pConvertCallbackPtr: CFunctionPointer<GodotJSWrapperVariant2JSCallback>,
		pExchangePtr: CVoidPointer,
		pLockPtr: CVoidArrayPointer,
		pFreeLockCallbackPtr: CFunctionPointer<GodotJSWrapperFreeLockCallback>,
	): CInt => {
		const methodName = GodotRuntime.parseString(pMethodNamePtr);
		// @ts-expect-error Accessing `globalThis` with a string.
		if (typeof globalThis[methodName] === "undefined") {
			return GodotRuntime.asCInt(-1);
		}
		const convertCallback = GodotRuntime.getFunction(pConvertCallbackPtr);
		const freeLockCallback = GodotRuntime.getFunction(pFreeLockCallbackPtr);
		const args = new Array<unknown>(pArgc).fill(null);
		for (let i = 0; i < pArgc; i++) {
			const type = convertCallback(pArgsPtr, GodotRuntime.asCInt(i), pExchangePtr, pLockPtr);
			const lockPtr = GodotRuntime.getHeapValue(pLockPtr, "*");
			// eslint-disable-next-line @typescript-eslint/no-confusing-void-expression -- It doesn't really return undefined.
			args[i] = GodotJSWrapper.variantToJS(type, pExchangePtr);
			if (lockPtr !== GodotRuntime.NULLPTR) {
				freeLockCallback(pLockPtr, type);
			}
		}
		try {
			// @ts-expect-error Accessing `globalThis` with a string.
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call -- Unsafe by design.
			const res = new globalThis[methodName](...args);
			// eslint-disable-next-line @typescript-eslint/no-unsafe-return -- We don't really know in advance the type it returns.
			return GodotJSWrapper.jsToVariant(res, pExchangePtr);
		} catch (error) {
			GodotRuntime.error(`Error calling constructor ${methodName} with args:`, args, "error:", error);
			return GodotRuntime.asCInt(-1);
		}
	},

	godot_js_wrapper_object_is_buffer__proxy: "sync",
	godot_js_wrapper_object_is_buffer__sig: "ii",
	godot_js_wrapper_object_is_buffer: (pId: GodotJSWrapperProxyId): CInt => {
		const value = GodotJSWrapper.getProxiedValue(pId);
		return GodotRuntime.asCIntBoolean(GodotJSWrapper.isBuffer(value));
	},

	godot_js_wrapper_object_transfer_buffer__proxy: "sync",
	godot_js_wrapper_object_transfer_buffer__sig: "iippp",
	godot_js_wrapper_object_transfer_buffer: (
		pId: GodotJSWrapperProxyId,
		pByteArrayPtr: CVoidPointer,
		pByteArrayWritePtr: CVoidPointer,
		pCallbackPtr: CFunctionPointer<GodotJSWrapperObjectTransferBufferCallback>,
	): CInt => {
		const value = GodotJSWrapper.getProxiedValue<ArrayBuffer | ArrayBufferView>(pId);
		if (!GodotJSWrapper.isBuffer(value)) {
			return GodotRuntime.asCInt(0);
		}

		// eslint-disable-next-line @typescript-eslint/init-declarations -- No need to init, it will be given the right value afterwards.
		let valueUint8Array;
		if (ArrayBuffer.isView(value) && !(value instanceof Uint8Array)) {
			valueUint8Array = new Uint8Array(value.buffer);
		} else if (value instanceof ArrayBuffer) {
			valueUint8Array = new Uint8Array(value);
		} else {
			GodotRuntime.error("`value` () is of unexpected type");
			return GodotRuntime.asCInt(0);
		}

		const resizePackedByteArrayAndOpenWrite = GodotRuntime.getFunction(pCallbackPtr);
		const bytesPtr = resizePackedByteArrayAndOpenWrite(
			pByteArrayPtr,
			pByteArrayWritePtr,
			GodotRuntime.asCInt(valueUint8Array.length),
		);
		HEAPU8.set(valueUint8Array, bytesPtr);

		return GodotRuntime.asCInt(0);
	},
};

autoAddDeps(_GodotJSWrapper, "$GodotJSWrapper");
addToLibrary(_GodotJSWrapper);
