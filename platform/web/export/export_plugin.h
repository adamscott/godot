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

#include "core/io/file_access.h"
#include "core/variant/variant.h"
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
		struct FileDependencies {
			String resource_path;
			String remap_file_path;
			int64_t remap_file_size;
			String remap_file_md5;
			String remap_file_sha256;
			String remap_path;
			int64_t remap_size;
			String remap_md5;
			String remap_sha256;
			LocalVector<FileDependencies *> dependencies;

			Error write_deps_json_file(const String &p_path);
			void flatten_dependencies(LocalVector<FileDependencies *> &r_deps) {
				if (r_deps.has(this)) {
					return;
				}
				r_deps.push_back(this);
				for (FileDependencies *dependency : dependencies) {
					dependency->flatten_dependencies(r_deps);
				}
			}

			FileDependencies(const ExportData *p_export_data, const String &p_resource_path, const String &p_remap_file_path, const String &p_remap_path) :
					resource_path(p_resource_path), remap_file_path(p_remap_file_path), remap_path(p_remap_path) {
				ERR_FAIL_COND(resource_path.is_empty());
				ERR_FAIL_COND(remap_file_path.is_empty());
				ERR_FAIL_COND(remap_path.is_empty());

				String real_remap_file_path = p_export_data->res_to_global(remap_file_path);
				String real_remap_path = p_export_data->res_to_global(remap_path);

				ERR_FAIL_COND(!FileAccess::exists(real_remap_file_path));
				ERR_FAIL_COND(!FileAccess::exists(real_remap_path));

				remap_file_size = FileAccess::get_size(real_remap_file_path);
				remap_size = FileAccess::get_size(real_remap_path);

				remap_file_md5 = real_remap_file_path.md5_text();
				remap_file_sha256 = real_remap_file_path.sha256_text();
				remap_md5 = real_remap_path.md5_text();
				remap_sha256 = real_remap_path.sha256_text();
			}
		};

		HashMap<String, FileDependencies> dependencies;
		EditorExportPlatformData::PackData pack_data;
		String assets_directory;
		String libraries_directory;
		bool debug;
		LocalVector<String> libraries;

		Error add_dependencies(const String &p_resource_path, bool p_is_encrypted = false, const PackedByteArray &p_key = PackedByteArray());
		String res_to_global(const String &p_res_path) const {
			String res_path = simplify_path(p_res_path);
			return assets_directory.path_join(res_path.trim_prefix("res://"));
		}
		String global_to_res(const String &p_global_path) const {
			return "res://" + p_global_path.trim_prefix(assets_directory.trim_suffix("/") + "/");
		}
	};

	class AsyncDialog : public ConfirmationDialog {
		GDCLASS(AsyncDialog, ConfirmationDialog);

		enum TabId {
			TAB_ID_MAIN_SCENE,
			TAB_ID_SELECT_RESOURCES,
			TAB_ID_MAX,
		};

		EditorExportPlatformWeb *export_platform = nullptr;

		TabContainer *tab_container = nullptr;
		Tree *main_scene_tree = nullptr;
		Tree *select_resources_tree = nullptr;

		bool _fill_tree(EditorFileSystemDirectory *p_dir, Tree *p_tree, TreeItem *p_tree_item, bool p_read_only);

		void _update_display();
		void _update_tab_main_scene();
		void _update_tab_select_resources();
		void _update_theme();

		void _on_tab_container_tab_changed(int p_tab);

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
	void _fix_html(Vector<uint8_t> &p_html, const Ref<EditorExportPreset> &p_preset, const String &p_name, bool p_debug, BitField<EditorExportPlatform::DebugFlags> p_flags, const Vector<SharedObject> p_shared_objects, const Dictionary &p_file_sizes, const String &p_main_scene_deps_json);
	Error _add_manifest_icon(const Ref<EditorExportPreset> &p_preset, const String &p_path, const String &p_icon, int p_size, Array &r_arr);
	Error _build_pwa(const Ref<EditorExportPreset> &p_preset, const String p_path, const Vector<SharedObject> &p_shared_objects);
	Error _write_or_error(const uint8_t *p_content, int p_len, String p_path);

	Error _export_project(const Ref<EditorExportPreset> &p_preset, int p_debug_flags);
	Error _launch_browser(const String &p_bind_host, uint16_t p_bind_port, bool p_use_tls);
	Error _start_server(const String &p_bind_host, uint16_t p_bind_port, bool p_use_tls);
	Error _stop_server();

	static Error _rename_and_store_file_in_async_pck(void *p_userdata, const String &p_path, const Vector<uint8_t> &p_data, int p_file, int p_total, const Vector<String> &p_enc_in_filters, const Vector<String> &p_enc_ex_filters, const PackedByteArray &p_key, uint64_t p_seed);
	void _open_async_dialog();
	void _on_async_dialog_visibility_changed();

	String _get_main_scene_path() const;

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
