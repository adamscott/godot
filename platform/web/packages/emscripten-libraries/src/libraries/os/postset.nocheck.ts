/**************************************************************************/
/*  postset.nocheck.ts                                                    */
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

// @ts-nocheck

export function $IDHandlerPostsetFnString() {
	"use macro";

	const fnString = function () {
		$IDHandler._references = new Map();
	}.toString();

	return `(${fnString})()`;
}

export function $GodotConfigPostsetFnString() {
	"use macro";

	const fnString = function () {
		Module["initConfig"] = GodotConfig.initialize;
	}.toString();

	return `(${fnString})()`;
}

export function $GodotFSPostsetFnString() {
	"use macro";

	const fnString = function () {
		Module["initFS"] = GodotFS.initialize;
		Module["copyToFS"] = GodotFS.copyToFS;
	}.toString();

	return `(${fnString})()`;
}

function $GodotOSPostsetFnString() {
	"use macro";

	const fnString = function () {
		Module["request_quit"] = function () {
			GodotOS.request_quit();
		};
		Module["onExit"] = GodotOS.cleanup;
		GodotOS._fs_sync_promise = Promise.resolve();
	}.toString();

	return `(${fnString})()`;
}

function $GodotEventListenersPostsetFnString() {
	"use macro";

	const fnString = function () {
		GodotOS.atExit(async () => {
			GodotEventListeners.clear();
		});
	}.toString();

	return `(${fnString})()`;
}

export const IDHandlerPostsetFnString = $IDHandlerPostsetFnString();
export const GodotConfigPostsetFnString = $GodotConfigPostsetFnString();
export const GodotFSPostsetFnString = $GodotFSPostsetFnString();
export const GodotOSPostsetFnString = $GodotOSPostsetFnString();
export const GodotEventListenersPostsetFnString = $GodotEventListenersPostsetFnString();
