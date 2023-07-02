#ifndef WEB_MESSAGE_SERVER_H
#define WEB_MESSAGE_SERVER_H

#include "core/object/ref_counted.h"

class WebMessageServer : public RefCounted {
	GDCLASS(WebMessageServer, RefCounted);

private:
	static int _next_server_id;

	int _server_id = 0;

	int _get_next_server_id() {
		int id = _next_server_id;
		_next_server_id++;
		return id;
	}

	static void _on_messaging_callback(const char *p_json);

public:
	Error install();
	void stop();

	WebMessageServer();
};

#endif
