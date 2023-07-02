#include "core/io/web_message_server.h"
#include "core/error/error_list.h"
#include "godot_js.h"

void WebMessageServer::_on_messaging_callback(const char *p_json) {
	print_line(vformat("%s", p_json));
}

Error WebMessageServer::install() {
	godot_js_messaging_cb(&WebMessageServer::_on_messaging_callback);
	return OK;
}

void WebMessageServer::stop() {
}

WebMessageServer::WebMessageServer() {
	_server_id = _get_next_server_id();
}

int WebMessageServer::_next_server_id = 0;
