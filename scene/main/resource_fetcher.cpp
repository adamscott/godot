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

void ResourceFetcher::set_fetch_list(const Ref<ResourceFetchList> &p_fetch_list) {
	_fetch_list = p_fetch_list;
}

Ref<ResourceFetchList> ResourceFetcher::get_fetch_list() const {
	return _fetch_list;
}

void ResourceFetcher::_bind_methods() {
	ClassDB::bind_method(D_METHOD("start"), &ResourceFetcher::start);
	ClassDB::bind_method(D_METHOD("reset"), &ResourceFetcher::reset);
	ClassDB::bind_method(D_METHOD("get_status"), &ResourceFetcher::get_status);
	ClassDB::bind_method(D_METHOD("get_fetch_list"), &ResourceFetcher::get_fetch_list);
	ClassDB::bind_method(D_METHOD("set_fetch_list", "fetch_list"), &ResourceFetcher::set_fetch_list);

	ADD_PROPERTY(PropertyInfo(Variant::OBJECT, "fetch_list", PROPERTY_HINT_RESOURCE_TYPE, "ResourceFetchList"), "set_fetch_list", "get_fetch_list");

	ADD_SIGNAL(MethodInfo("progress", PropertyInfo(Variant::STRING_NAME, "path"), PropertyInfo(Variant::INT, "downloaded"), PropertyInfo(Variant::INT, "total")));
	ADD_SIGNAL(MethodInfo("progress_total", PropertyInfo(Variant::INT, "downloaded"), PropertyInfo(Variant::INT, "total")));
	ADD_SIGNAL(MethodInfo("error", PropertyInfo(Variant::STRING_NAME, "path")));
}

ResourceFetcher::ResourceFetcher() {}
