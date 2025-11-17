/**************************************************************************/
/*  editor_export_platform_utils.cpp                                      */
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

#include "editor_export_platform_utils.h"

#include "core/config/project_settings.h"
#include "core/crypto/crypto_core.h"
#include "core/io/dir_access.h"
#include "core/io/file_access_encrypted.h"
#include "core/io/file_access_pack.h"
#include "core/math/random_pcg.h"
#include "editor/export/editor_export_platform_data.h"
#include "editor/export/editor_export_preset.h"
#include "editor/file_system/editor_file_system.h"

int EditorExportPlatformUtils::get_pad(int p_alignment, int p_n) {
	int rest = p_n % p_alignment;
	int pad = 0;
	if (rest > 0) {
		pad = p_alignment - rest;
	};

	return pad;
}

Variant EditorExportPlatformUtils::get_project_setting(const Ref<EditorExportPreset> &p_preset, const StringName &p_name) {
	if (p_preset.is_valid()) {
		return p_preset->get_project_setting(p_name);
	} else {
		return GLOBAL_GET(p_name);
	}
}

bool EditorExportPlatformUtils::encrypt_and_store_directory(Ref<FileAccess> p_fd, EditorExportPlatformData::PackData &p_pack_data, const Vector<uint8_t> &p_key, uint64_t p_seed, uint64_t p_file_base) {
	Ref<FileAccessEncrypted> fae;
	Ref<FileAccess> fhead = p_fd;

	fhead->store_32(p_pack_data.file_ofs.size()); //amount of files

	if (!p_key.is_empty()) {
		uint64_t seed = p_seed;
		fae.instantiate();
		if (fae.is_null()) {
			return false;
		}

		Vector<uint8_t> iv;
		if (seed != 0) {
			for (int i = 0; i < p_pack_data.file_ofs.size(); i++) {
				for (int64_t j = 0; j < p_pack_data.file_ofs[i].path_utf8.length(); j++) {
					seed = ((seed << 5) + seed) ^ p_pack_data.file_ofs[i].path_utf8.get_data()[j];
				}
				for (int64_t j = 0; j < p_pack_data.file_ofs[i].md5.size(); j++) {
					seed = ((seed << 5) + seed) ^ p_pack_data.file_ofs[i].md5[j];
				}
				seed = ((seed << 5) + seed) ^ (p_pack_data.file_ofs[i].ofs - p_file_base);
				seed = ((seed << 5) + seed) ^ p_pack_data.file_ofs[i].size;
			}

			RandomPCG rng = RandomPCG(seed);
			iv.resize(16);
			for (int i = 0; i < 16; i++) {
				iv.write[i] = rng.rand() % 256;
			}
		}

		Error err = fae->open_and_parse(fhead, p_key, FileAccessEncrypted::MODE_WRITE_AES256, false, iv);
		if (err != OK) {
			return false;
		}

		fhead = fae;
	}
	for (int i = 0; i < p_pack_data.file_ofs.size(); i++) {
		uint32_t string_len = p_pack_data.file_ofs[i].path_utf8.length();
		uint32_t pad = EditorExportPlatformUtils::get_pad(4, string_len);

		fhead->store_32(string_len + pad);
		fhead->store_buffer((const uint8_t *)p_pack_data.file_ofs[i].path_utf8.get_data(), string_len);
		for (uint32_t j = 0; j < pad; j++) {
			fhead->store_8(0);
		}

		fhead->store_64(p_pack_data.file_ofs[i].ofs - p_file_base);
		fhead->store_64(p_pack_data.file_ofs[i].size); // pay attention here, this is where file is
		fhead->store_buffer(p_pack_data.file_ofs[i].md5.ptr(), 16); //also save md5 for file
		uint32_t flags = 0;
		if (p_pack_data.file_ofs[i].encrypted) {
			flags |= PACK_FILE_ENCRYPTED;
		}
		if (p_pack_data.file_ofs[i].removal) {
			flags |= PACK_FILE_REMOVAL;
		}
		fhead->store_32(flags);
	}

	if (fae.is_valid()) {
		fhead.unref();
		fae.unref();
	}
	return true;
}

Error EditorExportPlatformUtils::encrypt_and_store_data(Ref<FileAccess> p_fd, const String &p_path, const Vector<uint8_t> &p_data, const Vector<String> &p_enc_in_filters, const Vector<String> &p_enc_ex_filters, const Vector<uint8_t> &p_key, uint64_t p_seed, bool &r_encrypt) {
	r_encrypt = false;
	for (int i = 0; i < p_enc_in_filters.size(); ++i) {
		if (p_path.matchn(p_enc_in_filters[i]) || p_path.trim_prefix("res://").matchn(p_enc_in_filters[i])) {
			r_encrypt = true;
			break;
		}
	}

	for (int i = 0; i < p_enc_ex_filters.size(); ++i) {
		if (p_path.matchn(p_enc_ex_filters[i]) || p_path.trim_prefix("res://").matchn(p_enc_ex_filters[i])) {
			r_encrypt = false;
			break;
		}
	}

	Ref<FileAccessEncrypted> fae;
	Ref<FileAccess> ftmp = p_fd;
	if (r_encrypt) {
		Vector<uint8_t> iv;
		if (p_seed != 0) {
			uint64_t seed = p_seed;

			const uint8_t *ptr = p_data.ptr();
			int64_t len = p_data.size();
			for (int64_t i = 0; i < len; i++) {
				seed = ((seed << 5) + seed) ^ ptr[i];
			}

			RandomPCG rng = RandomPCG(seed);
			iv.resize(16);
			for (int i = 0; i < 16; i++) {
				iv.write[i] = rng.rand() % 256;
			}
		}

		fae.instantiate();
		ERR_FAIL_COND_V(fae.is_null(), ERR_FILE_CANT_OPEN);

		Error err = fae->open_and_parse(ftmp, p_key, FileAccessEncrypted::MODE_WRITE_AES256, false, iv);
		ERR_FAIL_COND_V(err != OK, ERR_FILE_CANT_OPEN);
		ftmp = fae;
	}

	// Store file content.
	ftmp->store_buffer(p_data.ptr(), p_data.size());

	if (fae.is_valid()) {
		ftmp.unref();
		fae.unref();
	}
	return OK;
}

Error EditorExportPlatformUtils::store_temp_file(const String &p_simplified_path, const PackedByteArray &p_data, const Vector<String> &p_enc_in_filters, const Vector<String> &p_enc_ex_filters, const PackedByteArray &p_key, uint64_t p_seed, PackedByteArray &r_enc_data, EditorExportPlatformData::SavedData &r_sd) {
	Error err = OK;
	Ref<FileAccess> ftmp = FileAccess::create_temp(FileAccess::WRITE_READ, "export", "tmp", false, &err);
	if (err != OK) {
		return err;
	}
	r_sd.path_utf8 = p_simplified_path.trim_prefix("res://").utf8();
	r_sd.ofs = 0;
	r_sd.size = p_data.size();
	err = EditorExportPlatformUtils::encrypt_and_store_data(ftmp, p_simplified_path, p_data, p_enc_in_filters, p_enc_ex_filters, p_key, p_seed, r_sd.encrypted);
	if (err != OK) {
		return err;
	}

	r_enc_data.resize(ftmp->get_length());
	ftmp->seek(0);
	ftmp->get_buffer(r_enc_data.ptrw(), r_enc_data.size());
	ftmp.unref();

	// Store MD5 of original file.
	{
		unsigned char hash[16];
		CryptoCore::md5(p_data.ptr(), p_data.size(), hash);
		r_sd.md5.resize(16);
		for (int i = 0; i < 16; i++) {
			r_sd.md5.write[i] = hash[i];
		}
	}
	return OK;
}

// Utility method used to create a directory.
Error EditorExportPlatformUtils::create_directory(const String &p_dir) {
	if (DirAccess::exists(p_dir)) {
		return OK;
	}
	Ref<DirAccess> filesystem_da = DirAccess::create(DirAccess::ACCESS_RESOURCES);
	ERR_FAIL_COND_V_MSG(filesystem_da.is_null(), ERR_CANT_CREATE, "Cannot create directory '" + p_dir + "'.");
	Error err = filesystem_da->make_dir_recursive(p_dir);
	ERR_FAIL_COND_V_MSG(err, ERR_CANT_CREATE, "Cannot create directory '" + p_dir + "'.");
	return OK;
}

// Writes p_data into a file at p_path, creating directories if necessary.
// Note: this will overwrite the file at p_path if it already exists.
Error EditorExportPlatformUtils::store_file_at_path(const String &p_path, const PackedByteArray &p_data) {
	String dir = p_path.get_base_dir();
	Error err = EditorExportPlatformUtils::create_directory(dir);
	if (err != OK) {
		return err;
	}
	Ref<FileAccess> fa = FileAccess::open(p_path, FileAccess::WRITE);
	ERR_FAIL_COND_V_MSG(fa.is_null(), ERR_CANT_CREATE, "Cannot create file '" + p_path + "'.");
	fa->store_buffer(p_data.ptr(), p_data.size());
	return OK;
}

// Writes string p_data into a file at p_path, creating directories if necessary.
// Note: this will overwrite the file at p_path if it already exists.
Error EditorExportPlatformUtils::store_string_at_path(const String &p_path, const String &p_data) {
	String dir = p_path.get_base_dir();
	Error err = EditorExportPlatformUtils::create_directory(dir);
	if (err != OK) {
		if (OS::get_singleton()->is_stdout_verbose()) {
			print_error("Unable to write data into " + p_path);
		}
		return err;
	}
	Ref<FileAccess> fa = FileAccess::open(p_path, FileAccess::WRITE);
	ERR_FAIL_COND_V_MSG(fa.is_null(), ERR_CANT_CREATE, "Cannot create file '" + p_path + "'.");
	fa->store_string(p_data);
	return OK;
}

PackedByteArray EditorExportPlatformUtils::convert_string_encryption_key_to_bytes(const String &p_encryption_key) {
	PackedByteArray key;
	key.resize_initialized(32);
	ERR_FAIL_COND_V(p_encryption_key.length() != 64, key);

	for (int i = 0; i < 32; i++) {
		int v = 0;
		if (i * 2 < p_encryption_key.length()) {
			char32_t ct = p_encryption_key[i * 2];
			if (is_digit(ct)) {
				ct = ct - '0';
			} else if (ct >= 'a' && ct <= 'f') {
				ct = 10 + ct - 'a';
			}
			v |= ct << 4;
		}

		if (i * 2 + 1 < p_encryption_key.length()) {
			char32_t ct = p_encryption_key[i * 2 + 1];
			if (is_digit(ct)) {
				ct = ct - '0';
			} else if (ct >= 'a' && ct <= 'f') {
				ct = 10 + ct - 'a';
			}
			v |= ct;
		}
		key.write[i] = v;
	}

	return key;
}

void EditorExportPlatformUtils::export_find_resources(EditorFileSystemDirectory *p_dir, HashSet<String> &p_paths) {
	for (int i = 0; i < p_dir->get_subdir_count(); i++) {
		EditorExportPlatformUtils::export_find_resources(p_dir->get_subdir(i), p_paths);
	}

	for (int i = 0; i < p_dir->get_file_count(); i++) {
		if (p_dir->get_file_type(i) == "TextFile") {
			continue;
		}
		p_paths.insert(p_dir->get_file_path(i));
	}
}

void EditorExportPlatformUtils::export_find_customized_resources(const Ref<EditorExportPreset> &p_preset, EditorFileSystemDirectory *p_dir, EditorExportPreset::FileExportMode p_mode, HashSet<String> &p_paths) {
	for (int i = 0; i < p_dir->get_subdir_count(); i++) {
		EditorFileSystemDirectory *subdir = p_dir->get_subdir(i);
		EditorExportPlatformUtils::export_find_customized_resources(p_preset, subdir, p_preset->get_file_export_mode(subdir->get_path(), p_mode), p_paths);
	}

	for (int i = 0; i < p_dir->get_file_count(); i++) {
		if (p_dir->get_file_type(i) == "TextFile") {
			continue;
		}
		String path = p_dir->get_file_path(i);
		EditorExportPreset::FileExportMode file_mode = p_preset->get_file_export_mode(path, p_mode);
		if (file_mode != EditorExportPreset::MODE_FILE_REMOVE) {
			p_paths.insert(path);
		}
	}
}

void EditorExportPlatformUtils::export_find_dependencies(const String &p_path, HashSet<String> &p_paths) {
	if (p_paths.has(p_path)) {
		return;
	}

	p_paths.insert(p_path);

	EditorFileSystemDirectory *dir;
	int file_idx;
	dir = EditorFileSystem::get_singleton()->find_file(p_path, &file_idx);
	if (!dir) {
		return;
	}

	Vector<String> deps = dir->get_file_deps(file_idx);

	for (int i = 0; i < deps.size(); i++) {
		EditorExportPlatformUtils::export_find_dependencies(deps[i], p_paths);
	}
}

void EditorExportPlatformUtils::export_find_files(const Ref<EditorExportPreset> &p_preset, HashSet<String> &p_paths) {
	if (p_preset->get_export_filter() == EditorExportPreset::EXPORT_ALL_RESOURCES) {
		//find stuff
		EditorExportPlatformUtils::export_find_resources(EditorFileSystem::get_singleton()->get_filesystem(), p_paths);
	} else if (p_preset->get_export_filter() == EditorExportPreset::EXCLUDE_SELECTED_RESOURCES) {
		EditorExportPlatformUtils::export_find_resources(EditorFileSystem::get_singleton()->get_filesystem(), p_paths);
		Vector<String> files = p_preset->get_files_to_export();
		for (int i = 0; i < files.size(); i++) {
			p_paths.erase(files[i]);
		}
	} else if (p_preset->get_export_filter() == EditorExportPreset::EXPORT_CUSTOMIZED) {
		EditorExportPlatformUtils::export_find_customized_resources(p_preset, EditorFileSystem::get_singleton()->get_filesystem(), p_preset->get_file_export_mode("res://"), p_paths);
	} else {
		bool scenes_only = p_preset->get_export_filter() == EditorExportPreset::EXPORT_SELECTED_SCENES;

		Vector<String> files = p_preset->get_files_to_export();
		for (int i = 0; i < files.size(); i++) {
			if (scenes_only && ResourceLoader::get_resource_type(files[i]) != "PackedScene") {
				continue;
			}

			EditorExportPlatformUtils::export_find_dependencies(files[i], p_paths);
		}

		// Add autoload resources and their dependencies
		List<PropertyInfo> props;
		ProjectSettings::get_singleton()->get_property_list(&props);

		for (const PropertyInfo &pi : props) {
			if (!pi.name.begins_with("autoload/")) {
				continue;
			}

			String autoload_path = EditorExportPlatformUtils::get_project_setting(p_preset, pi.name);

			if (autoload_path.begins_with("*")) {
				autoload_path = autoload_path.substr(1);
			}

			EditorExportPlatformUtils::export_find_dependencies(autoload_path, p_paths);
		}
	}
}

void EditorExportPlatformUtils::edit_files_with_filter(Ref<DirAccess> &da, const Vector<String> &p_filters, HashSet<String> &r_list, bool exclude) {
	da->list_dir_begin();
	String cur_dir = da->get_current_dir().replace_char('\\', '/');
	if (!cur_dir.ends_with("/")) {
		cur_dir += "/";
	}
	String cur_dir_no_prefix = cur_dir.replace("res://", "");

	Vector<String> dirs;
	String f = da->get_next();
	while (!f.is_empty()) {
		if (da->current_is_dir()) {
			dirs.push_back(f);
		} else {
			String fullpath = cur_dir + f;
			// Test also against path without res:// so that filters like `file.txt` can work.
			String fullpath_no_prefix = cur_dir_no_prefix + f;
			for (int i = 0; i < p_filters.size(); ++i) {
				if (fullpath.matchn(p_filters[i]) || fullpath_no_prefix.matchn(p_filters[i])) {
					if (!exclude) {
						r_list.insert(fullpath);
					} else {
						r_list.erase(fullpath);
					}
				}
			}
		}
		f = da->get_next();
	}

	da->list_dir_end();

	for (int i = 0; i < dirs.size(); ++i) {
		const String &dir = dirs[i];
		if (dir.begins_with(".")) {
			continue;
		}

		if (EditorFileSystem::_should_skip_directory(cur_dir + dir)) {
			continue;
		}

		da->change_dir(dir);
		EditorExportPlatformUtils::edit_files_with_filter(da, p_filters, r_list, exclude);
		da->change_dir("..");
	}
}

void EditorExportPlatformUtils::edit_filter_list(HashSet<String> &r_list, const String &p_filter, bool exclude) {
	if (p_filter.is_empty()) {
		return;
	}
	Vector<String> split = p_filter.split(",");
	Vector<String> filters;
	for (int i = 0; i < split.size(); i++) {
		String f = split[i].strip_edges();
		if (f.is_empty()) {
			continue;
		}
		filters.push_back(f);
	}

	Ref<DirAccess> da = DirAccess::create(DirAccess::ACCESS_RESOURCES);
	ERR_FAIL_COND(da.is_null());
	EditorExportPlatformUtils::edit_files_with_filter(da, filters, r_list, exclude);
}
