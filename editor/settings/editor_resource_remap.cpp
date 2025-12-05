/**************************************************************************/
/*  editor_resource_remap.cpp                                             */
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

#include "editor_resource_remap.h"

#include "core/error/error_macros.h"
#include "core/object/callable_method_pointer.h"
#include "core/object/object.h"
#include "core/string/string_name.h"
#include "core/variant/variant.h"
#include "editor/editor_interface.h"
#include "editor/gui/editor_file_dialog.h"
#include "editor/themes/editor_scale.h"
#include "scene/gui/box_container.h"
#include "scene/gui/control.h"
#include "scene/gui/margin_container.h"
#include "scene/gui/scroll_container.h"
#include "scene/resources/texture.h"

// EditorResourceRemap.
String EditorResourceRemap::get_selected_feature_from_range(const TreeItem *p_item) {
	ERR_FAIL_NULL_V(p_item, "");
	PackedStringArray features = p_item->get_text(ResourceRemapOptionTree::COLUMN_FEATURE).split(",");
	int index = p_item->get_range(ResourceRemapOptionTree::COLUMN_FEATURE);
	ERR_FAIL_INDEX_V(index, features.size(), "");
	return features[index];
}

void EditorResourceRemap::on_add_button_pressed() {
	file_open_dialog->popup_exclusive_centered_clamped(this, Vector2(1050, 700) * get_theme_default_base_scale(), 0.8f);
}

void EditorResourceRemap::on_tree_cell_selected() {
}

void EditorResourceRemap::on_tree_button_clicked(Object *p_item, int p_column, int p_button, int p_mouse_button) {
}

void EditorResourceRemap::on_file_open_dialog_files_selected(const PackedStringArray &p_files) {
}

void EditorResourceRemap::on_option_add_button_pressed() {
	option_file_open_dialog->popup_exclusive_centered_clamped(this, Vector2(1050, 700) * get_theme_default_base_scale(), 0.8f);
}

void EditorResourceRemap::on_option_tree_item_edited() {
}

void EditorResourceRemap::on_option_tree_button_clicked(Object *p_item, int p_column, int p_button, int p_mouse_button) {
}

void EditorResourceRemap::on_option_tree_items_reordered(TreeItem *p_item, TreeItem *p_relative_to, bool p_before) {
}

void EditorResourceRemap::on_option_file_open_dialog_files_selected(const PackedStringArray &p_files) {
}

void EditorResourceRemap::update_theme() {
	Ref<Texture2D> add_button_icon = get_theme_icon(SNAME("Add"), SNAME("EditorIcons"));
	add_button->set_button_icon(add_button_icon);
	option_add_button->set_button_icon(add_button_icon);

	tree_scroll_container->set_custom_minimum_size(Size2(0, 150 * EDSCALE));
}

void EditorResourceRemap::_notification(int p_what) {
	switch (p_what) {
		case NOTIFICATION_THEME_CHANGED: {
			update_theme();
		} break;
	}
}

void EditorResourceRemap::_bind_methods() {
}

EditorResourceRemap::EditorResourceRemap() {
	set_h_size_flags(SizeFlags::SIZE_EXPAND_FILL);
	set_v_size_flags(SizeFlags::SIZE_EXPAND_FILL);

	HBoxContainer *remaps_header_container = memnew(HBoxContainer);
	// remaps_header_container->set_h_size_flags(SizeFlags::SIZE_EXPAND_FILL);
	Label *remaps_header_title_label = memnew(Label);
	remaps_header_title_label->set_text(TTRC("Resources:"));
	remaps_header_title_label->set_theme_type_variation(SNAME("HeaderSmall"));
	remaps_header_container->add_child(remaps_header_title_label);
	remaps_header_container->add_spacer();
	add_child(remaps_header_container);

	add_button = memnew(Button);
	add_button->set_text(TTRC("Add"));
	add_button->connect(SNAME("pressed"), callable_mp(this, &EditorResourceRemap::on_add_button_pressed));
	remaps_header_container->add_child(add_button);

	tree_scroll_container = memnew(ScrollContainer);
	add_child(tree_scroll_container);

	VBoxContainer *tree_container = memnew(VBoxContainer);
	tree_container->set_v_size_flags(SizeFlags::SIZE_EXPAND_FILL);
	tree_scroll_container->add_child(tree_container);

	tree = memnew(Tree);
	tree->set_v_size_flags(Control::SIZE_EXPAND_FILL);
	tree->connect(SNAME("cell_selected"), callable_mp(this, &EditorResourceRemap::on_tree_cell_selected));
	tree->connect(SNAME("button_clicked"), callable_mp(this, &EditorResourceRemap::on_tree_button_clicked));
	tree_container->add_child(tree);

	file_open_dialog = memnew(EditorFileDialog);
	file_open_dialog->set_file_mode(FileDialog::FileMode::FILE_MODE_OPEN_FILES);
	file_open_dialog->connect(SNAME("files_selected"), callable_mp(this, &EditorResourceRemap::on_file_open_dialog_files_selected));

	HBoxContainer *option_header_container = memnew(HBoxContainer);
	Label *option_header_title_label = memnew(Label);
	option_header_title_label->set_text(TTRC("Remaps by Feature:"));
	option_header_title_label->set_tooltip_text(TTRC("From top to bottom, the first remap in this list to match a feature in the export will be used.\nAny resources in this list that are not used will be excluded from the export."));
	option_header_title_label->set_mouse_filter(MouseFilter::MOUSE_FILTER_PASS);
	option_header_title_label->set_theme_type_variation(SNAME("HeaderSmall"));
	option_header_container->add_child(option_header_title_label);
	option_header_container->add_spacer();
	add_child(option_header_container);

	option_add_button = memnew(Button);
	option_add_button->set_text(TTRC("Add"));
	option_add_button->connect(SNAME("pressed"), callable_mp(this, &EditorResourceRemap::on_option_add_button_pressed));
	option_header_container->add_child(option_add_button);

	VBoxContainer *option_tree_container = memnew(VBoxContainer);
	option_tree_container->set_v_size_flags(SizeFlags::SIZE_EXPAND_FILL);
	add_child(option_tree_container);

	option_tree = memnew(ResourceRemapOptionTree);
	option_tree->connect(SNAME("item_edited"), callable_mp(this, &EditorResourceRemap::on_option_tree_item_edited));
	option_tree->connect(SNAME("button_clicked"), callable_mp(this, &EditorResourceRemap::on_option_tree_button_clicked));
	option_tree->connect(SNAME("tree_items_reordered"), callable_mp(this, &EditorResourceRemap::on_option_tree_items_reordered));
	option_tree_container->add_child(option_tree);

	option_file_open_dialog = memnew(EditorFileDialog);
	option_file_open_dialog->set_file_mode(FileDialog::FileMode::FILE_MODE_OPEN_FILES);
	option_file_open_dialog->connect(SNAME("files_selected"), callable_mp(this, &EditorResourceRemap::on_option_file_open_dialog_files_selected));
}

// ResourceRemapOptionTree.

void ResourceRemapOptionTree::update_theme() {
	set_column_custom_minimum_width(COLUMN_FEATURE, 220 * EDSCALE);

	Ref<Texture2D> triple_bar_icon = get_theme_icon(SNAME("TripleBar"), SNAME("EditorIcons"));
	set_column_custom_minimum_width(COLUMN_HANDLE, (triple_bar_icon->get_size().x + 32) * EDSCALE);
}

Variant ResourceRemapOptionTree::get_drag_data(const Point2 &p_point) {
	TreeItem *tree_item = get_selected();
	Control *drag_preview = memnew(Control);
	Label *preview_label = memnew(Label);
	Point2 preview_label_position = preview_label->get_position();

	// If you grab the middle of the handle, this space aligns the text to be around the same horizontal position.
	preview_label_position.x = 22;
	preview_label->set_position(preview_label_position);
	preview_label->set_text(EditorResourceRemap::get_selected_feature_from_range(tree_item));

	drag_preview->add_child(preview_label);
	set_drag_preview(drag_preview);
	return tree_item;
}

void ResourceRemapOptionTree::_notification(int p_what) {
	switch (p_what) {
		case NOTIFICATION_THEME_CHANGED: {
			update_theme();
		} break;
	}
}

void ResourceRemapOptionTree::_bind_methods() {
	ADD_SIGNAL(MethodInfo(SNAME("tree_items_reordered"), PropertyInfo(Variant::OBJECT, "item"), PropertyInfo(Variant::OBJECT, "relative_to"), PropertyInfo(Variant::BOOL, "before")));
}

ResourceRemapOptionTree::ResourceRemapOptionTree() {
	set_v_size_flags(SizeFlags::SIZE_EXPAND_FILL);

	set_columns(3);
	set_column_titles_visible(true);
	set_column_title(COLUMN_FEATURE, TTRC("Feature"));
	set_column_title(COLUMN_PATH, TTRC("Path"));
	set_column_expand(COLUMN_PATH, true);
	set_column_clip_content(COLUMN_PATH, true);
	set_column_expand(COLUMN_FEATURE, false);
	set_column_clip_content(COLUMN_FEATURE, false);
	set_column_expand(COLUMN_HANDLE, false);
	set_column_clip_content(COLUMN_HANDLE, false);
}
