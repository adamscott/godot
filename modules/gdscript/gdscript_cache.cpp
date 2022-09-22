/*************************************************************************/
/*  gdscript_cache.cpp                                                   */
/*************************************************************************/
/*                       This file is part of:                           */
/*                           GODOT ENGINE                                */
/*                      https://godotengine.org                          */
/*************************************************************************/
/* Copyright (c) 2007-2022 Juan Linietsky, Ariel Manzur.                 */
/* Copyright (c) 2014-2022 Godot Engine contributors (cf. AUTHORS.md).   */
/*                                                                       */
/* Permission is hereby granted, free of charge, to any person obtaining */
/* a copy of this software and associated documentation files (the       */
/* "Software"), to deal in the Software without restriction, including   */
/* without limitation the rights to use, copy, modify, merge, publish,   */
/* distribute, sublicense, and/or sell copies of the Software, and to    */
/* permit persons to whom the Software is furnished to do so, subject to */
/* the following conditions:                                             */
/*                                                                       */
/* The above copyright notice and this permission notice shall be        */
/* included in all copies or substantial portions of the Software.       */
/*                                                                       */
/* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,       */
/* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF    */
/* MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.*/
/* IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY  */
/* CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,  */
/* TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE     */
/* SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.                */
/*************************************************************************/

#include "gdscript_cache.h"

#include "core/io/file_access.h"
#include "core/templates/vector.h"
#include "gdscript.h"
#include "gdscript_analyzer.h"
#include "gdscript_parser.h"

bool GDScriptParserData::is_valid() const {
	return parser != nullptr;
}

GDScriptParserData::Status GDScriptParserData::get_status() const {
	return status;
}

GDScriptParser *GDScriptParserData::get_parser() const {
	return parser;
}

Error GDScriptParserData::raise_status(Status p_new_status) {
	ERR_FAIL_COND_V(parser == nullptr, ERR_INVALID_DATA);

	if (result != OK) {
		return result;
	}

	while (p_new_status > status) {
		switch (status) {
			case EMPTY:
				status = PARSED;
				result = parser->parse(GDScriptCache::get_source_code(path), path, false);
				break;
			case PARSED: {
				analyzer = memnew(GDScriptAnalyzer(parser));
				status = INHERITANCE_SOLVED;
				Error inheritance_result = analyzer->resolve_inheritance();
				if (result == OK) {
					result = inheritance_result;
				}
			} break;
			case INHERITANCE_SOLVED: {
				status = INTERFACE_SOLVED;
				Error interface_result = analyzer->resolve_interface();
				if (result == OK) {
					result = interface_result;
				}
			} break;
			case INTERFACE_SOLVED: {
				status = FULLY_SOLVED;
				Error body_result = analyzer->resolve_body();
				if (result == OK) {
					result = body_result;
				}
			} break;
			case FULLY_SOLVED: {
				return result;
			}
		}
		if (result != OK) {
			return result;
		}
	}

	return result;
}

GDScriptParserData::~GDScriptParserData() {
	if (parser != nullptr) {
		memdelete(parser);
	}
	if (analyzer != nullptr) {
		memdelete(analyzer);
	}
	MutexLock lock(GDScriptCache::singleton->lock);
	GDScriptCache::singleton->parser_map.erase(path);
}

GDScriptCache *GDScriptCache::singleton = nullptr;
bool GDScriptCache::destructing = false;

void GDScriptCache::remove_script(const String &p_path) {
	if (destructing) {
		return;
	}

	MutexLock lock(singleton->lock);

	for (String dependency : singleton->dependencies[p_path]) {
		if (singleton->dependencies[dependency].has(p_path)) {
			return;
		}
	}

	remove_dependencies(p_path, p_path);
}

void GDScriptCache::remove_dependencies(const String &p_source, const String &p_path, const bool &repeat) {
	if (destructing) {
		return;
	}

	MutexLock lock(singleton->lock);

	singleton->shallow_gdscript_cache.erase(p_path);
	singleton->full_gdscript_cache.erase(p_path);
	singleton->parser_map.erase(p_path);

	if (repeat) {
		for (String dependency : singleton->dependencies[p_path]) {
			remove_dependencies(p_source, dependency, !singleton->dependencies[dependency].has(p_path));
		}
	}
}

Ref<GDScriptParserDataRef> GDScriptCache::get_parser(const String &p_path, GDScriptParserData::Status p_status, Error &r_error, const String &p_owner) {
	MutexLock lock(singleton->lock);
	Ref<GDScriptParserData> ref;
	if (!p_owner.is_empty()) {
		singleton->dependencies[p_owner].insert(p_path);
	}
	if (singleton->parser_map.has(p_path)) {
		ref = Ref<GDScriptParserData>(singleton->parser_map[p_path]);
		if (ref.is_null()) {
			r_error = ERR_INVALID_DATA;

			Ref<GDScriptParserDataRef> wref;
			wref.instantiate();
			wref->set_ref(ref);
			return wref;
		}
	} else {
		if (!FileAccess::exists(p_path)) {
			r_error = ERR_FILE_NOT_FOUND;
			return ref;
		}
		GDScriptParser *parser = memnew(GDScriptParser);
		ref.instantiate();
		ref->parser = parser;
		ref->path = p_path;
		singleton->parser_map[p_path] = ref;
	}
	r_error = ref->raise_status(p_status);

	Ref<GDScriptParserDataRef> wref;
	wref.instantiate();
	wref->set_ref(ref);
	return wref;
}

String GDScriptCache::get_source_code(const String &p_path) {
	Vector<uint8_t> source_file;
	Error err;
	Ref<FileAccess> f = FileAccess::open(p_path, FileAccess::READ, &err);
	ERR_FAIL_COND_V(err, "");

	uint64_t len = f->get_length();
	source_file.resize(len + 1);
	uint64_t r = f->get_buffer(source_file.ptrw(), len);
	ERR_FAIL_COND_V(r != len, "");
	source_file.write[len] = 0;

	String source;
	if (source.parse_utf8((const char *)source_file.ptr()) != OK) {
		ERR_FAIL_V_MSG("", "Script '" + p_path + "' contains invalid unicode (UTF-8), so it was not loaded. Please ensure that scripts are saved in valid UTF-8 unicode.");
	}
	return source;
}

Ref<GDScriptRef> GDScriptCache::get_shallow_script(const String &p_path, const String &p_owner) {
	MutexLock lock(singleton->lock);
	if (!p_owner.is_empty()) {
		singleton->dependencies[p_owner].insert(p_path);
	}
	if (singleton->full_gdscript_cache.has(p_path)) {
		Ref<GDScriptRef> wref;
		wref.instantiate();
		wref->set_ref(singleton->full_gdscript_cache[p_path]);
		return wref;
	}
	if (singleton->shallow_gdscript_cache.has(p_path)) {
		Ref<GDScriptRef> wref;
		wref.instantiate();
		wref->set_ref(singleton->shallow_gdscript_cache[p_path]);
		return wref;
	}

	Ref<GDScript> script;
	script.instantiate();
	script->set_path(p_path, true);
	script->set_script_path(p_path);
	script->load_source_code(p_path);

	singleton->shallow_gdscript_cache[p_path] = script;

	Ref<GDScriptRef> wref;
	wref.instantiate();
	if (script.is_valid()) {
		wref->set_ref(singleton->shallow_gdscript_cache[p_path]);
	}

	return wref;
}

Ref<GDScriptRef> GDScriptCache::get_full_script(const String &p_path, Error &r_error, const String &p_owner) {
	MutexLock lock(singleton->lock);

	if (!p_owner.is_empty()) {
		singleton->dependencies[p_owner].insert(p_path);
	}

	r_error = OK;
	if (singleton->full_gdscript_cache.has(p_path)) {
		Ref<GDScriptRef> wref;
		wref.instantiate();
		wref->set_ref(singleton->full_gdscript_cache[p_path]);
		return wref;
	}

	Ref<GDScript> script = get_shallow_script(p_path)->get_ref();
	if (script.is_null()) {
		Ref<GDScriptRef> wref;
		wref.instantiate();
		wref->set_ref(Ref<GDScript>());
		return wref;
	}

	r_error = script->load_source_code(p_path);

	if (r_error) {
		return script;
	}

	r_error = script->reload();
	if (r_error) {
		return script;
	}

	singleton->full_gdscript_cache[p_path] = script;
	singleton->shallow_gdscript_cache.erase(p_path);

	Ref<GDScriptRef> wref;
	wref.instantiate();
	wref->set_ref(singleton->full_gdscript_cache[p_path]);
	return wref;
}

Error GDScriptCache::finish_compiling(const String &p_owner) {
	// Mark this as compiled.
	Ref<GDScript> script = get_shallow_script(p_owner)->get_ref();
	singleton->full_gdscript_cache[p_owner] = script;
	singleton->shallow_gdscript_cache.erase(p_owner);

	RBSet<String> depends = singleton->dependencies[p_owner];

	Error err = OK;
	for (const String &E : depends) {
		Error this_err = OK;
		// No need to save the script. We assume it's already referenced in the owner.
		get_full_script(E, this_err);

		if (this_err != OK) {
			err = this_err;
		}
	}

	return err;
}

GDScriptCache::GDScriptCache() {
	singleton = this;
	destructing = false;
}

GDScriptCache::~GDScriptCache() {
	destructing = true;
	parser_map.clear();
	shallow_gdscript_cache.clear();
	full_gdscript_cache.clear();
	singleton = nullptr;
}
