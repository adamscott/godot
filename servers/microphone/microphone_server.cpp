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

#include "core/object/object.h"
#include "core/variant/typed_array.h"
#include "servers/microphone/microphone_driver.h"
#include "servers/microphone/microphone_feed.h"

MicrophoneServer *MicrophoneServer::singleton = nullptr;

void MicrophoneServer::set_monitoring_feeds(bool p_monitoring_feeds) {
	MicrophoneDriver::get_singleton()->set_monitoring_feeds(p_monitoring_feeds);
}

bool MicrophoneServer::is_monitoring_feeds() const {
	return MicrophoneDriver::get_singleton()->is_monitoring_feeds();
}

int MicrophoneServer::get_feed_index(int p_id) {
	ERR_FAIL_COND_V_MSG(!is_monitoring_feeds(), -1, "MicrophoneServer is not actively monitoring feeds; call set_monitoring_feeds(true) first.");
	LocalVector<Ref<MicrophoneFeed>> feeds = MicrophoneDriver::get_singleton()->get_feeds();
	for (uint32_t i = 0; i < feeds.size(); i++) {
		if (feeds[i]->get_id() == p_id) {
			return i;
		}
	}
	return -1;
}

Ref<MicrophoneFeed> MicrophoneServer::get_feed_by_id(int p_id) {
	ERR_FAIL_COND_V_MSG(!is_monitoring_feeds(), nullptr, "MicrophoneServer is not actively monitoring feeds; call set_monitoring_feeds(true) first.");
	LocalVector<Ref<MicrophoneFeed>> feeds = MicrophoneDriver::get_singleton()->get_feeds();
	for (uint32_t i = 0; i < feeds.size(); i++) {
		if (feeds[i]->get_id() == p_id) {
			return feeds[i];
		}
	}
	return nullptr;
}

Ref<MicrophoneFeed> MicrophoneServer::get_feed(int p_index) {
	ERR_FAIL_COND_V_MSG(!is_monitoring_feeds(), nullptr, "MicrophoneServer is not actively monitoring feeds; call set_monitoring_feeds(true) first.");
	LocalVector<Ref<MicrophoneFeed>> feeds = MicrophoneDriver::get_singleton()->get_feeds();
	ERR_FAIL_COND_V(p_index < 0, nullptr);
	ERR_FAIL_INDEX_V((uint32_t)p_index, feeds.size(), nullptr);
	return feeds[p_index];
}

int MicrophoneServer::get_feed_count() const {
	ERR_FAIL_COND_V_MSG(!is_monitoring_feeds(), 0, "MicrophoneServer is not actively monitoring feeds; call set_monitoring_feeds(true) first.");
	return MicrophoneDriver::get_singleton()->get_feed_count();
}

TypedArray<MicrophoneFeed> MicrophoneServer::get_feeds() {
	ERR_FAIL_COND_V_MSG(!is_monitoring_feeds(), {}, "MicrophoneServer is not actively monitoring feeds; call set_monitoring_feeds(true) first.");
	TypedArray<MicrophoneFeed> return_feeds;
	int feed_count = get_feed_count();
	return_feeds.resize(feed_count);

	LocalVector<Ref<MicrophoneFeed>> feeds = MicrophoneDriver::get_singleton()->get_feeds();
	for (int i = 0; i < feed_count; i++) {
		return_feeds[i] = feeds[i];
	};
	return return_feeds;
}

void MicrophoneServer::init() {
	// TODO: Init.
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
	ClassDB::bind_method(D_METHOD("get_feeds"), &MicrophoneServer::get_feeds);

	ADD_SIGNAL(MethodInfo(SNAME("feed_added"), PropertyInfo(Variant::OBJECT, "feed")));
	ADD_SIGNAL(MethodInfo(SNAME("feed_removed"), PropertyInfo(Variant::OBJECT, "feed")));
	ADD_SIGNAL(MethodInfo(SNAME("feeds_updated")));
}
