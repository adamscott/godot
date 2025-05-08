/**************************************************************************/
/*  proxy_node.cpp                                                        */
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

#include "proxy_node.h"

#include "core/object/object.h"
#include "core/object/script_language.h"
#include "core/variant/typed_array.h"
#include "scene/3d/node_3d.h"
#include "scene/main/canvas_item.h"
#include "scene/main/node.h"

void ProxyNode::_notification(int p_what) {
	switch (p_what) {
		case NOTIFICATION_ENTER_TREE: {
			get_owner()->connect(SNAME("child_order_changed"), callable_mp(this, &ProxyNode::_on_child_order_changed));
		} break;
		case NOTIFICATION_CHILD_ORDER_CHANGED: {
			get_owner()->disconnect(SNAME("child_order_changed"), callable_mp(this, &ProxyNode::_on_child_order_changed));
		} break;
	}
}

bool ProxyNode::_set(const StringName &p_name, const Variant &p_value) {
	bool set_at_least_once = false;
	for (const NodePath &p_target_path : _target_paths) {
		Node *target = get_node_or_null(p_target_path);
		if (!target) {
			continue;
		}

		if (!target->is_class(_target_type)) {
			continue;
		}

		CanvasItem *canvas_item = Object::cast_to<CanvasItem>(target);
		if (canvas_item && _only_visible && !canvas_item->is_visible()) {
			continue;
		}

		Node3D *node_3d = Object::cast_to<Node3D>(target);
		if (node_3d && _only_visible && !node_3d->is_visible()) {
			continue;
		}

		target->set(p_name, p_value);
		set_at_least_once = true;
	}

	return set_at_least_once;
}

bool ProxyNode::_get(const StringName &p_name, Variant &r_ret) const {
	for (const NodePath &p_target_path : _target_paths) {
		Node *target = get_node_or_null(p_target_path);
		if (!target) {
			continue;
		}

		if (!target->is_class(_target_type)) {
			continue;
		}

		CanvasItem *canvas_item = Object::cast_to<CanvasItem>(target);
		if (canvas_item && _only_visible && !canvas_item->is_visible()) {
			continue;
		}

		Node3D *node_3d = Object::cast_to<Node3D>(target);
		if (node_3d && _only_visible && !node_3d->is_visible()) {
			continue;
		}

		r_ret = target->get(p_name);
		return true;
	}

	return false;
}

void ProxyNode::_get_property_list(List<PropertyInfo> *p_list) const {
	if (ClassDB::class_exists(_target_type)) {
		ClassDB::get_property_list(_target_type, p_list);
		return;
	}

	for (int i = 0; i < ScriptServer::get_language_count(); i++) {
		ScriptLanguage *language = ScriptServer::get_language(i);
		if (!language) {
			continue;
		}
		// TODO: Add "get_property_list" on language class.
	}
}

void ProxyNode::_on_child_order_changed() {
	_update_target_paths();
}

void ProxyNode::_update_target_paths() {
	LocalVector<NodePath> found;

	for (int i = 0; i < get_child_count(); i++) {
		Node *child = get_child(i);
		NodePath child_path = child->get_path();
		if (!_target_paths.has(child_path)) {
			continue;
		}
		found.push_back(child_path);
	}

	if (found.size() == _target_paths.size()) {
		return;
	}

	LocalVector<NodePath> targets_to_remove;
	for (NodePath target : _target_paths) {
		if (found.has(target)) {
			continue;
		}
		targets_to_remove.push_back(target);
	}

	for (NodePath target_to_remove : targets_to_remove) {
		_target_paths.erase(target_to_remove);
	}
}

void ProxyNode::set_only_visible(bool p_only_visible) {
	_only_visible = p_only_visible;
}

bool ProxyNode::get_only_visible() const {
	return _only_visible;
}

void ProxyNode::set_target_type(const StringName &p_target_type) {
	_target_type = p_target_type;
}

StringName ProxyNode::get_target_type() const {
	return _target_type;
}

void ProxyNode::set_target_paths(LocalVector<NodePath> p_target_paths) {
	_target_paths.clear();
	for (NodePath target_path : p_target_paths) {
		_target_paths.push_back(target_path);
	}
}

void ProxyNode::_set_target_paths(TypedArray<NodePath> p_target_paths) {
	_target_paths.clear();
	for (int i = 0; i < p_target_paths.size(); i++) {
		_target_paths.push_back(p_target_paths[i]);
	}
}

LocalVector<NodePath> ProxyNode::get_target_paths() const {
	return _target_paths;
}

TypedArray<NodePath> ProxyNode::_get_target_paths() const {
	TypedArray<NodePath> array;
	for (NodePath target_path : _target_paths) {
		array.push_back(target_path);
	}
	return array;
}

bool ProxyNode::has_target_path(NodePath p_target_path) const {
	return _target_paths.has(p_target_path);
}

ProxyNode::ProxyNode() {
}

void ProxyNode::_bind_methods() {
	ClassDB::bind_method(D_METHOD("set_only_visible", "only_visible"), &ProxyNode::set_only_visible);
	ClassDB::bind_method(D_METHOD("get_only_visible"), &ProxyNode::get_only_visible);
	ClassDB::bind_method(D_METHOD("set_target_type", "target_type"), &ProxyNode::set_target_type);
	ClassDB::bind_method(D_METHOD("get_target_type"), &ProxyNode::get_target_type);
	ClassDB::bind_method(D_METHOD("set_target_paths", "targets"), &ProxyNode::_set_target_paths);
	ClassDB::bind_method(D_METHOD("get_target_paths"), &ProxyNode::_get_target_paths);
	ClassDB::bind_method(D_METHOD("has_target", "target"), &ProxyNode::has_target_path);

	ADD_PROPERTY(PropertyInfo(Variant::BOOL, "only_visible"), "set_only_visible", "get_only_visible");
	ADD_PROPERTY(PropertyInfo(Variant::STRING_NAME, "target_type"), "set_target_type", "get_target_type");
	ADD_PROPERTY(PropertyInfo(Variant::ARRAY, "targets", PROPERTY_HINT_ARRAY_TYPE, vformat("%s/%s:%s", Variant::NODE_PATH, PROPERTY_HINT_NODE_PATH_VALID_TYPES, "Node")), "set_target_paths", "get_target_paths");
}
