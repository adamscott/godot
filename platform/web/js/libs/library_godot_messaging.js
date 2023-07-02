/**************************************************************************/
/*  library_godot_messaging.js                                            */
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

/**
 * Messaging helper.
 * 
 * @typedef {typeof GodotMessaging} GodotMessagingRoot
 * @typedef {GodotMessagingRoot.$GodotMessaging} $GodotMessaging
 * @typedef {$GodotMessaging._messageProxyClass} MessageProxy
 */
const GodotMessaging = {
	$GodotMessaging__deps: ['$GodotRuntime', '$GodotEventListeners'],
	// $GodotMessaging__postset: 'Module["requestMessageProxy"] = GodotMessaging.request_message_proxy',
	$GodotMessaging: {
		initialized: false,
		callbacks: {},
		
		_nextClientId: 0,

		/** @type {MessageProxy[]} */
		_proxies: [],

		_messageProxyClass: class MessageProxy extends EventTarget {
			/**
			 * Constructor
			 * @param {string} serverId
			 * @param {number} clientId
			 */
			constructor(serverId, clientId) {
				this.serverId = serverId;
			}
		},

		/**
		 * 
		 * @param {string} serverId
		 * @returns {MessageProxy} 
		 */
		request_message_proxy: function(serverId) {
			const clientId = GodotMessaging._nextClientId;
			GodotMessaging._nextClientId += 1;

			const proxy = new GodotMessaging._messageProxyClass(serverId, clientId);
			GodotMessaging._proxies.push(proxy);

			return proxy;
		},

		/**
		 * 
		 * @param {Function} callback 
		 * @returns 
		 */
		init: function (callback) {
			if (GodotMessaging.initialized) {
				return;
			}
			GodotMessaging.initialized = true;
			
			// const message_callback = function (evt) {
			// 	console.log("received message", evt, `(keys: ${Object.keys(GodotMessaging.callbacks)})`);
			// 	if (evt.origin !== window.location.origin || evt.data == null) {
			// 		console.log(`evt.origin (${evt.origin}) !== window.location.origin (${window.location.origin}) || evt.data == null`);
			// 		return;
			// 	}

			// 	const { type, jsonrpc, project_path } = evt.data || {};

			// 	if (type !== "godot_lsp" || typeof jsonrpc !== "string" || typeof project_path !== "string") {
			// 		console.log(`type (${type}) !== "godot_messaging" || jsonrpc/project_path !== "string"`);
			// 		return;
			// 	}

			// 	if (GodotMessaging.callbacks[project_path] == null) {
			// 		console.log(`callback is null for "${project_path}"`);
			// 		return;
			// 	}

			// 	const jsonrpc_str = GodotRuntime.allocString(jsonrpc); // This is important, because you can't pass JS strings directly into C++ code
			// 	GodotMessaging.callbacks[project_path](jsonrpc_str);
			// 	GodotRuntime.free(jsonrpc_str); // This is important to avoid memory leaks after the allocated string has been used by the C++ code
			// };

			// GodotEventListeners.add(window, 'message', message_callback, false);
		},
	},

	godot_js_messaging_cb__sig: 'vi',
	godot_js_messaging_cb: function (p_callback) {
		GodotMessaging.init(GodotRuntime.get_func(p_callback));
	},

	// godot_js_messaging_stop__sig: 'vi',
	// godot_js_messaging_stop: function (p_project_path) {
	// 	if (GodotMessaging.callbacks[UTF8ToString(p_project_path)] != null) {
	// 		delete GodotMessaging.callbacks[UTF8ToString(p_project_path)];
	// 	}
	// },

	// godot_js_messaging_post__sig: 'vii',
	// godot_js_messaging_post: function (p_project_path, p_client_id, p_jsonrpc) {
	// 	const message = {
	// 		type: "godot_messaging_editor",
	// 		project_path: UTF8ToString(p_project_path),
	// 		client_id: UTF8ToString(p_client_id),
	// 		jsonrpc: UTF8ToString(p_jsonrpc)
	// 	};
	// 	window.postMessage(message, window.location.origin);
	// }
}

autoAddDeps(GodotMessaging, '$GodotMessaging');
mergeInto(LibraryManager.library, GodotMessaging);
