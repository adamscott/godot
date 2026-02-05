/**************************************************************************/
/*  eslintconfig.ts                                                       */
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

import { defineConfig } from "eslint/config";
import html from "@html-eslint/eslint-plugin";
import love from "eslint-config-love";

export default defineConfig([
	{
		files: ["**/*.js", "**/*.ts", "**/*.mjs", "**/*.mts", "**/*.d.ts"],
		ignores: ["**/*.nocheck.*"],
		extends: [
			// @ts-expect-error: love and eslint don't use exactly the same types.
			love,
		],
		languageOptions: {
			parserOptions: {
				projectService: true,
			},
		},
		rules: {
			"@typescript-eslint/prefer-destructuring": "off",
			"@typescript-eslint/max-params": "off",
			"@typescript-eslint/no-magic-numbers": "off",
			"@typescript-eslint/no-unsafe-member-access": "off",
			"@typescript-eslint/no-unused-vars": [
				"error",
				{
					args: "all",
					argsIgnorePattern: "^_",
					caughtErrors: "all",
					caughtErrorsIgnorePattern: "^_",
					destructuredArrayIgnorePattern: "^_",
					varsIgnorePattern: "^_",
					ignoreRestSiblings: true,
				},
			],
			"@typescript-eslint/require-await": "off",
			"arrow-body-style": "off",
			complexity: ["error", 20],
			eqeqeq: ["error", "smart"],
			"max-lines": ["error", 3000],
			"no-param-reassign": ["error", { props: false }],
			"no-plusplus": [
				"error",
				{
					allowForLoopAfterthoughts: true,
				},
			],
			"prefer-destructuring": "off",
			"promise/avoid-new": "off",
			"promise/param-names": [
				"error",
				{
					resolvePattern: "^_?pResolve$",
					rejectPattern: "^_?pReject$",
				},
			],
			"sort-imports": ["error", {}],
		},
	},
	{
		files: ["**/*.html"],
		plugins: {
			html,
		},
		language: "html/html",
		rules: {},
	},
]);
