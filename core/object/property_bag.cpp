/**************************************************************************/
/*  property_bag.cpp                                                      */
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

#include "property_bag.h"

#include "core/object/class_db.h"

bool PropertyBag::_set(const StringName &p_name, const Variant &p_value) {
	if (properties.has(p_name)) {
		properties[p_name] = p_value;
		return true;
	}
	return false;
}

bool PropertyBag::_get(const StringName &p_name, Variant &r_ret) const {
	if (properties.has(p_name)) {
		r_ret = properties[p_name];
		return true;
	}
	return false;
}

bool PropertyBag::has_property(const StringName &p_name) {
	return properties.has(p_name);
}

void PropertyBag::add_property(const StringName &p_name) {
	ERR_FAIL_COND(properties.has(p_name));
	properties[p_name] = Variant();
}

void PropertyBag::remove_property(const StringName &p_name) {
	ERR_FAIL_COND(!properties.has(p_name));
	properties.erase(p_name);
}

void PropertyBag::clear_properties() {
	properties.clear();
}
