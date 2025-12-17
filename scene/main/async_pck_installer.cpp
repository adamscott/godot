/**************************************************************************/
/*  async_pck_installer.cpp                                               */
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

#include "async_pck_installer.h"

#include "core/config/engine.h"
#include "core/io/file_access.h"
#include "core/object/class_db.h"
#include "core/object/object.h"
#include "core/os/os.h"
#include "core/variant/variant.h"
#include "scene/main/node.h"

void AsyncPckInstaller::_notification(int p_what) {
	switch (p_what) {
		case NOTIFICATION_ENTER_TREE: {
		} break;

		case NOTIFICATION_READY: {
			if (autostart) {
				start();
			}
		} break;

		case NOTIFICATION_PROCESS: {
			update();
		} break;

		case NOTIFICATION_EXIT_TREE: {
		} break;
	}
}

void AsyncPckInstaller::update() {
	if (get_state() != INSTALLER_STATE_LOADING) {
		set_process(false);
		return;
	}

	for (const KeyValue<String, InstallerState> &key_value : paths_state) {
		Dictionary value = OS::get_singleton()->async_pck_install_file_get_status(key_value.key);
		print_line(vformat("AsyncPckInstaller::update() %s: %s", key_value.key, value));
	}
}

void AsyncPckInstaller::start() {
	if (Engine::get_singleton()->is_editor_hint()) {
		return;
	}

	if (!OS::get_singleton()->async_pck_is_supported()) {
		bool has_error = false;
		for (const String &file_path : file_paths) {
			if (FileAccess::exists(file_path)) {
				set_path_state(file_path, INSTALLER_STATE_INSTALLED);
			} else {
				has_error = true;
				set_path_state(file_path, INSTALLER_STATE_ERROR);
			}
		}
		if (!has_error) {
			emit_signal(SIGNAL_FILES_ASYNC_PCK_INSTALLED);
		}
		return;
	}

	if (file_paths.is_empty()) {
		emit_signal(SIGNAL_FILES_ASYNC_PCK_INSTALLED);
		return;
	}

	for (const String &file_path : file_paths) {
		Error err = OS::get_singleton()->async_pck_install_file(file_path);
		if (err == OK) {
			set_path_state(file_path, INSTALLER_STATE_LOADING);
		} else {
			set_path_state(file_path, INSTALLER_STATE_ERROR);
			return;
		}
	}

	set_process(true);
}

void AsyncPckInstaller::set_path_state(const String &p_path, InstallerState p_state) {
	ERR_FAIL_COND_MSG(!file_paths.has(p_path), vformat(R"*("%s" is not in `file_paths`.)*", p_path));
	bool value_updated = false;

	if (!paths_state.has(p_path)) {
		paths_state.insert(p_path, p_state);
		value_updated = true;
	} else if (paths_state.get(p_path) != p_state) {
		paths_state[p_path] = p_state;
	}

	if (!value_updated) {
		return;
	}

	switch (p_state) {
		case INSTALLER_STATE_INSTALLED: {
			emit_signal(SIGNAL_FILE_ASYNC_PCK_INSTALLED, p_path);
		} break;
		case INSTALLER_STATE_ERROR: {
			emit_signal(SIGNAL_FILE_ASYNC_PCK_ERROR, p_path);
		} break;
		case INSTALLER_STATE_LOADING:
		case INSTALLER_STATE_IDLE: {
			// Do nothing.
			// No signal for starting loading, only on "progress".
		} break;
		case INSTALLER_STATE_MAX: {
			ERR_FAIL_MSG("Cannot set to path state to `AsyncPckInstaller::InstallerState::INSTALLER_STATE_MAX`");
		} break;
	}
}

void AsyncPckInstaller::set_autostart(bool p_autostart) {
	autostart = p_autostart;
}

bool AsyncPckInstaller::get_autostart() const {
	return autostart;
}

void AsyncPckInstaller::set_file_paths(const PackedStringArray &p_file_paths) {
	ERR_MAIN_THREAD_GUARD;
	if (file_paths == p_file_paths) {
		return;
	}
	file_paths = p_file_paths;

	LocalVector<String> paths_to_remove;
	for (const KeyValue<String, InstallerState> &key_value : paths_state) {
		if (file_paths.has(key_value.key)) {
			continue;
		}
		paths_to_remove.push_back(key_value.key);
	}

	for (const String &path_to_remove : paths_to_remove) {
		paths_state.erase(path_to_remove);
	}
}

PackedStringArray AsyncPckInstaller::get_file_paths() const {
	return file_paths;
}

AsyncPckInstaller::InstallerState AsyncPckInstaller::get_state() const {
	InstallerState state = INSTALLER_STATE_IDLE;

	if (paths_state.is_empty()) {
		return INSTALLER_STATE_INSTALLED;
	}

	for (const KeyValue<String, InstallerState> &key_value : paths_state) {
		switch (state) {
			case INSTALLER_STATE_IDLE: {
				state = INSTALLER_STATE_IDLE;
			} break;

			case INSTALLER_STATE_LOADING: {
				switch (key_value.value) {
					case INSTALLER_STATE_LOADING:
					case INSTALLER_STATE_IDLE:
					case INSTALLER_STATE_INSTALLED:
					case INSTALLER_STATE_MAX: {
						// Do nothing.
					} break;

					case INSTALLER_STATE_ERROR: {
						return INSTALLER_STATE_ERROR;
					} break;
				}
			} break;

			case INSTALLER_STATE_INSTALLED: {
				switch (key_value.value) {
					case INSTALLER_STATE_IDLE: {
						state = INSTALLER_STATE_IDLE;
					} break;
					case INSTALLER_STATE_LOADING: {
						state = INSTALLER_STATE_LOADING;
					} break;
					case INSTALLER_STATE_ERROR: {
						return INSTALLER_STATE_ERROR;
					} break;
					case INSTALLER_STATE_INSTALLED:
					case INSTALLER_STATE_MAX: {
						// Do nothing.
					} break;
				}
			} break;

			case INSTALLER_STATE_ERROR: {
				return INSTALLER_STATE_ERROR;
			} break;

			case INSTALLER_STATE_MAX: {
				ERR_FAIL_V(INSTALLER_STATE_ERROR);
			} break;
		}
	}

	return state;
}

void AsyncPckInstaller::_bind_methods() {
	ClassDB::bind_method(D_METHOD("set_autostart", "autostart"), &AsyncPckInstaller::set_autostart);
	ClassDB::bind_method(D_METHOD("get_autostart"), &AsyncPckInstaller::get_autostart);
	ClassDB::bind_method(D_METHOD("set_resources_paths", "resources_paths"), &AsyncPckInstaller::set_file_paths);
	ClassDB::bind_method(D_METHOD("get_resources_paths"), &AsyncPckInstaller::get_file_paths);

	ClassDB::bind_method(D_METHOD("get_state"), &AsyncPckInstaller::get_state);

	ADD_PROPERTY(PropertyInfo(Variant::BOOL, "autostart"), "set_autostart", "get_autostart");
	ADD_PROPERTY(PropertyInfo(Variant::PACKED_STRING_ARRAY, "resources_paths", PROPERTY_HINT_ARRAY_TYPE, MAKE_FILE_ARRAY_TYPE_HINT("*")), "set_resources_paths", "get_resources_paths");

	ADD_SIGNAL(MethodInfo(SIGNAL_FILES_ASYNC_PCK_INSTALLED));
	ADD_SIGNAL(MethodInfo(SIGNAL_FILE_ASYNC_PCK_INSTALLED, PropertyInfo(Variant::STRING, "file", PROPERTY_HINT_FILE_PATH, "*")));
	ADD_SIGNAL(MethodInfo(SIGNAL_FILES_ASYNC_PCK_PROGRESS));
	ADD_SIGNAL(MethodInfo(SIGNAL_FILE_ASYNC_PCK_PROGRESS, PropertyInfo(Variant::STRING, "file", PROPERTY_HINT_FILE_PATH, "*")));
	ADD_SIGNAL(MethodInfo(SIGNAL_FILE_ASYNC_PCK_ERROR, PropertyInfo(Variant::STRING, "file", PROPERTY_HINT_FILE_PATH, "*")));

	BIND_ENUM_CONSTANT(INSTALLER_STATE_IDLE);
	BIND_ENUM_CONSTANT(INSTALLER_STATE_LOADING);
	BIND_ENUM_CONSTANT(INSTALLER_STATE_INSTALLED);
	BIND_ENUM_CONSTANT(INSTALLER_STATE_ERROR);
	BIND_ENUM_CONSTANT(INSTALLER_STATE_MAX);
}
