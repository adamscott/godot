/**************************************************************************/
/*  gdscript_format.cpp                                                   */
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

#include "gdscript_format.h"

#ifdef TOOLS_ENABLED
#include "editor/editor_settings.h"
#endif

#include "core/string/string_builder.h"

#include "gdscript_parser.h"

Error GDScriptFormat::format(const String &p_code, String &r_formatted_code) {
	// GDScriptParser parser;
	// Error err = parser.parse(p_code, "", false);

	// if (err != OK) {
	// 	parser_errors.clear();
	// 	for (GDScriptParser::ParserError parser_error : parser.get_errors()) {
	// 		parser_errors.push_back({ vformat("%s", parser_error.message), parser_error.line, parser_error.column });
	// 	}
	// 	return FAILED;
	// }

	// find_custom_newlines(p_code);

	// GDP::ClassNode *root = parser.get_tree();

	// StringBuilder code_block;
	// if (parser.is_tool()) {
	// 	if (!root->tool_header_comment.is_empty()) {
	// 		for (const String &i : root->tool_header_comment) {
	// 			code_block += "# ";
	// 			code_block += i;
	// 			code_block += "\n";
	// 		}
	// 	}
	// 	code_block += "@tool";
	// 	if (!root->tool_inline_comment.is_empty()) {
	// 		code_block += " # ";
	// 		code_block += root->tool_inline_comment;
	// 	}
	// 	code_block += "\n";
	// }

	// code_block += parse_class(root, 0);

	// String output = code_block.as_string();

	// while (output.ends_with("\n\n")) {
	// 	output = output.substr(0, output.length() - 1);
	// }

	// output = make_disabled_lines_from_headers(output);

	// r_formatted_code.clear();
	// r_formatted_code += output;

	return OK;
}

GDScriptFormat::GDScriptFormat() :
		line_length_maximum(100),
		tab_size(4),
		tab_type(0),
		lines_between_functions(2),
		indent_in_multiline_block(2) {
#ifdef TOOLS_ENABLED
	if (EditorSettings::get_singleton()) {
		line_length_maximum = EditorSettings::get_singleton()->get_setting("text_editor/appearance/guidelines/line_length_guideline_hard_column");
		lines_between_functions = EditorSettings::get_singleton()->get_setting("text_editor/behavior/formatter/lines_between_functions");
		indent_in_multiline_block = EditorSettings::get_singleton()->get_setting("text_editor/behavior/formatter/indent_in_multiline_block");
		tab_size = EditorSettings::get_singleton()->get_setting("text_editor/behavior/indent/size");
		tab_type = EditorSettings::get_singleton()->get_setting("text_editor/behavior/indent/type");
	}
#endif // TOOLS_ENABLED
}