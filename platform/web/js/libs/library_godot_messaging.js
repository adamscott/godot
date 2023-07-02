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

class MessageProxy extends EventTarget {
	/**
	 * Constructor
	 * @param {string} server_tag
	 * @param {number} client_id
	 */
	constructor(server_tag, client_id) {
		super();

		this.ready = false;
		this.server_tag = server_tag;
		this.client_id = client_id;
	}

	/**
	 * Send data to the server
	 * @param {object} data 
	 */
	send(data) {
		if (!this.ready) {
			return;
		}

		GodotMessaging.call(this.server_tag, this.client_id, data);
	}

	/**
	 * 
	 * @param {boolean} dispatch_event 
	 */
	_ready(dispatch_event) {
		this.ready = true;

		GodotMessaging.register(this.server_tag, this.client_id);

		if (dispatch_event) {
			this.dispatchEvent(new CustomEvent("ready", {}));
		}
	}
}

const GodotMessaging = {
	server_callbacks: {},
	
	_nextClientId: 0,

	/** @type {MessageProxy[]} */
	_proxies: [],

	_messageProxyClass: MessageProxy,

	/**
	 * 
	 * @param {string} server_tag
	 */
	request_message_proxy: function(server_tag) {
		const clientId = GodotMessaging._nextClientId;
		GodotMessaging._nextClientId += 1;

		/** @type {MessageProxy} */
		const proxy = new GodotMessaging._messageProxyClass(server_tag, clientId);
		GodotMessaging._proxies.push(proxy);

		if (GodotMessaging.server_callbacks[server_tag] != null) {
			proxy._ready(false);
		}

		return proxy;
	},

	/**
	 * 
	 * @param {Function} callback 
	 * @returns 
	 */
	init: function (callback, server_tag) {
		GodotMessaging.server_callbacks[server_tag] = callback;
		for (const proxy of GodotMessaging._proxies) {
			if (proxy.server_tag === server_tag) {
				proxy._ready(true);
			}
		}
		
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

	/**
	 * 
	 * @param {string} server_tag 
	 */
	stop: function (server_tag) {
		if (GodotMessaging.server_callbacks[server_tag] != null) {
			delete GodotMessaging.server_callbacks[server_tag];
		}
	},

	call: function (server_tag, client_id, data) {
		if (GodotMessaging.server_callbacks[server_tag] == null) {
			throw new Error(`Cannot call server "${server_tag}", server not registered`);
		}

		const message = JSON.stringify({
			type: "call",
			client_id,
			data
		});
		const json_str = GodotRuntime.allocString(message);
		GodotMessaging.server_callbacks[server_tag](json_str);
		GodotRuntime.free(json_str);
	},

	register: function (server_tag, client_id) {
		if (GodotMessaging.server_callbacks[server_tag] == null) {
			throw new Error(`Cannot call server "${server_tag}", server not registered`);
		}

		const message = JSON.stringify({
			type: "register",
			client_id
		});
		const server_tag_str = GodotRuntime.allocString(server_tag);
		const json_str = GodotRuntime.allocString(message);
		GodotMessaging.server_callbacks[server_tag](server_tag_str, json_str);
		GodotRuntime.free(server_tag_str);
		GodotRuntime.free(json_str);
	}
};

/**
 * Messaging helper.
 */
const _GodotMessaging = {
	$GodotMessaging__deps: ['$GodotRuntime', '$GodotEventListeners'],
	$GodotMessaging__postset: 'Module["requestMessageProxy"] = GodotMessaging.request_message_proxy',
	$GodotMessaging: GodotMessaging,

	godot_js_messaging_cb__sig: 'vii',
	godot_js_messaging_cb: function (p_callback, p_server_tag) {
		GodotMessaging.init(GodotRuntime.get_func(p_callback), UTF8ToString(p_server_tag));
	},

	godot_js_messaging_stop__sig: 'vi',
	godot_js_messaging_stop: function (p_server_tag) {
		GodotMessaging.stop(UTF8ToString(p_server_tag));
	}
}

autoAddDeps(_GodotMessaging, '$GodotMessaging');
mergeInto(LibraryManager.library, _GodotMessaging);
