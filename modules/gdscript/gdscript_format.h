/**************************************************************************/
/*  gdscript_format.h                                                     */
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

#ifndef GDSCRIPT_FORMAT_H
#define GDSCRIPT_FORMAT_H

#include "gdscript_parser.h"

class GDScriptFormat {
private:
	static int get_operation_priority(const GDScriptParser::BinaryOpNode::OpType p_op_type) {
		switch (p_op_type) {
			case GDScriptParser::BinaryOpNode::OpType::OP_MULTIPLICATION:
			case GDScriptParser::BinaryOpNode::OpType::OP_DIVISION:
			case GDScriptParser::BinaryOpNode::OpType::OP_MODULO:
			case GDScriptParser::BinaryOpNode::OpType::OP_POWER:
				return 0;
			case GDScriptParser::BinaryOpNode::OpType::OP_ADDITION:
			case GDScriptParser::BinaryOpNode::OpType::OP_SUBTRACTION:
				return 1;
			case GDScriptParser::BinaryOpNode::OpType::OP_BIT_LEFT_SHIFT:
			case GDScriptParser::BinaryOpNode::OpType::OP_BIT_RIGHT_SHIFT:
				return 2;
			case GDScriptParser::BinaryOpNode::OpType::OP_COMP_LESS:
			case GDScriptParser::BinaryOpNode::OpType::OP_COMP_LESS_EQUAL:
			case GDScriptParser::BinaryOpNode::OpType::OP_COMP_GREATER:
			case GDScriptParser::BinaryOpNode::OpType::OP_COMP_GREATER_EQUAL:
				return 3;
			case GDScriptParser::BinaryOpNode::OpType::OP_CONTENT_TEST:
			case GDScriptParser::BinaryOpNode::OpType::OP_COMP_EQUAL:
			case GDScriptParser::BinaryOpNode::OpType::OP_COMP_NOT_EQUAL:
				return 4;
			case GDScriptParser::BinaryOpNode::OpType::OP_BIT_AND:
				return 5;
			case GDScriptParser::BinaryOpNode::OpType::OP_BIT_XOR:
				return 6;
			case GDScriptParser::BinaryOpNode::OpType::OP_BIT_OR:
				return 7;
			case GDScriptParser::BinaryOpNode::OpType::OP_LOGIC_AND:
				return 8;
			case GDScriptParser::BinaryOpNode::OpType::OP_LOGIC_OR:
				return 9;
		}

		return 10;
	}

	static bool is_nestable_statement(const GDScriptParser::Node *p_node) {
		bool nestable_statement = true;
		if (p_node != nullptr) {
			switch (p_node->type) {
				case GDScriptParser::Node::Type::TYPE:
				case GDScriptParser::Node::Type::CAST:
				case GDScriptParser::Node::Type::LITERAL:
				case GDScriptParser::Node::Type::ASSIGNMENT:
				case GDScriptParser::Node::Type::IDENTIFIER:
				case GDScriptParser::Node::Type::GET_NODE:
				case GDScriptParser::Node::Type::SELF:
					nestable_statement = false;
					break;
				default:
					break;
			}
		}

		return nestable_statement;
	}

	static bool should_not_hold_comments(const GDScriptParser::Node *p_node) {
		return p_node->type == GDScriptParser::Node::Type::BINARY_OPERATOR || p_node->type == GDScriptParser::Node::Type::TERNARY_OPERATOR || p_node->type == GDScriptParser::Node::Type::SUITE;
	}

	static bool has_special_line_wrapping(const GDScriptParser::Node *p_node) {
		return p_node != nullptr && p_node->type == GDScriptParser::Node::Type::ASSERT;
	}

public:
	int line_length_maximum;
	int tab_size;
	int tab_type;
	int lines_between_functions;
	int indent_in_multiline_block;

	Error format(const String &p_code, String &r_formatted_code);

	GDScriptFormat();
};

#endif // GDSCRIPT_FORMAT_H