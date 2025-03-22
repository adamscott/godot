/**************************************************************************/
/*  css.h                                                                 */
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

#include "core/io/resource.h"
#include "core/io/resource_loader.h"
#include "core/io/resource_saver.h"

class CSS : public Resource {
	GDCLASS(CSS, Resource);

	struct Property {
	};

	struct Value {
	};

	struct PropertiesList {
		Property property;
		Value value;

		PropertiesList *properties_list = nullptr;
	};

	struct SelectorsList {
		struct PseudoClass {
		};
		struct PseudoElement {
		};

		PropertiesList *properties_list = nullptr;
		// Other selectors that match this rule.
		SelectorsList *selectors_list = nullptr;
	};

	struct StyleRule {
		SelectorsList selector_list;
		PropertiesList properties_list;
	};

	LocalVector<StyleRule *> style_rules;

	String _code;
	String _error_str;
	int _error_line = 0;

protected:
	static void _bind_methods();

public:
	Error parse(const Variant &p_css_string);

	static String stringify(const Variant &p_var, const String &p_indent = "");

	String get_code();
	void set_code(String p_code);

	_FORCE_INLINE_ int get_error_line() const { return _error_line; }
	_FORCE_INLINE_ String get_error_message() const { return _error_str; }
};

class ResourceFormatLoaderCSS : public ResourceFormatLoader {
public:
	virtual Ref<Resource> load(const String &p_path, const String &p_original_path = "", Error *r_error = nullptr, bool p_use_sub_threads = false, float *r_progress = nullptr, CacheMode p_cache_mode = CACHE_MODE_REUSE) override;
	virtual void get_recognized_extensions(List<String> *p_extensions) const override;
	virtual bool handles_type(const String &p_path) const override;
	virtual String get_resource_type(const String &p_path) const override;
};

class ResourceFormatSaverCSS : public ResourceFormatSaver {
public:
	virtual Error save(const Ref<Resource> &p_resource, const String &p_path, uint32_t p_flags = 0) override;
	virtual void get_recognized_extensions(const Ref<Resource> &p_resource, List<String> *p_extensions) const override;
	virtual bool recognize(const Ref<Resource> &p_resource) const override;
};
