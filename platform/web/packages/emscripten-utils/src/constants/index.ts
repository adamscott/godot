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

import { asCInt, asCType } from "#/types/index.js";
import type { CPointer } from "#/types/index.js";

export const NULLPTR: CPointer = asCType<CPointer>(0);

// Based on core/error/error_list.h.
export const CIntError = {
	OK: asCInt(0),
	FAILED: asCInt(1), ///< Generic fail error
	ERR_UNAVAILABLE: asCInt(2), ///< What is requested is unsupported/unavailable
	ERR_UNCONFIGURED: asCInt(3), ///< The object being used hasn't been properly set up yet
	ERR_UNAUTHORIZED: asCInt(4), ///< Missing credentials for requested resource
	ERR_PARAMETER_RANGE_ERROR: asCInt(5), ///< Parameter given out of range (5)
	ERR_OUT_OF_MEMORY: asCInt(6), ///< Out of memory
	ERR_FILE_NOT_FOUND: asCInt(7),
	ERR_FILE_BAD_DRIVE: asCInt(8),
	ERR_FILE_BAD_PATH: asCInt(9),
	ERR_FILE_NO_PERMISSION: asCInt(10), // (10)
	ERR_FILE_ALREADY_IN_USE: asCInt(11),
	ERR_FILE_CANT_OPEN: asCInt(12),
	ERR_FILE_CANT_WRITE: asCInt(13),
	ERR_FILE_CANT_READ: asCInt(14),
	ERR_FILE_UNRECOGNIZED: asCInt(15), // (15)
	ERR_FILE_CORRUPT: asCInt(16),
	ERR_FILE_MISSING_DEPENDENCIES: asCInt(17),
	ERR_FILE_EOF: asCInt(18),
	ERR_CANT_OPEN: asCInt(19), ///< Can't open a resource/socket/file
	ERR_CANT_CREATE: asCInt(20), // (20)
	ERR_QUERY_FAILED: asCInt(21),
	ERR_ALREADY_IN_USE: asCInt(22),
	ERR_LOCKED: asCInt(23), ///< resource is locked
	ERR_TIMEOUT: asCInt(24),
	ERR_CANT_CONNECT: asCInt(25), // (25)
	ERR_CANT_RESOLVE: asCInt(26),
	ERR_CONNECTION_ERROR: asCInt(27),
	ERR_CANT_ACQUIRE_RESOURCE: asCInt(27),
	ERR_CANT_FORK: asCInt(29),
	ERR_INVALID_DATA: asCInt(30), ///< Data passed is invalid (30)
	ERR_INVALID_PARAMETER: asCInt(31), ///< Parameter passed is invalid
	ERR_ALREADY_EXISTS: asCInt(32), ///< When adding, item already exists
	ERR_DOES_NOT_EXIST: asCInt(33), ///< When retrieving/erasing, if item does not exist
	ERR_DATABASE_CANT_READ: asCInt(34), ///< database is full
	ERR_DATABASE_CANT_WRITE: asCInt(35), ///< database is full (35)
	ERR_COMPILATION_FAILED: asCInt(36),
	ERR_METHOD_NOT_FOUND: asCInt(37),
	ERR_LINK_FAILED: asCInt(38),
	ERR_SCRIPT_FAILED: asCInt(39),
	ERR_CYCLIC_LINK: asCInt(40), // (40)
	ERR_INVALID_DECLARATION: asCInt(41),
	ERR_DUPLICATE_SYMBOL: asCInt(42),
	ERR_PARSE_ERROR: asCInt(43),
	ERR_BUSY: asCInt(44),
	ERR_SKIP: asCInt(45), // (45)
	ERR_HELP: asCInt(46), ///< user requested help!!
	ERR_BUG: asCInt(47), ///< a bug in the software certainly happened, due to a double check failing or unexpected behavior.
	ERR_PRINTER_ON_FIRE: asCInt(48), /// the parallel port printer is engulfed in flames
	ERR_MAX: asCInt(49), // Not being returned, value represents the number of errors
} as const;

export const CIntBoolean = {
	TRUE: asCInt(1),
	FALSE: asCInt(0),
};
