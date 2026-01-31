/**************************************************************************/
/*  godot_fs.ts                                                           */
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

import { GodotFSPostsetFnString } from "./postset.nocheck.js";

export const _GodotFS = {
	$GodotFS__deps: ["$FS", "$IDBFS", "$GodotRuntime"],
	$GodotFS__postset: GodotFSPostsetFnString,
	$GodotFS: {
		ENOENT: 44,
		_idbfs: false,
		_syncing: false,
		_mountPoints: [] as string[],

		isPersistent: (): boolean => {
			return GodotFS._idbfs;
		},

		// Initialize godot file system, setting up persistent paths.
		// Returns a promise that resolves when the FS is ready.
		// We keep track of mount_points, so that we can properly close the IDBFS
		// since emscripten is not doing it by itself. (emscripten GH#12516).
		initialize: async (pPersistentPaths: string[]): Promise<Error | null> => {
			GodotFS._idbfs = false;
			if (!Array.isArray(pPersistentPaths)) {
				throw new Error("Persistent paths must be an array.");
			}
			if (pPersistentPaths.length === 0) {
				return null;
			}
			GodotFS._mountPoints = pPersistentPaths.slice();

			const createRecursive = (pDirectory: string): void => {
				try {
					FS.stat(pDirectory);
				} catch (error) {
					if ((error as typeof FS.ErrnoError | null)?.errno !== GodotFS.ENOENT) {
						GodotRuntime.error(error);
					}
					FS.mkdirTree(pDirectory);
				}
			};

			for (const mountPoint of GodotFS._mountPoints) {
				createRecursive(mountPoint);
				FS.mount(IDBFS, {}, mountPoint);
			}

			return await new Promise((pResolve, _pReject) => {
				FS.syncfs(true, (pErrorCode) => {
					if (pErrorCode == null) {
						GodotFS._idbfs = true;
					} else {
						GodotFS._mountPoints = [];
						GodotFS._idbfs = false;
						GodotRuntime.print(`IndexedDB not available: ${pErrorCode.message}`);
					}
					pResolve(pErrorCode ?? null);
				});
			});
		},

		clear: (): void => {
			for (const mountPoint of GodotFS._mountPoints) {
				try {
					FS.unmount(mountPoint);
				} catch (error) {
					GodotRuntime.print("Already unmounted", error);
				}
				if (Object.keys(IDBFS.dbs).includes(mountPoint)) {
					IDBFS.dbs[mountPoint].close();
					// eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- emscripten global code.
					delete IDBFS.dbs[mountPoint];
				}
			}
			GodotFS._mountPoints = [];
			GodotFS._idbfs = false;
			GodotFS._syncing = false;
		},

		sync: async (): Promise<Error | null> => {
			if (GodotFS._syncing) {
				GodotRuntime.error("Already syncing.");
				return null;
			}
			GodotFS._syncing = true;
			return await new Promise((pResolve, _pReject) => {
				FS.syncfs(false, (pError) => {
					if (pError != null) {
						GodotRuntime.error("Failed to save IDB file system:", pError);
					}
					GodotFS._syncing = false;
					pResolve(pError ?? null);
				});
			});
		},

		copyToFS: (pPath: string, pBuffer: ArrayBuffer): void => {
			const idx = pPath.lastIndexOf("/");
			let dir = "/";
			if (idx > 0) {
				dir = pPath.slice(0, idx);
			}
			try {
				FS.stat(dir);
			} catch (error) {
				if ((error as typeof FS.ErrnoError | null)?.errno !== GodotFS.ENOENT) {
					GodotRuntime.error(error);
				}
				FS.mkdirTree(dir);
			}
			FS.writeFile(pPath, new Uint8Array(pBuffer));
		},
	},
};
autoAddDeps(_GodotFS, "$GodotFS");
addToLibrary(_GodotFS);
