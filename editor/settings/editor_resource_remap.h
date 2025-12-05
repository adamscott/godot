/**************************************************************************/
/*  editor_resource_remap.h                                               */
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

#include "editor/gui/editor_file_dialog.h"
#include "scene/gui/box_container.h"
#include "scene/gui/button.h"
#include "scene/gui/scroll_container.h"
#include "scene/gui/tree.h"

class ResourceRemapOptionTree;

class EditorResourceRemap : public VBoxContainer {
	GDCLASS(EditorResourceRemap, VBoxContainer);

	bool updating_remaps = false;

	Button *add_button = nullptr;
	Button *option_add_button = nullptr;
	EditorFileDialog *file_open_dialog = nullptr;
	EditorFileDialog *option_file_open_dialog = nullptr;

	Tree *tree = nullptr;
	ResourceRemapOptionTree *option_tree = nullptr;

	ScrollContainer *tree_scroll_container = nullptr;

	void on_add_button_pressed();
	void on_tree_cell_selected();
	void on_tree_button_clicked(Object *p_item, int p_column, int p_button, int p_mouse_button);
	void on_file_open_dialog_files_selected(const PackedStringArray &p_files);

	void on_option_add_button_pressed();
	void on_option_tree_item_edited();
	void on_option_tree_button_clicked(Object *p_item, int p_column, int p_button, int p_mouse_button);
	void on_option_tree_items_reordered(TreeItem *p_item, TreeItem *p_relative_to, bool p_before);
	void on_option_file_open_dialog_files_selected(const PackedStringArray &p_files);

	void update_theme();

protected:
	void _notification(int p_what);
	static void _bind_methods();

public:
	static String get_selected_feature_from_range(const TreeItem *p_item);

	EditorResourceRemap();
};

class ResourceRemapOptionTree : public Tree {
	GDCLASS(ResourceRemapOptionTree, Tree);

public:
	enum Column {
		COLUMN_HANDLE = 0,
		COLUMN_FEATURE = 1,
		COLUMN_PATH = 2,
	};

private:
	void update_theme();

protected:
	void _notification(int p_what);
	static void _bind_methods();

public:
	virtual Variant get_drag_data(const Point2 &p_point) override;

	ResourceRemapOptionTree();
};
