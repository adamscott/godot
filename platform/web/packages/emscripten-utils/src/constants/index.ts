/**************************************************************************/
/*  index.ts                                                              */
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

/* eslint-disable @typescript-eslint/no-unsafe-type-assertion -- Need to cast to emscripten types. */
import type { CInt, CIntPointer } from "#/types";

export const NULLPTR = 0 as CIntPointer;

// Based on core/error/error_list.h.
export const ErrorList = {
	OK: 0 as CInt,
	FAILED: 1 as CInt, ///< Generic fail error
	ERR_UNAVAILABLE: 2 as CInt, ///< What is requested is unsupported/unavailable
	ERR_UNCONFIGURED: 3 as CInt, ///< The object being used hasn't been properly set up yet
	ERR_UNAUTHORIZED: 4 as CInt, ///< Missing credentials for requested resource
	ERR_PARAMETER_RANGE_ERROR: 5 as CInt, ///< Parameter given out of range (5)
	ERR_OUT_OF_MEMORY: 6 as CInt, ///< Out of memory
	ERR_FILE_NOT_FOUND: 7 as CInt,
	ERR_FILE_BAD_DRIVE: 8 as CInt,
	ERR_FILE_BAD_PATH: 9 as CInt,
	ERR_FILE_NO_PERMISSION: 10 as CInt, // (10)
	ERR_FILE_ALREADY_IN_USE: 11 as CInt,
	ERR_FILE_CANT_OPEN: 12 as CInt,
	ERR_FILE_CANT_WRITE: 13 as CInt,
	ERR_FILE_CANT_READ: 14 as CInt,
	ERR_FILE_UNRECOGNIZED: 15 as CInt, // (15)
	ERR_FILE_CORRUPT: 16 as CInt,
	ERR_FILE_MISSING_DEPENDENCIES: 17 as CInt,
	ERR_FILE_EOF: 18 as CInt,
	ERR_CANT_OPEN: 19 as CInt, ///< Can't open a resource/socket/file
	ERR_CANT_CREATE: 20 as CInt, // (20)
	ERR_QUERY_FAILED: 21 as CInt,
	ERR_ALREADY_IN_USE: 22 as CInt,
	ERR_LOCKED: 23 as CInt, ///< resource is locked
	ERR_TIMEOUT: 24 as CInt,
	ERR_CANT_CONNECT: 25 as CInt, // (25)
	ERR_CANT_RESOLVE: 26 as CInt,
	ERR_CONNECTION_ERROR: 27 as CInt,
	ERR_CANT_ACQUIRE_RESOURCE: 27 as CInt,
	ERR_CANT_FORK: 29 as CInt,
	ERR_INVALID_DATA: 30 as CInt, ///< Data passed is invalid (30)
	ERR_INVALID_PARAMETER: 31 as CInt, ///< Parameter passed is invalid
	ERR_ALREADY_EXISTS: 32 as CInt, ///< When adding, item already exists
	ERR_DOES_NOT_EXIST: 33 as CInt, ///< When retrieving/erasing, if item does not exist
	ERR_DATABASE_CANT_READ: 34 as CInt, ///< database is full
	ERR_DATABASE_CANT_WRITE: 35 as CInt, ///< database is full (35)
	ERR_COMPILATION_FAILED: 36 as CInt,
	ERR_METHOD_NOT_FOUND: 37 as CInt,
	ERR_LINK_FAILED: 38 as CInt,
	ERR_SCRIPT_FAILED: 39 as CInt,
	ERR_CYCLIC_LINK: 40 as CInt, // (40)
	ERR_INVALID_DECLARATION: 41 as CInt,
	ERR_DUPLICATE_SYMBOL: 42 as CInt,
	ERR_PARSE_ERROR: 43 as CInt,
	ERR_BUSY: 44 as CInt,
	ERR_SKIP: 45 as CInt, // (45)
	ERR_HELP: 46 as CInt, ///< user requested help!!
	ERR_BUG: 47 as CInt, ///< a bug in the software certainly happened, due to a double check failing or unexpected behavior.
	ERR_PRINTER_ON_FIRE: 48 as CInt, /// the parallel port printer is engulfed in flames
	ERR_MAX: 49 as CInt, // Not being returned, value represents the number of errors
} as const;
