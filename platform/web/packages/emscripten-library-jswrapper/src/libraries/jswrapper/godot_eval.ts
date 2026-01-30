/**************************************************************************/
/*  godot_eval.ts                                                         */
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
	CInt,
	CIntPointer,
	CVoidPointer,
} from "@godotengine/emscripten-utils/types";

type GodotJSEvalCallback = (pPtr: CVoidPointer, pPtr2: CVoidPointer, pLength: CInt) => CVoidPointer;

export const _GodotEval = {
	$GodotEval__deps: ["$GodotRuntime"] as const,
	$GodotEval: {},

	godot_js_eval__deps: ["$GodotRuntime"] as const,
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
			if (GodotRuntime.fromCTypeToBoolean(pUseGlobalContext)) {
				// Indirect eval call grants global execution context.
				// eslint-disable-next-line no-void, no-eval -- By design.
				evalReturnValue = (void 0, eval)(jsCode);
			} else {
				// eslint-disable-next-line no-eval -- By design.
				const evalAlt = eval;
				evalReturnValue = evalAlt(jsCode);
			}
		} catch (error) {
			GodotRuntime.error("Error while running `eval()`:", error);
		}

		switch (typeof evalReturnValue) {
			case "boolean":
				GodotRuntime.setHeapValue(
					GodotRuntime.asCType<CIntPointer>(pUnionPtr),
					GodotRuntime.asCIntBoolean(evalReturnValue),
					"i32",
				);
				return GodotRuntime.asCInt(1); // BOOL

			case "number":
				GodotRuntime.setHeapValue(
					GodotRuntime.asCType<CDoublePointer>(pUnionPtr),
					GodotRuntime.asCType<CDouble>(evalReturnValue),
					"double",
				);
				return GodotRuntime.asCInt(3); // FLOAT

			case "string":
				GodotRuntime.setHeapValue(pUnionPtr, GodotRuntime.allocString(evalReturnValue), "*");
				return GodotRuntime.asCInt(4); // STRING

			case "object":
				{
					if (evalReturnValue == null) {
						break;
					}

					// eslint-disable-next-line @typescript-eslint/init-declarations -- Value will be set accordingly.
					let evalReturnValueUint8Array: Uint8Array;
					if (ArrayBuffer.isView(evalReturnValue) && !(evalReturnValue instanceof Uint8Array)) {
						evalReturnValueUint8Array = new Uint8Array(evalReturnValue.buffer);
					} else if (evalReturnValue instanceof ArrayBuffer) {
						evalReturnValueUint8Array = new Uint8Array(evalReturnValue);
					} else {
						GodotRuntime.error("Unexpected `evalReturnValue` type");
						return GodotRuntime.asCInt(0); // NIL;
					}

					if (evalReturnValue instanceof Uint8Array) {
						const callback = GodotRuntime.getFunction(pCallbackPtr);
						const bytesPtr = callback(
							pByteArrayPtr,
							pByteArrayWritePtr,
							GodotRuntime.asCInt(evalReturnValueUint8Array.length),
						);
						HEAPU8.set(evalReturnValue, bytesPtr);
						return GodotRuntime.asCInt(29); // PACKED_BYTE_ARRAY
					}
				}
				break;

			// no default
		}
		return GodotRuntime.asCInt(0); // NIL
	},
};

autoAddDeps(_GodotEval, "$GodotEval");
addToLibrary(_GodotEval);
