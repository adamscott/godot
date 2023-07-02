#include "core/io/web_message_server.h"
#include "core/error/error_list.h"
#include "core/io/json.h"
#include "core/variant/dictionary.h"
#include "godot_js.h"

void WebMessageServer::_on_messaging_callback(const char *p_server_tag, const char *p_json) {
	Dictionary dict = JSON::parse_string(p_json);

	String type = dict["type"];
	if (type == "register") {
		SelfList<WebMessageServer> *s = WebMessageServerManager::get_singleton()->_server_list.first();
		while (s) {
			WebMessageServer *server = s->self();
			if (server->_server_tag == String(p_server_tag)) {
				int client_id = dict["client_id"];
				server->_available_clients.append(client_id);
			}

			s = s->next();
		}
	}
}

void WebMessageServer::on_callback(Dictionary p_data) {
	print_line(vformat("(%s) callback: %s", _server_tag, p_data));
}

bool WebMessageServer::is_connection_available() {
	return _available_clients.size() > 0;
}

Error WebMessageServer::install() {
	godot_js_messaging_cb(&WebMessageServer::_on_messaging_callback, _server_tag.utf8().get_data());
	return OK;
}

void WebMessageServer::stop() {
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
