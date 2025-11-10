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

#include "core/config/project_settings.h"
#include "core/error/error_list.h"
#include "core/io/config_file.h"
#include "core/io/dir_access.h"
#include "core/io/file_access.h"
#include "editor/editor_string_names.h"
#include "editor/export/editor_export.h"
#include "editor/export/project_export.h"
#include "editor/import/resource_importer_texture_settings.h"
#include "editor/inspector/editor_properties.h"
#include "editor/settings/editor_settings.h"
#include "editor/themes/editor_scale.h"
#include "modules/zip/zip_reader.h"
#include "scene/gui/box_container.h"
#include "scene/gui/control.h"
#include "scene/gui/dialogs.h"
#include "scene/gui/line_edit.h"
#include "scene/gui/margin_container.h"
#include "scene/gui/menu_button.h"
#include "scene/gui/option_button.h"
#include "scene/gui/split_container.h"
#include "scene/gui/tab_container.h"
#include "scene/main/window.h"
#include "scene/resources/image_texture.h"
#include "scene/scene_string_names.h"

#include "logo_svg.gen.h"
#include "run_icon_svg.gen.h"

#include "modules/modules_enabled.gen.h" // For mono.
#include "modules/svg/image_loader_svg.h"

/**
 * EditorExportPlatformWeb::WebAsyncPckDialog
 */
void EditorExportPlatformWeb::AsyncPckDialog::_notification(int p_what) {
	auto _update_theme = [this]() -> void {
		duplicate_pck_button->set_button_icon(pck_item_list->get_editor_theme_icon(SNAME("Duplicate")));
		delete_pck_button->set_button_icon(pck_item_list->get_editor_theme_icon(SNAME("Remove")));
	};

	switch (p_what) {
		case NOTIFICATION_VISIBILITY_CHANGED: {
			if (is_visible()) {
				update_pck_item_list();
			}
		} break;

		case NOTIFICATION_ENTER_TREE: {
			connect(SNAME("canceled"), callable_mp(this, &AsyncPckDialog::on_canceled));
			connect(SceneStringName(confirmed), callable_mp(this, &AsyncPckDialog::on_confirmed));
		} break;

		case NOTIFICATION_EXIT_TREE: {
			disconnect(SNAME("canceled"), callable_mp(this, &AsyncPckDialog::on_canceled));
			disconnect(SceneStringName(confirmed), callable_mp(this, &AsyncPckDialog::on_confirmed));
		} break;

		case NOTIFICATION_THEME_CHANGED: {
			_update_theme();
		} break;

		case NOTIFICATION_READY: {
			_update_theme();
		} break;

		default: {
			// Do nothing.
		} break;
	}
}

void EditorExportPlatformWeb::AsyncPckDialog::_bind_methods() {
	ClassDB::bind_method("set_async_pck_path", &EditorExportPlatformWeb::AsyncPckDialog::set_async_pck_path);
	ClassDB::bind_method("get_async_pck_path", &EditorExportPlatformWeb::AsyncPckDialog::get_async_pck_path);
	ADD_PROPERTY(PropertyInfo(Variant::STRING, "async_pck_path"), "set_async_pck_path", "get_async_pck_path");
}

void EditorExportPlatformWeb::AsyncPckDialog::set_async_pck_path(const String &p_path) {
	Ref<AsyncPck> current = get_current_async_pck();
	if (current.is_null()) {
		return;
	}
	String path = p_path;
	if (!path.ends_with(".asyncpck")) {
		path += ".asyncpck";
	}
	current->path = p_path;
}

String EditorExportPlatformWeb::AsyncPckDialog::get_async_pck_path() {
	Ref<AsyncPck> current = get_current_async_pck();
	if (current.is_null()) {
		return "";
	}
	return current->path;
}

void EditorExportPlatformWeb::AsyncPckDialog::handle_cancel() {
	print_line("cancel!");
}

void EditorExportPlatformWeb::AsyncPckDialog::handle_confirm() {
	print_line("confirm!");
}

void EditorExportPlatformWeb::AsyncPckDialog::handle_add_pck() {
	print_line("add pck!");
	Ref<EditorExportPreset> current_preset = EditorNode::get_singleton()->get_project_export_dialog()->get_current_preset();
	ERR_FAIL_COND(current_preset.is_null());

	Ref<AsyncPck> async_pck;
	async_pck.instantiate();

	auto _get_async_pck_path = [&current_preset](int p_attempt) -> String {
		String export_path_basename = current_preset->get_export_path().get_file().get_basename();

		if (p_attempt > 1) {
			String format = "%s_%s.asyncpck";
			if (export_path_basename.is_empty()) {
				return vformat(format, current_preset->get_name().to_snake_case(), p_attempt);
			}
			return vformat(format, export_path_basename, p_attempt);
		}

		String format = "%s.asyncpck";
		if (export_path_basename.is_empty()) {
			return vformat(format, current_preset->get_name().to_snake_case());
		}
		return vformat(format, export_path_basename);
	};

	int attempt = 1;
	String path;
	while (true) {
		bool valid = true;
		path = _get_async_pck_path(attempt);
		if (!path.ends_with("/")) {
			path += "/";
		}
		for (int i = 0; i < static_cast<int32_t>(export_platform->async_pcks.size()); i++) {
			String async_pck_path = export_platform->async_pcks[i]->path;
			if (!async_pck_path.ends_with("/")) {
				async_pck_path += "/";
			}
			if (path.simplify_path() == async_pck_path.simplify_path()) {
				valid = false;
				break;
			}
		}

		if (valid) {
			break;
		}
		attempt += 1;
	}

	async_pck->path = path;
	export_platform->async_pcks.push_back(async_pck);

	update_pck_item_list();
}

void EditorExportPlatformWeb::AsyncPckDialog::handle_duplicate_pck() {
	print_line("duplicate pck!");
}

void EditorExportPlatformWeb::AsyncPckDialog::handle_delete_pck() {
	print_line("delete pck!");
}

void EditorExportPlatformWeb::AsyncPckDialog::update_pck_item_list() {
	updating = true;

	Ref<AsyncPck> current_async_pck = get_current_async_pck();

	int current_index = -1;
	pck_item_list->clear();
	for (int i = 0; i < static_cast<int32_t>(export_platform->async_pcks.size()); i++) {
		Ref<AsyncPck> async_pck = export_platform->async_pcks[i];
		if (async_pck == current_async_pck) {
			current_index = i;
		}
		String async_pck_path = async_pck->path;
		pck_item_list->add_item(async_pck_path);
	}

	if (current_index != -1) {
		pck_item_list->select(current_index);
	}

	updating = false;
	update_pck_settings();
}

void EditorExportPlatformWeb::AsyncPckDialog::update_pck_settings() {
	// Ref<AsyncPck> current_async_pck = get_current_async_pck();
	update_pck_path_setting();
}

void EditorExportPlatformWeb::AsyncPckDialog::update_pck_path_setting() {
	Ref<AsyncPck> current_async_pck = get_current_async_pck();
	if (current_async_pck.is_null()) {
		path_line_edit->set_editable(false);
		path_line_edit->set_text("");
		return;
	}

	path_line_edit->set_editable(true);
	path_line_edit->set_text(current_async_pck->path);
	validate_pck_path_setting(current_async_pck->path);
}

bool EditorExportPlatformWeb::AsyncPckDialog::validate_pck_path_setting(const String &p_path) {
	Ref<AsyncPck> current_async_pck = get_current_async_pck();
	if (current_async_pck.is_null()) {
		return true;
	}

	String path = p_path;
	if (path.is_empty()) {
		path_line_edit_error_label->set_text(TTRC("Path must be a relative path."));
		return false;
	}

	if (path.ends_with("/")) {
		if (!path.substr(0, path.length() - 1).ends_with(".asyncpck")) {
			path = path + ".asyncpck/";
			path_line_edit->set_text(path);
		}
	} else if (!path.ends_with(".asyncpck")) {
		path = path + ".asyncpck";
		path_line_edit->set_text(path);
	}

	if (!path.is_relative_path()) {
		path_line_edit_error_label->set_text(TTRC("Path must be a relative path."));
		return false;
	}

	current_async_pck->path = path;
	path_line_edit->set_text(path);

	return true;
}

Variant EditorExportPlatformWeb::AsyncPckDialog::drop_data_fw(const Point2 &p_point, Control *p_from) {
	return Variant();
}

bool EditorExportPlatformWeb::AsyncPckDialog::can_drop_data_fw(const Point2 &p_point, const Variant &p_data, Control *p_from) {
	return false;
}

void EditorExportPlatformWeb::AsyncPckDialog::get_drag_data_fw(const Point2 &p_point, const Variant &p_data, Control *p_from) {
}

void EditorExportPlatformWeb::AsyncPckDialog::on_path_focus_exited() {
	if (validate_pck_path_setting(path_line_edit->get_text())) {
		update_pck_item_list();
	}
}

void EditorExportPlatformWeb::AsyncPckDialog::on_canceled() {
	handle_cancel();
}

void EditorExportPlatformWeb::AsyncPckDialog::on_confirmed() {
	handle_confirm();
}

void EditorExportPlatformWeb::AsyncPckDialog::on_delete_pck_confirmation_dialog_confirmed() {
	handle_delete_pck();
}

void EditorExportPlatformWeb::AsyncPckDialog::on_add_pck_button_pressed() {
	handle_add_pck();
}

void EditorExportPlatformWeb::AsyncPckDialog::on_duplicate_pck_button_pressed() {
	handle_duplicate_pck();
}

void EditorExportPlatformWeb::AsyncPckDialog::on_delete_pck_button_pressed() {
	handle_delete_pck();
}

void EditorExportPlatformWeb::AsyncPckDialog::on_item_list_item_selected(int p_item_selected) {
	update_pck_item_list();
}

void EditorExportPlatformWeb::AsyncPckDialog::on_export_filter_item_selected(int p_item_selected) {
}

void EditorExportPlatformWeb::AsyncPckDialog::on_file_mode_popup_id_pressed(int p_item_selected) {
}

void EditorExportPlatformWeb::AsyncPckDialog::on_filter_changed() {
}

Ref<EditorExportPlatformWeb::AsyncPck> EditorExportPlatformWeb::AsyncPckDialog::get_current_async_pck() {
	if (pck_item_list->get_current() >= 0 && pck_item_list->get_current() < pck_item_list->get_item_count()) {
		return export_platform->async_pcks[pck_item_list->get_current()];
	}
	return nullptr;
}

EditorExportPlatformWeb::AsyncPckDialog::AsyncPckDialog(Ref<EditorExportPlatformWeb> p_export_platform) {
	ERR_FAIL_COND(p_export_platform.is_null());
	export_platform = p_export_platform;

	set_title(TTRC("Edit Exported Async PCKs"));
	set_flag(Window::FLAG_MAXIMIZE_DISABLED, false);
	set_clamp_to_embedder(true);
	set_min_size(Size2i(600 * EDSCALE, 400 * EDSCALE));
	set_size(Size2i(600 * EDSCALE, 600 * EDSCALE));

	VBoxContainer *main_container = memnew(VBoxContainer);
	add_child(main_container);
	main_container->set_anchors_and_offsets_preset(Control::LayoutPreset::PRESET_FULL_RECT);

	HSplitContainer *hbox = memnew(HSplitContainer);
	main_container->add_child(hbox);
	hbox->set_v_size_flags(Control::SIZE_EXPAND_FILL);
	if (EDITOR_GET("interface/touchscreen/enable_touch_optimizations")) {
		hbox->set_touch_dragger_enabled(true);
	}

	// PCKs list.
	VBoxContainer *pck_list_vb = memnew(VBoxContainer);
	pck_list_vb->set_h_size_flags(Control::SIZE_EXPAND_FILL);
	hbox->add_child(pck_list_vb);

	Label *async_pcks_label = memnew(Label(TTRC("Async PCKs")));
	async_pcks_label->set_theme_type_variation("HeaderSmall");

	HBoxContainer *pck_list_hb = memnew(HBoxContainer);
	pck_list_hb->add_child(async_pcks_label);
	pck_list_hb->add_spacer();
	pck_list_vb->add_child(pck_list_hb);

	add_pck_button = memnew(Button);
	add_pck_button->set_text(TTRC(U"Add…"));
	add_pck_button->connect(SceneStringName(pressed), callable_mp(this, &EditorExportPlatformWeb::AsyncPckDialog::on_add_pck_button_pressed));
	pck_list_hb->add_child(add_pck_button);

	MarginContainer *pck_list_margin_container = memnew(MarginContainer);
	pck_list_vb->add_child(pck_list_margin_container);
	pck_list_margin_container->set_v_size_flags(Control::SIZE_EXPAND_FILL);
	pck_item_list = memnew(ItemList);
	pck_item_list->set_theme_type_variation("ItemListSecondary");
	pck_item_list->set_auto_translate_mode(Node::AUTO_TRANSLATE_MODE_DISABLED);
	SET_DRAG_FORWARDING_GCD(pck_item_list, EditorExportPlatformWeb::AsyncPckDialog);
	pck_list_margin_container->add_child(pck_item_list);
	pck_item_list->connect(SceneStringName(item_selected), callable_mp(this, &EditorExportPlatformWeb::AsyncPckDialog::on_item_list_item_selected));
	duplicate_pck_button = memnew(Button);
	duplicate_pck_button->set_tooltip_text(TTRC("Duplicate"));
	duplicate_pck_button->set_flat(true);
	pck_list_hb->add_child(duplicate_pck_button);
	duplicate_pck_button->connect(SceneStringName(pressed), callable_mp(this, &EditorExportPlatformWeb::AsyncPckDialog::on_duplicate_pck_button_pressed));
	delete_pck_button = memnew(Button);
	delete_pck_button->set_tooltip_text(TTRC("Delete"));
	delete_pck_button->set_flat(true);
	pck_list_hb->add_child(delete_pck_button);
	delete_pck_button->connect(SceneStringName(pressed), callable_mp(this, &EditorExportPlatformWeb::AsyncPckDialog::on_delete_pck_button_pressed));

	// Async PCK settings.
	VBoxContainer *settings_vb = memnew(VBoxContainer);
	settings_vb->set_h_size_flags(Control::SIZE_EXPAND_FILL);
	hbox->add_child(settings_vb);

	path_line_edit = memnew(LineEdit);
	path_line_edit->set_accessibility_name(TTRC("Set Async PCK Path"));
	settings_vb->add_margin_child(TTRC("Async PCK Path (relative to the preset export path)"), path_line_edit);
	path_line_edit->connect(SceneStringName(focus_exited), callable_mp(this, &EditorExportPlatformWeb::AsyncPckDialog::on_path_focus_exited));

	path_line_edit_error_label = memnew(Label);
	path_line_edit_error_label->set_focus_mode(Control::FOCUS_ACCESSIBILITY);
	path_line_edit_error_label->add_theme_color_override(SceneStringName(font_color), EditorNode::get_singleton()->get_editor_theme()->get_color(SNAME("error_color"), EditorStringName(Editor)));
	settings_vb->add_child(path_line_edit_error_label);
	path_line_edit_error_label->hide();

	// Sections.
	sections = memnew(TabContainer);
	sections->set_use_hidden_tabs_for_min_size(true);
	sections->set_theme_type_variation("TabContainerOdd");
	settings_vb->add_child(sections);
	sections->set_v_size_flags(Control::SIZE_EXPAND_FILL);

	// Resources export parameters.
	ScrollContainer *resources_scroll_container = memnew(ScrollContainer);
	resources_scroll_container->set_name(TTR("Resources"));
	resources_scroll_container->set_horizontal_scroll_mode(ScrollContainer::SCROLL_MODE_DISABLED);
	sections->add_child(resources_scroll_container);

	VBoxContainer *resources_vb = memnew(VBoxContainer);
	resources_vb->set_h_size_flags(Control::SIZE_EXPAND_FILL);
	resources_vb->set_v_size_flags(Control::SIZE_EXPAND_FILL);
	resources_scroll_container->add_child(resources_vb);

	export_filter = memnew(OptionButton);
	export_filter->set_accessibility_name(TTRC("Export Mode"));
	export_filter->add_item(TTR("Export all resources in the project"));
	export_filter->add_item(TTR("Export selected scenes (and dependencies)"));
	export_filter->add_item(TTR("Export selected resources (and dependencies)"));
	export_filter->add_item(TTR("Export all resources in the project except resources checked below"));
	// export_filter->add_item(TTR("Export as dedicated server"));
	resources_vb->add_margin_child(TTR("Export Mode:"), export_filter);
	export_filter->connect(SceneStringName(item_selected), callable_mp(this, &EditorExportPlatformWeb::AsyncPckDialog::on_export_filter_item_selected));

	// server_strip_message = memnew(Label);
	// server_strip_message->set_focus_mode(Control::FOCUS_ACCESSIBILITY);
	// server_strip_message->set_visible(false);
	// server_strip_message->set_autowrap_mode(TextServer::AUTOWRAP_WORD_SMART);
	// server_strip_message->set_custom_minimum_size(Size2(300 * EDSCALE, 1));
	// resources_vb->add_child(server_strip_message);

	// {
	// 	LocalVector<StringName> resource_names;
	// 	ClassDB::get_inheriters_from_class("Resource", resource_names);

	// 	PackedStringArray strippable;
	// 	for (const StringName &resource_name : resource_names) {
	// 		if (ClassDB::has_method(resource_name, "create_placeholder", true)) {
	// 			strippable.push_back(resource_name);
	// 		}
	// 	}
	// 	strippable.sort();

	// 	String message = TTR("\"Strip Visuals\" will replace the following resources with placeholders:") + " ";
	// 	message += String(", ").join(strippable);
	// 	server_strip_message->set_text(message);
	// }

	file_mode_popup = memnew(PopupMenu);
	add_child(file_mode_popup);
	file_mode_popup->add_item(TTR("Strip Visuals"), EditorExportPreset::MODE_FILE_STRIP);
	file_mode_popup->add_item(TTR("Keep"), EditorExportPreset::MODE_FILE_KEEP);
	file_mode_popup->add_item(TTR("Remove"), EditorExportPreset::MODE_FILE_REMOVE);
	file_mode_popup->connect(SceneStringName(id_pressed), callable_mp(this, &EditorExportPlatformWeb::AsyncPckDialog::on_file_mode_popup_id_pressed));

	include_filters = memnew(LineEdit);
	include_filters->set_accessibility_name(TTRC("Include Filters"));
	resources_vb->add_margin_child(
			TTR("Filters to export non-resource files/folders\n(comma-separated, e.g: *.json, *.txt, docs/*)"),
			include_filters);
	include_filters->connect(SceneStringName(text_changed), callable_mp(this, &EditorExportPlatformWeb::AsyncPckDialog::on_filter_changed));

	exclude_filters = memnew(LineEdit);
	exclude_filters->set_accessibility_name(TTRC("Exclude Filters"));
	resources_vb->add_margin_child(
			TTR("Filters to exclude files/folders from project\n(comma-separated, e.g: *.json, *.txt, docs/*)"),
			exclude_filters);
	exclude_filters->connect(SceneStringName(text_changed), callable_mp(this, &EditorExportPlatformWeb::AsyncPckDialog::on_filter_changed));

	// Disable by default.
	path_line_edit->set_editable(false);
	duplicate_pck_button->set_disabled(true);
	delete_pck_button->set_disabled(true);
	sections->hide();

	// Deletion dialog.
	delete_pck_confirmation_dialog = memnew(ConfirmationDialog);
	add_child(delete_pck_confirmation_dialog);
	delete_pck_confirmation_dialog->set_ok_button_text(TTR("Delete"));
	delete_pck_confirmation_dialog->connect(SceneStringName(confirmed), callable_mp(this, &EditorExportPlatformWeb::AsyncPckDialog::on_delete_pck_confirmation_dialog_confirmed));

	// Export project file dialog.
	set_hide_on_ok(false);
}

/**
 * EditorExportPlatformWeb
 */

Error EditorExportPlatformWeb::_extract_template(const String &p_template, const String &p_dir, const String &p_name, bool pwa) {
	Ref<FileAccess> io_fa;
	zlib_filefunc_def io = zipio_create_io(&io_fa);
	unzFile pkg = unzOpen2(p_template.utf8().get_data(), &io);

	if (!pkg) {
		add_message(EXPORT_MESSAGE_ERROR, TTR("Prepare Templates"), vformat(TTR("Could not open template for export: \"%s\"."), p_template));
		return ERR_FILE_NOT_FOUND;
	}

	if (unzGoToFirstFile(pkg) != UNZ_OK) {
		add_message(EXPORT_MESSAGE_ERROR, TTR("Prepare Templates"), vformat(TTR("Invalid export template: \"%s\"."), p_template));
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
			add_message(EXPORT_MESSAGE_ERROR, TTR("Prepare Templates"), vformat(TTR("Could not write file: \"%s\"."), dst));
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
		add_message(EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Could not write file: \"%s\"."), p_path));
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

void EditorExportPlatformWeb::_fix_html(Vector<uint8_t> &p_html, const Ref<EditorExportPreset> &p_preset, const String &p_name, bool p_debug, BitField<EditorExportPlatform::DebugFlags> p_flags, const Vector<SharedObject> p_shared_objects, const Dictionary &p_file_sizes) {
	// Engine.js config
	Dictionary config;
	Array libs;
	for (int i = 0; i < p_shared_objects.size(); i++) {
		libs.push_back(p_shared_objects[i].path.get_file());
	}
	Vector<String> flags = gen_export_flags(p_flags & (~DEBUG_FLAG_DUMB_CLIENT));
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
			add_message(EXPORT_MESSAGE_ERROR, TTR("Icon Creation"), vformat(TTR("Could not read file: \"%s\"."), p_icon));
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
		add_message(EXPORT_MESSAGE_ERROR, TTR("Icon Creation"), vformat(TTR("Could not write file: \"%s\"."), icon_dest));
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
		name + ".pck"
	};
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
			add_message(EXPORT_MESSAGE_ERROR, TTR("PWA"), vformat(TTR("Could not read file: \"%s\"."), sw_path));
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
			add_message(EXPORT_MESSAGE_ERROR, TTR("PWA"), vformat(TTR("Could not read file: \"%s\"."), offline_dest));
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

	r_options->push_back(ExportOption(PropertyInfo(Variant::CALLABLE, "async/edit_exported_async_pcks", PROPERTY_HINT_TOOL_BUTTON, vformat("%s,Edit", TTRC("Edit Exported Async PCKs")), PROPERTY_USAGE_EDITOR | PROPERTY_USAGE_NO_INSTANCE_STATE), callable_mp(const_cast<EditorExportPlatformWeb *>(this), &EditorExportPlatformWeb::_open_edit_exported_async_pcks_dialog)));

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

	const String base_dir = p_path.get_base_dir();
	const String base_path = p_path.get_basename();
	const String base_name = p_path.get_file().get_basename();

	if (!DirAccess::exists(base_dir)) {
		add_message(EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Target folder does not exist or is inaccessible: \"%s\""), base_dir));
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
		add_message(EXPORT_MESSAGE_ERROR, TTR("Prepare Templates"), vformat(TTR("Template file not found: \"%s\"."), template_path));
		return ERR_FILE_NOT_FOUND;
	}

	// Export pck and shared objects
	Vector<SharedObject> shared_objects;
	String pck_path = base_path + ".pck";
	String zip_path;
	Error error;

	bool is_async_export_preset = (bool)p_preset->get("async/is_async_export_preset");
	if (is_async_export_preset) {
		if (FileAccess::exists(pck_path)) {
			add_message(EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR(R"*(Could not create directory "%s", a file with the same name exists.)*"), pck_path));
			return ERR_ALREADY_EXISTS;
		}

		bool clear_async_before_export = (bool)p_preset->get("async/clear_before_export");

		Ref<DirAccess> temporary_dir = DirAccess::create_temp("godot_web_export", true, &error);
		if (error != OK) {
			add_message(EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Could not create temporary directory.")));
			return error;
		}
		zip_path = temporary_dir->get_current_dir().path_join(vformat("%s.zip", base_name));
		save_zip(p_preset, p_debug, zip_path, &shared_objects);

		Ref<ZIPReader> zip_reader;
		zip_reader.instantiate();
		error = zip_reader->open(zip_path);
		if (error != OK) {
			add_message(EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Could not open .zip file: \"%s\"."), zip_path));
			return error;
		}
		if (clear_async_before_export && DirAccess::exists(pck_path)) {
			{
				Ref<DirAccess> pck_dir_access = DirAccess::open(pck_path);
				pck_dir_access->erase_contents_recursive();
			}
			{
				Ref<DirAccess> root_dir_access = DirAccess::open(".");
				root_dir_access->remove(pck_path);
			}
		}

		if (!DirAccess::exists(pck_path)) {
			error = DirAccess::make_dir_absolute(pck_path);
			if (error != OK) {
				add_message(EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR(R"*(Could not create directory: "%s")*"), pck_path));
				return error;
			}
		}

		Ref<DirAccess> root_dir = DirAccess::open(pck_path);
		if (root_dir.is_null()) {
			add_message(EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR(R"*(Could not open directory: "%s")*"), pck_path));
			return error;
		}

		PackedStringArray file_paths = zip_reader->get_files();
		for (const String &file_path : file_paths) {
			if (file_path.ends_with("/")) {
				root_dir->make_dir_recursive(file_path);
				continue;
			}

			String save_path = root_dir->get_current_dir().path_join(file_path);
			root_dir->make_dir_recursive(save_path.get_base_dir());
			PackedByteArray file_data;
			{
				Ref<FileAccess> file = FileAccess::open(save_path, FileAccess::WRITE);
				file_data = zip_reader->read_file(file_path, true);
				file->store_buffer(file_data);
			}

			if (file_path.ends_with(".remap")) {
				Ref<ConfigFile> remap_file;
				remap_file.instantiate();
				remap_file->parse(String::utf8((const char *)file_data.ptr()));

				String resource_path = "res://" + file_path.trim_suffix(".remap");
				List<String> resource_dependencies;
				ResourceLoader::get_dependencies(resource_path, &resource_dependencies);

				Array file_dependencies;
				for (const String &resource_dependency : resource_dependencies) {
					// print_line(vformat("[%s]: %s", resource_path, resource_dependency));
					Dictionary file_dependency;
					file_dependency["uid"] = resource_dependency.get_slice("::", 0);
					file_dependency["fallback_path"] = resource_dependency.get_slice("::", 2);
					file_dependencies.push_back(file_dependency);
				}
				remap_file->set_value("dependencies", "files", file_dependencies);
				remap_file->save(save_path);
			}
		}

		{
			Ref<DirAccess> da = DirAccess::create(DirAccess::ACCESS_FILESYSTEM);
			for (int i = 0; i < shared_objects.size(); i++) {
				String dst = root_dir->get_current_dir().path_join(shared_objects[i].path.get_file());
				error = da->copy(shared_objects[i].path, dst);
				if (error != OK) {
					add_message(EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Could not write file: \"%s\"."), shared_objects[i].path.get_file()));
					return error;
				}
			}
		}

		return OK;
	}

	error = save_pack(p_preset, p_debug, pck_path, &shared_objects);
	if (error != OK) {
		add_message(EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Could not write file: \"%s\"."), pck_path));
		return error;
	}

	{
		Ref<DirAccess> da = DirAccess::create(DirAccess::ACCESS_FILESYSTEM);
		for (int i = 0; i < shared_objects.size(); i++) {
			String dst = base_dir.path_join(shared_objects[i].path.get_file());
			error = da->copy(shared_objects[i].path, dst);
			if (error != OK) {
				add_message(EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Could not write file: \"%s\"."), shared_objects[i].path.get_file()));
				return error;
			}
		}
	}

	// Extract templates.
	error = _extract_template(template_path, base_dir, base_name, pwa);
	if (error) {
		// Message is supplied by the subroutine method.
		return error;
	}

	// Parse generated file sizes (pck and wasm, to help show a meaningful loading bar).
	Dictionary file_sizes;
	Ref<FileAccess> f = FileAccess::open(pck_path, FileAccess::READ);
	if (f.is_valid()) {
		file_sizes[pck_path.get_file()] = (uint64_t)f->get_length();
	}
	f = FileAccess::open(base_path + ".wasm", FileAccess::READ);
	if (f.is_valid()) {
		file_sizes[base_name + ".wasm"] = (uint64_t)f->get_length();
	}

	// Read the HTML shell file (custom or from template).
	const String html_path = custom_html.is_empty() ? base_path + ".html" : custom_html;
	Vector<uint8_t> html;
	f = FileAccess::open(html_path, FileAccess::READ);
	if (f.is_null()) {
		add_message(EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Could not read HTML shell: \"%s\"."), html_path));
		return ERR_FILE_CANT_READ;
	}
	html.resize(f->get_length());
	f->get_buffer(html.ptrw(), html.size());
	f.unref(); // close file.

	// Generate HTML file with replaced strings.
	_fix_html(html, p_preset, base_name, p_debug, p_flags, shared_objects, file_sizes);
	Error err = _write_or_error(html.ptr(), html.size(), p_path);
	if (err != OK) {
		// Message is supplied by the subroutine method.
		return err;
	}
	html.resize(0);

	// Export splash (why?)
	Ref<Image> splash = _get_project_splash(p_preset);
	const String splash_png_path = base_path + ".png";
	if (splash->save_png(splash_png_path) != OK) {
		add_message(EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Could not write file: \"%s\"."), splash_png_path));
		return ERR_FILE_CANT_WRITE;
	}

	// Save a favicon that can be accessed without waiting for the project to finish loading.
	// This way, the favicon can be displayed immediately when loading the page.
	if (export_icon) {
		Ref<Image> favicon = _get_project_icon(p_preset);
		const String favicon_png_path = base_path + ".icon.png";
		if (favicon->save_png(favicon_png_path) != OK) {
			add_message(EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Could not write file: \"%s\"."), favicon_png_path));
			return ERR_FILE_CANT_WRITE;
		}
		favicon->resize(180, 180);
		const String apple_icon_png_path = base_path + ".apple-touch-icon.png";
		if (favicon->save_png(apple_icon_png_path) != OK) {
			add_message(EXPORT_MESSAGE_ERROR, TTR("Export"), vformat(TTR("Could not write file: \"%s\"."), apple_icon_png_path));
			return ERR_FILE_CANT_WRITE;
		}
	}

	// Generate the PWA worker and manifest
	if (pwa) {
		err = _build_pwa(p_preset, p_path, shared_objects);
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
			add_message(EXPORT_MESSAGE_ERROR, TTR("Run"), vformat(TTR("Could not create HTTP server directory: %s."), dest));
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
		DirAccess::remove_file_or_error(basepath + ".pck");
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
		add_message(EXPORT_MESSAGE_ERROR, TTR("Run"), vformat(TTR("Error starting HTTP server: %d."), err));
	}
	return err;
}

Error EditorExportPlatformWeb::_stop_server() {
	server->stop();
	return OK;
}

void EditorExportPlatformWeb::_init_edit_exported_async_pcks_dialog() {
	if (edit_exported_async_pcks_dialog != nullptr) {
		return;
	}
	edit_exported_async_pcks_dialog = memnew(AsyncPckDialog(this));
	edit_exported_async_pcks_dialog->connect(SceneStringName(visibility_changed), callable_mp(this, &EditorExportPlatformWeb::_on_edit_exported_async_pcks_dialog_visibility_changed));
}

void EditorExportPlatformWeb::_finalize_edit_exported_async_pcks_dialog() {
	if (edit_exported_async_pcks_dialog == nullptr) {
		return;
	}
	edit_exported_async_pcks_dialog->disconnect(SceneStringName(visibility_changed), callable_mp(this, &EditorExportPlatformWeb::_on_edit_exported_async_pcks_dialog_visibility_changed));
	edit_exported_async_pcks_dialog->queue_free();
	edit_exported_async_pcks_dialog = nullptr;
}

void EditorExportPlatformWeb::_open_edit_exported_async_pcks_dialog() {
	if (edit_exported_async_pcks_dialog == nullptr) {
		_init_edit_exported_async_pcks_dialog();
	}
	edit_exported_async_pcks_dialog->popup_exclusive_centered(EditorNode::get_singleton()->get_project_export_dialog());
}

void EditorExportPlatformWeb::_on_edit_exported_async_pcks_dialog_visibility_changed() {
	if (edit_exported_async_pcks_dialog->is_visible()) {
		return;
	}
	_finalize_edit_exported_async_pcks_dialog();
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

EditorExportPlatformWeb::~EditorExportPlatformWeb() {
	_finalize_edit_exported_async_pcks_dialog();
}
