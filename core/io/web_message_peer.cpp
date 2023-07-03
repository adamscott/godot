#include "core/io/web_message_peer.h"
#include "core/io/web_message_server.h"

void WebMessagePeer::handle(Variant p_data) {
	data.append(p_data);
}

Variant WebMessagePeer::get_data() {
	if (!has_data()) {
		return Variant();
	}

	Variant data_to_return = data.get(0);
	print_line(vformat("get_data called: %s", data_to_return));

	data.remove_at(0);
	return data_to_return;
}

void WebMessagePeer::send(Variant p_data, const String p_type) {
	server->send(client_id, p_type, p_data);
}

void WebMessagePeer::close() {
}

WebMessagePeer::WebMessagePeer() {}
WebMessagePeer::~WebMessagePeer() {}
