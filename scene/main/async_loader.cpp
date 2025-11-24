/**************************************************************************/
/*  async_loader.cpp                                                      */
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

#include "async_loader.h"
#include "core/config/engine.h"
#include "core/io/file_access.h"
#include "core/object/object.h"
#include "core/os/os.h"
#include "core/variant/variant.h"
#include "scene/main/node.h"

void AsyncLoader::_notification(int p_what) {
	switch (p_what) {
		case NOTIFICATION_ENTER_TREE: {
		} break;

		case NOTIFICATION_READY: {
			if (autostart) {
				start();
			}
		} break;

		case NOTIFICATION_EXIT_TREE: {
		} break;
	}
}

void AsyncLoader::start() {
	if (Engine::get_singleton()->is_editor_hint()) {
		return;
	}
	if (!OS::get_singleton()->asyncpck_is_supported()) {
		bool has_error = false;
		for (const String &file_path : file_paths) {
			if (FileAccess::exists(file_path)) {
				emit_signal("file_async_installed", file_path);
			} else {
				has_error = true;
				emit_signal("file_async_error", file_path);
			}
		}
		if (!has_error) {
			emit_signal("files_async_installed");
		}
		return;
	}

	for (const String &file_path : file_paths) {
		OS::get_singleton()->asyncpck_load_file(file_path);
	}
}

void AsyncLoader::set_autostart(bool p_autostart) {
	autostart = p_autostart;
}

bool AsyncLoader::get_autostart() const {
	return autostart;
}

void AsyncLoader::set_file_paths(const PackedStringArray &p_file_paths) {
	ERR_MAIN_THREAD_GUARD;
	if (file_paths == p_file_paths) {
		return;
	}
	file_paths = p_file_paths;
}

PackedStringArray AsyncLoader::get_file_paths() const {
	return file_paths;
}

void AsyncLoader::_bind_methods() {
	ClassDB::bind_method(D_METHOD("set_autostart", "autostart"), &AsyncLoader::set_autostart);
	ClassDB::bind_method(D_METHOD("get_autostart"), &AsyncLoader::get_autostart);
	ClassDB::bind_method(D_METHOD("set_resources_paths", "resources_paths"), &AsyncLoader::set_file_paths);
	ClassDB::bind_method(D_METHOD("get_resources_paths"), &AsyncLoader::get_file_paths);

	ADD_PROPERTY(PropertyInfo(Variant::BOOL, "autostart"), "set_autostart", "get_autostart");
	ADD_PROPERTY(PropertyInfo(Variant::PACKED_STRING_ARRAY, "resources_paths", PROPERTY_HINT_FILE_PATH, "*"), "set_resources_paths", "get_resources_paths");

	ADD_SIGNAL(MethodInfo("files_async_installed"));
	ADD_SIGNAL(MethodInfo("file_async_installed", PropertyInfo(Variant::STRING, "file", PROPERTY_HINT_FILE_PATH, "*")));
	ADD_SIGNAL(MethodInfo("files_async_progress"));
	ADD_SIGNAL(MethodInfo("file_async_progress", PropertyInfo(Variant::STRING, "file", PROPERTY_HINT_FILE_PATH, "*")));
	ADD_SIGNAL(MethodInfo("file_async_error", PropertyInfo(Variant::STRING, "file", PROPERTY_HINT_FILE_PATH, "*")));
}
