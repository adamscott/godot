/**************************************************************************/
/*  microphone_server.cpp                                                 */
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

#include "microphone_server.h"

#include "core/variant/typed_array.h"
#include "servers/microphone/microphone_feed.h"
#include "servers/microphone/microphone_server_dummy.h"

MicrophoneServer *MicrophoneServer::singleton = nullptr;
MicrophoneServer::MicrophoneServerCreate MicrophoneServer::server_create_functions[MicrophoneServer::MAX_SERVERS] = {
	{ "dummy", &MicrophoneServerDummy::create_function }
};
int MicrophoneServer::server_create_count = 1;

int MicrophoneServer::get_free_id() {
	bool id_exists = true;
	int newid = 0;

	// find a free id
	while (id_exists) {
		newid++;
		id_exists = false;
		for (int i = 0; i < feeds.size() && !id_exists; i++) {
			if (feeds[i]->get_id() == newid) {
				id_exists = true;
			};
		};
	};

	return newid;
}

int MicrophoneServer::get_feed_index(int p_id) {
	ERR_FAIL_COND_V_MSG(!monitoring_feeds, -1, "MicrophoneServer is not actively monitoring feeds; call set_monitoring_feeds(true) first.");

	for (int i = 0; i < feeds.size(); i++) {
		if (feeds[i]->get_id() == p_id) {
			return i;
		};
	};

	return -1;
}

Ref<MicrophoneFeed> MicrophoneServer::get_feed_by_id(int p_id) {
	ERR_FAIL_COND_V_MSG(!monitoring_feeds, nullptr, "MicrophoneServer is not actively monitoring feeds; call set_monitoring_feeds(true) first.");

	int index = get_feed_index(p_id);

	if (index == -1) {
		return nullptr;
	} else {
		return feeds[index];
	}
}

void MicrophoneServer::add_feed(const Ref<MicrophoneFeed> &p_feed) {
	ERR_FAIL_COND(p_feed.is_null());

	// add our feed
	feeds.push_back(p_feed);

	print_verbose("MicrophoneServer: Registered camera " + p_feed->get_name() + " with ID " + itos(p_feed->get_id()) + " at index " + itos(feeds.size() - 1));

	// let whomever is interested know
	emit_signal(SNAME("feed_added"), p_feed->get_id());
}

void MicrophoneServer::remove_feed(const Ref<MicrophoneFeed> &p_feed) {
	for (int i = 0; i < feeds.size(); i++) {
		if (feeds[i] == p_feed) {
			int feed_id = p_feed->get_id();

			print_verbose("MicrophoneServer: Removed camera " + p_feed->get_name() + " with ID " + itos(feed_id));

			// remove it from our array, if this results in our feed being unreferenced it will be destroyed
			feeds.remove_at(i);

			// let whomever is interested know
			emit_signal(SNAME("feed_removed"), feed_id);
			return;
		};
	};
}

Ref<MicrophoneFeed> MicrophoneServer::get_feed(int p_index) {
	ERR_FAIL_COND_V_MSG(!monitoring_feeds, nullptr, "MicrophoneServer is not actively monitoring feeds; call set_monitoring_feeds(true) first.");
	ERR_FAIL_INDEX_V(p_index, feeds.size(), nullptr);

	return feeds[p_index];
}

int MicrophoneServer::get_feed_count() {
	ERR_FAIL_COND_V_MSG(!monitoring_feeds, 0, "MicrophoneServer is not actively monitoring feeds; call set_monitoring_feeds(true) first.");
	return feeds.size();
}

TypedArray<MicrophoneFeed> MicrophoneServer::get_feeds() {
	ERR_FAIL_COND_V_MSG(!monitoring_feeds, {}, "MicrophoneServer is not actively monitoring feeds; call set_monitoring_feeds(true) first.");
	TypedArray<MicrophoneFeed> return_feeds;
	int cc = get_feed_count();
	return_feeds.resize(cc);

	for (int i = 0; i < feeds.size(); i++) {
		return_feeds[i] = get_feed(i);
	};

	return return_feeds;
}

void MicrophoneServer::register_create_function(const char *p_name, CreateFunction p_function) {
	ERR_FAIL_COND(server_create_count == MAX_SERVERS);
	// Dummy display server is always last
	server_create_functions[server_create_count] = server_create_functions[server_create_count - 1];
	server_create_functions[server_create_count - 1].name = p_name;
	server_create_functions[server_create_count - 1].create_function = p_function;
	server_create_count += 1;
}

int MicrophoneServer::get_create_function_count() {
	return server_create_count;
}

const char *MicrophoneServer::get_create_function_name(int p_index) {
	ERR_FAIL_INDEX_V(p_index, server_create_count, nullptr);
	return server_create_functions[p_index].name;
}

MicrophoneServer *MicrophoneServer::create(int p_index) {
	ERR_FAIL_INDEX_V(p_index, server_create_count, nullptr);
	return server_create_functions[p_index].create_function();
}

MicrophoneServer::MicrophoneServer() {
	singleton = this;
}

MicrophoneServer::~MicrophoneServer() {
	singleton = nullptr;
}

void MicrophoneServer::_bind_methods() {
	ClassDB::bind_method(D_METHOD("set_monitoring_feeds", "is_monitoring_feeds"), &MicrophoneServer::set_monitoring_feeds);
	ClassDB::bind_method(D_METHOD("is_monitoring_feeds"), &MicrophoneServer::is_monitoring_feeds);
	ADD_PROPERTY(PropertyInfo(Variant::BOOL, "monitoring_feeds"), "set_monitoring_feeds", "is_monitoring_feeds");
	ADD_PROPERTY_DEFAULT("monitoring_feeds", false);

	ClassDB::bind_method(D_METHOD("get_feed", "index"), &MicrophoneServer::get_feed);
	ClassDB::bind_method(D_METHOD("get_feed_count"), &MicrophoneServer::get_feed_count);
	ClassDB::bind_method(D_METHOD("feeds"), &MicrophoneServer::get_feeds);

	ClassDB::bind_method(D_METHOD("add_feed", "feed"), &MicrophoneServer::add_feed);
	ClassDB::bind_method(D_METHOD("remove_feed", "feed"), &MicrophoneServer::remove_feed);

	ADD_SIGNAL(MethodInfo(SNAME("feed_added"), PropertyInfo(Variant::INT, "id")));
	ADD_SIGNAL(MethodInfo(SNAME("feed_removed"), PropertyInfo(Variant::INT, "id")));
	ADD_SIGNAL(MethodInfo(SNAME("feeds_updated")));
}
