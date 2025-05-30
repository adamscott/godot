/**************************************************************************/
/*  eval.ts                                                               */
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

import {
	CCharPointer,
	CFunctionPointer,
	CIDHandlerId,
	CInt,
	CInt64,
	CInt64Pointer,
	CPointer,
	CVoidArrayPointer,
	CVoidPointer,
} from "./emscripten.ts";

type GodotJSWrapperProxyId = CIDHandlerId<GodotJSWrapperProxy<unknown>>;

type GodotJSWrapperVariant2JSCallback = (
	pArgs: CVoidArrayPointer,
	pPosition: CInt,
	rValue: CVoidPointer,
	pLock: CVoidArrayPointer,
) => CInt;
type GodotJSWrapperFreeLockCallback = (
	pLock: CVoidArrayPointer,
	pType: CInt,
) => void;
type GodotJSWrapperCreateCbCallback = (
	pReference: CVoidPointer,
	pArgumentId: CInt,
	pArgumentCount: CInt,
) => void;
type GodotJSWrapperObjectTransferBufferCallback = (
	pPtr: CVoidPointer,
	pPtr2: CVoidPointer,
	pLength: CInt,
) => CVoidPointer;

type GodotJSEvalCallback = (
	pPtr: CVoidPointer,
	pPtr2: CVoidPointer,
	pLength: CInt,
) => CVoidPointer;

export type VariantToJS = <T extends number>(
	pType: T,
	pValuePtr: CPointer,
) => T extends 0 ? null
	: T extends 1 ? boolean
	: T extends 2 ? (number | bigint)
	: T extends 3 ? number
	: T extends 4 ? string
	: T extends 24 ? object | null
	: undefined;

export type JSToVariant = <T extends unknown>(
	pValue: T,
	pExchangePtr: CPointer,
) => T extends (undefined | null) ? 0
	: T extends boolean ? 1
	: T extends number ? 2 | 3
	: T extends bigint ? 2
	: T extends string ? 4
	: 24;

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

	reference() {
		this._references += 1;
	}

	unreference() {
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
	$GodotJSWrapper__deps: ["$GodotRuntime", "$IDHandler"],
	$GodotJSWrapper__postset: [
		"GodotJSWrapper.proxies = new Map();",
	].join(";"),
	$GodotJSWrapper: {
		proxies: null as unknown as Map<
			unknown,
			GodotJSWrapperProxyId
		>,
		callbackReturnValue: null as unknown,

		GodotJSWrapperProxy,

		getProxied: (pValue: object): GodotJSWrapperProxyId => {
			const id = GodotJSWrapper.proxies.get(pValue);
			if (id === undefined) {
				const proxy = new GodotJSWrapper.GodotJSWrapperProxy(pValue);
				return proxy.getId();
			}
			IDHandler.get(id)!.reference();
			return id;
		},

		getProxiedValue: <T>(pId: GodotJSWrapperProxyId): T | null => {
			const proxy = IDHandler.get(pId);
			if (proxy == null) {
				return null;
			}
			return proxy.getValue() as T;
		},

		variantToJS: ((pType, pValuePtr) => {
			switch (pType) {
				case 0:
					return null;
				case 1:
					return Boolean(GodotRuntime.getHeapValue(pValuePtr, "i64"));
				case 2: {
					// `heapValue` may be a bigint.
					const heapValue = GodotRuntime.getHeapValue(
						pValuePtr,
						"i64",
					);
					return heapValue >= Number.MIN_SAFE_INTEGER &&
						heapValue <= Number.MAX_SAFE_INTEGER
						? Number(heapValue)
						: heapValue;
				}
				case 3:
					return Number(
						GodotRuntime.getHeapValue(pValuePtr, "double"),
					);
				case 4:
					return GodotRuntime.parseString(
						GodotRuntime.getHeapValue(
							pValuePtr,
							"*",
						) as CCharPointer,
					);
				case 24: // OBJECT
					return GodotJSWrapper.getProxiedValue(
						GodotRuntime.getHeapValue(
							pValuePtr,
							"i64",
						) as GodotJSWrapperProxyId,
					);
				default:
					return undefined;
			}
		}) as VariantToJS,

		jsToVariant: (function (pValue, pExchangePtr) {
			if (pValue === undefined || pValue === null) {
				return 0; // NIL
			}
			if (typeof pValue === "boolean") {
				GodotRuntime.setHeapValue(pExchangePtr, Number(pValue), "i64");
				return 1; // BOOL
			} else if (typeof pValue === "number") {
				if (Number.isInteger(pValue)) {
					GodotRuntime.setHeapValue(pExchangePtr, pValue, "i64");
					return 2; // INT
				}
				GodotRuntime.setHeapValue(pExchangePtr, pValue, "double");
				return 3; // FLOAT
			} else if (typeof pValue === "bigint") {
				GodotRuntime.setHeapValue(
					pExchangePtr as CInt64Pointer,
					pValue as unknown as CInt64,
					"i64",
				);
				return 2; // INT
			} else if (typeof pValue === "string") {
				const valuePtr = GodotRuntime.allocString(pValue);
				GodotRuntime.setHeapValue(pExchangePtr, valuePtr, "*");
				return 4; // STRING
			}
			const id = GodotJSWrapper.getProxied(pValue);
			GodotRuntime.setHeapValue(pExchangePtr, id, "i64");
			return 24; // OBJECT
		}) as JSToVariant,

		isBuffer: (
			pObject: unknown,
		): pObject is ArrayBuffer | ArrayBufferView => {
			return pObject instanceof ArrayBuffer ||
				ArrayBuffer.isView(pObject);
		},
	},

	godot_js_wrapper_interface_get__proxy: "sync",
	godot_js_wrapper_interface_get__sig: "ip",
	godot_js_wrapper_interface_get: (pNamePtr: CCharPointer): CInt => {
		const name = GodotRuntime.parseString(pNamePtr);
		if (!(name in globalThis)) {
			return 0 as CInt;
		}
		// @ts-expect-error Accessing `globalThis` with a string.
		return GodotJSWrapper.getProxied(globalThis[name]) as CInt;
	},

	godot_js_wrapper_object_call__proxy: "sync",
	godot_js_wrapper_object_call__sig: "iippipppp",
	godot_js_wrapper_object_call: (
		pId: GodotJSWrapperProxyId,
		pMethodPtr: CCharPointer,
		pArgsPtr: CVoidArrayPointer,
		pArgc: CInt,
		pConvertCallbackPtr: CFunctionPointer<
			GodotJSWrapperVariant2JSCallback
		>,
		pConvertCallbackReturnValuePtr: CVoidPointer,
		pLockPtr: CVoidArrayPointer,
		pFreeLockCallbackPtr: CFunctionPointer<
			GodotJSWrapperFreeLockCallback
		>,
	): CInt => {
		const value = GodotJSWrapper.getProxiedValue(pId);
		if (value == null) {
			return -1 as CInt;
		}
		const method = GodotRuntime.parseString(pMethodPtr);
		const convertCallback = GodotRuntime.getFunction(pConvertCallbackPtr);
		const freeLockCallback = GodotRuntime.getFunction(pFreeLockCallbackPtr);
		const args = new Array<unknown>(pArgc).fill(null);
		for (let i = 0; i < pArgc; i++) {
			const convertedType = convertCallback(
				pArgsPtr,
				i as CInt,
				pConvertCallbackReturnValuePtr,
				pLockPtr,
			);
			const lockPtr = GodotRuntime.getHeapValue(
				pLockPtr,
				"*",
			) as CVoidPointer;
			args[i] = GodotJSWrapper.variantToJS(
				convertedType,
				pConvertCallbackReturnValuePtr,
			);
			if (lockPtr !== GodotRuntime.NULLPTR) {
				freeLockCallback(pLockPtr, convertedType);
			}
		}
		try {
			// @ts-expect-error We know it can fail.
			const res = value[method](...args);
			return GodotJSWrapper.jsToVariant(
				res,
				pConvertCallbackReturnValuePtr,
			);
		} catch (e) {
			GodotRuntime.error(
				`Error calling method ${method} on:`,
				value,
				"error:",
				e,
			);
			return -1 as CInt;
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
			return 0 as CInt;
		}

		if (pPropertyPtr === GodotRuntime.NULLPTR) {
			return GodotJSWrapper.jsToVariant(value, pExchangePtr) as CInt;
		}

		const property = GodotRuntime.parseString(pPropertyPtr);
		try {
			// @ts-expect-error We know it can fail.
			return GodotJSWrapper.jsToVariant(value[property], pExchangePtr);
		} catch (_error) {
			GodotRuntime.error(
				`Error getting variable ${property} on object`,
				value,
			);
			return 0 as CInt; // NIL
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
			// @ts-expect-error We know it can fail.
			value[name] = GodotJSWrapper.variantToJS(pType, pExchangePtr);
		} catch (_error) {
			GodotRuntime.error(
				`Error setting variable ${name} on object`,
				value,
			);
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
		let id = 0 as GodotJSWrapperProxyId;
		const callback = (...args: unknown[]) => {
			if (GodotJSWrapper.getProxiedValue(id) == null) {
				return undefined;
			}
			// The callback will store the returned value in this variable via
			// "godot_js_wrapper_object_set_cb_ret" upon calling the user function.
			// This is safe! JavaScript is single threaded (and using it in threads is not a good idea anyway).
			GodotJSWrapper.callbackReturnValue = null;
			const argsProxy = new GodotJSWrapper.GodotJSWrapperProxy(args);
			cCallback(
				pReferencePtr,
				argsProxy.getId() as CInt,
				args.length as CInt,
			);
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
	godot_js_wrapper_object_set_cb_ret: (
		pValueType: CInt,
		pValueExchangePtr: CVoidPointer,
	): void => {
		GodotJSWrapper.callbackReturnValue = GodotJSWrapper.variantToJS(
			pValueType,
			pValueExchangePtr,
		);
	},

	godot_js_wrapper_object_getvar__proxy: "sync",
	godot_js_wrapper_object_getvar__sig: "iiip",
	godot_js_wrapper_object_getvar: (
		pId: GodotJSWrapperProxyId,
		pType: CInt,
		pExchangePtr: CVoidPointer,
	): CInt => {
		const value = GodotJSWrapper.getProxiedValue(pId);
		if (value == null) {
			return -1 as CInt;
		}
		const property = GodotJSWrapper.variantToJS(pType, pExchangePtr);
		if (property == null) {
			return -1 as CInt;
		}
		try {
			return GodotJSWrapper.jsToVariant(value[property], pExchangePtr);
		} catch (error) {
			GodotRuntime.error(
				`Error getting variable ${property} on object`,
				value,
				error,
			);
			return -1 as CInt;
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
			return -1 as CInt;
		}
		const key = GodotJSWrapper.variantToJS(pKeyType, pKeyExchangePtr);
		try {
			// @ts-expect-error We know it can fail.
			value[key] = GodotJSWrapper.variantToJS(
				pValueType,
				pValueExchangePtr,
			);
			return 0 as CInt;
		} catch (_error) {
			GodotRuntime.error(
				`Error setting variable ${key} on object`,
				value,
			);
			return -1 as CInt;
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
		if (typeof (globalThis[methodName]) === "undefined") {
			return -1 as CInt;
		}
		const convertCallback = GodotRuntime.getFunction(pConvertCallbackPtr);
		const freeLockCallback = GodotRuntime.getFunction(pFreeLockCallbackPtr);
		const args = new Array<unknown>(pArgc).fill(null);
		for (let i = 0; i < pArgc; i++) {
			const type = convertCallback(
				pArgsPtr,
				i as CInt,
				pExchangePtr,
				pLockPtr,
			);
			const lockPtr = GodotRuntime.getHeapValue(pLockPtr, "*");
			args[i] = GodotJSWrapper.variantToJS(type, pExchangePtr);
			if (lockPtr !== GodotRuntime.NULLPTR) {
				freeLockCallback(pLockPtr, type);
			}
		}
		try {
			// @ts-expect-error Accessing `globalThis` with a string.
			const res = new globalThis[methodName](...args);
			return GodotJSWrapper.jsToVariant(res, pExchangePtr);
		} catch (error) {
			GodotRuntime.error(
				`Error calling constructor ${methodName} with args:`,
				args,
				"error:",
				error,
			);
			return -1 as CInt;
		}
	},

	godot_js_wrapper_object_is_buffer__proxy: "sync",
	godot_js_wrapper_object_is_buffer__sig: "ii",
	godot_js_wrapper_object_is_buffer: (pId: GodotJSWrapperProxyId): CInt => {
		const value = GodotJSWrapper.getProxiedValue(pId);
		return GodotRuntime.boolean(GodotJSWrapper.isBuffer(value));
	},

	godot_js_wrapper_object_transfer_buffer__proxy: "sync",
	godot_js_wrapper_object_transfer_buffer__sig: "iippp",
	godot_js_wrapper_object_transfer_buffer: (
		pId: GodotJSWrapperProxyId,
		pByteArrayPtr: CVoidPointer,
		pByteArrayWritePtr: CVoidPointer,
		pCallbackPtr: CFunctionPointer<
			GodotJSWrapperObjectTransferBufferCallback
		>,
	): CInt => {
		const value = GodotJSWrapper.getProxiedValue<
			ArrayBuffer | ArrayBufferView
		>(pId);
		if (!GodotJSWrapper.isBuffer(value)) {
			return 0 as CInt;
		}

		let valueUint8Array: Uint8Array;
		if (ArrayBuffer.isView(value) && !(value instanceof Uint8Array)) {
			valueUint8Array = new Uint8Array(value.buffer);
		} else if (value instanceof ArrayBuffer) {
			valueUint8Array = new Uint8Array(value);
		} else {
			GodotRuntime.error("`value` is of unexpected type");
			return 0 as CInt;
		}

		const resizePackedByteArrayAndOpenWrite = GodotRuntime.getFunction(
			pCallbackPtr,
		);
		const bytesPtr = resizePackedByteArrayAndOpenWrite(
			pByteArrayPtr,
			pByteArrayWritePtr,
			valueUint8Array.length as CInt,
		);
		HEAPU8.set(valueUint8Array, bytesPtr);

		return 0 as CInt;
	},
};
autoAddDeps(_GodotJSWrapper, "$GodotJSWrapper");
addToLibrary(_GodotJSWrapper);

const _GodotEval = {
	godot_js_eval__deps: ["$GodotRuntime"],
	godot_js_eval__sig: "ipipppp",
	godot_js_eval: (
		pJsCodePtr: CCharPointer,
		pUseGlobalContext: CInt,
		pUnionPtr: CVoidPointer,
		pByteArrayPtr: CVoidPointer,
		pByteArrayWritePtr: CVoidPointer,
		pCallbackPtr: CFunctionPointer<GodotJSEvalCallback>,
	): CInt => {
		const jsCode = GodotRuntime.parseString(pJsCodePtr);
		let evalReturnValue = null as unknown;
		try {
			// https://esbuild.github.io/content-types/#direct-eval
			if (pUseGlobalContext) {
				// Indirect eval call grants global execution context.
				evalReturnValue = (void 0, eval)(jsCode);
			} else {
				evalReturnValue = eval(jsCode);
			}
		} catch (error) {
			GodotRuntime.error("Error while running `eval()`:", error);
		}

		switch (typeof evalReturnValue) {
			case "boolean":
				GodotRuntime.setHeapValue(
					pUnionPtr,
					Number(evalReturnValue),
					"i32",
				);
				return 1 as CInt; // BOOL

			case "number":
				GodotRuntime.setHeapValue(pUnionPtr, evalReturnValue, "double");
				return 3 as CInt; // FLOAT

			case "string":
				GodotRuntime.setHeapValue(
					pUnionPtr,
					GodotRuntime.allocString(evalReturnValue),
					"*",
				);
				return 4 as CInt; // STRING

			case "object":
				if (evalReturnValue == null) {
					break;
				}

				let evalReturnValueUint8Array: Uint8Array;
				if (
					ArrayBuffer.isView(evalReturnValue) &&
					!(evalReturnValue instanceof Uint8Array)
				) {
					evalReturnValueUint8Array = new Uint8Array(
						evalReturnValue.buffer,
					);
				} else if (evalReturnValue instanceof ArrayBuffer) {
					evalReturnValueUint8Array = new Uint8Array(evalReturnValue);
				} else {
					GodotRuntime.error("Unexpected `evalReturnValue` type");
					return 0 as CInt;
				}

				if (evalReturnValue instanceof Uint8Array) {
					const callback = GodotRuntime.getFunction(pCallbackPtr);
					const bytes_ptr = callback(
						pByteArrayPtr,
						pByteArrayWritePtr,
						evalReturnValueUint8Array.length as CInt,
					);
					HEAPU8.set(evalReturnValue, bytes_ptr);
					return 29 as CInt; // PACKED_BYTE_ARRAY
				}
				break;

			// no default
		}
		return 0 as CInt; // NIL
	},
};
addToLibrary(_GodotEval);
