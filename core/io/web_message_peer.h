#ifndef WEB_MESSAGE_PEER_H
#define WEB_MESSAGE_PEER_H

#include "core/object/ref_counted.h"

class WebMessageServer;

class WebMessagePeer : public RefCounted {
	GDCLASS(WebMessagePeer, RefCounted);

	friend class WebMessageServer;

protected:
	int client_id = 0;
	Ref<WebMessageServer> server;
	Vector<Variant> data;

public:
	int get_client_id() { return client_id; }

	bool has_data() { return !data.is_empty(); }
	Variant get_data();

	void handle(Variant p_data);

	void send(Variant p_data, const String p_type = "data");
	void close();

	WebMessagePeer();
	~WebMessagePeer();
};

#endif
