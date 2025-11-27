/**************************************************************************/
/*  export_plugin.h                                                       */
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

#include "core/error/error_list.h"
#include "core/error/error_macros.h"
#include "core/io/file_access.h"
#include "core/object/object.h"
#include "core/string/fuzzy_search.h"
#include "core/variant/dictionary.h"
#include "core/variant/variant.h"
#include "editor/export/editor_export_preset.h"
#include "editor/file_system/editor_file_system.h"
#include "editor_http_server.h"

#include "core/config/project_settings.h"
#include "core/io/image_loader.h"
#include "core/io/stream_peer_tls.h"
#include "core/io/tcp_server.h"
#include "core/io/zip_io.h"
#include "editor/editor_node.h"
#include "editor/editor_string_names.h"
#include "editor/export/editor_export_platform.h"
#include "main/splash.gen.h"
#include "scene/gui/dialogs.h"
#include "scene/gui/tree.h"

class ImageTexture;

class EditorExportPlatformWeb : public EditorExportPlatform {
	GDCLASS(EditorExportPlatformWeb, EditorExportPlatform);

	enum RemoteDebugState {
		REMOTE_DEBUG_STATE_UNAVAILABLE,
		REMOTE_DEBUG_STATE_AVAILABLE,
		REMOTE_DEBUG_STATE_SERVING,
	};

	enum AsyncLoadSetting {
		ASYNC_LOAD_SETTING_LOAD_EVERYTHING = 0,
		ASYNC_LOAD_SETTING_ONLY_LOAD_MAIN_SCENE_DEPENDENCIES_AND_SPECIFIED_RESOURCES = 1,
	};

	struct ExportData {
		struct File {
			bool exists = false;
			String path;
			uint32_t size = 0;
			String md5;
			String sha256;

			Dictionary get_as_dictionary() const {
				Dictionary data;
				data["size"] = size;
				data["md5"] = md5;
				data["sha256"] = sha256;
				return data;
			}
		};

		struct ResourceData {
			const ExportData *export_data;

			String path;
			File native_file;
			File remap_file;
			File remapped_file;
			LocalVector<const ResourceData *> dependencies;

			uint32_t get_size() const;
			Dictionary get_as_resource_dictionary() const;
			void flatten_dependencies(LocalVector<const ResourceData *> *p_deps) const;

			static ResourceData create(const ExportData *p_export_data, const String &p_path, const String &p_remap_file_path = "", const String &p_remapped_file_path = "", Error *r_error = nullptr);
		};

		HashMap<String, ResourceData> dependencies;
		EditorExportPlatformData::PackData pack_data;
		String assets_directory;
		String libraries_directory;
		bool debug;
		LocalVector<String> libraries;
		Ref<EditorExportPreset> preset;

		HashSet<String> get_features_set() const;
		String res_to_global(const String &p_res_path) const {
			String res_path = simplify_path(p_res_path);
			return assets_directory.path_join(res_path.trim_prefix("res://"));
		}
		String global_to_res(const String &p_global_path) const {
			return "res://" + p_global_path.trim_prefix(assets_directory.trim_suffix("/") + "/");
		}
		String global_to_local(const String &p_global_path) const {
			return p_global_path.trim_prefix(assets_directory.get_base_dir());
		}

		Error write_deps_json_file(const String &p_resource_path, HashSet<String> &p_features_set);
	};

	class AsyncDialog : public ConfirmationDialog {
		GDCLASS(AsyncDialog, ConfirmationDialog);

		enum TreeColumn {
			TREE_COLUMN_PATH = 0,
			TREE_COLUMN_IS_MAIN_SCENE_DEPENDENCY = 1,
			TREE_COLUMN_IS_FORCED = 2,
			TREE_COLUMN_IS_DEPENDENCY = 3,
		};

		struct TreePaths {
			struct TreePath {
				struct Comparator {
					bool operator()(const TreePath &p_a, const TreePath &p_b) const {
						return p_a.path.filenocasecmp_to(p_b.path) < 0;
					}
				};

				enum TreePathValue {
					TREE_PATH_VALUE_MAIN,
					TREE_PATH_VALUE_FORCED,
					TREE_PATH_VALUE_DEPENDENCY,
				};

				enum TreePathState {
					TREE_PATH_STATE_UNCHECKED,
					TREE_PATH_STATE_INDETERMINATE,
					TREE_PATH_STATE_CHECKED,
				};

				String path;

				TreePath *parent = nullptr;
				LocalVector<TreePath *> children;
				bool is_directory = false;

				bool main = false;
				bool forced = false;

				TreePathState get_state(TreePathValue p_value) const;
				void set_state(TreePathState p_state, TreePathValue p_value);
			};

			List<TreePath> paths;
			HashMap<String, TreePath *> paths_map;
			LocalVector<String> paths_ordered;

			static TreePaths create(const HashSet<String> &p_file_paths);
		};

		EditorExportPlatformWeb *export_platform = nullptr;
		EditorExportPlatformUtils::AsyncPckFileDependenciesState file_dependencies_state;
		HashSet<String> exported_paths;
		HashSet<String> exported_paths_and_forced_files_and_dependencies;
		TreePaths tree_paths;
		String main_scene_path;
		String default_bus_layout_path;
		String icon_path;
		HashSet<String> forced_files;
		HashMap<String, const HashSet<String> *> main_scene_dependencies;
		HashMap<String, const HashSet<String> *> forced_files_dependencies;

		Ref<EditorExportPreset> preset;

		bool updating = false;

		LineEdit *tree_search_line_edit = nullptr;

		Tree *tree_hierarchical = nullptr;
		Tree *tree_search = nullptr;
		Timer *tree_search_debounce_timer = nullptr;
		bool tree_had_first_update = false;

		FuzzySearch tree_fuzzy_search;

		void update_theme();
		void update_forced_files();

		void on_confirmed();
		void on_tree_item_edited(Tree *p_edited_tree);
		void on_tree_pro(Tree *p_edited_tree);
		void on_tree_search_line_edit_text_changed(const String &p_new_text);
		void on_tree_search_debounce_timer_timeout();

		void add_selected_file(const String &p_path);
		void remove_selected_file(const String &p_path);
		void update_selected_file(const String &p_path, bool p_add);

		void tree_add_callbacks();
		void tree_remove_callbacks();
		void tree_init();
		void tree_update();
		void tree_get_paths_and_dirs(const HashSet<String> &p_file_paths, HashMap<String, LocalVector<String>> &r_paths_map, LocalVector<String> &r_paths_list) const;
		void tree_fill_hierarchical(const TreePaths &p_paths);
		void tree_fill_search(const TreePaths &p_paths);

	protected:
		void _notification(int p_what);

	public:
		AsyncDialog(EditorExportPlatformWeb *p_export_platform);
	};

	AsyncDialog *async_dialog = nullptr;

	Ref<ImageTexture> logo;
	Ref<ImageTexture> run_icon;
	Ref<ImageTexture> stop_icon;
	Ref<ImageTexture> restart_icon;
	RemoteDebugState remote_debug_state = REMOTE_DEBUG_STATE_UNAVAILABLE;

	Ref<EditorHTTPServer> server;

	String _get_template_name(bool p_extension, bool p_thread_support, bool p_debug) const {
		String name = "web";
		if (p_extension) {
			name += "_dlink";
		}
		if (!p_thread_support) {
			name += "_nothreads";
		}
		if (p_debug) {
			name += "_debug.zip";
		} else {
			name += "_release.zip";
		}
		return name;
	}

	Ref<Image> _get_project_icon(const Ref<EditorExportPreset> &p_preset) const {
		Error err = OK;
		Ref<Image> icon;
		icon.instantiate();
		const String icon_path = String(get_project_setting(p_preset, "application/config/icon")).strip_edges();
		if (!icon_path.is_empty()) {
			icon = _load_icon_or_splash_image(icon_path, &err);
		}
		if (icon_path.is_empty() || err != OK || icon.is_null() || icon->is_empty()) {
			return EditorNode::get_singleton()->get_editor_theme()->get_icon(SNAME("DefaultProjectIcon"), EditorStringName(EditorIcons))->get_image();
		}
		return icon;
	}

	Ref<Image> _get_project_splash(const Ref<EditorExportPreset> &p_preset) const {
		Error err = OK;
		Ref<Image> splash;
		splash.instantiate();
		const String splash_path = String(get_project_setting(p_preset, "application/boot_splash/image")).strip_edges();
		if (!splash_path.is_empty()) {
			splash = _load_icon_or_splash_image(splash_path, &err);
		}
		if (splash_path.is_empty() || err != OK || splash.is_null() || splash->is_empty()) {
			return Ref<Image>(memnew(Image(boot_splash_png)));
		}
		return splash;
	}

	Error _extract_template(const String &p_template, const String &p_dir, const String &p_name, bool pwa);
	void _replace_strings(const HashMap<String, String> &p_replaces, Vector<uint8_t> &r_template);
	void _fix_html(Vector<uint8_t> &p_html, const Ref<EditorExportPreset> &p_preset, const String &p_name, bool p_debug, BitField<EditorExportPlatform::DebugFlags> p_flags, const Vector<SharedObject> p_shared_objects, const Dictionary &p_file_sizes, const Dictionary &p_async_pck_data_jsondeps_json);

	Error _add_manifest_icon(const Ref<EditorExportPreset> &p_preset, const String &p_path, const String &p_icon, int p_size, Array &r_arr);
	Error _build_pwa(const Ref<EditorExportPreset> &p_preset, const String p_path, const Vector<SharedObject> &p_shared_objects);
	Error _write_or_error(const uint8_t *p_content, int p_len, String p_path);

	Error _export_project(const Ref<EditorExportPreset> &p_preset, int p_debug_flags);
	Error _launch_browser(const String &p_bind_host, uint16_t p_bind_port, bool p_use_tls);
	Error _start_server(const String &p_bind_host, uint16_t p_bind_port, bool p_use_tls);
	Error _stop_server();

	static HashSet<String> _get_mandatory_initial_load_files(const Ref<EditorExportPreset> &p_preset);
	static Error _rename_and_store_file_in_async_pck(void *p_userdata, const String &p_path, const Vector<uint8_t> &p_data, int p_file, int p_total, const Vector<String> &p_enc_in_filters, const Vector<String> &p_enc_ex_filters, const PackedByteArray &p_key, uint64_t p_seed);
	void _open_async_dialog();
	void _on_async_dialog_visibility_changed();

public:
	virtual void get_preset_features(const Ref<EditorExportPreset> &p_preset, List<String> *r_features) const override;

	virtual void get_export_options(List<ExportOption> *r_options) const override;
	virtual bool get_export_option_visibility(const EditorExportPreset *p_preset, const String &p_option) const override;

	virtual String get_name() const override;
	virtual String get_os_name() const override;
	virtual Ref<Texture2D> get_logo() const override;

	virtual bool has_valid_export_configuration(const Ref<EditorExportPreset> &p_preset, String &r_error, bool &r_missing_templates, bool p_debug = false) const override;
	virtual bool has_valid_project_configuration(const Ref<EditorExportPreset> &p_preset, String &r_error) const override;
	virtual List<String> get_binary_extensions(const Ref<EditorExportPreset> &p_preset) const override;
	virtual Error export_project(const Ref<EditorExportPreset> &p_preset, bool p_debug, const String &p_path, BitField<EditorExportPlatform::DebugFlags> p_flags = 0) override;

	virtual bool poll_export() override;
	virtual int get_options_count() const override;
	virtual String get_option_label(int p_index) const override;
	virtual String get_option_tooltip(int p_index) const override;
	virtual Ref<Texture2D> get_option_icon(int p_index) const override;
	virtual Error run(const Ref<EditorExportPreset> &p_preset, int p_option, BitField<EditorExportPlatform::DebugFlags> p_debug_flags) override;
	virtual Ref<Texture2D> get_run_icon() const override;

	virtual void get_platform_features(List<String> *r_features) const override {
		r_features->push_back("web");
		r_features->push_back(get_os_name().to_lower());
	}

	virtual void resolve_platform_feature_priorities(const Ref<EditorExportPreset> &p_preset, HashSet<String> &p_features) override {
	}

	String get_debug_protocol() const override { return "ws://"; }

	virtual void initialize() override;
};
