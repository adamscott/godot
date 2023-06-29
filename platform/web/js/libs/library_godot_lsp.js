/**************************************************************************/
/*  library_godot_lsp.js                                                  */
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

/*
 * LSP helper.
 */
const GodotLSP = {
	$GodotLSP__deps: ['$GodotRuntime', '$GodotEventListeners'],
	$GodotLSP: {
		initialized: false,
		callbacks: {},

		init: function (cb, project_path) {
			GodotLSP.callbacks[project_path] = cb;
			if (GodotLSP.initialized) {
				return;
			}
			GodotLSP.initialized = true;
			
			const message_callback = function (evt) {
				console.log("received message", evt, `(keys: ${Object.keys(GodotLSP.callbacks)})`);
				if (evt.origin !== window.location.origin || evt.data == null) {
					console.log(`evt.origin (${evt.origin}) !== window.location.origin (${window.location.origin}) || evt.data == null`);
					return;
				}

				const { type, jsonrpc, project_path } = evt.data || {};

				if (type !== "godot_lsp" || typeof jsonrpc !== "string" || typeof project_path !== "string") {
					console.log(`type (${type}) !== "godot_lsp" || jsonrpc/project_path !== "string"`);
					return;
				}

				if (GodotLSP.callbacks[project_path] == null) {
					console.log(`callback is null for "${project_path}"`);
					return;
				}

				const jsonrpc_str = GodotRuntime.allocString(jsonrpc); // This is important, because you can't pass JS strings directly into C++ code
				GodotLSP.callbacks[project_path](jsonrpc_str);
				GodotRuntime.free(jsonrpc_str); // This is important to avoid memory leaks after the allocated string has been used by the C++ code
			};

			GodotEventListeners.add(window, 'message', message_callback, false);
		},
	},

	godot_js_lsp_cb__sig: 'vi',
	godot_js_lsp_cb: function (p_callback, p_project_path) {
		GodotLSP.init(GodotRuntime.get_func(p_callback), UTF8ToString(p_project_path));
	},
}
autoAddDeps(GodotLSP, '$GodotLSP');
mergeInto(LibraryManager.library, GodotLSP);
