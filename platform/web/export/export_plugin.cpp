/**************************************************************************/
/*  export_plugin.cpp                                                     */
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

#include "export_plugin.h"

#include "core/error/error_list.h"
#include "core/error/error_macros.h"
#include "core/extension/gdextension.h"
#include "core/io/config_file.h"
#include "core/io/file_access.h"
#include "core/io/file_access_encrypted.h"
#include "core/io/json.h"
#include "core/io/resource_loader.h"
#include "core/io/resource_uid.h"
#include "core/os/memory.h"
#include "core/string/fuzzy_search.h"
#include "core/variant/dictionary.h"
#include "editor/editor_node.h"
#include "editor/export/editor_export_platform.h"
#include "editor/export/editor_export_preset.h"
#include "logo_svg.gen.h"
#include "run_icon_svg.gen.h"

#include "core/config/project_settings.h"
#include "core/io/dir_access.h"
#include "editor/editor_string_names.h"
#include "editor/export/editor_export.h"
#include "editor/export/editor_export_platform_utils.h"
#include "editor/export/project_export.h"
#include "editor/file_system/editor_file_system.h"
#include "editor/import/resource_importer_texture_settings.h"
#include "editor/settings/editor_settings.h"
#include "editor/themes/editor_scale.h"
#include "scene/gui/box_container.h"
#include "scene/gui/grid_container.h"
#include "scene/gui/line_edit.h"
#include "scene/gui/margin_container.h"
#include "scene/gui/tab_container.h"
#include "scene/gui/tree.h"
#include "scene/main/node.h"
#include "scene/main/timer.h"
#include "scene/main/window.h"
#include "scene/resources/image_texture.h"
#include "scene/scene_string_names.h"

#include "modules/modules_enabled.gen.h" // For mono.
#include "modules/svg/image_loader_svg.h"

#include <functional>

/**
 * EditorExportPlatformWeb::ExportData::ResourceData
 */
uint32_t EditorExportPlatformWeb::ExportData::ResourceData::get_size() const {
	uint32_t size = 0;
	if (native_file.exists) {
		size += native_file.size;
	}
	if (remap_file.exists) {
		size += remap_file.size;
	}
	if (remapped_file.exists) {
		size += remapped_file.size;
	}
	return size;
}

Dictionary EditorExportPlatformWeb::ExportData::ResourceData::get_as_resource_dictionary() const {
	Dictionary data;
	Dictionary resources;

	if (native_file.exists) {
		resources[native_file.path] = native_file.get_as_dictionary();
	}
	if (remap_file.exists) {
		resources[remap_file.path] = remap_file.get_as_dictionary();
	}
	if (remapped_file.exists) {
		resources[remapped_file.path] = remapped_file.get_as_dictionary();
	}
	data["files"] = resources;
	data["totalSize"] = get_size();
	return data;
}

void EditorExportPlatformWeb::ExportData::ResourceData::flatten_dependencies(LocalVector<const ResourceData *> *p_deps) const {
	ERR_FAIL_NULL(p_deps);

	for (const ResourceData *dependency : dependencies) {
		if (p_deps->has(dependency)) {
			continue;
		}
		p_deps->push_back(dependency);
		dependency->flatten_dependencies(p_deps);
	}
}

EditorExportPlatformWeb::ExportData::ResourceData EditorExportPlatformWeb::ExportData::ResourceData::create(const ExportData *p_export_data, const String &p_path, const String &p_remap_file_path, const String &p_remapped_file_path, Error *r_error) {
	Error error = OK;
#define HANDLE_ERR(m_cond, m_err) \
	if (unlikely(m_cond)) {       \
		error = (m_err);          \
		goto return_error;        \
	}                             \
	(void)0

	ResourceData data;
	String real_native_file_path;
	String real_remap_file_path;
	String real_remapped_file_path;

	HANDLE_ERR(p_export_data == nullptr, ERR_INVALID_PARAMETER);
	HANDLE_ERR(p_path.is_empty(), ERR_INVALID_PARAMETER);
	if (!p_remap_file_path.is_empty()) {
		HANDLE_ERR(p_remapped_file_path.is_empty(), ERR_INVALID_PARAMETER);
	}

	data.path = p_path;
	data.native_file.path = p_path;
	data.remap_file.path = p_remap_file_path;
	data.remapped_file.path = p_remapped_file_path;

	real_native_file_path = p_export_data->res_to_global(p_path);
	real_remap_file_path = !p_remap_file_path.is_empty()
			? p_export_data->res_to_global(p_remap_file_path)
			: "";
	real_remapped_file_path = !p_remapped_file_path.is_empty()
			? p_export_data->res_to_global(p_remapped_file_path)
			: "";

	data.native_file.exists = FileAccess::exists(real_native_file_path);
	data.remap_file.exists = FileAccess::exists(real_remap_file_path);
	data.remapped_file.exists = FileAccess::exists(real_remapped_file_path);
	if (!data.remap_file.path.is_empty()) {
		HANDLE_ERR(!data.remap_file.exists, ERR_FILE_NOT_FOUND);
		HANDLE_ERR(!data.remapped_file.exists, ERR_FILE_NOT_FOUND);
	}

	if (data.native_file.exists) {
		data.native_file.size = FileAccess::get_size(real_native_file_path);
	}
	if (data.remap_file.exists) {
		data.remap_file.size = FileAccess::get_size(real_remap_file_path);
		data.remapped_file.size = FileAccess::get_size(real_remapped_file_path);
	}

	if (data.native_file.exists) {
		data.native_file.md5 = real_native_file_path.md5_text();
		data.native_file.sha256 = real_native_file_path.sha256_text();
	}
	if (data.remap_file.exists) {
		data.remap_file.md5 = real_remap_file_path.md5_text();
		data.remap_file.sha256 = real_remap_file_path.sha256_text();
		data.remapped_file.md5 = real_remapped_file_path.md5_text();
		data.remapped_file.sha256 = real_remapped_file_path.sha256_text();
	}

return_error:
	if (r_error != nullptr) {
		*r_error = error;
	}

	if (error != OK) {
		return ResourceData();
	}
	return data;
#undef HANDLE_ERR
}

/**
 * EditorExportPlatformWeb::ExportData
 */

Error EditorExportPlatformWeb::ExportData::write_deps_json_file(const String &p_resource_path, HashSet<String> &p_features_set) {
	if (dependencies_map.has(p_resource_path)) {
		return OK;
	}

	Error error;

	String resource_path = EditorExportPlatformUtils::get_path_from_dependency(p_resource_path);
	String remap_file_path;
	String remapped_file_path;

	const String SUFFIX_REMAP = ".remap";
	const String SUFFIX_IMPORT = ".import";

	bool exists_import = FileAccess::exists(res_to_global(resource_path + SUFFIX_IMPORT));
	bool exists_remap = FileAccess::exists(res_to_global(resource_path + SUFFIX_REMAP));

	if (exists_import || exists_remap) {
		if (exists_import) {
			remap_file_path = resource_path + SUFFIX_IMPORT;
		} else {
			remap_file_path = resource_path + SUFFIX_REMAP;
		}
		Ref<FileAccess> remap_file_access = FileAccess::open(res_to_global(remap_file_path), FileAccess::READ);
		ERR_FAIL_COND_V(remap_file_access.is_null(), FileAccess::get_open_error());

		Ref<ConfigFile> remap_file;
		remap_file.instantiate();
		// if (p_is_encrypted) {
		// 	Ref<FileAccessEncrypted> remap_file_access_encrypted;
		// 	remap_file_access_encrypted.instantiate();
		// 	Error err = remap_file_access_encrypted->open_and_parse(remap_file_access, p_key, FileAccessEncrypted::MODE_READ, false);
		// 	ERR_FAIL_COND_V(err != OK, err);
		// 	remap_file_access = remap_file_access_encrypted;
		// }
		remap_file->parse(remap_file_access->get_as_text());

		Vector<String> remap_section_keys = remap_file->get_section_keys("remap");
		for (const String &remap_section_key : remap_section_keys) {
			bool found = false;
			const String PREFIX_PATH = "path.";
			if (remap_section_key.begins_with(PREFIX_PATH)) {
				String type = remap_section_key.trim_prefix(PREFIX_PATH);
				if (p_features_set.has(type)) {
					found = true;
				}
			}
			if (remap_section_key == "path") {
				found = true;
			}
			if (!found) {
				continue;
			}
			remapped_file_path = ResourceUID::ensure_path(remap_file->get_value("remap", remap_section_key));
			break;
		}

		// Let's try again for .uid instead.
		if (remapped_file_path.is_empty()) {
			remap_section_keys = remap_file->get_section_keys("remap");
			for (const String &remap_section_key : remap_section_keys) {
				bool found = false;
				if (remap_section_key == "uid") {
					found = true;
				}
				if (!found) {
					continue;
				}
				remapped_file_path = ResourceUID::ensure_path(remap_file->get_value("remap", remap_section_key));
				break;
			}
		}

		ERR_FAIL_COND_V_MSG(remapped_file_path.is_empty(), ERR_FILE_NOT_FOUND, vformat(TTRC(R"*(Could not find a remap path in "%s".)*"), res_to_global(remap_file_path)));
	}

	ExportData::ResourceData resource = ExportData::ResourceData::create(this, resource_path, remap_file_path, remapped_file_path, &error);
	if (error != OK) {
		return error;
	}

	dependencies_map.insert(resource_path, &dependencies.push_back(resource)->get());

	HashSet<String> resource_dependencies;
	{
		EditorExportPlatformUtils::AsyncPckFileDependenciesState file_dependencies_state;
		file_dependencies_state.add_to_file_dependencies(resource_path);
		HashMap<String, const HashSet<String> *> file_dependencies = file_dependencies_state.get_file_dependencies_of(resource_path);
		for (const KeyValue<String, const HashSet<String> *> &key_value : file_dependencies) {
			resource_dependencies.insert(key_value.key);
		}
	}
	for (const String &resource_dependency : resource_dependencies) {
		Error error = write_deps_json_file(resource_dependency, p_features_set);
		if (error != OK) {
			ERR_PRINT(vformat(TTRC(R"*(Could not add dependencies of "%s".)*"), resource_dependency));
			return error;
		}
		dependencies_map.get(resource_path)->dependencies.push_back(dependencies_map.get(resource_dependency));
	}
	ExportData::ResourceData *dependency = dependencies_map.get(resource_path);

	LocalVector<const ExportData::ResourceData *> found_dependencies;
	dependency->flatten_dependencies(&found_dependencies);

	Dictionary deps;

	// Resources.
	Dictionary deps_resources;
	deps["resources"] = deps_resources;

	for (const ExportData::ResourceData *dependency : found_dependencies) {
		deps_resources[dependency->path] = dependency->get_as_resource_dictionary();
	}

	// Dependencies.
	Dictionary deps_dependencies;
	deps["dependencies"] = deps_dependencies;

	std::function<void(const ExportData::ResourceData *)> _l_add_deps_dependencies;
	_l_add_deps_dependencies = [&_l_add_deps_dependencies, &deps_dependencies](const ExportData::ResourceData *l_dependency) -> void {
		LocalVector<const ExportData::ResourceData *> local_dependencies;
		l_dependency->flatten_dependencies(&local_dependencies);

		Array paths_array;
		deps_dependencies[l_dependency->path] = paths_array;
		for (const ExportData::ResourceData *local_dependency : local_dependencies) {
			if (local_dependency->path != l_dependency->path) {
				paths_array.push_back(local_dependency->path);
			}
			if (!deps_dependencies.has(local_dependency->path)) {
				_l_add_deps_dependencies(local_dependency);
			}
		}
		paths_array.sort();
	};

	for (const ExportData::ResourceData *found_dependency : found_dependencies) {
		_l_add_deps_dependencies(found_dependency);
	}

	{
		String deps_json_file_path = res_to_global(resource_path) + ".deps.json";
		Ref<FileAccess> deps_json_file = FileAccess::open(deps_json_file_path, FileAccess::WRITE);
		if (deps_json_file.is_null()) {
			ERR_PRINT(vformat(R"*(Could not write to "%s".)*", deps_json_file_path));
			return FileAccess::get_open_error();
		}
		deps_json_file->store_string(JSON::stringify(deps, String(" ").repeat(2)));
	}

	return OK;
}

HashSet<String> EditorExportPlatformWeb::ExportData::get_features_set() const {
	List<String> features_list;

	preset->get_platform()->get_platform_features(&features_list);
	preset->get_platform()->get_preset_features(preset, &features_list);

	String custom = preset->get_custom_features();
	Vector<String> custom_list = custom.split(",");
	for (int i = 0; i < custom_list.size(); i++) {
		String f = custom_list[i].strip_edges();
		if (!f.is_empty()) {
			features_list.push_back(f);
		}
	}

	HashSet<String> features_set;
	for (const String &feature : features_list) {
		features_set.insert(feature);
	}
	return features_set;
}

/**
 * EditorExportPlatformWeb::AsyncDialog::TreePaths::TreePath
 */
void EditorExportPlatformWeb::AsyncDialog::TreeFilesPaths::TreeFilePath::_invalidate_cache(TreeFilePathValue p_value) {
	state_cache.erase(p_value);

	if (parent != nullptr) {
		parent->invalidate_cache(p_value);
	}
}

void EditorExportPlatformWeb::AsyncDialog::TreeFilesPaths::TreeFilePath::invalidate_cache(TreeFilePathValue p_value) {
	_invalidate_cache(p_value);

	switch (p_value) {
		case TREE_PATH_VALUE_MAIN:
		case TREE_PATH_VALUE_FORCED: {
			_invalidate_cache(TREE_PATH_VALUE_DEPENDENCY);
		} break;
		case TREE_PATH_VALUE_DEPENDENCY: {
			// Do nothing.
		} break;
	}
}

void EditorExportPlatformWeb::AsyncDialog::TreeFilesPaths::TreeFilePath::set_path(const String &p_path) {
	ERR_FAIL_COND(p_path.is_empty());
	path = p_path;
	is_directory = DirAccess::exists(path);
	if (!is_directory) {
		path_file_size = FileAccess::get_size(path);
	}
}

String EditorExportPlatformWeb::AsyncDialog::TreeFilesPaths::TreeFilePath::get_path() const {
	return path;
}

void EditorExportPlatformWeb::AsyncDialog::TreeFilesPaths::TreeFilePath::set_state(TreeFilePathValue p_value, TreeFilePathState p_state) {
	ERR_FAIL_COND_MSG(p_state == TREE_PATH_STATE_INDETERMINATE, "Cannot manually set TreePath state to indeterminate.");
	ERR_FAIL_COND(p_state != TREE_PATH_STATE_CHECKED && p_state != TREE_PATH_STATE_UNCHECKED);

	state_cache.erase(p_value);
	if (parent != nullptr) {
		parent->state_cache.erase(p_value);
	}

	if (is_directory) {
		for (TreeFilePath *child : children) {
			child->set_state(p_value, p_state);
		}
	} else {
		state_cache[p_value] = p_state;
		state[p_value] = p_state == TREE_PATH_STATE_CHECKED;
	}
}

EditorExportPlatformWeb::AsyncDialog::TreeFilesPaths::TreeFilePath::TreeFilePathState EditorExportPlatformWeb::AsyncDialog::TreeFilesPaths::TreeFilePath::get_state(TreeFilePathValue p_value) const {
	if (state_cache.has(p_value)) {
		return state_cache[p_value];
	}

#define SET_CACHE_AND_RETURN_STATE(m_state)            \
	{                                                  \
		TreeFilePathState _m_cached_state = (m_state); \
		state_cache[p_value] = _m_cached_state;        \
		return _m_cached_state;                        \
	}                                                  \
	(void)0

	if (!is_directory) {
		SET_CACHE_AND_RETURN_STATE(state[p_value]
						? TREE_PATH_STATE_CHECKED
						: TREE_PATH_STATE_UNCHECKED);
	}

	uint32_t checked_count = 0;
	for (const TreeFilePath *child : children) {
		TreeFilePathState child_state = child->get_state(p_value);
		switch (child_state) {
			case TREE_PATH_STATE_CHECKED: {
				checked_count += 1;
			} break;
			case TREE_PATH_STATE_INDETERMINATE: {
				SET_CACHE_AND_RETURN_STATE(TREE_PATH_STATE_INDETERMINATE);
			} break;
			case TREE_PATH_STATE_UNCHECKED: {
				// Do nothing.
			} break;
		}
	}

	if (checked_count == 0) {
		SET_CACHE_AND_RETURN_STATE(TREE_PATH_STATE_UNCHECKED);
	} else if (checked_count == children.size()) {
		SET_CACHE_AND_RETURN_STATE(TREE_PATH_STATE_CHECKED);
	}
	SET_CACHE_AND_RETURN_STATE(TREE_PATH_STATE_INDETERMINATE);

#undef SET_CACHE_AND_RETURN_STATE
}

void EditorExportPlatformWeb::AsyncDialog::TreeFilesPaths::TreeFilePath::tree_item_update() {
	if (tree_item == nullptr) {
		return;
	}

#define STATE_UPDATE_VALUE(m_value, m_column)                                            \
	switch (get_state(TreeFilePathValue::m_value)) {                                     \
		case TREE_PATH_STATE_CHECKED: {                                                  \
			tree_item->set_checked(AsyncDialog::TreeFilesColumn::m_column, true);        \
			tree_item->set_indeterminate(AsyncDialog::TreeFilesColumn::m_column, false); \
		} break;                                                                         \
		case TREE_PATH_STATE_INDETERMINATE: {                                            \
			tree_item->set_checked(AsyncDialog::TreeFilesColumn::m_column, false);       \
			tree_item->set_indeterminate(AsyncDialog::TreeFilesColumn::m_column, true);  \
		} break;                                                                         \
		case TREE_PATH_STATE_UNCHECKED: {                                                \
			tree_item->set_checked(AsyncDialog::TreeFilesColumn::m_column, false);       \
			tree_item->set_indeterminate(AsyncDialog::TreeFilesColumn::m_column, false); \
		} break;                                                                         \
	}                                                                                    \
	(void)0

	STATE_UPDATE_VALUE(TREE_PATH_VALUE_MAIN, TREE_FILES_COLUMN_IS_MAIN_SCENE_DEPENDENCY);
	STATE_UPDATE_VALUE(TREE_PATH_VALUE_FORCED, TREE_FILES_COLUMN_IS_FORCED);
	STATE_UPDATE_VALUE(TREE_PATH_VALUE_DEPENDENCY, TREE_FILES_COLUMN_IS_DEPENDENCY);

#undef STATE_UPDATE_VALUE
}

void EditorExportPlatformWeb::AsyncDialog::TreeFilesPaths::TreeFilePath::tree_item_remove_from_tree() {
	if (tree_item == nullptr || !tree_item_in_tree) {
		return;
	}

	TreeItem *parent_tree_item = tree_item->get_parent();
	if (parent_tree_item != nullptr) {
		parent_tree_item->remove_child(tree_item);
		tree_item_in_tree = false;
	}

	for (int i = 0; i < tree_item->get_child_count(); i++) {
		TreeItem *child_tree_item = tree_item->get_child(i);
		TreeFilePath *child_tree_path = (TreeFilePath *)(uint64_t)child_tree_item->get_metadata(TREE_FILES_COLUMN_PATH);
		child_tree_path->tree_item_remove_from_tree();
	}
}

EditorExportPlatformWeb::AsyncDialog::TreeFilesPaths::TreeFilePath::~TreeFilePath() {
	if (!tree_item_in_tree && tree_item != nullptr) {
		memfree(tree_item);
		tree_item = nullptr;
	}
}

/**
 * EditorExportPlatformWeb::AsyncDialog::TreePaths
 */
void EditorExportPlatformWeb::AsyncDialog::TreeFilesPaths::initialize(const HashSet<String> &p_file_paths) {
	ERR_FAIL_COND(_initialized);
	_initialized = true;

	paths.clear();
	paths_map.clear();
	paths_ordered.clear();

	const String PREFIX_RES = "res://";
	HashSet<String> paths_set;

	// Create directory paths.
	for (const String &file_path : p_file_paths) {
		String path = file_path;
		while (true) {
			if (paths_set.has(path)) {
				break;
			}
			paths_set.insert(path);
			String parent_dir = path.get_base_dir();
			if (parent_dir == path) {
				break;
			}
			path = parent_dir;
		}
	}

	// Ordered list.
	for (const String &path_set_element : paths_set) {
		paths_ordered.push_back(path_set_element);
	}
	paths_ordered.sort_custom<FileNoCaseComparator>();

	// Set TreePath list.
	for (uint64_t i = 0; i < paths_ordered.size(); i++) {
		String &path = paths_ordered[i];
		List<TreeFilePath>::Element *tree_path_element = paths.push_back({});
		TreeFilePath *tree_path = &tree_path_element->get();
		tree_path->set_path(path);

		paths_map.insert(path, tree_path);

		if (path != PREFIX_RES) {
			String path_base_dir = path.get_base_dir();
			if (paths_map.has(path_base_dir)) {
				tree_path->parent = paths_map[path_base_dir];
				tree_path->parent->children.push_back(tree_path);
			}
		}
	}
}

/**
 * EditorExportPlatformWeb::AsyncDialog
 */
void EditorExportPlatformWeb::AsyncDialog::_notification(int p_what) {
	switch (p_what) {
		case NOTIFICATION_ENTER_TREE: {
		} break;

		case NOTIFICATION_READY: {
			tree_files_init();
			connect(SceneStringName(confirmed), callable_mp(this, &EditorExportPlatformWeb::AsyncDialog::on_confirmed));
		} break;

		case NOTIFICATION_VISIBILITY_CHANGED: {
			if (!is_visible()) {
				return;
			}
			tree_files_update();
			update_theme();
		} break;

		case NOTIFICATION_POSTINITIALIZE:
		case NOTIFICATION_THEME_CHANGED: {
			update_theme();
		} break;
	}
}

void EditorExportPlatformWeb::AsyncDialog::on_confirmed() {
	PackedStringArray forced_files_array;
	for (const String &forced_file : forced_files) {
		forced_files_array.push_back(forced_file);
	}

	preset->set("async/initial_load_forced_files", forced_files_array);
}

void EditorExportPlatformWeb::AsyncDialog::on_tree_files_item_edited() {
	using TreeFilePath = TreeFilesPaths::TreeFilePath;
	using TreeFilePathValue = TreeFilePath::TreeFilePathValue;
	using TreeFilePathState = TreeFilePath::TreeFilePathState;

	if (updating) {
		return;
	}

	TreeItem *edited_item = tree_files->get_edited();
	TreeFilePath *tree_path = static_cast<TreeFilePath *>((void *)(uint64_t)edited_item->get_metadata(TREE_FILES_COLUMN_PATH));
	ERR_FAIL_NULL(tree_path);

	bool forced = edited_item->is_checked(TREE_FILES_COLUMN_IS_FORCED);
	tree_path->set_state(TreeFilePathValue::TREE_PATH_VALUE_FORCED,
			forced
					? TreeFilePathState::TREE_PATH_STATE_CHECKED
					: TreeFilePathState::TREE_PATH_STATE_UNCHECKED);

	callable_mp(this, &EditorExportPlatformWeb::AsyncDialog::tree_files_update).call_deferred();
}

void EditorExportPlatformWeb::AsyncDialog::on_tree_files_search_line_edit_text_changed(const String &p_new_text) {
	// tree_search_debounce_timer->start();

	callable_mp(this, &EditorExportPlatformWeb::AsyncDialog::tree_files_update).call_deferred();
}

void EditorExportPlatformWeb::AsyncDialog::on_tree_files_search_debounce_timer_timeout() {
	callable_mp(this, &EditorExportPlatformWeb::AsyncDialog::tree_files_update).call_deferred();
}

void EditorExportPlatformWeb::AsyncDialog::tree_files_init() {
	file_dependencies_state.clear();
	main_scene_dependencies.clear();

	HashSet<String> mandatory_initial_load_files = EditorExportPlatformWeb::_get_mandatory_initial_load_files(preset);
	file_dependencies_state.add_to_file_dependencies(mandatory_initial_load_files);

	main_scene_dependencies = file_dependencies_state.get_file_dependencies_of(mandatory_initial_load_files);

	forced_files.clear();

	PackedStringArray forced_files_array = preset->get("async/initial_load_forced_files");
	for (const String &forced_file : forced_files_array) {
		forced_files.insert(forced_file);
	}

	exported_paths.clear();
	EditorExportPlatformUtils::export_find_preset_resources(preset, exported_paths);
}

void EditorExportPlatformWeb::AsyncDialog::tree_files_update() {
	using TreeFilePath = TreeFilesPaths::TreeFilePath;
	using TreeFilePathValue = TreeFilePath::TreeFilePathValue;
	using TreeFilePathState = TreeFilePath::TreeFilePathState;

	if (updating) {
		return;
	}
	updating = true;

	tree_files_search_debounce_timer->stop();
	tree_files_remove_callbacks();

	// Update search.
	String tree_search_line_edit_text = tree_files_search_line_edit->get_text();
	tree_files_state_new = tree_search_line_edit_text.length() > 3
			? TREE_STATE_SEARCH
			: TREE_STATE_HIERARCHICAL;

	// Update `forced_files`.
	if (tree_paths.is_initialized()) {
		forced_files.clear();

		for (const TreeFilePath &tree_path : tree_paths.paths) {
			if (tree_path.is_directory) {
				continue;
			}
			TreeFilePathState tree_path_forced_state = tree_path.get_state(TreeFilePathValue::TREE_PATH_VALUE_FORCED);
			if (tree_path_forced_state != TreeFilePathState::TREE_PATH_STATE_CHECKED) {
				continue;
			}
			forced_files.insert(tree_path.get_path());
		}
	}

	file_dependencies_state.add_to_file_dependencies(forced_files);
	forced_files_dependencies = file_dependencies_state.get_file_dependencies_of(forced_files);

	HashSet<String> all_files = HashSet<String>(exported_paths);
	for (const KeyValue<String, const HashSet<String> *> &key_value : forced_files_dependencies) {
		all_files.insert(key_value.key);
	}

	bool tree_paths_was_initialized = tree_paths.is_initialized();
	if (!tree_paths_was_initialized) {
		tree_paths.initialize(all_files);
	}

	for (TreeFilePath &tree_path : tree_paths.paths) {
		if (tree_path.is_directory) {
			continue;
		}
		String path = tree_path.get_path();

		if (tree_paths_was_initialized) {
			// We set the "dependency" column state only.
			TreeFilePathState tree_path_main_state = tree_path.get_state(TreeFilePathValue::TREE_PATH_VALUE_MAIN);
			if (tree_path_main_state == TreeFilePathState::TREE_PATH_STATE_CHECKED) {
				tree_path.set_state(TreeFilePathValue::TREE_PATH_VALUE_DEPENDENCY, tree_path_main_state);
				continue;
			}

			TreeFilePathState tree_path_forced_state = tree_path.get_state(TreeFilePathValue::TREE_PATH_VALUE_FORCED);
			if (tree_path_forced_state == TreeFilePathState::TREE_PATH_STATE_CHECKED) {
				tree_path.set_state(TreeFilePathValue::TREE_PATH_VALUE_DEPENDENCY, tree_path_forced_state);
				continue;
			}
		} else {
			// We initialize each column state.
			tree_path.set_state(TreeFilePathValue::TREE_PATH_VALUE_MAIN,
					main_scene_dependencies.has(path)
							? TreeFilePathState::TREE_PATH_STATE_CHECKED
							: TreeFilePathState::TREE_PATH_STATE_UNCHECKED);

			tree_path.set_state(TreeFilePathValue::TREE_PATH_VALUE_FORCED,
					forced_files.has(path)
							? TreeFilePathState::TREE_PATH_STATE_CHECKED
							: TreeFilePathState::TREE_PATH_STATE_UNCHECKED);
		}

		tree_path.set_state(TreeFilePathValue::TREE_PATH_VALUE_DEPENDENCY,
				forced_files_dependencies.has(path)
						? TreeFilePathState::TREE_PATH_STATE_CHECKED
						: TreeFilePathState::TREE_PATH_STATE_UNCHECKED);
	}

	if (tree_files_state_new == tree_files_state_current) {
		tree_files_state_new = TREE_STATE_NONE;
	}

	bool tree_item_parents_unset = false;
	if (tree_files_had_first_update) {
		bool unset_tree_item_parents = false;
		// Check if the state has changed since the last update.
		if (tree_files_state_new == TREE_STATE_NONE) {
			// State hasn't changed.
			switch (tree_files_state_current) {
				case TREE_STATE_SEARCH: {
					// We always need to reset the tree with search.
					unset_tree_item_parents = true;
					tree_fuzzy_search.set_query(tree_search_line_edit_text);
				} break;
				case TREE_STATE_HIERARCHICAL: {
					// Do nothing.
				} break;
				case TREE_STATE_NONE: {
					ERR_FAIL();
				} break;
			}
		} else {
			unset_tree_item_parents = true;
			tree_files_state_current = tree_files_state_new;
			tree_files_state_new = TREE_STATE_NONE;
		}

		if (unset_tree_item_parents) {
			tree_item_parents_unset = true;
			tree_files_unset_tree_item_parents();
		}
	} else {
		// First update.
		tree_item_parents_unset = true;
		tree_files_init_tree_items();
	}

	if (tree_files_state_current == TREE_STATE_SEARCH) {
		tree_files_update_search();
	} else {
		tree_files_update_hierarchical(tree_item_parents_unset);
	}

	tree_files_add_callbacks();

	// Finalize updating tree.
	updating = false;
	tree_files_had_first_update = true;
}

void EditorExportPlatformWeb::AsyncDialog::tree_files_init_tree_items() {
	using TreeFilePath = TreeFilesPaths::TreeFilePath;

	TreeItem *tree_root_item = tree_files->create_item();

	for (TreeFilePath &tree_path : tree_paths.paths) {
		String path = tree_path.get_path();
		bool is_root = tree_path.parent == nullptr;
		TreeItem *tree_item;
		if (is_root) {
			tree_item = tree_root_item;
			tree_path.tree_item_in_tree = true;
		} else {
			tree_item = tree_root_item->create_child();
			tree_root_item->remove_child(tree_item);
		}
		tree_path.tree_item = tree_item;

		tree_item->set_tooltip_text(TREE_FILES_COLUMN_PATH, path);
		tree_item->set_metadata(TREE_FILES_COLUMN_PATH, (uint64_t)&tree_path);
		tree_item->set_cell_mode(TREE_FILES_COLUMN_IS_MAIN_SCENE_DEPENDENCY, TreeItem::CELL_MODE_CHECK);
		tree_item->set_text_alignment(TREE_FILES_COLUMN_IS_MAIN_SCENE_DEPENDENCY, HORIZONTAL_ALIGNMENT_CENTER);
		tree_item->set_editable(TREE_FILES_COLUMN_IS_MAIN_SCENE_DEPENDENCY, false);
		tree_item->set_cell_mode(TREE_FILES_COLUMN_IS_FORCED, TreeItem::CELL_MODE_CHECK);
		tree_item->set_text_alignment(TREE_FILES_COLUMN_IS_FORCED, HORIZONTAL_ALIGNMENT_CENTER);
		tree_item->set_editable(TREE_FILES_COLUMN_IS_FORCED, true);
		tree_item->set_cell_mode(TREE_FILES_COLUMN_IS_DEPENDENCY, TreeItem::CELL_MODE_CHECK);
		tree_item->set_text_alignment(TREE_FILES_COLUMN_IS_DEPENDENCY, HORIZONTAL_ALIGNMENT_CENTER);
		tree_item->set_editable(TREE_FILES_COLUMN_IS_DEPENDENCY, false);

		if (tree_path.is_directory) {
			tree_item->set_icon(TREE_FILES_COLUMN_PATH, get_theme_icon(SNAME("folder"), SNAME("FileDialog")));
			tree_item->set_text(TREE_FILES_COLUMN_PATH, is_root ? path : path + "/");
		} else {
			String type = EditorFileSystem::get_singleton()->get_file_type(path);
			tree_item->set_icon(TREE_FILES_COLUMN_PATH, EditorNode::get_singleton()->get_class_icon(type));
			tree_item->set_text(TREE_FILES_COLUMN_PATH, path.get_file());
		}
	}
}

void EditorExportPlatformWeb::AsyncDialog::tree_files_unset_tree_item_parents() {
	using TreeFilePath = TreeFilesPaths::TreeFilePath;

	for (TreeFilePath &tree_path : tree_paths.paths) {
		tree_path.tree_item_remove_from_tree();
	}
}

#define SET_TREE_ITEM_STATE(m_tree_path, m_tree_item, m_tree_column, m_tree_path_value) \
	switch ((m_tree_path)->get_state(TreeFilePathValue::m_tree_path_value)) {           \
		case TreeFilePathState::TREE_PATH_STATE_CHECKED: {                              \
			(m_tree_item)->set_checked(TreeFilesColumn::m_tree_column, true);           \
			(m_tree_item)->set_indeterminate(TreeFilesColumn::m_tree_column, false);    \
		} break;                                                                        \
		case TreeFilePathState::TREE_PATH_STATE_INDETERMINATE: {                        \
			(m_tree_item)->set_checked(TreeFilesColumn::m_tree_column, false);          \
			(m_tree_item)->set_indeterminate(TreeFilesColumn::m_tree_column, true);     \
		} break;                                                                        \
		case TreeFilePathState::TREE_PATH_STATE_UNCHECKED: {                            \
			(m_tree_item)->set_checked(TreeFilesColumn::m_tree_column, false);          \
			(m_tree_item)->set_indeterminate(TreeFilesColumn::m_tree_column, false);    \
		} break;                                                                        \
	}                                                                                   \
	(void)0

void EditorExportPlatformWeb::AsyncDialog::tree_files_update_hierarchical(bool p_add_tree_items_to_tree) {
	using TreeFilePath = TreeFilesPaths::TreeFilePath;
	using TreeFilePathState = TreeFilePath::TreeFilePathState;
	using TreeFilePathValue = TreeFilePath::TreeFilePathValue;

	tree_files->set_hide_root(false);

	uint64_t main_size = 0;
	uint64_t forced_size = 0;
	uint64_t forced_size_added = 0;
	uint64_t dependencies_size = 0;

	uint64_t paths_ordered_size = tree_paths.paths_ordered.size();

	for (uint64_t i = 0; i < paths_ordered_size; i++) {
		String &path = tree_paths.paths_ordered[i];

		TreeFilePath *tree_path = tree_paths.paths_map[path];
		TreeItem *tree_item = tree_path->tree_item;

		if (p_add_tree_items_to_tree && tree_path->parent != nullptr) {
			TreeFilePath *tree_parent_path = tree_paths.paths_map[tree_path->parent->get_path()];
			TreeItem *tree_parent_item = tree_parent_path->tree_item;
			tree_parent_item->add_child(tree_item);
			tree_path->tree_item_in_tree = true;
		}

		if (!tree_path->is_directory) {
			tree_item->set_text(TREE_FILES_COLUMN_PATH, path.get_basename());
		}

		SET_TREE_ITEM_STATE(tree_path, tree_item, TREE_FILES_COLUMN_IS_MAIN_SCENE_DEPENDENCY, TREE_PATH_VALUE_MAIN);
		SET_TREE_ITEM_STATE(tree_path, tree_item, TREE_FILES_COLUMN_IS_FORCED, TREE_PATH_VALUE_FORCED);
		SET_TREE_ITEM_STATE(tree_path, tree_item, TREE_FILES_COLUMN_IS_DEPENDENCY, TREE_PATH_VALUE_DEPENDENCY);

		tree_path->tree_item_update();

		if (tree_path->is_directory) {
			continue;
		}

		bool is_main = false;
		if (tree_path->get_state(TreeFilePathValue::TREE_PATH_VALUE_MAIN) == TreeFilePathState::TREE_PATH_STATE_CHECKED) {
			is_main = true;
			main_size += tree_path->get_path_file_size();
		}
		if (tree_path->get_state(TreeFilePathValue::TREE_PATH_VALUE_FORCED) == TreeFilePathState::TREE_PATH_STATE_CHECKED) {
			uint64_t forced_file_size = tree_path->get_path_file_size();
			forced_size += forced_file_size;
			if (!is_main) {
				forced_size_added += forced_file_size;
			}
		}
		if (tree_path->get_state(TreeFilePathValue::TREE_PATH_VALUE_DEPENDENCY) == TreeFilePathState::TREE_PATH_STATE_CHECKED) {
			dependencies_size += tree_path->get_path_file_size();
		}
	}

	tree_sizes_item->set_text(TREE_SIZES_COLUMN_MAIN, String::humanize_size(main_size));
	tree_sizes_item->set_text(TREE_SIZES_COLUMN_FORCED, String::humanize_size(forced_size));
	tree_sizes_item->set_text(TREE_SIZES_COLUMN_FORCED_WITHOUT_MAIN, String::humanize_size(forced_size_added));
	tree_sizes_item->set_text(TREE_SIZES_COLUMN_TOTAL, String::humanize_size(dependencies_size));
}

void EditorExportPlatformWeb::AsyncDialog::tree_files_update_search() {
	using TreeFilePath = TreeFilesPaths::TreeFilePath;
	using TreeFilePathState = TreeFilePath::TreeFilePathState;
	using TreeFilePathValue = TreeFilePath::TreeFilePathValue;

	tree_files->set_hide_root(true);

	Vector<FuzzySearchTarget> search_targets;
	Vector<FuzzySearchResult> search_results;

	for (const String &path : tree_paths.paths_ordered) {
		if (path == PREFIX_RES) {
			continue;
		}
		search_targets.push_back({ path.substr(PREFIX_RES_LENGTH).get_file(), tree_paths.paths_map[path] });
	}
	tree_fuzzy_search.search_all(search_targets, search_results);

	TreeFilePath *tree_root_path = tree_paths.paths_map[PREFIX_RES];
	TreeItem *tree_root_item = tree_root_path->tree_item;

	uint64_t main_size = 0;
	uint64_t forced_size = 0;
	uint64_t forced_size_added = 0;
	uint64_t dependencies_size = 0;

	tree_root_path->tree_item_update();

	for (const FuzzySearchResult &search_result : search_results) {
		String path = PREFIX_RES + search_result.target.string;
		TreeFilePath *tree_path = static_cast<TreeFilePath *>(search_result.target.userdata);
		TreeItem *tree_item = tree_path->tree_item;
		tree_root_item->add_child(tree_item);
		tree_path->tree_item_in_tree = true;

		if (!tree_path->is_directory) {
			tree_item->set_text(TREE_FILES_COLUMN_PATH, path);
		}

		SET_TREE_ITEM_STATE(tree_path, tree_item, TREE_FILES_COLUMN_IS_MAIN_SCENE_DEPENDENCY, TREE_PATH_VALUE_MAIN);
		SET_TREE_ITEM_STATE(tree_path, tree_item, TREE_FILES_COLUMN_IS_FORCED, TREE_PATH_VALUE_FORCED);
		SET_TREE_ITEM_STATE(tree_path, tree_item, TREE_FILES_COLUMN_IS_DEPENDENCY, TREE_PATH_VALUE_DEPENDENCY);

		tree_path->tree_item_update();

		if (tree_path->is_directory) {
			continue;
		}

		bool is_main = false;
		if (tree_path->get_state(TreeFilePathValue::TREE_PATH_VALUE_MAIN) == TreeFilePathState::TREE_PATH_STATE_CHECKED) {
			is_main = true;
			main_size += tree_path->get_path_file_size();
		}
		if (tree_path->get_state(TreeFilePathValue::TREE_PATH_VALUE_FORCED) == TreeFilePathState::TREE_PATH_STATE_CHECKED) {
			uint64_t forced_file_size = tree_path->get_path_file_size();
			forced_size += forced_file_size;
			if (!is_main) {
				forced_size_added += forced_file_size;
			}
		}
		if (tree_path->get_state(TreeFilePathValue::TREE_PATH_VALUE_DEPENDENCY) == TreeFilePathState::TREE_PATH_STATE_CHECKED) {
			dependencies_size += tree_path->get_path_file_size();
		}
	}

	tree_sizes_item->set_text(TREE_SIZES_COLUMN_MAIN, String::humanize_size(main_size));
	tree_sizes_item->set_text(TREE_SIZES_COLUMN_FORCED, String::humanize_size(forced_size));
	tree_sizes_item->set_text(TREE_SIZES_COLUMN_FORCED_WITHOUT_MAIN, String::humanize_size(forced_size_added));
	tree_sizes_item->set_text(TREE_SIZES_COLUMN_TOTAL, String::humanize_size(dependencies_size));
}
#undef SET_TREE_ITEM_STATE

void EditorExportPlatformWeb::AsyncDialog::tree_files_add_callbacks() {
#define ADD_CALLBACK(m_target, m_event, m_callable)                             \
	{                                                                           \
		Callable _m_callable = (m_callable);                                    \
		if (!(m_target)->is_connected(SceneStringName(m_event), _m_callable)) { \
			(m_target)->connect(SceneStringName(m_event), _m_callable);         \
		}                                                                       \
	}                                                                           \
	(void)0

	ADD_CALLBACK(tree_files, item_edited, callable_mp(this, &EditorExportPlatformWeb::AsyncDialog::on_tree_files_item_edited));
	ADD_CALLBACK(tree_files_search_line_edit, text_changed, callable_mp(this, &EditorExportPlatformWeb::AsyncDialog::on_tree_files_search_line_edit_text_changed));
	ADD_CALLBACK(tree_files_search_debounce_timer, timeout, callable_mp(this, &EditorExportPlatformWeb::AsyncDialog::on_tree_files_search_debounce_timer_timeout));

#undef ADD_CALLBACK
}

void EditorExportPlatformWeb::AsyncDialog::tree_files_remove_callbacks() {
#define REMOVE_CALLBACK(m_target, m_event, m_callable)                         \
	{                                                                          \
		Callable _m_callable = (m_callable);                                   \
		if ((m_target)->is_connected(SceneStringName(m_event), _m_callable)) { \
			(m_target)->disconnect(SceneStringName(m_event), _m_callable);     \
		}                                                                      \
	}                                                                          \
	(void)0

	REMOVE_CALLBACK(tree_files, item_edited, callable_mp(this, &EditorExportPlatformWeb::AsyncDialog::on_tree_files_item_edited));
	REMOVE_CALLBACK(tree_files_search_line_edit, text_changed, callable_mp(this, &EditorExportPlatformWeb::AsyncDialog::on_tree_files_search_line_edit_text_changed));
	REMOVE_CALLBACK(tree_files_search_debounce_timer, timeout, callable_mp(this, &EditorExportPlatformWeb::AsyncDialog::on_tree_files_search_debounce_timer_timeout));

#undef REMOVE_CALLBACK
}

void EditorExportPlatformWeb::AsyncDialog::update_files_size_forced_size_label_text(uint64_t p_size, uint64_t p_added_size) {
	if (p_size == p_added_size) {
		file_size_forced_size_label->set_text(String::humanize_size(p_size));
		return;
	}

	file_size_forced_size_label->set_text(vformat(TTRC("%s (%s without main duplicates)"), String::humanize_size(p_size), String::humanize_size(p_added_size)));
}

void EditorExportPlatformWeb::AsyncDialog::update_theme() {
	set_min_size(Size2i(600 * EDSCALE, 500 * EDSCALE));

	main_container->add_theme_constant_override("margin_top", MAIN_CONTAINER_MARGIN_TOP);
	main_container->add_theme_constant_override("margin_left", MAIN_CONTAINER_MARGIN_SIDES);
	main_container->add_theme_constant_override("margin_right", MAIN_CONTAINER_MARGIN_SIDES);
	main_container->add_theme_constant_override("margin_bottom", MAIN_CONTAINER_MARGIN_BOTTOM);

	tree_files_margin_container->add_theme_constant_override("margin_bottom", 10 * EDSCALE);

	tree_files->set_custom_minimum_size(Size2(1, 75 * EDSCALE));
	tree_files->set_column_custom_minimum_width(TREE_FILES_COLUMN_PATH, 50 * EDSCALE);

	tree_sizes_margin_container->add_theme_constant_override("margin_bottom", 10 * EDSCALE);

	tree_sizes->set_custom_minimum_size(Size2(1, 75 * EDSCALE));
	tree_sizes->set_column_custom_minimum_width(TREE_FILES_COLUMN_PATH, 50 * EDSCALE);
}

EditorExportPlatformWeb::AsyncDialog::AsyncDialog(EditorExportPlatformWeb *p_export_platform) :
		export_platform(p_export_platform) {
	preset = EditorNode::get_singleton()->get_project_export_dialog()->get_current_preset();

	set_title(TTRC("Edit Initial Load Resources"));
	set_flag(FLAG_MAXIMIZE_DISABLED, false);
	set_clamp_to_embedder(true);
	set_min_size(Size2i(600 * EDSCALE, 500 * EDSCALE));

	main_container = memnew(MarginContainer);
	add_child(main_container);
	main_container->set_h_size_flags(Control::SIZE_EXPAND_FILL);
	main_container->set_v_size_flags(Control::SIZE_EXPAND_FILL);

	VBoxContainer *main_vbox_container = memnew(VBoxContainer);
	main_container->add_child(main_vbox_container);
	main_vbox_container->set_h_size_flags(Control::SIZE_EXPAND_FILL);
	main_vbox_container->set_v_size_flags(Control::SIZE_EXPAND_FILL);

	// Files tree.
	VBoxContainer *tree_files_main_container = memnew(VBoxContainer);
	main_vbox_container->add_margin_child(TTRC("Initial load files"), tree_files_main_container, true);
	tree_files_main_container->set_h_size_flags(Control::SIZE_EXPAND_FILL);
	tree_files_main_container->set_v_size_flags(Control::SIZE_EXPAND_FILL);

	tree_files_search_debounce_timer = memnew(Timer);
	tree_files_main_container->add_child(tree_files_search_debounce_timer);
	tree_files_search_debounce_timer->set_wait_time(TREE_SEARCH_DEBOUNCE_TIME_S);
	tree_files_search_debounce_timer->set_autostart(false);
	tree_files_search_debounce_timer->set_one_shot(true);

	tree_files_search_line_edit = memnew(LineEdit);
	tree_files_main_container->add_child(tree_files_search_line_edit);
	tree_files_search_line_edit->set_placeholder(TTRC("Filter Files"));
	tree_files_search_line_edit->set_clear_button_enabled(true);
	tree_files_search_line_edit->set_h_size_flags(Control::SIZE_EXPAND_FILL);

	tree_files_margin_container = memnew(MarginContainer);
	tree_files_main_container->add_child(tree_files_margin_container);
	tree_files_margin_container->set_v_size_flags(Control::SIZE_EXPAND_FILL);

	tree_files = memnew(Tree);
	tree_files_margin_container->add_child(tree_files);
	tree_files->set_auto_translate_mode(AUTO_TRANSLATE_MODE_DISABLED);
	tree_files->set_hide_root(false);
	tree_files->set_select_mode(Tree::SelectMode::SELECT_ROW);
	tree_files->set_allow_reselect(true);
	tree_files->set_custom_minimum_size(Size2(1, 75 * EDSCALE));
	tree_files->set_v_size_flags(Control::SIZE_EXPAND_FILL);
	tree_files->set_columns(4);
	tree_files->set_column_titles_visible(true);
	tree_files->set_column_title(TREE_FILES_COLUMN_PATH, TTRC("Path"));
	tree_files->set_column_title(TREE_FILES_COLUMN_IS_MAIN_SCENE_DEPENDENCY, TTRC("Loaded"));
	tree_files->set_column_title(TREE_FILES_COLUMN_IS_FORCED, TTRC("Force"));
	tree_files->set_column_title(TREE_FILES_COLUMN_IS_DEPENDENCY, TTRC("Dependency"));
	tree_files->set_column_title_tooltip_text(TREE_FILES_COLUMN_IS_MAIN_SCENE_DEPENDENCY, TTRC("Loaded resources are resources that depend on the main scene. These resources will be loaded initially automatically."));
	tree_files->set_column_title_tooltip_text(TREE_FILES_COLUMN_IS_FORCED, TTRC("Forced resources are resources that will be available after the first load, no matter if they are or not a main scene dependency."));
	tree_files->set_column_title_tooltip_text(TREE_FILES_COLUMN_IS_DEPENDENCY, TTRC("These resources are the ones currently initially loaded. This column includes the resources from the first column and the ones from the second (including their dependencies)."));
	tree_files->set_column_expand(TREE_FILES_COLUMN_PATH, true);
	tree_files->set_column_expand(TREE_FILES_COLUMN_IS_MAIN_SCENE_DEPENDENCY, false);
	tree_files->set_column_expand(TREE_FILES_COLUMN_IS_FORCED, false);
	tree_files->set_column_expand(TREE_FILES_COLUMN_IS_DEPENDENCY, false);

	tree_fuzzy_search.allow_subsequences = true;
	tree_fuzzy_search.max_misses = TREE_SEARCH_FUZZY_SEARCH_MAX_MISSES;

	// Sizes tree.
	VBoxContainer *tree_sizes_main_container = memnew(VBoxContainer);
	main_vbox_container->add_margin_child(TTRC("Initial load size"), tree_sizes_main_container, false);

	tree_sizes_margin_container = memnew(MarginContainer);
	tree_sizes_main_container->add_child(tree_sizes_margin_container);

	tree_sizes = memnew(Tree);
	tree_sizes_margin_container->add_child(tree_sizes);
	tree_sizes->set_hide_root(false);
	tree_sizes->set_select_mode(Tree::SelectMode::SELECT_SINGLE);
	tree_sizes->set_allow_reselect(true);
	tree_sizes->set_custom_minimum_size(Size2(1, 75 * EDSCALE));
	tree_sizes->set_v_size_flags(Control::SIZE_EXPAND_FILL);
	tree_sizes->set_columns(4);
	tree_sizes->set_column_titles_visible(true);
	tree_sizes->set_column_title(TREE_SIZES_COLUMN_MAIN, TTRC("Main"));
	tree_sizes->set_column_title(TREE_SIZES_COLUMN_FORCED, TTRC("Forced"));
	tree_sizes->set_column_title(TREE_SIZES_COLUMN_FORCED_WITHOUT_MAIN, TTRC("Force (without main)"));
	tree_sizes->set_column_title(TREE_SIZES_COLUMN_TOTAL, TTRC("Total"));
	tree_sizes->set_column_expand(TREE_SIZES_COLUMN_MAIN, true);
	tree_sizes->set_column_expand(TREE_SIZES_COLUMN_FORCED, true);
	tree_sizes->set_column_expand(TREE_SIZES_COLUMN_FORCED_WITHOUT_MAIN, true);
	tree_sizes->set_column_expand(TREE_SIZES_COLUMN_TOTAL, true);
	tree_sizes->set_column_expand_ratio(TREE_SIZES_COLUMN_MAIN, 1);
	tree_sizes->set_column_expand_ratio(TREE_SIZES_COLUMN_FORCED, 1);
	tree_sizes->set_column_expand_ratio(TREE_SIZES_COLUMN_FORCED_WITHOUT_MAIN, 1);
	tree_sizes->set_column_expand_ratio(TREE_SIZES_COLUMN_TOTAL, 1);

	tree_sizes_item = tree_sizes->create_item();
	tree_sizes_item->set_disable_folding(true);
	tree_sizes_item->set_text_alignment(TREE_SIZES_COLUMN_MAIN, HorizontalAlignment::HORIZONTAL_ALIGNMENT_CENTER);
	tree_sizes_item->set_text_alignment(TREE_SIZES_COLUMN_FORCED, HorizontalAlignment::HORIZONTAL_ALIGNMENT_CENTER);
	tree_sizes_item->set_text_alignment(TREE_SIZES_COLUMN_FORCED_WITHOUT_MAIN, HorizontalAlignment::HORIZONTAL_ALIGNMENT_CENTER);
	tree_sizes_item->set_text_alignment(TREE_SIZES_COLUMN_TOTAL, HorizontalAlignment::HORIZONTAL_ALIGNMENT_CENTER);

	tree_files_add_callbacks();
}

/**
 * EditorExportPlatformWeb
 */

Error EditorExportPlatformWeb::_extract_template(const String &p_template, const String &p_dir, const String &p_name, bool pwa) {
	Ref<FileAccess> io_fa;
	zlib_filefunc_def io = zipio_create_io(&io_fa);
	unzFile pkg = unzOpen2(p_template.utf8().get_data(), &io);

	if (!pkg) {
		add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("Prepare Templates"), vformat(TTR("Could not open template for export: \"%s\"."), p_template));
		return ERR_FILE_NOT_FOUND;
	}

	if (unzGoToFirstFile(pkg) != UNZ_OK) {
		add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("Prepare Templates"), vformat(TTR("Invalid export template: \"%s\"."), p_template));
		unzClose(pkg);
		return ERR_FILE_CORRUPT;
	}

	do {
		//get filename
		unz_file_info info;
		char fname[16384];
		unzGetCurrentFileInfo(pkg, &info, fname, 16384, nullptr, 0, nullptr, 0);

		String file = String::utf8(fname);

		// Skip folders.
		if (file.ends_with("/")) {
			continue;
		}

		// Skip service worker and offline page if not exporting pwa.
		if (!pwa && (file == "godot.service.worker.js" || file == "godot.offline.html")) {
			continue;
		}
		Vector<uint8_t> data;
		data.resize(info.uncompressed_size);

		//read
		unzOpenCurrentFile(pkg);
		unzReadCurrentFile(pkg, data.ptrw(), data.size());
		unzCloseCurrentFile(pkg);

		//write
		String dst = p_dir.path_join(file.replace("godot", p_name));
		Ref<FileAccess> f = FileAccess::open(dst, FileAccess::WRITE);
		if (f.is_null()) {
			add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("Prepare Templates"), vformat(TTR("Could not write file: \"%s\"."), dst));
			unzClose(pkg);
			return ERR_FILE_CANT_WRITE;
		}
		f->store_buffer(data.ptr(), data.size());

	} while (unzGoToNextFile(pkg) == UNZ_OK);
	unzClose(pkg);
	return OK;
}

Error EditorExportPlatformWeb::_write_or_error(const uint8_t *p_content, int p_size, String p_path) {
	Ref<FileAccess> f = FileAccess::open(p_path, FileAccess::WRITE);
	if (f.is_null()) {
		add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Could not write file: \"%s\"."), p_path));
		return ERR_FILE_CANT_WRITE;
	}
	f->store_buffer(p_content, p_size);
	return OK;
}

void EditorExportPlatformWeb::_replace_strings(const HashMap<String, String> &p_replaces, Vector<uint8_t> &r_template) {
	String str_template = String::utf8(reinterpret_cast<const char *>(r_template.ptr()), r_template.size());
	String out;
	Vector<String> lines = str_template.split("\n");
	for (int i = 0; i < lines.size(); i++) {
		String current_line = lines[i];
		for (const KeyValue<String, String> &E : p_replaces) {
			current_line = current_line.replace(E.key, E.value);
		}
		out += current_line + "\n";
	}
	CharString cs = out.utf8();
	r_template.resize(cs.length());
	for (int i = 0; i < cs.length(); i++) {
		r_template.write[i] = cs[i];
	}
}

void EditorExportPlatformWeb::_fix_html(Vector<uint8_t> &p_html, const Ref<EditorExportPreset> &p_preset, const String &p_name, bool p_debug, BitField<EditorExportPlatform::DebugFlags> p_flags, const Vector<SharedObject> p_shared_objects, const Dictionary &p_file_sizes, const Dictionary &p_async_pck_data) {
	// Engine.js config
	Dictionary config;
	Array libs;
	for (int i = 0; i < p_shared_objects.size(); i++) {
		libs.push_back(p_shared_objects[i].path.get_file());
	}
	Vector<String> flags = gen_export_flags(p_flags & (~EditorExportPlatformData::DEBUG_FLAG_DUMB_CLIENT));
	Array args;
	for (int i = 0; i < flags.size(); i++) {
		args.push_back(flags[i]);
	}
	config["canvasResizePolicy"] = p_preset->get("html/canvas_resize_policy");
	config["experimentalVK"] = p_preset->get("html/experimental_virtual_keyboard");
	config["focusCanvas"] = p_preset->get("html/focus_canvas_on_start");
	config["gdextensionLibs"] = libs;
	config["executable"] = p_name;
	config["args"] = args;
	config["fileSizes"] = p_file_sizes;
	config["ensureCrossOriginIsolationHeaders"] = (bool)p_preset->get("progressive_web_app/ensure_cross_origin_isolation_headers");

	config["godotPoolSize"] = p_preset->get("threads/godot_pool_size");
	config["emscriptenPoolSize"] = p_preset->get("threads/emscripten_pool_size");

	AsyncLoadSetting async_initial_load_mode = (AsyncLoadSetting)(int)p_preset->get("async/initial_load_mode");
	switch (async_initial_load_mode) {
		case ASYNC_LOAD_SETTING_LOAD_EVERYTHING: {
			config["mainPack"] = p_name + ".pck";
		} break;
		case ASYNC_LOAD_SETTING_ONLY_LOAD_MAIN_SCENE_DEPENDENCIES_AND_SPECIFIED_RESOURCES: {
			config["mainPack"] = p_name + ".asyncpck";
			config["asyncPckData"] = p_async_pck_data;
		} break;
	}

	String head_include;
	if (p_preset->get("html/export_icon")) {
		head_include += "<link id=\"-gd-engine-icon\" rel=\"icon\" type=\"image/png\" href=\"" + p_name + ".icon.png\" />\n";
		head_include += "<link rel=\"apple-touch-icon\" href=\"" + p_name + ".apple-touch-icon.png\"/>\n";
	}
	if (p_preset->get("progressive_web_app/enabled")) {
		head_include += "<link rel=\"manifest\" href=\"" + p_name + ".manifest.json\">\n";
		config["serviceWorker"] = p_name + ".service.worker.js";
	}

	// Replaces HTML string
	const String str_config = Variant(config).to_json_string();
	const String custom_head_include = p_preset->get("html/head_include");
	HashMap<String, String> replaces;
	replaces["$GODOT_URL"] = p_name + ".js";
	replaces["$GODOT_PROJECT_NAME"] = get_project_setting(p_preset, "application/config/name");
	replaces["$GODOT_HEAD_INCLUDE"] = head_include + custom_head_include;
	replaces["$GODOT_CONFIG"] = str_config;
	replaces["$GODOT_SPLASH_COLOR"] = "#" + Color(get_project_setting(p_preset, "application/boot_splash/bg_color")).to_html(false);

	Vector<String> godot_splash_classes;
	godot_splash_classes.push_back("show-image--" + String(get_project_setting(p_preset, "application/boot_splash/show_image")));
	RenderingServer::SplashStretchMode boot_splash_stretch_mode = get_project_setting(p_preset, "application/boot_splash/stretch_mode");
	godot_splash_classes.push_back("fullsize--" + String(((boot_splash_stretch_mode != RenderingServer::SplashStretchMode::SPLASH_STRETCH_MODE_DISABLED) ? "true" : "false")));
	godot_splash_classes.push_back("use-filter--" + String(get_project_setting(p_preset, "application/boot_splash/use_filter")));
	replaces["$GODOT_SPLASH_CLASSES"] = String(" ").join(godot_splash_classes);
	replaces["$GODOT_SPLASH"] = p_name + ".png";

	if (p_preset->get("variant/thread_support")) {
		replaces["$GODOT_THREADS_ENABLED"] = "true";
	} else {
		replaces["$GODOT_THREADS_ENABLED"] = "false";
	}

	_replace_strings(replaces, p_html);
}

Error EditorExportPlatformWeb::_add_manifest_icon(const Ref<EditorExportPreset> &p_preset, const String &p_path, const String &p_icon, int p_size, Array &r_arr) {
	const String name = p_path.get_file().get_basename();
	const String icon_name = vformat("%s.%dx%d.png", name, p_size, p_size);
	const String icon_dest = p_path.get_base_dir().path_join(icon_name);

	Ref<Image> icon;
	if (!p_icon.is_empty()) {
		Error err = OK;
		icon = _load_icon_or_splash_image(p_icon, &err);
		if (err != OK || icon.is_null() || icon->is_empty()) {
			add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("Icon Creation"), vformat(TTR("Could not read file: \"%s\"."), p_icon));
			return err;
		}
		if (icon->get_width() != p_size || icon->get_height() != p_size) {
			icon->resize(p_size, p_size);
		}
	} else {
		icon = _get_project_icon(p_preset);
		icon->resize(p_size, p_size);
	}
	const Error err = icon->save_png(icon_dest);
	if (err != OK) {
		add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("Icon Creation"), vformat(TTR("Could not write file: \"%s\"."), icon_dest));
		return err;
	}
	Dictionary icon_dict;
	icon_dict["sizes"] = vformat("%dx%d", p_size, p_size);
	icon_dict["type"] = "image/png";
	icon_dict["src"] = icon_name;
	r_arr.push_back(icon_dict);
	return err;
}

Error EditorExportPlatformWeb::_build_pwa(const Ref<EditorExportPreset> &p_preset, const String p_path, const Vector<SharedObject> &p_shared_objects) {
	String proj_name = get_project_setting(p_preset, "application/config/name");
	if (proj_name.is_empty()) {
		proj_name = "Godot Game";
	}

	// Service worker
	const String dir = p_path.get_base_dir();
	const String name = p_path.get_file().get_basename();
	bool extensions = (bool)p_preset->get("variant/extensions_support");
	bool ensure_crossorigin_isolation_headers = (bool)p_preset->get("progressive_web_app/ensure_cross_origin_isolation_headers");
	HashMap<String, String> replaces;
	replaces["___GODOT_VERSION___"] = String::num_int64(OS::get_singleton()->get_unix_time()) + "|" + String::num_int64(OS::get_singleton()->get_ticks_usec());
	replaces["___GODOT_NAME___"] = proj_name.substr(0, 16);
	replaces["___GODOT_OFFLINE_PAGE___"] = name + ".offline.html";
	replaces["___GODOT_ENSURE_CROSSORIGIN_ISOLATION_HEADERS___"] = ensure_crossorigin_isolation_headers ? "true" : "false";

	// Files cached during worker install.
	Array cache_files = {
		name + ".html",
		name + ".js",
		name + ".offline.html"
	};
	if (p_preset->get("html/export_icon")) {
		cache_files.push_back(name + ".icon.png");
		cache_files.push_back(name + ".apple-touch-icon.png");
	}

	cache_files.push_back(name + ".audio.worklet.js");
	cache_files.push_back(name + ".audio.position.worklet.js");
	replaces["___GODOT_CACHE___"] = Variant(cache_files).to_json_string();

	// Heavy files that are cached on demand.
	Array opt_cache_files = {
		name + ".wasm",
	};

	AsyncLoadSetting async_initial_load_mode = (AsyncLoadSetting)(int)p_preset->get("async/initial_load_mode");
	switch (async_initial_load_mode) {
		case ASYNC_LOAD_SETTING_LOAD_EVERYTHING: {
			opt_cache_files.push_back(name + ".pck");
		} break;

		case ASYNC_LOAD_SETTING_ONLY_LOAD_MAIN_SCENE_DEPENDENCIES_AND_SPECIFIED_RESOURCES: {
			// TODO: Add AsyncPCK contents to the cache.
		} break;
	}

	if (extensions) {
		opt_cache_files.push_back(name + ".side.wasm");
		for (int i = 0; i < p_shared_objects.size(); i++) {
			opt_cache_files.push_back(p_shared_objects[i].path.get_file());
		}
	}
	replaces["___GODOT_OPT_CACHE___"] = Variant(opt_cache_files).to_json_string();

	const String sw_path = dir.path_join(name + ".service.worker.js");
	Vector<uint8_t> sw;
	{
		Ref<FileAccess> f = FileAccess::open(sw_path, FileAccess::READ);
		if (f.is_null()) {
			add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("PWA"), vformat(TTR("Could not read file: \"%s\"."), sw_path));
			return ERR_FILE_CANT_READ;
		}
		sw.resize(f->get_length());
		f->get_buffer(sw.ptrw(), sw.size());
	}
	_replace_strings(replaces, sw);
	Error err = _write_or_error(sw.ptr(), sw.size(), dir.path_join(name + ".service.worker.js"));
	if (err != OK) {
		// Message is supplied by the subroutine method.
		return err;
	}

	// Custom offline page
	const String offline_page = p_preset->get("progressive_web_app/offline_page");
	if (!offline_page.is_empty()) {
		Ref<DirAccess> da = DirAccess::create(DirAccess::ACCESS_FILESYSTEM);
		const String offline_dest = dir.path_join(name + ".offline.html");
		err = da->copy(ProjectSettings::get_singleton()->globalize_path(offline_page), offline_dest);
		if (err != OK) {
			add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("PWA"), vformat(TTR("Could not read file: \"%s\"."), offline_dest));
			return err;
		}
	}

	// Manifest
	const char *modes[4] = { "fullscreen", "standalone", "minimal-ui", "browser" };
	const char *orientations[3] = { "any", "landscape", "portrait" };
	const int display = CLAMP(int(p_preset->get("progressive_web_app/display")), 0, 4);
	const int orientation = CLAMP(int(p_preset->get("progressive_web_app/orientation")), 0, 3);

	Dictionary manifest;
	manifest["name"] = proj_name;
	manifest["start_url"] = "./" + name + ".html";
	manifest["display"] = String::utf8(modes[display]);
	manifest["orientation"] = String::utf8(orientations[orientation]);
	manifest["background_color"] = "#" + p_preset->get("progressive_web_app/background_color").operator Color().to_html(false);

	Array icons_arr;
	const String icon144_path = p_preset->get("progressive_web_app/icon_144x144");
	err = _add_manifest_icon(p_preset, p_path, icon144_path, 144, icons_arr);
	if (err != OK) {
		// Message is supplied by the subroutine method.
		return err;
	}
	const String icon180_path = p_preset->get("progressive_web_app/icon_180x180");
	err = _add_manifest_icon(p_preset, p_path, icon180_path, 180, icons_arr);
	if (err != OK) {
		// Message is supplied by the subroutine method.
		return err;
	}
	const String icon512_path = p_preset->get("progressive_web_app/icon_512x512");
	err = _add_manifest_icon(p_preset, p_path, icon512_path, 512, icons_arr);
	if (err != OK) {
		// Message is supplied by the subroutine method.
		return err;
	}
	manifest["icons"] = icons_arr;

	CharString cs = Variant(manifest).to_json_string().utf8();
	err = _write_or_error((const uint8_t *)cs.get_data(), cs.length(), dir.path_join(name + ".manifest.json"));
	if (err != OK) {
		// Message is supplied by the subroutine method.
		return err;
	}

	return OK;
}

void EditorExportPlatformWeb::get_preset_features(const Ref<EditorExportPreset> &p_preset, List<String> *r_features) const {
	if (p_preset->get("vram_texture_compression/for_desktop")) {
		r_features->push_back("s3tc");
		r_features->push_back("bptc");
	}
	if (p_preset->get("vram_texture_compression/for_mobile")) {
		r_features->push_back("etc2");
		r_features->push_back("astc");
	}
	if (p_preset->get("variant/thread_support").operator bool()) {
		r_features->push_back("threads");
	} else {
		r_features->push_back("nothreads");
	}
	if (p_preset->get("variant/extensions_support").operator bool()) {
		r_features->push_back("web_extensions");
	} else {
		r_features->push_back("web_noextensions");
	}
	r_features->push_back("wasm32");
}

void EditorExportPlatformWeb::get_export_options(List<ExportOption> *r_options) const {
	r_options->push_back(ExportOption(PropertyInfo(Variant::STRING, "custom_template/debug", PROPERTY_HINT_GLOBAL_FILE, "*.zip"), ""));
	r_options->push_back(ExportOption(PropertyInfo(Variant::STRING, "custom_template/release", PROPERTY_HINT_GLOBAL_FILE, "*.zip"), ""));

	r_options->push_back(ExportOption(PropertyInfo(Variant::INT, "async/initial_load_mode", PROPERTY_HINT_ENUM, "Load Everything,Only Load Main Scene Dependencies And Specified Resources"), 0, true));
	r_options->push_back(ExportOption(PropertyInfo(Variant::CALLABLE, "async/initial_load_edit_button", PROPERTY_HINT_TOOL_BUTTON, vformat("%s,Edit", TTRC("Edit Initial Load Resources")), PROPERTY_USAGE_EDITOR | PROPERTY_USAGE_NO_INSTANCE_STATE), callable_mp(const_cast<EditorExportPlatformWeb *>(this), &EditorExportPlatformWeb::_open_async_dialog)));
	r_options->push_back(ExportOption(PropertyInfo(Variant::ARRAY, "async/initial_load_forced_files", PROPERTY_HINT_NONE, "", PROPERTY_USAGE_NO_EDITOR), Array()));

	r_options->push_back(ExportOption(PropertyInfo(Variant::BOOL, "variant/extensions_support"), false)); // GDExtension support.
	r_options->push_back(ExportOption(PropertyInfo(Variant::BOOL, "variant/thread_support"), false, true)); // Thread support (i.e. run with or without COEP/COOP headers).
	r_options->push_back(ExportOption(PropertyInfo(Variant::BOOL, "vram_texture_compression/for_desktop"), true)); // S3TC
	r_options->push_back(ExportOption(PropertyInfo(Variant::BOOL, "vram_texture_compression/for_mobile"), false)); // ETC or ETC2, depending on renderer

	r_options->push_back(ExportOption(PropertyInfo(Variant::BOOL, "html/export_icon"), true));
	r_options->push_back(ExportOption(PropertyInfo(Variant::STRING, "html/custom_html_shell", PROPERTY_HINT_FILE, "*.html"), ""));
	r_options->push_back(ExportOption(PropertyInfo(Variant::STRING, "html/head_include", PROPERTY_HINT_MULTILINE_TEXT), ""));
	r_options->push_back(ExportOption(PropertyInfo(Variant::INT, "html/canvas_resize_policy", PROPERTY_HINT_ENUM, "None,Project,Adaptive"), 2));
	r_options->push_back(ExportOption(PropertyInfo(Variant::BOOL, "html/focus_canvas_on_start"), true));
	r_options->push_back(ExportOption(PropertyInfo(Variant::BOOL, "html/experimental_virtual_keyboard"), false));
	r_options->push_back(ExportOption(PropertyInfo(Variant::BOOL, "progressive_web_app/enabled"), false));
	r_options->push_back(ExportOption(PropertyInfo(Variant::BOOL, "progressive_web_app/ensure_cross_origin_isolation_headers"), true));
	r_options->push_back(ExportOption(PropertyInfo(Variant::STRING, "progressive_web_app/offline_page", PROPERTY_HINT_FILE, "*.html"), ""));
	r_options->push_back(ExportOption(PropertyInfo(Variant::INT, "progressive_web_app/display", PROPERTY_HINT_ENUM, "Fullscreen,Standalone,Minimal UI,Browser"), 1));
	r_options->push_back(ExportOption(PropertyInfo(Variant::INT, "progressive_web_app/orientation", PROPERTY_HINT_ENUM, "Any,Landscape,Portrait"), 0));
	r_options->push_back(ExportOption(PropertyInfo(Variant::STRING, "progressive_web_app/icon_144x144", PROPERTY_HINT_FILE, "*.png,*.webp,*.svg"), ""));
	r_options->push_back(ExportOption(PropertyInfo(Variant::STRING, "progressive_web_app/icon_180x180", PROPERTY_HINT_FILE, "*.png,*.webp,*.svg"), ""));
	r_options->push_back(ExportOption(PropertyInfo(Variant::STRING, "progressive_web_app/icon_512x512", PROPERTY_HINT_FILE, "*.png,*.webp,*.svg"), ""));
	r_options->push_back(ExportOption(PropertyInfo(Variant::COLOR, "progressive_web_app/background_color", PROPERTY_HINT_COLOR_NO_ALPHA), Color()));

	r_options->push_back(ExportOption(PropertyInfo(Variant::INT, "threads/emscripten_pool_size"), 8));
	r_options->push_back(ExportOption(PropertyInfo(Variant::INT, "threads/godot_pool_size"), 4));
}

bool EditorExportPlatformWeb::get_export_option_visibility(const EditorExportPreset *p_preset, const String &p_option) const {
	if (p_option == "async/initial_load_edit_button") {
		return (int)p_preset->get("async/initial_load_mode") != ASYNC_LOAD_SETTING_LOAD_EVERYTHING;
	}

	bool advanced_options_enabled = p_preset->are_advanced_options_enabled();
	if (p_option == "custom_template/debug" || p_option == "custom_template/release") {
		return advanced_options_enabled;
	}

	if (p_option == "threads/godot_pool_size" || p_option == "threads/emscripten_pool_size") {
		return p_preset->get("variant/thread_support").operator bool();
	}

	return true;
}

String EditorExportPlatformWeb::get_name() const {
	return "Web";
}

String EditorExportPlatformWeb::get_os_name() const {
	return "Web";
}

Ref<Texture2D> EditorExportPlatformWeb::get_logo() const {
	return logo;
}

bool EditorExportPlatformWeb::has_valid_export_configuration(const Ref<EditorExportPreset> &p_preset, String &r_error, bool &r_missing_templates, bool p_debug) const {
#ifdef MODULE_MONO_ENABLED
	// Don't check for additional errors, as this particular error cannot be resolved.
	r_error += TTR("Exporting to Web is currently not supported in Godot 4 when using C#/.NET. Use Godot 3 to target Web with C#/Mono instead.") + "\n";
	r_error += TTR("If this project does not use C#, use a non-C# editor build to export the project.") + "\n";
	return false;
#else

	String err;

	if ((int)p_preset->get("async/initial_load_mode") != AsyncLoadSetting::ASYNC_LOAD_SETTING_LOAD_EVERYTHING) {
		if (String(EditorExportPlatformUtils::get_project_setting(p_preset, "application/run/main_scene")).is_empty()) {
			err += TTR("No main scene has been set. The main scene must be set for the web platform in order to preload the minimal files.") + "\n";
		}
	}

	bool valid = false;
	bool extensions = (bool)p_preset->get("variant/extensions_support");
	bool thread_support = (bool)p_preset->get("variant/thread_support");

	// Look for export templates (first official, and if defined custom templates).
	bool dvalid = exists_export_template(_get_template_name(extensions, thread_support, true), &err);
	bool rvalid = exists_export_template(_get_template_name(extensions, thread_support, false), &err);

	if (p_preset->get("custom_template/debug") != "") {
		dvalid = FileAccess::exists(p_preset->get("custom_template/debug"));
		if (!dvalid) {
			err += TTR("Custom debug template not found.") + "\n";
		}
	}
	if (p_preset->get("custom_template/release") != "") {
		rvalid = FileAccess::exists(p_preset->get("custom_template/release"));
		if (!rvalid) {
			err += TTR("Custom release template not found.") + "\n";
		}
	}

	valid = dvalid || rvalid;
	r_missing_templates = !valid;

	if (!err.is_empty()) {
		r_error = err;
	}

	return valid;
#endif // !MODULE_MONO_ENABLED
}

bool EditorExportPlatformWeb::has_valid_project_configuration(const Ref<EditorExportPreset> &p_preset, String &r_error) const {
	String err;
	bool valid = true;

	// Validate the project configuration.

	if (p_preset->get("vram_texture_compression/for_mobile")) {
		if (!ResourceImporterTextureSettings::should_import_etc2_astc()) {
			valid = false;
		}
	}

	if (!err.is_empty()) {
		r_error = err;
	}

	return valid;
}

List<String> EditorExportPlatformWeb::get_binary_extensions(const Ref<EditorExportPreset> &p_preset) const {
	List<String> list;
	list.push_back("html");
	return list;
}

Error EditorExportPlatformWeb::export_project(const Ref<EditorExportPreset> &p_preset, bool p_debug, const String &p_path, BitField<EditorExportPlatform::DebugFlags> p_flags) {
	ExportNotifier notifier(*this, p_preset, p_debug, p_path, p_flags);

	const String custom_debug = p_preset->get("custom_template/debug");
	const String custom_release = p_preset->get("custom_template/release");
	const String custom_html = p_preset->get("html/custom_html_shell");
	const bool export_icon = p_preset->get("html/export_icon");
	const bool pwa = p_preset->get("progressive_web_app/enabled");

	String path = p_path;
	if (!path.is_absolute_path()) {
		if (!path.begins_with("res://")) {
			path = "res://" + path;
		}
		path = ProjectSettings::get_singleton()->globalize_path(path);
	}

	const String base_dir = path.get_base_dir();
	const String base_path = path.get_basename();
	const String base_name = path.get_file().get_basename();

	if (!DirAccess::exists(base_dir)) {
		add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Target folder does not exist or is inaccessible: \"%s\""), base_dir));
		return ERR_FILE_BAD_PATH;
	}

	// Find the correct template
	String template_path = p_debug ? custom_debug : custom_release;
	template_path = template_path.strip_edges();
	if (template_path.is_empty()) {
		bool extensions = (bool)p_preset->get("variant/extensions_support");
		bool thread_support = (bool)p_preset->get("variant/thread_support");
		template_path = find_export_template(_get_template_name(extensions, thread_support, p_debug));
	}

	if (!template_path.is_empty() && !FileAccess::exists(template_path)) {
		add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("Prepare Templates"), vformat(TTR("Template file not found: \"%s\"."), template_path));
		return ERR_FILE_NOT_FOUND;
	}

	Error error;

	// Export pck and shared objects
	Vector<SharedObject> shared_objects;
	String pck_path;

	// Async PCK related.
	Dictionary async_pck_data;
	// Parse generated file sizes (pck and wasm, to help show a meaningful loading bar).
	Dictionary file_sizes;

	AsyncLoadSetting async_initial_load_mode = (AsyncLoadSetting)(int)p_preset->get("async/initial_load_mode");
	switch (async_initial_load_mode) {
		case ASYNC_LOAD_SETTING_LOAD_EVERYTHING: {
			pck_path = base_path + ".pck";

			error = save_pack(p_preset, p_debug, pck_path, &shared_objects);
			if (error != OK) {
				add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Could not write file: \"%s\"."), pck_path));
				return error;
			}

			{
				Ref<DirAccess> da = DirAccess::create(DirAccess::ACCESS_FILESYSTEM);
				for (int i = 0; i < shared_objects.size(); i++) {
					String dst = base_dir.path_join(shared_objects[i].path.get_file());
					error = da->copy(shared_objects[i].path, dst);
					if (error != OK) {
						add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Could not write file: \"%s\"."), shared_objects[i].path.get_file()));
						return error;
					}
				}
			}

			// Updating file sizes.
			Ref<FileAccess> f = FileAccess::open(pck_path, FileAccess::READ);
			if (f.is_valid()) {
				file_sizes[pck_path.get_file()] = (uint64_t)f->get_length();
			}

		} break;

		case ASYNC_LOAD_SETTING_ONLY_LOAD_MAIN_SCENE_DEPENDENCIES_AND_SPECIFIED_RESOURCES: {
			pck_path = base_path + ".asyncpck";

			ExportData export_data;
			export_data.assets_directory = pck_path.path_join("assets");
			export_data.libraries_directory = pck_path.path_join("libraries");
			export_data.pack_data.path = "assets.sparsepck";
			export_data.pack_data.use_sparse_pck = true;
			export_data.preset = p_preset;

			HashSet<String> features_set = export_data.get_features_set();

			error = export_project_files(p_preset, p_debug, &EditorExportPlatformWeb::_rename_and_store_file_in_async_pck, nullptr, &export_data);
			if (error != OK) {
				add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Could not write async pck: \"%s\"."), pck_path));
				return error;
			}

			PackedByteArray encoded_data;
			error = _generate_sparse_pck_metadata(p_preset, export_data.pack_data, encoded_data, true);
			if (error != OK) {
				add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Could not encode contents of async pck: \"%s\"."), pck_path));
				return error;
			}

			error = EditorExportPlatformUtils::store_file_at_path(export_data.assets_directory.path_join("assets.sparsepck"), encoded_data);
			if (error != OK) {
				add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Could not store contents of async pck: \"%s\"."), pck_path));
				return error;
			}

			// bool is_encrypted = p_preset->get_enc_pck() && p_preset->get_enc_directory();

			{
				Ref<DirAccess> da = DirAccess::create(DirAccess::ACCESS_FILESYSTEM);
				for (int i = 0; i < shared_objects.size(); i++) {
					String dst = export_data.libraries_directory.path_join(shared_objects[i].path.get_file());
					error = da->copy(shared_objects[i].path, dst);
					if (error != OK) {
						add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Could not write file: \"%s\"."), shared_objects[i].path.get_file()));
						return error;
					}
				}
			}

			{
				enum Pass {
					PASS_REMAP_IMPORT,
					PASS_NON_REMAP_IMPORT
				};

				std::function<Error(String, Pass)> _l_loop_asset_dir;
				_l_loop_asset_dir = [&_l_loop_asset_dir, &export_data, &features_set](const String &l_path, Pass l_pass) -> Error {
					const String SUFFIX_DEPS_JSON = ".deps.json";
					const String SUFFIX_REMAP = ".remap";
					const String SUFFIX_IMPORT = ".import";
					String path = l_path.simplify_path();
					Ref<DirAccess> dir_access = DirAccess::open(path);
					ERR_FAIL_COND_V(dir_access.is_null(), ERR_CANT_OPEN);

					dir_access->list_dir_begin();
					String next = dir_access->get_next();
					while (!next.is_empty()) {
#define CONTINUE_TO_NEXT()         \
	next = dir_access->get_next(); \
	continue
						if (next == "." || next == "..") {
							CONTINUE_TO_NEXT();
						}
						if (DirAccess::exists(path.path_join(next))) {
							Error err = _l_loop_asset_dir(path.path_join(next), l_pass);
							if (err != OK) {
								return err;
							}
							CONTINUE_TO_NEXT();
						}
						if (next.ends_with(SUFFIX_DEPS_JSON)) {
							CONTINUE_TO_NEXT();
						}

						String suffix;
						String resource_path;

						switch (l_pass) {
							case PASS_REMAP_IMPORT: {
								if (next.ends_with(SUFFIX_REMAP)) {
									suffix = SUFFIX_REMAP;
								} else if (next.ends_with(SUFFIX_IMPORT)) {
									suffix = SUFFIX_IMPORT;
								} else {
									CONTINUE_TO_NEXT();
								}
								resource_path = export_data.global_to_res(path.path_join(next.trim_suffix(suffix)));
							} break;
							case PASS_NON_REMAP_IMPORT: {
								if (next.ends_with(SUFFIX_REMAP) || next.ends_with(SUFFIX_IMPORT)) {
									CONTINUE_TO_NEXT();
								}
								resource_path = export_data.global_to_res(path.path_join(next));

								bool found = false;
								for (const KeyValue<String, ExportData::ResourceData *> &key_value : export_data.dependencies_map) {
									const String &dependency_path = key_value.key;
									const ExportData::ResourceData *dependency_data = key_value.value;

									if (resource_path == dependency_path) {
										found = true;
										break;
									}
									if (dependency_data->native_file.exists && resource_path == dependency_data->native_file.path) {
										found = true;
										break;
									}
									if (dependency_data->remap_file.exists && resource_path == dependency_data->remap_file.path) {
										found = true;
										break;
									}
									if (dependency_data->remapped_file.exists && resource_path == dependency_data->remapped_file.path) {
										found = true;
										break;
									}
								}
								if (found) {
									CONTINUE_TO_NEXT();
								}
							} break;
						}

						Error err = export_data.write_deps_json_file(resource_path, features_set);
						if (err != OK) {
							return err;
						}

						CONTINUE_TO_NEXT();
					}
					dir_access->list_dir_end();

					return OK;
#undef CONTINUE_TO_NEXT
				};
				_l_loop_asset_dir(ProjectSettings::get_singleton()->globalize_path(export_data.assets_directory), PASS_REMAP_IMPORT);
				_l_loop_asset_dir(ProjectSettings::get_singleton()->globalize_path(export_data.assets_directory), PASS_NON_REMAP_IMPORT);
			}

			// {
			// 	String main_scene_path = export_data.res_to_global(get_project_setting(p_preset, "application/run/main_scene"));

			// 	Dictionary main_scene_deps;
			// 	{
			// 		Ref<FileAccess> main_scene_deps_json_file = FileAccess::open(main_scene_path + ".deps.json", FileAccess::READ);
			// 		ERR_FAIL_COND_V(main_scene_deps_json_file.is_null(), FileAccess::get_open_error());
			// 		main_scene_deps = JSON::parse_string(main_scene_deps_json_file->get_as_text());
			// 	}

			// 	Dictionary resources = main_scene_deps.get("resources", Dictionary());
			// 	int added_size = 0;

			// 	{
			// 		PackedByteArray key = EditorExportPlatformUtils::convert_string_encryption_key_to_bytes(_get_script_encryption_key(p_preset));
			// 		std::function<Error(String)> loop_asset_dir;
			// 		loop_asset_dir = [&loop_asset_dir, &export_data, &resources, &added_size, &is_encrypted, &key, &file_sizes](const String &p_path) -> Error {
			// 			String path = p_path.simplify_path();
			// 			Ref<DirAccess> dir_access = DirAccess::open(path);
			// 			dir_access->list_dir_begin();
			// 			String next = dir_access->get_next();
			// 			while (!next.is_empty()) {
			// 				if (next == "." || next == "..") {
			// 					next = dir_access->get_next();
			// 					continue;
			// 				}
			// 				if (DirAccess::exists(path.path_join(next))) {
			// 					Error err = loop_asset_dir(path.path_join(next));
			// 					if (err != OK) {
			// 						return err;
			// 					}
			// 					next = dir_access->get_next();
			// 					continue;
			// 				}

			// 				String file_path = export_data.global_to_res(path.simplify_path().path_join(next));
			// 				if (!resources.has(file_path)) {
			// 					Dictionary file_data;
			// 					int file_size;

			// 					Ref<FileAccess> file_access = FileAccess::open(export_data.res_to_global(file_path), FileAccess::READ);
			// 					ERR_FAIL_COND_V(file_access.is_null(), FileAccess::get_open_error());

			// 					if (is_encrypted && !file_path.ends_with(".deps.json") && !file_path.ends_with("assets.sparsepck")) {
			// 						Ref<FileAccessEncrypted> file_access_encrypted;
			// 						file_access_encrypted.instantiate();
			// 						ERR_FAIL_COND_V(file_access_encrypted.is_null(), FAILED);
			// 						PackedByteArray new_key;
			// 						new_key.resize(32);
			// 						memcpy(new_key.ptrw(), key.ptr(), 32);
			// 						Error err = file_access_encrypted->open_and_parse(file_access, new_key, FileAccessEncrypted::MODE_READ, false);
			// 						ERR_FAIL_COND_V(err != OK, err);
			// 						file_access = file_access_encrypted;
			// 					}

			// 					file_size = file_access->get_length();
			// 					file_sizes[file_path] = file_size;

			// 					file_data.set("size", file_size);
			// 					resources.set(file_path, file_data);
			// 					added_size += file_size;
			// 				}
			// 				next = dir_access->get_next();
			// 			}
			// 			dir_access->list_dir_end();

			// 			return OK;
			// 		};

			// 		loop_asset_dir(ProjectSettings::get_singleton()->globalize_path(export_data.assets_directory));
			// 	}

			// 	main_scene_deps.set("total_size", int64_t(main_scene_deps.get("total_size", 0)) + added_size);
			// 	main_scene_deps_json = JSON::stringify(main_scene_deps, String(" ").repeat(2));
			// 	{
			// 		Ref<FileAccess> main_scene_deps_json_file = FileAccess::open(main_scene_path + ".deps.json", FileAccess::WRITE);
			// 		ERR_FAIL_COND_V(main_scene_deps_json_file.is_null(), FileAccess::get_open_error());
			// 		main_scene_deps_json_file->store_string(main_scene_deps_json);
			// 	}
			// }

			// main_scene_deps_json = "";

			{
				HashSet<String> mandatory_files = EditorExportPlatformWeb::_get_mandatory_initial_load_files(p_preset);
				HashSet<String> exported_files;

				{
					EditorExportPlatformUtils::AsyncPckFileDependenciesState file_dependencies_state;
					file_dependencies_state.add_to_file_dependencies(mandatory_files);

					HashSet<String> forced_files;
					PackedStringArray forced_files_array = p_preset->get("async/initial_load_forced_files");
					for (const String &forced_file : forced_files_array) {
						forced_files.insert(forced_file);
					}
					file_dependencies_state.add_to_file_dependencies(forced_files);

					HashMap<String, const HashSet<String> *> exported_files_dependencies;
					{
						HashMap<String, const HashSet<String> *> mandatory_dependencies = file_dependencies_state.get_file_dependencies_of(mandatory_files);
						for (const KeyValue<String, const HashSet<String> *> &key_value : mandatory_dependencies) {
							exported_files_dependencies[key_value.key] = key_value.value;
							exported_files.insert(key_value.key);
						}
					}

					for (const String &forced_file : forced_files) {
						bool found = false;
						for (const String &exported_file : exported_files) {
							if (exported_files_dependencies[exported_file] == nullptr) {
								continue;
							}
							if (exported_files_dependencies[exported_file]->has(forced_file)) {
								found = true;
								break;
							}
						}
						if (found) {
							continue;
						}

						file_dependencies_state.add_to_file_dependencies(forced_file);

						HashMap<String, const HashSet<String> *> new_exported_dependencies = file_dependencies_state.get_file_dependencies_of(forced_file);
						exported_files_dependencies[forced_file] = new_exported_dependencies[forced_file];
						exported_files.insert(EditorExportPlatformUtils::get_path_from_dependency(forced_file));
					}
				}

				Dictionary deps;
				for (const String &forced_file : exported_files) {
					String deps_json_file_path = export_data.res_to_global(forced_file) + ".deps.json";
					Ref<FileAccess> deps_json_file = FileAccess::open(deps_json_file_path, FileAccess::READ);
					if (deps_json_file.is_null()) {
						add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Could not open file: \"%s\"."), deps_json_file_path));
						return error;
					}
					deps[forced_file] = JSON::parse_string(deps_json_file->get_as_utf8_string());

					Dictionary resources = Dictionary(deps[forced_file])["resources"];
					Array resources_keys = resources.keys();
					for (const String resources_key : resources_keys) {
						Dictionary resource_data = resources[resources_key];
						Dictionary resource_files = resource_data["files"];
						Array resource_files_keys = resource_files.keys();
						for (const String resource_files_key : resource_files_keys) {
							Dictionary resource_file = resource_files[resource_files_key];
							uint32_t resource_files_size = resource_file["size"];
							String global_path = export_data.res_to_global(resource_files_key);
							String local_path = vformat("%s/%s", pck_path.get_file(), export_data.global_to_local(global_path)).simplify_path();
							file_sizes[local_path] = resource_files_size;
						}
					}
				}
				async_pck_data.set("initialLoad", deps);
			}

			{
				Dictionary static_files;
				async_pck_data.set("staticFiles", static_files);

				auto _l_update_file_sizes = [&export_data, &pck_path, &file_sizes, &static_files](const String &l_file_path) -> void {
					String global_path = export_data.res_to_global(l_file_path);
					String local_path = vformat("%s/%s", pck_path.get_file(), export_data.global_to_local(global_path)).simplify_path();
					int32_t file_size = FileAccess::get_size(global_path);
					file_sizes[local_path] = file_size;
					Dictionary static_file_data;
					static_files[l_file_path] = static_file_data;

					Dictionary static_file_data_files;
					static_file_data["files"] = static_file_data_files;
					static_file_data["totalSize"] = file_size;

					Dictionary static_file_data_files_file;
					static_file_data_files[l_file_path] = static_file_data_files_file;

					static_file_data_files_file["size"] = file_size;
				};
				_l_update_file_sizes("res://project.binary");
				_l_update_file_sizes("res://assets.sparsepck");
				_l_update_file_sizes("res://.godot/uid_cache.bin");
				_l_update_file_sizes("res://.godot/global_script_class_cache.cfg");
			}

			{
				Dictionary directories;
				directories.set("assets", vformat("%s/%s", pck_path.get_file(), export_data.global_to_local(export_data.assets_directory)).simplify_path());
				directories.set("libraries", vformat("%s/%s", pck_path.get_file(), export_data.global_to_local(export_data.libraries_directory)).simplify_path());
				async_pck_data.set("directories", directories);
			}

		} break;

		default: {
			add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR(R"*(Invalid `async/initial_load_mode` value: %s)*"), async_initial_load_mode));
			return ERR_INVALID_PARAMETER;
		} break;
	}

	// Extract templates.
	error = _extract_template(template_path, base_dir, base_name, pwa);
	if (error) {
		// Message is supplied by the subroutine method.
		return error;
	}

	Ref<FileAccess> f = FileAccess::open(base_path + ".wasm", FileAccess::READ);
	if (f.is_valid()) {
		file_sizes[base_name + ".wasm"] = (uint64_t)f->get_length();
	}

	// Read the HTML shell file (custom or from template).
	const String html_path = custom_html.is_empty() ? base_path + ".html" : custom_html;
	Vector<uint8_t> html;
	f = FileAccess::open(html_path, FileAccess::READ);
	if (f.is_null()) {
		add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Could not read HTML shell: \"%s\"."), html_path));
		return ERR_FILE_CANT_READ;
	}
	html.resize(f->get_length());
	f->get_buffer(html.ptrw(), html.size());
	f.unref(); // close file.

	// Generate HTML file with replaced strings.
	_fix_html(html, p_preset, base_name, p_debug, p_flags, shared_objects, file_sizes, async_pck_data);
	Error err = _write_or_error(html.ptr(), html.size(), path);
	if (err != OK) {
		// Message is supplied by the subroutine method.
		return err;
	}
	html.resize(0);

	// Export splash (why?)
	Ref<Image> splash = _get_project_splash(p_preset);
	const String splash_png_path = base_path + ".png";
	if (splash->save_png(splash_png_path) != OK) {
		add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Could not write file: \"%s\"."), splash_png_path));
		return ERR_FILE_CANT_WRITE;
	}

	// Save a favicon that can be accessed without waiting for the project to finish loading.
	// This way, the favicon can be displayed immediately when loading the page.
	if (export_icon) {
		Ref<Image> favicon = _get_project_icon(p_preset);
		const String favicon_png_path = base_path + ".icon.png";
		if (favicon->save_png(favicon_png_path) != OK) {
			add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Could not write file: \"%s\"."), favicon_png_path));
			return ERR_FILE_CANT_WRITE;
		}
		favicon->resize(180, 180);
		const String apple_icon_png_path = base_path + ".apple-touch-icon.png";
		if (favicon->save_png(apple_icon_png_path) != OK) {
			add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Could not write file: \"%s\"."), apple_icon_png_path));
			return ERR_FILE_CANT_WRITE;
		}
	}

	// Generate the PWA worker and manifest
	if (pwa) {
		err = _build_pwa(p_preset, path, shared_objects);
		if (err != OK) {
			// Message is supplied by the subroutine method.
			return err;
		}
	}

	return OK;
}

bool EditorExportPlatformWeb::poll_export() {
	Ref<EditorExportPreset> preset;

	for (int i = 0; i < EditorExport::get_singleton()->get_export_preset_count(); i++) {
		Ref<EditorExportPreset> ep = EditorExport::get_singleton()->get_export_preset(i);
		if (ep->is_runnable() && ep->get_platform() == this) {
			preset = ep;
			break;
		}
	}

	RemoteDebugState prev_remote_debug_state = remote_debug_state;
	remote_debug_state = REMOTE_DEBUG_STATE_UNAVAILABLE;

	if (preset.is_valid()) {
		const bool debug = true;
		// Throwaway variables to pass to `can_export`.
		String err;
		bool missing_templates;

		if (can_export(preset, err, missing_templates, debug)) {
			if (server->is_listening()) {
				remote_debug_state = REMOTE_DEBUG_STATE_SERVING;
			} else {
				remote_debug_state = REMOTE_DEBUG_STATE_AVAILABLE;
			}
		}
	}

	if (remote_debug_state != REMOTE_DEBUG_STATE_SERVING && server->is_listening()) {
		server->stop();
	}

	return remote_debug_state != prev_remote_debug_state;
}

Ref<Texture2D> EditorExportPlatformWeb::get_option_icon(int p_index) const {
	Ref<Texture2D> play_icon = EditorExportPlatform::get_option_icon(p_index);

	switch (remote_debug_state) {
		case REMOTE_DEBUG_STATE_UNAVAILABLE: {
			return nullptr;
		} break;

		case REMOTE_DEBUG_STATE_AVAILABLE: {
			switch (p_index) {
				case 0:
				case 1:
					return play_icon;
				default:
					ERR_FAIL_V(nullptr);
			}
		} break;

		case REMOTE_DEBUG_STATE_SERVING: {
			switch (p_index) {
				case 0:
					return play_icon;
				case 1:
					return restart_icon;
				case 2:
					return stop_icon;
				default:
					ERR_FAIL_V(nullptr);
			}
		} break;
	}

	return nullptr;
}

int EditorExportPlatformWeb::get_options_count() const {
	switch (remote_debug_state) {
		case REMOTE_DEBUG_STATE_UNAVAILABLE: {
			return 0;
		} break;

		case REMOTE_DEBUG_STATE_AVAILABLE: {
			return 2;
		} break;

		case REMOTE_DEBUG_STATE_SERVING: {
			return 3;
		} break;
	}

	return 0;
}

String EditorExportPlatformWeb::get_option_label(int p_index) const {
	String run_in_browser = TTR("Run in Browser");
	String start_http_server = TTR("Start HTTP Server");
	String reexport_project = TTR("Re-export Project");
	String stop_http_server = TTR("Stop HTTP Server");

	switch (remote_debug_state) {
		case REMOTE_DEBUG_STATE_UNAVAILABLE:
			return "";

		case REMOTE_DEBUG_STATE_AVAILABLE: {
			switch (p_index) {
				case 0:
					return run_in_browser;
				case 1:
					return start_http_server;
				default:
					ERR_FAIL_V("");
			}
		} break;

		case REMOTE_DEBUG_STATE_SERVING: {
			switch (p_index) {
				case 0:
					return run_in_browser;
				case 1:
					return reexport_project;
				case 2:
					return stop_http_server;
				default:
					ERR_FAIL_V("");
			}
		} break;
	}

	return "";
}

String EditorExportPlatformWeb::get_option_tooltip(int p_index) const {
	String run_in_browser = TTR("Run exported HTML in the system's default browser.");
	String start_http_server = TTR("Start the HTTP server.");
	String reexport_project = TTR("Export project again to account for updates.");
	String stop_http_server = TTR("Stop the HTTP server.");

	switch (remote_debug_state) {
		case REMOTE_DEBUG_STATE_UNAVAILABLE:
			return "";

		case REMOTE_DEBUG_STATE_AVAILABLE: {
			switch (p_index) {
				case 0:
					return run_in_browser;
				case 1:
					return start_http_server;
				default:
					ERR_FAIL_V("");
			}
		} break;

		case REMOTE_DEBUG_STATE_SERVING: {
			switch (p_index) {
				case 0:
					return run_in_browser;
				case 1:
					return reexport_project;
				case 2:
					return stop_http_server;
				default:
					ERR_FAIL_V("");
			}
		} break;
	}

	return "";
}

Error EditorExportPlatformWeb::run(const Ref<EditorExportPreset> &p_preset, int p_option, BitField<EditorExportPlatform::DebugFlags> p_debug_flags) {
	const uint16_t bind_port = EDITOR_GET("export/web/http_port");
	// Resolve host if needed.
	const String bind_host = EDITOR_GET("export/web/http_host");
	const bool use_tls = EDITOR_GET("export/web/use_tls");

	switch (remote_debug_state) {
		case REMOTE_DEBUG_STATE_UNAVAILABLE: {
			return FAILED;
		} break;

		case REMOTE_DEBUG_STATE_AVAILABLE: {
			switch (p_option) {
				// Run in Browser.
				case 0: {
					Error err = _export_project(p_preset, p_debug_flags);
					if (err != OK) {
						return err;
					}
					err = _start_server(bind_host, bind_port, use_tls);
					if (err != OK) {
						return err;
					}
					return _launch_browser(bind_host, bind_port, use_tls);
				} break;

				// Start HTTP Server.
				case 1: {
					Error err = _export_project(p_preset, p_debug_flags);
					if (err != OK) {
						return err;
					}
					return _start_server(bind_host, bind_port, use_tls);
				} break;

				default: {
					ERR_FAIL_V_MSG(FAILED, vformat(R"(Invalid option "%s" for the current state.)", p_option));
				}
			}
		} break;

		case REMOTE_DEBUG_STATE_SERVING: {
			switch (p_option) {
				// Run in Browser.
				case 0: {
					Error err = _export_project(p_preset, p_debug_flags);
					if (err != OK) {
						return err;
					}
					return _launch_browser(bind_host, bind_port, use_tls);
				} break;

				// Re-export Project.
				case 1: {
					return _export_project(p_preset, p_debug_flags);
				} break;

				// Stop HTTP Server.
				case 2: {
					return _stop_server();
				} break;

				default: {
					ERR_FAIL_V_MSG(FAILED, vformat(R"(Invalid option "%s" for the current state.)", p_option));
				}
			}
		} break;
	}

	return FAILED;
}

Error EditorExportPlatformWeb::_export_project(const Ref<EditorExportPreset> &p_preset, int p_debug_flags) {
	const String dest = EditorPaths::get_singleton()->get_temp_dir().path_join("web");
	Ref<DirAccess> da = DirAccess::create(DirAccess::ACCESS_FILESYSTEM);
	if (!da->dir_exists(dest)) {
		Error err = da->make_dir_recursive(dest);
		if (err != OK) {
			add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("Run"), vformat(TTR("Could not create HTTP server directory: %s."), dest));
			return err;
		}
	}

	const String basepath = dest.path_join("tmp_js_export");
	Error err = export_project(p_preset, true, basepath + ".html", p_debug_flags);
	if (err != OK) {
		// Export generates several files, clean them up on failure.
		DirAccess::remove_file_or_error(basepath + ".html");
		DirAccess::remove_file_or_error(basepath + ".offline.html");
		DirAccess::remove_file_or_error(basepath + ".js");
		DirAccess::remove_file_or_error(basepath + ".audio.worklet.js");
		DirAccess::remove_file_or_error(basepath + ".audio.position.worklet.js");
		DirAccess::remove_file_or_error(basepath + ".service.worker.js");
		DirAccess::remove_file_or_error(basepath + ".asyncpck");
		DirAccess::remove_file_or_error(basepath + ".png");
		DirAccess::remove_file_or_error(basepath + ".side.wasm");
		DirAccess::remove_file_or_error(basepath + ".wasm");
		DirAccess::remove_file_or_error(basepath + ".icon.png");
		DirAccess::remove_file_or_error(basepath + ".apple-touch-icon.png");
	}
	return err;
}

Error EditorExportPlatformWeb::_launch_browser(const String &p_bind_host, const uint16_t p_bind_port, const bool p_use_tls) {
	OS::get_singleton()->shell_open(String((p_use_tls ? "https://" : "http://") + p_bind_host + ":" + itos(p_bind_port) + "/tmp_js_export.html"));
	// FIXME: Find out how to clean up export files after running the successfully
	// exported game. Might not be trivial.
	return OK;
}

Error EditorExportPlatformWeb::_start_server(const String &p_bind_host, const uint16_t p_bind_port, const bool p_use_tls) {
	IPAddress bind_ip;
	if (p_bind_host.is_valid_ip_address()) {
		bind_ip = p_bind_host;
	} else {
		bind_ip = IP::get_singleton()->resolve_hostname(p_bind_host);
	}
	ERR_FAIL_COND_V_MSG(!bind_ip.is_valid(), ERR_INVALID_PARAMETER, "Invalid editor setting 'export/web/http_host': '" + p_bind_host + "'. Try using '127.0.0.1'.");

	const String tls_key = EDITOR_GET("export/web/tls_key");
	const String tls_cert = EDITOR_GET("export/web/tls_certificate");

	// Restart server.
	server->stop();
	Error err = server->listen(p_bind_port, bind_ip, p_use_tls, tls_key, tls_cert);
	if (err != OK) {
		add_message(EditorExportPlatformData::EXPORT_MESSAGE_ERROR, TTR("Run"), vformat(TTR("Error starting HTTP server: %d."), err));
	}
	return err;
}

Error EditorExportPlatformWeb::_stop_server() {
	server->stop();
	return OK;
}

Error EditorExportPlatformWeb::_rename_and_store_file_in_async_pck(void *p_userdata, const String &p_path, const Vector<uint8_t> &p_data, int p_file, int p_total, const Vector<String> &p_enc_in_filters, const Vector<String> &p_enc_ex_filters, const Vector<uint8_t> &p_key, uint64_t p_seed) {
	// EditorExportPlatformWeb *export_platform = static_cast<EditorExportPlatformWeb *>(p_userdata);
	ExportData *export_data = static_cast<ExportData *>(p_userdata);
	const String simplified_path = EditorExportPlatform::simplify_path(p_path);

	Vector<uint8_t> encoded_data;
	EditorExportPlatformData::SavedData saved_data;
	Error err = EditorExportPlatformUtils::store_temp_file(simplified_path, p_data, p_enc_in_filters, p_enc_ex_filters, p_key, p_seed, encoded_data, saved_data);
	if (err != OK) {
		return err;
	}

	const String target_path = export_data->assets_directory.path_join(simplified_path.trim_prefix("res://"));
	err = EditorExportPlatformUtils::store_file_at_path(target_path, encoded_data);

	export_data->pack_data.file_ofs.push_back(saved_data);

	return OK;
}

void EditorExportPlatformWeb::_open_async_dialog() {
	if (async_dialog == nullptr) {
		async_dialog = memnew(AsyncDialog(this));
		async_dialog->connect("visibility_changed", callable_mp(this, &EditorExportPlatformWeb::_on_async_dialog_visibility_changed));
	}
	async_dialog->popup_exclusive_centered(EditorNode::get_singleton()->get_project_export_dialog());
}

void EditorExportPlatformWeb::_on_async_dialog_visibility_changed() {
	ERR_FAIL_NULL(async_dialog);
	if (async_dialog->is_visible()) {
		return;
	}
	async_dialog->disconnect("visibility_changed", callable_mp(this, &EditorExportPlatformWeb::_on_async_dialog_visibility_changed));
	async_dialog->queue_free();
	async_dialog = nullptr;
}

HashSet<String> EditorExportPlatformWeb::_get_mandatory_initial_load_files(const Ref<EditorExportPreset> &p_preset) {
	HashSet<String> mandatory_initial_load_files;

	{
		// Main scene.
		mandatory_initial_load_files.insert(
				EditorExportPlatformUtils::get_path_from_dependency(
						EditorExportPlatformUtils::get_project_setting(p_preset, "application/run/main_scene")));
	}

	{
		// Translation files.
		PackedStringArray translations = EditorExportPlatformUtils::get_project_setting(p_preset, "internationalization/locale/translations");
		for (const String &translation : translations) {
			mandatory_initial_load_files.insert(EditorExportPlatformUtils::get_path_from_dependency(translation));
		}
	}

	{
		// Autoload files.
		HashMap<StringName, ProjectSettings::AutoloadInfo> autoload_list = ProjectSettings::get_singleton()->get_autoload_list();
		for (const KeyValue<StringName, ProjectSettings::AutoloadInfo> &key_value : autoload_list) {
			mandatory_initial_load_files.insert(
					EditorExportPlatformUtils::get_path_from_dependency(
							key_value.value.path));
		}
	}

	{
		// Single files.
		auto _l_add_project_setting_if_file_exists = [&p_preset, &mandatory_initial_load_files](const String &l_project_setting) -> void {
			String path = EditorExportPlatformUtils::get_path_from_dependency(EditorExportPlatformUtils::get_project_setting(p_preset, l_project_setting));
			if (FileAccess::exists(path)) {
				mandatory_initial_load_files.insert(path);
			}
		};

		// Icon path.
		_l_add_project_setting_if_file_exists("application/config/icon");
		// Default bus layout path.
		_l_add_project_setting_if_file_exists("audio/buses/default_bus_layout");
		// Certificate bundle override.
		_l_add_project_setting_if_file_exists("network/tls/certificate_bundle_override");
		// Default environment.
		_l_add_project_setting_if_file_exists("rendering/environment/defaults/default_environment");
		// Default XR action map.
		_l_add_project_setting_if_file_exists("xr/openxr/default_action_map");
	}

	return mandatory_initial_load_files;
}

Ref<Texture2D> EditorExportPlatformWeb::get_run_icon() const {
	return run_icon;
}

void EditorExportPlatformWeb::initialize() {
	if (!EditorNode::get_singleton()) {
		return;
	}

	server.instantiate();

	Ref<Image> img = memnew(Image);
	const bool upsample = !Math::is_equal_approx(Math::round(EDSCALE), EDSCALE);

	ImageLoaderSVG::create_image_from_string(img, _web_logo_svg, EDSCALE, upsample, false);
	logo = ImageTexture::create_from_image(img);

	ImageLoaderSVG::create_image_from_string(img, _web_run_icon_svg, EDSCALE, upsample, false);
	run_icon = ImageTexture::create_from_image(img);

	Ref<Theme> theme = EditorNode::get_singleton()->get_editor_theme();
	if (theme.is_valid()) {
		stop_icon = theme->get_icon(SNAME("Stop"), EditorStringName(EditorIcons));
		restart_icon = theme->get_icon(SNAME("Reload"), EditorStringName(EditorIcons));
	} else {
		stop_icon.instantiate();
		restart_icon.instantiate();
	}
}
