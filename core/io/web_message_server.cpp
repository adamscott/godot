#include "core/io/web_message_server.h"
#include "core/error/error_list.h"
#include "core/error/error_macros.h"
#include "core/io/json.h"
#include "core/io/web_message_peer.h"
#include "core/variant/dictionary.h"
#include "godot_js.h"

void WebMessageServer::_on_messaging_callback(const char *p_json) {
	Dictionary dict = JSON::parse_string(p_json);

	String server_tag = dict["server_tag"];
	int client_id = dict["client_id"];
	String type = dict["type"];
	if (type == "register") {
		SelfList<WebMessageServer> *s = WebMessageServerManager::get_singleton()->_server_list.first();
		while (s) {
			WebMessageServer *server = s->self();
			if (server->_server_tag == String(server_tag)) {
				server->_available_clients.append(client_id);

				break;
			}

			s = s->next();
		}
		return;
	}

	if (type == "data") {
		SelfList<WebMessageServer> *s = WebMessageServerManager::get_singleton()->_server_list.first();
		while (s) {
			WebMessageServer *server = s->self();
			if (server->_server_tag == String(server_tag)) {
				for (Ref<WebMessagePeer> peer : server->_peers) {
					if (peer->get_client_id() == client_id) {
						peer->handle(dict["data"]);

						break;
					}
				}

				break;
			}

			s = s->next();
		}
		return;
	}
}

void WebMessageServer::on_callback(Dictionary p_data) {
	print_line(vformat("(%s) callback: %s", _server_tag, p_data));
}

Error WebMessageServer::install() {
	godot_js_messaging_cb(&WebMessageServer::_on_messaging_callback, _server_tag.utf8().get_data());
	return OK;
}

void WebMessageServer::stop() {
	for (Ref<WebMessagePeer> peer : _peers) {
		peer->close();
	}
}

bool WebMessageServer::is_connection_available() {
	return _available_clients.size() > 0;
}

Ref<WebMessagePeer> WebMessageServer::take_connection() {
	Ref<WebMessagePeer> peer;
	if (!is_connection_available()) {
		return peer;
	}

	print_line(vformat("WebMessageServer::take_connection()"));

	int available_client = _available_clients.get(0);
	_available_clients.remove_at(0);
	peer->client_id = available_client;
	peer->server = Ref<WebMessageServer>(this);

	_peers.append(peer);

	send(available_client, "ready", Dictionary());

	return peer;
}

void WebMessageServer::send(const int p_client_id, const String p_type, Variant p_data) {
	String json = JSON::stringify(p_data);
	godot_js_messaging_send_data_to_client(_server_tag.utf8().get_data(), p_client_id, p_type.utf8().get_data(), json.utf8().get_data());
}

void WebMessageServer::set_server_tag(const String p_server_tag) {
	ERR_FAIL_COND_MSG(_server_tag != "", "Cannot change WebMessageServer tag once it's set");
	_server_tag = p_server_tag;
}

WebMessageServer::WebMessageServer() :
		_server_list(this) {
	{
		MutexLock lock(WebMessageServerManager::get_singleton()->mutex);
		WebMessageServerManager::get_singleton()->_server_list.add(&_server_list);
	}
}

WebMessageServer::~WebMessageServer() {
	{
		MutexLock lock(WebMessageServerManager::get_singleton()->mutex);
		_server_list.remove_from_list();
	}
}

int WebMessageServer::_next_server_id = 0;

// WebMessageServerManager

WebMessageServerManager::WebMessageServerManager() {
	_singleton = this;
}

WebMessageServerManager::~WebMessageServerManager() {
	_singleton = nullptr;
}

WebMessageServerManager *WebMessageServerManager::_singleton = nullptr;
