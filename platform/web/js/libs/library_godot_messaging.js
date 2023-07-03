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
	 * @param {string} serverTag
	 * @param {number} clientId
	 */
	constructor(serverTag, clientId) {
		super();

		this.ready = false;
		this.serverTag = serverTag;
		this.clientId = clientId;
	}

	/**
	 * Send data to the server
	 * @param {object} data 
	 */
	send(data) {
		if (!this.ready) {
			return;
		}

		GodotMessaging.send_data_to_server(this.serverTag, this.clientId, data);
	}
}

const GodotMessaging = {
	_servers: {},
	_callback: null,
	
	_nextClientId: 0,

	/** @type {MessageProxy[]} */
	_proxies: {},

	_messageProxyClass: MessageProxy,

	/**
	 * @param {MessageProxy} proxy 
	 */
	register_proxy: function (proxy) {
		GodotMessaging.send_register_request_to_server(proxy.serverTag, proxy.clientId);
	},

	/**
	 * 
	 * @param {string} serverTag
	 */
	request_message_proxy: function(serverTag) {
		const clientId = GodotMessaging._nextClientId;
		GodotMessaging._nextClientId += 1;

		/** @type {MessageProxy} */
		const proxy = new GodotMessaging._messageProxyClass(serverTag, clientId);
		
		if (GodotMessaging._proxies[serverTag] == null) {
			GodotMessaging._proxies[serverTag] = [proxy]
		} else {
			GodotMessaging._proxies[serverTag].push(proxy);
		}

		if (serverTag in GodotMessaging._servers) {
			GodotMessaging.register_proxy(proxy, { dispatchEvent: false });
		}

		return proxy;
	},

	/**
	 * 
	 * @param {Function} callback 
	 * @returns 
	 */
	init: function (callback, serverTag) {
		GodotMessaging._servers[serverTag] = true;
		if (GodotMessaging._callback == null) {
			// The callback is the same for each server instance
			GodotMessaging._callback = callback;
		}

		if (GodotMessaging._proxies[serverTag] != null) {
			for (const proxy of GodotMessaging._proxies[serverTag]) {
				GodotMessaging.register_proxy(proxy);
			}
		}
	},

	/**
	 * 
	 * @param {string} serverTag 
	 */
	stop: function (serverTag) {
		if (serverTag in GodotMessaging._servers) {
			if (GodotMessaging._proxies[serverTag] != null) {
				for (const proxy of GodotMessaging._proxies[serverTag]) {
					proxy.dispatchEvent(new CustomEvent("stop"));
				}
				delete GodotMessaging._proxies[serverTag];
			}
			GodotMessaging._servers = GodotMessaging._servers.filter((server) => server !== serverTag);
		}
	},

	send_data_to_server: function (serverTag, clientId, type = "data", data) {
		if (!serverTag in GodotMessaging._servers) {
			throw new Error(`Cannot call server "${serverTag}", server not registered`);
		}

		const message = JSON.stringify({
			serverTag,
			clientId,
			type,
			data
		});
		const jsonStr = GodotRuntime.allocString(message);
		GodotMessaging._callback(jsonStr);
		GodotRuntime.free(jsonStr);
	},

	send_data_to_client: function (serverTag, clientId, type = "data", data) {
		if (!serverTag in GodotMessaging._servers) {
			throw new Error(`Cannot send data from server "${serverTag}", server not registered`);
		}

		switch (type) {
			case "ready": {
				GodotMessaging._servers[serverTag].ready = true;

				if (GodotMessaging._proxies[serverTag] != null) {
					for (const proxy of GodotMessaging._proxies[serverTag]) {
						if (proxy.clientId === clientId) {
							proxy.dispatchEvent(new CustomEvent("ready"));
							break;
						}
					}
				}
			} break;

			case "data":
			default: {
				if (GodotMessaging._proxies[serverTag] != null) {
					for (const proxy of GodotMessaging._proxies[serverTag]) {
						if (proxy.clientId === clientId) {
							proxy.dispatchEvent(new CustomEvent("message", data));
							break;
						}
					}
				}
			}
		}
 	},

	send_register_request_to_server: function (serverTag, clientId) {
		if (!serverTag in GodotMessaging._servers) {
			throw new Error(`Cannot call server "${serverTag}", server not registered`);
		}

		const message = JSON.stringify({
			type: "register",
			client_id: clientId
		});
		const serverTagStr = GodotRuntime.allocString(serverTag);
		const jsonStr = GodotRuntime.allocString(message);
		GodotMessaging._callback(serverTagStr, jsonStr);
		GodotRuntime.free(serverTagStr);
		GodotRuntime.free(jsonStr);
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

	godot_js_messaging_send_data_to_client__sig: 'viiii',
	godot_js_messaging_send_data_to_client: function (p_server_tag, p_client_id, p_type, p_json) {
		GodotMessaging.send_data_to_client(UTF8ToString(p_server_tag), p_client_id, UTF8ToString(p_type), UTF8ToString(p_json));
	},

	godot_js_messaging_stop__sig: 'vi',
	godot_js_messaging_stop: function (p_server_tag) {
		GodotMessaging.stop(UTF8ToString(p_server_tag));
	}
}

autoAddDeps(_GodotMessaging, '$GodotMessaging');
mergeInto(LibraryManager.library, _GodotMessaging);
