/**************************************************************************/
/*  fetch_export_plugin.cpp                                               */
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

#include "fetch_export_plugin.h"

#include "core/error/error_macros.h"
#include "core/io/file_access.h"
#include "core/io/resource_loader.h"
#include "core/variant/typed_array.h"
#include "editor/editor_file_system.h"
#include "editor/export/editor_export_preset.h"
#include "scene/main/resource_fetcher.h"
#include "scene/resources/packed_scene.h"

Error FetchExportPlugin::_find_resource_fetcher_nodes(Node *p_node) {
	ERR_FAIL_COND_V(p_node == nullptr, FAILED);

	ResourceFetcher *resource_fetcher = Object::cast_to<ResourceFetcher>(p_node);
	if (resource_fetcher) {
		_parse_fetch_node(resource_fetcher);
	}

	if (p_node->get_child_count() == 0) {
		return OK;
	}

	TypedArray<Object> children = p_node->get_children();
	for (Object *child_obj : children) {
		Node *child = Object::cast_to<Node>(child_obj);
		if (child == nullptr) {
			continue;
		}
		_find_resource_fetcher_nodes(child);
	}

	return OK;
}

Error FetchExportPlugin::_parse_fetch_node(ResourceFetcher *p_resource_fetcher) {
	ERR_FAIL_COND_V(p_resource_fetcher == nullptr, FAILED);

	EditorFileSystemDirectory *filesystem = EditorFileSystem::get_singleton()->get_filesystem();

	TypedArray<Resource> resources = p_resource_fetcher->get_resources();
	for (const Ref<Resource> resource : resources) {
		if (resource.is_null()) {
			continue;
		}

		bool is_imported = !resource->get_import_path().is_empty();
		String file_path = is_imported
				? resource->get_import_path()
				: resource->get_path();
		if (_fetched_resources.has(file_path)) {
			continue;
		}
		_fetched_resources.append(file_path);

		Ref<PackedScene> resource_scene = resource;
		if (resource_scene.is_valid()) {
			Node *resource_scene_root = resource_scene->instantiate();
			_find_resource_fetcher_nodes(resource_scene_root);
		}

		if (file_path.is_relative_path()) {
			file_path = _current_scene->get_scene_file_path().path_join(file_path);
		}

		if (!file_path.begins_with("res://")) {
			continue;
		}

		Error err;
		Ref<FileAccess> file = FileAccess::open(file_path, FileAccess::READ, &err);
		if (err != OK) {
			return err;
		}
		add_fetch_file(file_path, file->get_buffer(file->get_length()));

		String res_stripped_file_path = file_path.replace_first("res://", "");
		Vector<String> file_path_dirs = res_stripped_file_path.split("/");
		while (file_path_dirs.size() > 1) {
			int dir_index = filesystem->find_dir_index(file_path_dirs[0]);
			if (dir_index < 0) {
				return FAILED;
			}
			filesystem = filesystem->get_subdir(dir_index);
			file_path_dirs.remove_at(0);
		}

		file_path = file_path_dirs[0];
		int resource_index = filesystem->find_file_index(file_path);
		if (resource_index < 0) {
			return FAILED;
		}

		Vector<String> deps = filesystem->get_file_deps(resource_index);

		for (const String &dep : deps) {
			if (_fetched_resources.has(dep)) {
				continue;
			}
			_fetched_resources.append(dep);

			Error err;

			Ref<Resource> dep_res = ResourceLoader::load(dep, "", ResourceFormatLoader::CACHE_MODE_REUSE, &err);
			if (err != OK) {
				return err;
			}

			bool dep_is_imported = !dep_res->get_import_path().is_empty();
			String dep_path = dep_is_imported
					? dep_res->get_import_path()
					: dep;

			{
				Ref<FileAccess> file = FileAccess::open(dep_path, FileAccess::READ, &err);
				if (err != OK) {
					return err;
				}
				add_fetch_file(dep, file->get_buffer(file->get_length()));
			}

			if (dep_is_imported) {
				String dep_import_path = dep + ".import";
				Ref<FileAccess> file_import = FileAccess::open(dep_import_path, FileAccess::READ, &err);
				if (err != OK) {
					return err;
				}
				add_fetch_file(dep_import_path, file_import->get_buffer(file_import->get_length()));
			}
		}
	}

	return OK;
}

uint64_t FetchExportPlugin::_get_customization_configuration_hash() const {
	Ref<EditorExportPreset> preset = get_export_preset();
	ERR_FAIL_COND_V(preset.is_null(), 0);

	return preset->get_customized_files().hash();
}

void FetchExportPlugin::_export_begin(const HashSet<String> &p_features, bool p_debug, const String &p_path, int p_flags) {
	_fetched_resources.clear();
	_current_scene = nullptr;
}

void FetchExportPlugin::_export_file(const String &p_path, const String &p_type, const HashSet<String> &p_features) {
	if (p_type != "PackedScene") {
		return;
	}

	if (!p_features.has("fetch")) {
		return;
	}

	// Let's load the scene in order to discover if there's `ResourceFetcher` nodes inside.
	Ref<Resource> scene_resource = ResourceLoader::load(p_path, p_type);
	Ref<PackedScene> scene = scene_resource;
	if (scene.is_null()) {
		return;
	}

	Node *root = scene->instantiate();
	if (root == nullptr) {
		return;
	}

	_find_resource_fetcher_nodes(root);
}

void FetchExportPlugin::_export_end() {
	_fetched_resources.clear();
	_current_scene = nullptr;
}

FetchExportPlugin::FetchExportPlugin() {}

FetchExportPlugin::~FetchExportPlugin() {}
