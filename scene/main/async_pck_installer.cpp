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

void AsyncPCKInstaller::_notification(int p_what) {
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
			set_process(false);
		} break;
	}
}

void AsyncPCKInstaller::update() {
	InstallerStatus current_state = get_status();
	switch (current_state) {
		case INSTALLER_STATUS_IDLE:
		case INSTALLER_STATUS_LOADING: {
			// Do nothing.
		} break;

		case INSTALLER_STATUS_INSTALLED:
		case INSTALLER_STATUS_ERROR: {
			set_process(false);
			return;
		} break;

		case INSTALLER_STATUS_MAX: {
			set_process(false);
			ERR_FAIL();
		} break;
	}

	const static String KEY_FILES = "files";
	const static String KEY_STATUS = "status";
	const static String KEY_SIZE = "size";
	const static String KEY_PROGRESS = "progress";
	const static String KEY_PROGRESS_RATIO = "progress_ratio";

	const static String STATUS_IDLE = "STATUS_IDLE";
	const static String STATUS_LOADING = "STATUS_LOADING";
	const static String STATUS_ERROR = "STATUS_ERROR";
	const static String STATUS_INSTALLED = "STATUS_INSTALLED";

	HashMap<String, Dictionary> files_status;

	auto _l_get_status_enum_value = [](const String &l_status_value) -> InstallerStatus {
		if (l_status_value == STATUS_IDLE) {
			return INSTALLER_STATUS_IDLE;
		} else if (l_status_value == STATUS_LOADING) {
			return INSTALLER_STATUS_LOADING;
		} else if (l_status_value == STATUS_ERROR) {
			return INSTALLER_STATUS_ERROR;
		} else if (l_status_value == STATUS_INSTALLED) {
			return INSTALLER_STATUS_INSTALLED;
		}
		ERR_FAIL_V(INSTALLER_STATUS_ERROR);
	};

	auto _l_get_file_progress_dictionary = [&](const Dictionary &l_file_progress) -> Dictionary {
		Dictionary file_progress;
		file_progress[KEY_STATUS] = _l_get_status_enum_value(l_file_progress[KEY_STATUS]);
		file_progress[KEY_SIZE] = l_file_progress[KEY_SIZE];
		file_progress[KEY_PROGRESS] = l_file_progress[KEY_PROGRESS];
		file_progress[KEY_PROGRESS_RATIO] = l_file_progress[KEY_PROGRESS_RATIO];

		return file_progress;
	};

	for (const KeyValue<String, InstallerStatus> &key_value : paths_state) {
		Dictionary status = OS::get_singleton()->async_pck_install_file_get_status(key_value.key);
		Dictionary files = status[KEY_FILES];
		for (const KeyValue<Variant, Variant> &file_key_value : files) {
			if (files_status.has(file_key_value.key)) {
				continue;
			}
			files_status.insert(file_key_value.key, file_key_value.value);
		}

		set_path_status(key_value.key, _l_get_status_enum_value(status[KEY_STATUS]));

		Dictionary file_progress = _l_get_file_progress_dictionary(status);
		emit_signal(SIGNAL_FILE_ASYNC_PCK_PROGRESS, key_value.key, file_progress);
	}

	uint64_t progress_total = 0;
	uint64_t size_total = 0;
	double progress_ratio = 0;

	for (const KeyValue<String, Dictionary> &key_value : files_status) {
		size_total += (uint64_t)key_value.value[KEY_SIZE];
		progress_total += (uint64_t)key_value.value[KEY_PROGRESS];
	}

	Dictionary files_progress;
	files_progress[KEY_STATUS] = get_status();
	files_progress[KEY_SIZE] = size_total;
	files_progress[KEY_PROGRESS] = progress_total;
	if (size_total > 0) {
		progress_ratio = (double)progress_total / (double)size_total;
	}
	files_progress[KEY_PROGRESS_RATIO] = progress_ratio;

	Dictionary files_progress_files;
	files_progress[KEY_FILES] = files_progress_files;
	for (const KeyValue<String, Dictionary> &key_value : files_status) {
		files_progress_files[key_value.key] = key_value.value;
	}

	emit_signal(SIGNAL_FILES_ASYNC_PCK_PROGRESS, file_paths, files_progress);
}

void AsyncPCKInstaller::start() {
	if (Engine::get_singleton()->is_editor_hint()) {
		return;
	}

	if (!OS::get_singleton()->async_pck_is_supported()) {
		HashMap<String, PackedStringArray> file_paths_errors;
		for (const String &file_path : file_paths) {
			if (FileAccess::exists(file_path)) {
				set_path_status(file_path, INSTALLER_STATUS_INSTALLED);
				emit_signal(SIGNAL_FILE_ASYNC_PCK_INSTALLED, file_path);
			} else {
				set_path_status(file_path, INSTALLER_STATUS_ERROR);
				file_paths_errors[file_path].push_back(vformat(R"*(File "%s" doesn't exist.)*", file_path));
				emit_signal(SIGNAL_FILE_ASYNC_PCK_INSTALLED, file_path, file_paths_errors[file_path]);
			}
		}
		if (file_paths_errors.is_empty()) {
			emit_signal(SIGNAL_FILES_ASYNC_PCK_INSTALLED, file_paths);
		} else {
			Dictionary errors;
			for (const KeyValue<String, PackedStringArray> &key_value : file_paths_errors) {
				errors[key_value.key] = key_value.value;
			}
			emit_signal(SIGNAL_FILES_ASYNC_PCK_ERROR, errors);
		}
		return;
	}

	if (file_paths.is_empty()) {
		emit_signal(SIGNAL_FILES_ASYNC_PCK_INSTALLED, file_paths);
		return;
	}

	for (const String &file_path : file_paths) {
		Error err = OS::get_singleton()->async_pck_install_file(file_path);
		if (err == OK) {
			set_path_status(file_path, INSTALLER_STATUS_LOADING);
		} else {
			set_path_status(file_path, INSTALLER_STATUS_ERROR);
			return;
		}
	}

	set_process(true);
}

void AsyncPCKInstaller::set_path_status(const String &p_path, InstallerStatus p_state) {
	ERR_FAIL_COND_MSG(!file_paths.has(p_path), vformat(R"*("%s" is not in `file_paths`.)*", p_path));
	// bool value_updated = false;

	if (!paths_state.has(p_path)) {
		paths_state.insert(p_path, p_state);
		// value_updated = true;
	} else if (paths_state.get(p_path) != p_state) {
		paths_state[p_path] = p_state;
	}
}

void AsyncPCKInstaller::set_autostart(bool p_autostart) {
	autostart = p_autostart;
}

bool AsyncPCKInstaller::get_autostart() const {
	return autostart;
}

void AsyncPCKInstaller::set_file_paths(const PackedStringArray &p_file_paths) {
	ERR_MAIN_THREAD_GUARD;
	if (file_paths == p_file_paths) {
		return;
	}
	file_paths = p_file_paths;

	LocalVector<String> paths_to_remove;
	for (const KeyValue<String, InstallerStatus> &key_value : paths_state) {
		if (file_paths.has(key_value.key)) {
			continue;
		}
		paths_to_remove.push_back(key_value.key);
	}

	for (const String &path_to_remove : paths_to_remove) {
		paths_state.erase(path_to_remove);
	}
}

PackedStringArray AsyncPCKInstaller::get_file_paths() const {
	return file_paths;
}

AsyncPCKInstaller::InstallerStatus AsyncPCKInstaller::get_status() const {
	InstallerStatus status = INSTALLER_STATUS_IDLE;

	if (paths_state.is_empty()) {
		return INSTALLER_STATUS_INSTALLED;
	}

	for (const KeyValue<String, InstallerStatus> &key_value : paths_state) {
#define CASE_INSTALLER_STATUS_MAX           \
	case INSTALLER_STATUS_MAX: {            \
		ERR_FAIL_V(INSTALLER_STATUS_ERROR); \
	} break

		switch (status) {
			case INSTALLER_STATUS_IDLE: {
				switch (key_value.value) {
					case INSTALLER_STATUS_IDLE: {
						// Do nothing, the state is the same.
					} break;

					case INSTALLER_STATUS_LOADING:
					case INSTALLER_STATUS_INSTALLED: {
						status = key_value.value;
					} break;

					case INSTALLER_STATUS_ERROR: {
						return INSTALLER_STATUS_ERROR;
					} break;

						CASE_INSTALLER_STATUS_MAX;
				}
			} break;

			case INSTALLER_STATUS_LOADING: {
				switch (key_value.value) {
					case INSTALLER_STATUS_LOADING: {
						// Do nothing, the state is the same.
					} break;

					case INSTALLER_STATUS_IDLE: {
						// Huh? It reverted back to idle for some reason.
						status = INSTALLER_STATUS_IDLE;
						print_error(vformat(R"*(Installer state for "%s" reverted from `INSTALLER_STATE_INSTALLED` to `INSTALLER_STATE_IDLE`)*", key_value.key));
					} break;

					case INSTALLER_STATUS_INSTALLED: {
						status = INSTALLER_STATUS_INSTALLED;
					} break;

					case INSTALLER_STATUS_ERROR: {
						return INSTALLER_STATUS_ERROR;
					} break;

						CASE_INSTALLER_STATUS_MAX;
				}
			} break;

			case INSTALLER_STATUS_INSTALLED: {
				switch (key_value.value) {
					case INSTALLER_STATUS_INSTALLED: {
						// Do nothing, the state is the same.
					} break;

					case INSTALLER_STATUS_IDLE:
					case INSTALLER_STATUS_LOADING: {
						// Huh? It reverted back to idle for some reason.
						status = key_value.value;
						String state_name = key_value.value == INSTALLER_STATUS_IDLE
								? "IDLE"
								: "LOADING";
						print_error(vformat(R"*(Installer state for "%s" reverted from `INSTALLER_STATE_INSTALLED` to `INSTALLER_STATE_%s`)*", key_value.key, state_name));
					} break;

					case INSTALLER_STATUS_ERROR: {
						return INSTALLER_STATUS_ERROR;
					} break;

						CASE_INSTALLER_STATUS_MAX;
				}
			} break;

			case INSTALLER_STATUS_ERROR: {
				return INSTALLER_STATUS_ERROR;
			} break;

				CASE_INSTALLER_STATUS_MAX;
		}

#undef CASE_INSTALLER_STATUS_MAX
	}

	return status;
}

void AsyncPCKInstaller::_bind_methods() {
	ClassDB::bind_method(D_METHOD("set_autostart", "autostart"), &AsyncPCKInstaller::set_autostart);
	ClassDB::bind_method(D_METHOD("get_autostart"), &AsyncPCKInstaller::get_autostart);
	ClassDB::bind_method(D_METHOD("set_resources_paths", "resources_paths"), &AsyncPCKInstaller::set_file_paths);
	ClassDB::bind_method(D_METHOD("get_resources_paths"), &AsyncPCKInstaller::get_file_paths);

	ClassDB::bind_method(D_METHOD("get_status"), &AsyncPCKInstaller::get_status);

	ADD_PROPERTY(PropertyInfo(Variant::BOOL, "autostart"), "set_autostart", "get_autostart");
	ADD_PROPERTY(PropertyInfo(Variant::PACKED_STRING_ARRAY, "resources_paths", PROPERTY_HINT_ARRAY_TYPE, MAKE_FILE_ARRAY_TYPE_HINT("*")), "set_resources_paths", "get_resources_paths");

	ADD_SIGNAL(MethodInfo(SIGNAL_FILES_ASYNC_PCK_INSTALLED, PropertyInfo(Variant::PACKED_STRING_ARRAY, "files", PROPERTY_HINT_ARRAY_TYPE, MAKE_FILE_ARRAY_TYPE_HINT("*"))));
	ADD_SIGNAL(MethodInfo(SIGNAL_FILE_ASYNC_PCK_INSTALLED, PropertyInfo(Variant::STRING, "file", PROPERTY_HINT_FILE_PATH, "*")));
	ADD_SIGNAL(MethodInfo(SIGNAL_FILES_ASYNC_PCK_PROGRESS, PropertyInfo(Variant::PACKED_STRING_ARRAY, "files", PROPERTY_HINT_ARRAY_TYPE, MAKE_FILE_ARRAY_TYPE_HINT("*")), PropertyInfo(Variant::DICTIONARY, "progress_status")));
	ADD_SIGNAL(MethodInfo(SIGNAL_FILE_ASYNC_PCK_PROGRESS, PropertyInfo(Variant::STRING, "file", PROPERTY_HINT_FILE_PATH, "*"), PropertyInfo(Variant::DICTIONARY, "progress_status")));
	ADD_SIGNAL(MethodInfo(SIGNAL_FILES_ASYNC_PCK_ERROR, PropertyInfo(Variant::DICTIONARY, "files_errors")));
	ADD_SIGNAL(MethodInfo(SIGNAL_FILE_ASYNC_PCK_ERROR, PropertyInfo(Variant::STRING, "file", PROPERTY_HINT_FILE_PATH, "*"), PropertyInfo(Variant::DICTIONARY, "errors")));

	BIND_ENUM_CONSTANT(INSTALLER_STATUS_IDLE);
	BIND_ENUM_CONSTANT(INSTALLER_STATUS_LOADING);
	BIND_ENUM_CONSTANT(INSTALLER_STATUS_INSTALLED);
	BIND_ENUM_CONSTANT(INSTALLER_STATUS_ERROR);
	BIND_ENUM_CONSTANT(INSTALLER_STATUS_MAX);
}
