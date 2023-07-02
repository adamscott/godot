#ifndef WEB_MESSAGE_SERVER_H
#define WEB_MESSAGE_SERVER_H

#include "core/object/ref_counted.h"
#include "core/templates/self_list.h"

class WebMessageServer : public RefCounted {
	GDCLASS(WebMessageServer, RefCounted);

private:
	static int _next_server_id;

	int _server_id = 0;
	String _server_tag;
	SelfList<WebMessageServer> _server_list;

	Vector<int> _available_clients;

	int _get_next_server_id() {
		int id = _next_server_id;
		_next_server_id++;
		return id;
	}

	static void _on_messaging_callback(const char *p_server_tag, const char *p_json);

	Error on_client_connected();
	void on_callback(Dictionary p_data);

public:
	Error install();
	void stop();

	bool is_connection_available();

	void set_server_tag(const String p_server_tag) { _server_tag = p_server_tag; }
	String get_server_tag() { return _server_tag; }

	WebMessageServer();
	~WebMessageServer();
};

class WebMessageServerManager : public RefCounted {
private:
	friend class WebMessageServer;

	static WebMessageServerManager *_singleton;
	Mutex mutex;

	SelfList<WebMessageServer>::List _server_list;

public:
	static WebMessageServerManager *get_singleton() { return _singleton; }

	WebMessageServerManager();
	~WebMessageServerManager();
};
#endif
