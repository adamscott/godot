/**************************************************************************/
/*  index.ts                                                              */
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

import type { Constructor, PrimitiveMap } from "#/types/index.js";
import { PRIMITIVES } from "#/constants/index.js";

export function isNull(pTest: unknown): pTest is null {
	return pTest === null;
}

export function isUndefined(pTest: unknown): pTest is undefined {
	return pTest == null;
}

export function isNullish(pTest: unknown): pTest is null | undefined {
	return isNull(pTest) || isUndefined(pTest);
}

export function throwIfNullish<T>(pTest: unknown, pError: Error): asserts pTest is NonNullable<T> {
	if (isNullish(pTest)) {
		throw pError;
	}
}

export function isOfType<PrimitiveMapKey extends keyof PrimitiveMap>(
	pTest: unknown,
	pType: PrimitiveMapKey,
): pTest is PrimitiveMap[PrimitiveMapKey];
export function isOfType<T>(pTest: unknown, pType: Constructor<T>): pTest is T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Base overload function.
export function isOfType(pTest: any, pType: any): boolean {
	if (pType == null) {
		throw new TypeError(`\`pType\` is ${pType}.`);
	}
	if (typeof pType === "string") {
		return (PRIMITIVES as string[]).includes(pType);
	}

	return pTest instanceof pType;
}

export function throwIfIsNotOfType<PrimitiveMapKey extends keyof PrimitiveMap>(
	pTest: unknown,
	pType: PrimitiveMapKey,
	pError: Error,
): asserts pTest is PrimitiveMap[PrimitiveMapKey];
export function throwIfIsNotOfType<T>(pTest: unknown, pType: Constructor<T>, pError: Error): asserts pTest is T;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Base overload function.
export function throwIfIsNotOfType(pTest: any, pType: any, pError: Error): void {
	if (!isOfType(pTest, pType)) {
		throw pError;
	}
}
