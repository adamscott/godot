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
	 * @typedef {object} MessageProxySendOptions
	 * @property {string} [type]
	 * 
	 * Send data to the server
	 * @param {object} data
	 * @param {MessageProxySendOptions} [options]
	 */
	send(data, options = {}) {
		if (!this.ready) {
			return;
		}

		const { type = "data" } = options;

		GodotMessaging.send_data_to_server(this.serverTag, this.clientId, data, { type });
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
		GodotMessaging.send_data_to_server(proxy.serverTag, proxy.clientId, {}, { type: "register" });
	},

	/**
	 * 
	 * @param {MessageProxy} proxy 
	 */
	ready_proxy: function (proxy) {
		proxy.ready = true;
		proxy.dispatchEvent(new CustomEvent("ready"));
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

	/**
	 * @typedef {object} SendDataToServerOptions
	 * @property {string} [type]
	 *
	 * Sends data to the server
	 * @param {string} serverTag 
	 * @param {number} clientId 
	 * @param {any} data 
	 * @param {SendDataToServerOptions} [options] 
	 */
	send_data_to_server: function (serverTag, clientId, data, options = {}) {
		const { type = "data" } = options;

		if (!serverTag in GodotMessaging._servers) {
			throw new Error(`Cannot call server "${serverTag}", server not registered`);
		}

		const message = JSON.stringify({
			"server_tag": serverTag,
			"client_id": clientId,
			type,
			data
		});
		const jsonStr = GodotRuntime.allocString(message);
		GodotMessaging._callback(jsonStr);
		GodotRuntime.free(jsonStr);
	},

	/**
	 * @typedef {object} SendDataToClientOptions
	 * @property {string} [type]
	 * 
	 * Sends data to the client
	 * @param {string} serverTag 
	 * @param {number} clientId 
	 * @param {any} data 
	 * @param {SendDataToClientOptions} [options] 
	 */
	send_data_to_client: function (serverTag, clientId, data, options = {}) {
		const { type = "data" } = options;

		if (!serverTag in GodotMessaging._servers) {
			throw new Error(`Cannot send data from server "${serverTag}", server not registered`);
		}

		switch (type) {
			case "ready": {
				GodotMessaging._servers[serverTag].ready = true;

				if (GodotMessaging._proxies[serverTag] != null) {
					for (const proxy of GodotMessaging._proxies[serverTag]) {
						if (proxy.clientId === clientId) {
							GodotMessaging.ready_proxy(proxy);
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
							proxy.dispatchEvent(new CustomEvent("data", {
								detail: JSON.parse(data)
							}));
							break;
						}
					}
				}
			}
		}
 	}
};

/**
 * Messaging helper.
 */
const _GodotMessaging = {
	$GodotMessaging__deps: ['$GodotRuntime', '$GodotEventListeners'],
	$GodotMessaging__postset: 'Module["requestMessageProxy"] = GodotMessaging.request_message_proxy',
	$GodotMessaging: GodotMessaging,

	godot_js_messaging_cb__proxy: 'sync',
	godot_js_messaging_cb__sig: 'vii',
	godot_js_messaging_cb: function (p_callback, p_server_tag) {
		GodotMessaging.init(GodotRuntime.get_func(p_callback), GodotRuntime.parseString(p_server_tag));
	},

	godot_js_messaging_send_data_to_client__proxy: 'sync',
	godot_js_messaging_send_data_to_client__sig: 'viiii',
	godot_js_messaging_send_data_to_client: function (p_server_tag, p_client_id, p_type, p_json) {
		GodotMessaging.send_data_to_client(GodotRuntime.parseString(p_server_tag), p_client_id, GodotRuntime.parseString(p_json), { type: GodotRuntime.parseString(p_type) });
	},

	godot_js_messaging_stop__proxy: 'sync',
	godot_js_messaging_stop__sig: 'vi',
	godot_js_messaging_stop: function (p_server_tag) {
		GodotMessaging.stop(GodotRuntime.parseString(p_server_tag));
	}
}

autoAddDeps(_GodotMessaging, '$GodotMessaging');
mergeInto(LibraryManager.library, _GodotMessaging);
