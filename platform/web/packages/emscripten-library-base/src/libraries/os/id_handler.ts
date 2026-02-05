/**************************************************************************/
/*  id_handler.ts                                                         */
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

import type { CIDHandlerId, CIDHandlerIdExtract } from "@godotengine/emscripten-utils/types";
import { asCIDHandlerId as $asCIDHandlerId } from "@godotengine/emscripten-utils/types" with { type: "macro" };
import { convertFunctionToIifeString as $convertFunctionToIifeString } from "@godotengine/utils/macros" with { type: "macro" };

export const _IDHandler = {
	$IDHandler__deps: ["$GodotRuntime"] as const,
	$IDHandler__postset: $convertFunctionToIifeString(() => {
		IDHandler._references = new Map();
	}),
	$IDHandler: {
		_lastId: $asCIDHandlerId<unknown>(0),
		// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- We init `_references` in postset.
		_references: null as unknown as Map<number, unknown>,

		get: <T extends CIDHandlerId<unknown>>(pId: T): CIDHandlerIdExtract<T> | null => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- We don't keep track of types.
			return IDHandler._references.get(pId) as CIDHandlerIdExtract<T> | null;
		},

		add: <T>(pData: T): CIDHandlerId<T> => {
			const id = GodotRuntime.asCIDHandlerId<T>(IDHandler._lastId + 1);
			IDHandler._references.set(id, pData);
			IDHandler._lastId = id;
			return id;
		},

		remove: (pId: CIDHandlerId<unknown>): void => {
			IDHandler._references.delete(pId);
		},
	},
};

autoAddDeps(_IDHandler, "$IDHandler");
addToLibrary(_IDHandler);
