/**************************************************************************/
/*  css.cpp                                                               */
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

#include "css.h"

#include "core/io/file_access.h"
#include "core/object/class_db.h"
#include "core/object/object.h"

Error CSS::parse(const Variant &p_css_string) {
	return OK;
}

String CSS::get_code() {
	return _code;
}

void CSS::set_code(String p_code) {
	_code = p_code;
}

void CSS::_bind_methods() {
	ClassDB::bind_method(D_METHOD("set_code", "code"), &CSS::set_code);
	ClassDB::bind_method(D_METHOD("get_code"), &CSS::get_code);

	ADD_PROPERTY(PropertyInfo(Variant::STRING, "code", PROPERTY_HINT_NONE, "", PROPERTY_USAGE_NO_EDITOR), "set_code", "get_code");
}

Ref<Resource> ResourceFormatLoaderCSS::load(const String &p_path, const String &p_original_path, Error *r_error, bool p_use_sub_threads, float *r_progress, CacheMode p_cache_mode) {
	if (r_error) {
		*r_error = ERR_FILE_CANT_OPEN;
	}

	if (!FileAccess::exists(p_path)) {
		*r_error = ERR_FILE_NOT_FOUND;
		return Ref<Resource>();
	}

	Ref<CSS> css;
	css.instantiate();

	Error err = css->parse(FileAccess::get_file_as_string(p_path));
	if (err != OK) {
		String err_text = vformat("Error parsing CSS file at '%s', on line %s: %s", p_path, itos(css->get_error_line()), css->get_error_message());

		if (Engine::get_singleton()->is_editor_hint()) {
			WARN_PRINT(err_text);
		} else {
			if (r_error) {
				*r_error = err;
			}
			ERR_PRINT(err_text);
			return nullptr;
		}
	}

	if (r_error) {
		*r_error = OK;
	}

	return css;
}
void ResourceFormatLoaderCSS::get_recognized_extensions(List<String> *p_extensions) const {
	p_extensions->push_back("css");
}
bool ResourceFormatLoaderCSS::handles_type(const String &p_type) const {
	return (p_type == "CSS");
}
String ResourceFormatLoaderCSS::get_resource_type(const String &p_path) const {
	String extension = p_path.get_extension().to_lower();
	if (extension == "css") {
		return "CSS";
	}
	return "";
}

Error ResourceFormatSaverCSS::save(const Ref<Resource> &p_resource, const String &p_path, uint32_t p_flags) {
	return FAILED;
}
void ResourceFormatSaverCSS::get_recognized_extensions(const Ref<Resource> &p_resource, List<String> *p_extensions) const {
	Ref<CSS> css = p_resource;
	if (css.is_valid()) {
		p_extensions->push_back("css");
	}
}
bool ResourceFormatSaverCSS::recognize(const Ref<Resource> &p_resource) const {
	return p_resource->get_class_name() == "CSS";
}
