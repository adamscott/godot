/**************************************************************************/
/*  css_container.cpp                                                     */
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

#include "css_container.h"

#include "core/io/css.h"
#include "core/object/object.h"

void CSSContainer::_resort() {
	for (int i = 0; i < get_child_count(); i++) {
		Control *c = as_sortable_control(get_child(i));
		if (c == nullptr) {
			continue;
		}

		Size2i size = c->get_combined_minimum_size();

		fit_child_in_rect(c, Rect2(50, 50, size.width, size.height));
	}
}

Ref<CSS> CSSContainer::get_css() {
	return _css;
}

void CSSContainer::set_css(Ref<CSS> p_css) {
	_css = p_css;
}

void CSSContainer::_bind_methods() {
	ClassDB::bind_method(D_METHOD("set_css", "css"), &CSSContainer::set_css);
	ClassDB::bind_method(D_METHOD("get_css"), &CSSContainer::get_css);

	ADD_PROPERTY(PropertyInfo(Variant::OBJECT, "css", PROPERTY_HINT_RESOURCE_TYPE, "CSS"), "set_css", "get_css");
}

void CSSContainer::_notification(int p_what) {
	switch (p_what) {
		case NOTIFICATION_THEME_CHANGED: {
			update_minimum_size();
		} break;

		case NOTIFICATION_SORT_CHILDREN: {
			_resort();
		} break;
	}
}

CSSContainer::CSSContainer() {
}
