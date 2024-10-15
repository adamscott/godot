/**************************************************************************/
/*  resource_fetcher.cpp                                                  */
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

#include "resource_fetcher.h"
#include "core/object/class_db.h"
#include "core/object/object.h"

void ResourceFetcher::start() {
	_status = FetchStatus::FETCH_STATUS_FETCHING;
}

void ResourceFetcher::reset() {
	_status = FetchStatus::FETCH_STATUS_IDLE;
}

ResourceFetcher::FetchStatus ResourceFetcher::get_status() const {
	return _status;
}

void ResourceFetcher::_set_resources(const Array &p_data) {
	_resources.clear();

	ERR_FAIL_COND(p_data.size() != 2);
	Vector<String> names = p_data[0];
	Array resdata = p_data[1];

	ERR_FAIL_COND(names.size() != resdata.size());

	for (int i = 0; i < resdata.size(); i++) {
		Ref<Resource> resource = resdata[i];
		ERR_CONTINUE(!resource.is_valid());
		_resources[names[i]] = resource;
	}
}

Array ResourceFetcher::_get_resources() const {
	Vector<String> names;
	Array arr;
	arr.resize(_resources.size());
	names.resize(_resources.size());

	RBSet<String> sorted_names;

	for (const KeyValue<StringName, Ref<Resource>> &E : _resources) {
		sorted_names.insert(E.key);
	}

	int i = 0;
	for (const String &sorted_name : sorted_names) {
		names.set(i, sorted_name);
		arr[i] = _resources[sorted_name];
		i++;
	}

	Array res;
	res.push_back(names);
	res.push_back(arr);
	return res;
}

void ResourceFetcher::add_resource(const StringName &p_name, const Ref<Resource> &p_resource) {
	ERR_FAIL_COND(p_resource.is_null());
	if (_resources.has(p_name)) {
		StringName new_name;
		int idx = 2;

		while (true) {
			new_name = p_name.operator String() + " " + itos(idx);
			if (_resources.has(new_name)) {
				idx++;
				continue;
			}

			break;
		}

		add_resource(new_name, p_resource);
	} else {
		_resources[p_name] = p_resource;
	}
}

void ResourceFetcher::remove_resource(const StringName &p_name) {
	ERR_FAIL_COND(!_resources.has(p_name));
	_resources.erase(p_name);
}

void ResourceFetcher::rename_resource(const StringName &p_from_name, const StringName &p_to_name) {
	ERR_FAIL_COND(!_resources.has(p_from_name));

	Ref<Resource> res = _resources[p_from_name];

	_resources.erase(p_from_name);
	add_resource(p_to_name, res);
}

bool ResourceFetcher::has_resource(const StringName &p_name) const {
	return _resources.has(p_name);
}

Ref<Resource> ResourceFetcher::get_resource(const StringName &p_name) const {
	ERR_FAIL_COND_V(!_resources.has(p_name), Ref<Resource>());
	return _resources[p_name];
}

Vector<String> ResourceFetcher::_get_resource_list() const {
	Vector<String> res;
	res.resize(_resources.size());
	int i = 0;
	for (const KeyValue<StringName, Ref<Resource>> &KV : _resources) {
		res.set(i, KV.key);
		i++;
	}

	return res;
}

void ResourceFetcher::get_resource_list(List<StringName> *p_list) {
	for (const KeyValue<StringName, Ref<Resource>> &KV : _resources) {
		p_list->push_back(KV.key);
	}
}

void ResourceFetcher::_bind_methods() {
	ClassDB::bind_method(D_METHOD("start"), &ResourceFetcher::start);
	ClassDB::bind_method(D_METHOD("reset"), &ResourceFetcher::reset);
	ClassDB::bind_method(D_METHOD("get_status"), &ResourceFetcher::get_status);

	ClassDB::bind_method(D_METHOD("add_resource", "name", "resource"), &ResourceFetcher::add_resource);
	ClassDB::bind_method(D_METHOD("remove_resource", "name"), &ResourceFetcher::remove_resource);
	ClassDB::bind_method(D_METHOD("rename_resource", "name", "newname"), &ResourceFetcher::rename_resource);
	ClassDB::bind_method(D_METHOD("has_resource", "name"), &ResourceFetcher::has_resource);
	ClassDB::bind_method(D_METHOD("get_resource", "name"), &ResourceFetcher::get_resource);
	ClassDB::bind_method(D_METHOD("get_resource_list"), &ResourceFetcher::_get_resource_list);

	ADD_PROPERTY(PropertyInfo(Variant::ARRAY, "resources", PROPERTY_HINT_NONE, "", PROPERTY_USAGE_NO_EDITOR | PROPERTY_USAGE_INTERNAL), "_set_resources", "_get_resources");

	ADD_SIGNAL(MethodInfo("progress", PropertyInfo(Variant::STRING_NAME, "path"), PropertyInfo(Variant::INT, "downloaded"), PropertyInfo(Variant::INT, "total")));
	ADD_SIGNAL(MethodInfo("progress_total", PropertyInfo(Variant::INT, "downloaded"), PropertyInfo(Variant::INT, "total")));
	ADD_SIGNAL(MethodInfo("error", PropertyInfo(Variant::STRING_NAME, "path")));
}

ResourceFetcher::ResourceFetcher() {}
