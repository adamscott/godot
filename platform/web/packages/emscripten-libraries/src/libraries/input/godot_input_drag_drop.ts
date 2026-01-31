/**************************************************************************/
/*  godot_input_drag_drop.ts                                              */
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

export interface GodotInputFile {
	path: string;
	name: string;
	type: string;
	size: number;
	data: ArrayBuffer;
}

/*
 * Drag and drop helper.
 * This is pretty big, but basically detect dropped files on GodotConfig.canvas,
 * process them one by one (recursively for directories), and copies them to
 * the temporary FS path '/tmp/drop-[random]/' so it can be emitted as a godot
 * event (that requires a string array of paths).
 *
 * NOTE: The temporary files are removed after the callback. This means that
 * deferred callbacks won't be able to access the files.
 */
export const _GodotInputDragDrop = {
	$GodotInputDragDrop__deps: ["$FS", "$GodotFS"],
	$GodotInputDragDrop: {
		_promises: [] as Array<Promise<void>>,
		_pendingFiles: [] as GodotInputFile[],

		addEntry: (pEntry: FileSystemEntry): void => {
			if (pEntry.isDirectory) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- We just checked.
				GodotInputDragDrop.addDirectory(pEntry as FileSystemDirectoryEntry);
			} else if (pEntry.isFile) {
				// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- We just checked.
				GodotInputDragDrop.addFile(pEntry as FileSystemFileEntry);
			} else {
				GodotRuntime.error("Unrecognized input drag&drop entry:", pEntry);
			}
		},

		addDirectory: (pEntry: FileSystemDirectoryEntry): void => {
			GodotInputDragDrop._promises.push(
				new Promise((pResolve, pReject) => {
					const reader = pEntry.createReader();
					reader.readEntries(
						(pEntries) => {
							for (const entry of pEntries) {
								GodotInputDragDrop.addEntry(entry);
							}
							pResolve(undefined);
						},
						(pError) => {
							pReject(pError);
						},
					);
				}),
			);
		},

		addFile: (pEntry: FileSystemFileEntry): void => {
			GodotInputDragDrop._promises.push(
				new Promise((pResolve, pReject) => {
					pEntry.file(
						(pFile) => {
							const fileRelativePath =
								"relativePath" in pFile
									? // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- `relativePath` is of type `string` if defined.
										(pFile.relativePath as string)
									: pFile.webkitRelativePath;
							const reader = new FileReader();
							reader.addEventListener("load", (_pEvent) => {
								const file = {
									path: fileRelativePath,
									name: pFile.name,
									type: pFile.type,
									size: pFile.size,
									// eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- we are using `readAsArrayBuffer()`.
									data: (reader.result ?? new ArrayBuffer()) as ArrayBuffer,
								} satisfies GodotInputFile;
								GodotInputDragDrop._pendingFiles.push(file);
								pResolve(undefined);
							});
							reader.addEventListener("error", (_pEvent) => {
								if (reader.error == null) {
									return;
								}
								GodotRuntime.error(`Error reading file "${fileRelativePath}"`);
								pReject(reader.error);
							});
							reader.readAsArrayBuffer(pFile);
						},
						(pError) => {
							GodotRuntime.error("Error parsing entry file:", pError);
							pReject(pError);
						},
					);
				}),
			);
		},

		processEvent: (pEvent: DragEvent, pCallback: (pFiles: string[]) => void) => {
			pEvent.preventDefault();

			if (pEvent.dataTransfer?.items == null) {
				GodotRuntime.error("File upload is not supported.");
				return;
			}

			// Use DataTransferItemList interface to access the file(s)
			const dataTransferItems = Array.from(pEvent.dataTransfer.items);
			for (const dataTransferItem of dataTransferItems) {
				// @ts-expect-error: Try to call non-standard (yet) APIs.
				// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-type-assertion -- Try to call non-standard (yet) APIs.
				const entry = (dataTransferItem.getAsEntry?.() ??
					dataTransferItem.webkitGetAsEntry()) as FileSystemEntry | null;
				if (entry == null) {
					continue;
				}
				GodotInputDragDrop.addEntry(entry);
			}
			Promise.allSettled(GodotInputDragDrop._promises)
				.then(() => {
					const dropTemporaryDirectoryPath = `/tmp/drop-${(Math.random() * (1 << 30)).toString(10)}/`;
					const dropPaths = [] as string[];
					const filePaths = [] as string[];

					// Without trailing slash
					FS.mkdir(dropTemporaryDirectoryPath.slice(0, -1));
					for (const pendingFile of GodotInputDragDrop._pendingFiles) {
						const path = pendingFile.path;
						GodotFS.copyToFS(dropTemporaryDirectoryPath + path, pendingFile.data);
						let index = path.indexOf("/");
						if (index === -1) {
							// Root file.
							dropPaths.push(dropTemporaryDirectoryPath + path);
						} else {
							// Subdirectory.
							const subdirectory = path.substring(0, index);
							index = subdirectory.indexOf("/");
							if (index < 0 && !dropPaths.includes(dropTemporaryDirectoryPath + subdirectory)) {
								dropPaths.push(dropTemporaryDirectoryPath + subdirectory);
							}
						}
						filePaths.push(dropTemporaryDirectoryPath + path);
					}

					GodotInputDragDrop._promises = [];
					GodotInputDragDrop._pendingFiles = [];
					pCallback(dropPaths);
				})
				.catch((pError: unknown) => {
					GodotRuntime.error("Error while processing input drag&drop event:", pError);
				});
		},

		removeDrop: (pFiles: string[], pDropPath: string): void => {
			const directories = [pDropPath.substring(0, pDropPath.length - 1)];

			// Remove temporary files.
			for (const file of pFiles) {
				FS.unlink(file);
				const directory = file.replace(pDropPath, "");
				let index = directory.lastIndexOf("/");
				while (index > 0) {
					if (!directories.includes(pDropPath + directory)) {
						directories.push(pDropPath + directory);
					}
					index = directory.lastIndexOf("/");
				}
			}

			// Remove directories.
			directories.sort((a, b) => {
				const al = (a.match(/\//gv) ?? []).length;
				const bl = (b.match(/\//gv) ?? []).length;
				return al > bl ? -1 : Number(al < bl);
			});
			for (const directory of directories) {
				FS.rmdir(directory);
			}
		},

		handler: (pCallback: (pFiles: string[]) => void) => (pEvent: DragEvent) => {
			GodotInputDragDrop.processEvent(pEvent, pCallback);
		},
	},
};
autoAddDeps(_GodotInputDragDrop, "$GodotInputDragDrop");
addToLibrary(_GodotInputDragDrop);
