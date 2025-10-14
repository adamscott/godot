/**************************************************************************/
/*  microphone_server.h                                                   */
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

#pragma once

#include "core/object/class_db.h"
#include "core/os/thread_safe.h"
#include "core/string/string_name.h"

class MicrophoneFeed;
template <typename T>
class TypedArray;

class MicrophoneServer : public Object {
	GDCLASS(MicrophoneServer, Object);
	_THREAD_SAFE_CLASS_

public:
	typedef MicrophoneServer *(*CreateFunction)();

private:
protected:
	static MicrophoneServer *singleton;
	static void _bind_methods();

	static inline const int MAX_SERVERS = 64;
	struct MicrophoneServerCreate {
		const char *name;
		CreateFunction create_function;
	};
	static MicrophoneServerCreate server_create_functions[MAX_SERVERS];
	static int server_create_count;

	bool monitoring_feeds = false;
	Vector<Ref<MicrophoneFeed>> feeds;

public:
	static MicrophoneServer *get_singleton() { return singleton; }

	virtual void set_monitoring_feeds(bool p_monitoring_feeds) { monitoring_feeds = p_monitoring_feeds; }
	_FORCE_INLINE_ bool is_monitoring_feeds() const { return monitoring_feeds; }

	// Right now we identify our feed by it's ID when it's used in the background.
	// May see if we can change this to purely relying on MicrophoneFeed objects or by name.
	int get_free_id();
	int get_feed_index(int p_id);
	Ref<MicrophoneFeed> get_feed_by_id(int p_id);

	// Add and remove feeds.
	void add_feed(const Ref<MicrophoneFeed> &p_feed);
	void remove_feed(const Ref<MicrophoneFeed> &p_feed);

	// Get our feeds.
	Ref<MicrophoneFeed> get_feed(int p_index);
	int get_feed_count();
	TypedArray<MicrophoneFeed> get_feeds();

	static void register_create_function(const char *p_name, CreateFunction p_function);
	static int get_create_function_count();
	static const char *get_create_function_name(int p_index);
	static MicrophoneServer *create(int p_index);

	MicrophoneServer();
	~MicrophoneServer();
};
