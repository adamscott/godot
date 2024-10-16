/**************************************************************************/
/*  resource_fetcher_editor_plugin.cpp                                    */
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

#include "resource_fetcher_editor_plugin.h"

#include "editor/editor_command_palette.h"
#include "editor/editor_node.h"
#include "editor/gui/editor_bottom_panel.h"
#include "editor/themes/editor_scale.h"
#include "scene/main/resource_fetcher.h"

void ResourceFetcherEditor::_notification(int p_what) {
}

void ResourceFetcherEditor::edit(ResourceFetcher *p_fetcher) {
	fetcher = p_fetcher;
}

void ResourceFetcherEditor::_bind_methods() {
}

ResourceFetcherEditor::ResourceFetcherEditor() {
}

ResourceFetcherEditor::~ResourceFetcherEditor() {}

void ResourceFetcherEditorPlugin::edit(Object *p_object) {
	ResourceFetcher *resource_fetcher = Object::cast_to<ResourceFetcher>(p_object);
	if (resource_fetcher == nullptr) {
		return;
	}

	_fetcher_editor->edit(resource_fetcher);
}

bool ResourceFetcherEditorPlugin::handles(Object *p_object) const {
	return p_object->is_class("ResourceFetcher");
}

void ResourceFetcherEditorPlugin::make_visible(bool p_visible) {
	if (p_visible) {
		_button->show();
		EditorNode::get_bottom_panel()->make_item_visible(_fetcher_editor);
		return;
	}
	if (_fetcher_editor->is_visible_in_tree()) {
		EditorNode::get_bottom_panel()->hide_bottom_panel();
	}
	_button->hide();
}

ResourceFetcherEditorPlugin::ResourceFetcherEditorPlugin() {
	_fetcher_editor = memnew(ResourceFetcherEditor);
	_fetcher_editor->set_custom_minimum_size(Size2(0, 250) * EDSCALE);

	_button = EditorNode::get_bottom_panel()->add_item("ResourceFetcher", _fetcher_editor, ED_SHORTCUT_AND_COMMAND("bottom_panels/toggle_resource_resource_fetcher_bottom_panel", TTR("Toggle ResourceFetcher Bottom Panel")));
	_button->hide();
}

ResourceFetcherEditorPlugin::~ResourceFetcherEditorPlugin() {
}
