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

#include "core/config/engine.h"
#include "core/object/class_db.h"
#include "core/object/object.h"
#include "core/string/print_string.h"
#include "core/variant/typed_array.h"
#include "core/variant/variant.h"

void ResourceFetcher::_notification(int p_what) {
	switch (p_what) {
		case NOTIFICATION_ENTER_TREE: {
			if (_auto_start) {
				start();
			}
		} break;
		case NOTIFICATION_PROCESS: {
			_poll();
		} break;
	}
}

bool ResourceFetcher::_is_runtime_enabled() const {
	if (Engine::get_singleton()->is_editor_hint()) {
		return false;
	}
	if (!OS::get_singleton()->has_feature("fetch")) {
		return false;
	}

	return true;
}

void ResourceFetcher::_poll() {
}

void ResourceFetcher::start() {
	if (!_is_runtime_enabled()) {
		return;
	}

	_status = FetchStatus::FETCH_STATUS_FETCHING;
	print_line(vformat("start()!"));

	// for (const Ref<Resource> resource : get_resources()) {
	// 	if (resource.is_null()) {
	// 		continue;
	// 	}
	// 	Error err = OS::get_singleton()->async_fetch_start(resource->get_path());
	// 	if (err != OK) {
	// 		ResourceStatus status = {
	// 			.status = OS::AsyncFetchStatus::ASYNC_FETCH_ERROR,
	// 			.try_count = 1
	// 		};
	// 		_resource_status.insert(resource, status);
	// 	}
	// }
}

void ResourceFetcher::reset() {
	if (!_is_runtime_enabled()) {
		return;
	}

	_status = FetchStatus::FETCH_STATUS_IDLE;

	for (const Ref<Resource> resource : get_resources()) {
		if (resource.is_null()) {
			continue;
		}
		OS::get_singleton()->async_fetch_cancel(resource->get_path());
	}
}

ResourceFetcher::FetchStatus ResourceFetcher::get_status() const {
	return _status;
}

void ResourceFetcher::set_auto_start(bool p_auto_start) {
	_auto_start = p_auto_start;
}

bool ResourceFetcher::get_auto_start() const {
	return _auto_start;
}

void ResourceFetcher::set_resources(const TypedArray<Resource> &p_resources) {
	_resources.clear();
	for (const Ref<Resource> p_resource : p_resources) {
		_resources.push_back(p_resource);
	}
}

TypedArray<Resource> ResourceFetcher::get_resources() const {
	TypedArray<Resource> resources;
	for (const Ref<Resource> &resource : _resources) {
		resources.append(resource);
	}
	return resources;
}

void ResourceFetcher::add_resource(const Ref<Resource> &p_resource) {
	ERR_FAIL_COND(p_resource.is_null());
	ERR_FAIL_COND(_resources.has(p_resource));
	_resources.push_back(p_resource);
}

void ResourceFetcher::remove_resource(const Ref<Resource> &p_resource) {
	ERR_FAIL_COND(!_resources.has(p_resource));
	_resources.erase(p_resource);
}

bool ResourceFetcher::has_resource(const Ref<Resource> &p_resource) const {
	return _resources.has(p_resource);
}

void ResourceFetcher::_bind_methods() {
	ClassDB::bind_method(D_METHOD("start"), &ResourceFetcher::start);
	ClassDB::bind_method(D_METHOD("reset"), &ResourceFetcher::reset);
	ClassDB::bind_method(D_METHOD("get_status"), &ResourceFetcher::get_status);

	ClassDB::bind_method(D_METHOD("set_auto_start", "auto_start"), &ResourceFetcher::set_auto_start);
	ClassDB::bind_method(D_METHOD("get_auto_start"), &ResourceFetcher::get_auto_start);

	ClassDB::bind_method(D_METHOD("add_resource", "resource"), &ResourceFetcher::add_resource);
	ClassDB::bind_method(D_METHOD("remove_resource", "resource"), &ResourceFetcher::remove_resource);
	ClassDB::bind_method(D_METHOD("has_resource", "resource"), &ResourceFetcher::has_resource);

	ClassDB::bind_method(D_METHOD("set_resources", "resources"), &ResourceFetcher::set_resources);
	ClassDB::bind_method(D_METHOD("get_resources"), &ResourceFetcher::get_resources);

	ADD_PROPERTY(PropertyInfo(Variant::ARRAY, "resources", PROPERTY_HINT_NONE /**, "", PROPERTY_USAGE_NO_EDITOR | PROPERTY_USAGE_INTERNAL **/), "set_resources", "get_resources");
	ADD_PROPERTY(PropertyInfo(Variant::BOOL, "auto_start"), "set_auto_start", "get_auto_start");

	ADD_SIGNAL(MethodInfo("progress", PropertyInfo(Variant::STRING_NAME, "path"), PropertyInfo(Variant::INT, "downloaded"), PropertyInfo(Variant::INT, "total")));
	ADD_SIGNAL(MethodInfo("progress_total", PropertyInfo(Variant::INT, "downloaded"), PropertyInfo(Variant::INT, "total")));
	ADD_SIGNAL(MethodInfo("error", PropertyInfo(Variant::STRING_NAME, "path")));
}

ResourceFetcher::ResourceFetcher() {
	if (Engine::get_singleton()->is_editor_hint()) {
		_status = FetchStatus::FETCH_STATUS_EDITOR;
		set_process(false);
		set_physics_process(false);
		return;
	}

	_status = FetchStatus::FETCH_STATUS_IDLE;
}
