const Preloader = /** @constructor */ function () { // eslint-disable-line no-unused-vars
	const bandwidthSaver = {
		enabled: false,
		checked: false,
		compressionFormat: '',
	};

	/**
	 * Tries to download a precompressed brotli file.
	 * @param {Response} response Initial response.
	 */
	async function tryDownloadBrotliFile(response) {
		const newUrl = new URL(response.url);
		newUrl.pathname += '.br';
		try {
			const brotliHeadResponse = await fetch(newUrl, {
				method: 'HEAD',
				headers: response.headers,
			});
			if (!brotliHeadResponse.ok) {
				// The file doesn't exist, it's not an error.
				return null;
			}

			let fileSize = 0;
			if (brotliHeadResponse.headers.has('content-length')) {
				fileSize = brotliHeadResponse.headers.get('content-length');
			}

			// The method succeeded, so the file exists.
			// Lets load the actual brotli-dec-wasm module.
			const brotliWasm = await Engine.getJSModule('brotli-dec-wasm').then((m) => m.default);

			// Let's load the actual brotli file.
			const brotliResponse = await fetch(newUrl, {
				method: 'GET',
				headers: response.headers,
			});
			if (!brotliResponse.ok) {
				// We weren't able to download the file for some reason, let's just print the error and ignore the file.
				const error = new Error(
					`Error while downloading brotli-compressed file "${newUrl.href}", got status ${brotliResponse.status}: ${brotliResponse.statusText}`
				);
				engine.config.onPrintError(error);
				return null;
			}

			const fileContents = await brotliResponse.arrayBuffer();
			// Note: `brotliWasm.DecompressStream()` method has been tried, but it doesn't seem to work.
			const decompressedData = brotliWasm.decompress(new Uint8Array(fileContents));
			return {
				response: new Response(decompressedData, {
					method: 'GET',
					status: brotliResponse.status,
					headers: brotliResponse.headers,
				}),
				fileSize,
			};
		} catch (error) {
			const newError = new Error(`Error while downloading brotli-compressed file "${newUrl.href}"`);
			newError.cause = error;
			engine.config.onPrintError(error);
			return null;
		}
	}

	async function tryDownloadGZipFile(response) {
		const newUrl = new URL(response.url);
		newUrl.pathname += '.gz';
		try {
			const gzipHeadResponse = await fetch(newUrl, {
				method: 'HEAD',
				headers: response.headers,
			});
			if (!gzipHeadResponse.ok) {
				// The file doesn't exist, it's not an error.
				return null;
			}

			let fileSize = 0;
			if (gzipHeadResponse.headers.has('content-length')) {
				fileSize = gzipHeadResponse.headers.get('content-length');
			}

			// The method succeeded, so the file exists.
			// Lets load the actual pako module.
			const pako = await Engine.getJSModule('pako');
			const inflatorEventTarget = new EventTarget();

			class Inflator extends pako.Inflate {
				onData(chunk) {
					super.onData(chunk);
					inflatorEventTarget.dispatchEvent(new CustomEvent('data', { detail: { chunk } }));
				}

				onEnd(status) {
					super.onEnd(status);
					inflatorEventTarget.dispatchEvent(new CustomEvent('end'));
				}
			}
			const inflator = new Inflator();

			const decompressionStream = new TransformStream({
				start(controller) {
					inflatorEventTarget.addEventListener('data', (event) => {
						controller.enqueue(event.detail.chunk);
					});
					inflatorEventTarget.addEventListener('end', (_) => {
						controller.terminate();
					});
				},
				transform(chunk, controller) {
					inflator.push(chunk);
					if (inflator.err) {
						const error = new Error(`gzip inflation error: ${inflator.msg}`);
						controller.error(error);
					}
				},
			});

			// Let's load the actual gzip file.
			const gzipResponse = await fetch(newUrl, {
				method: 'GET',
				headers: response.headers,
			});
			if (!gzipResponse.ok) {
				// We weren't able to download the file for some reason, let's just print the error and ignore the file.
				const error = new Error(
					`Error while downloading gzip-compressed file "${newUrl.href}", got status ${gzipResponse.status}: ${gzipResponse.statusText}`
				);
				engine.config.onPrintError(error);
				return null;
			}

			const decompressedStream = gzipResponse.body.pipeThrough(decompressionStream);

			return {
				response: new Response(decompressedStream, {
					method: 'GET',
					status: gzipResponse.status,
					headers: gzipResponse.headers,
				}),
				fileSize,
			};
		} catch (error) {
			const newError = new Error(`Error while downloading gzip-compressed file "${newUrl.href}"`);
			newError.cause = error;
			engine.config.onPrintError(error);
			return null;
		}
	}

	function getTrackedResponse(response, load_status) {
		function onloadprogress(reader, controller) {
			return reader.read().then(function (result) {
				if (load_status.done) {
					return Promise.resolve();
				}
				if (result.value) {
					controller.enqueue(result.value);
					load_status.loaded += result.value.length;
				}
				if (!result.done) {
					return onloadprogress(reader, controller);
				}
				load_status.done = true;
				return Promise.resolve();
			});
		}

		const reader = response.body.getReader();
		return new Response(
			new ReadableStream({
				start: function (controller) {
					onloadprogress(reader, controller).then(function () {
						controller.close();
					});
				},
			}),
			{ headers: response.headers }
		);
	}

	async function loadFetch(file, tracker, fileSize, raw) {
		tracker[file] = {
			total: fileSize || 0,
			loaded: 0,
			done: false,
		};

		const handleResponse = async (response) => {
			if (!response.ok) {
				throw new Error(`Failed loading file '${file}'`);
			}

			const tr = await getTrackedResponse(response, tracker[file]);
			if (raw) {
				return tr;
			}
			return tr.arrayBuffer();
		};

		const headResponse = await fetch(file, {
			method: 'HEAD',
		});
		if (!headResponse.ok) {
			throw new Error(`Failed loading file '${file}'`);
		}

		if (!bandwidthSaver.checked) {
			bandwidthSaver.checked = true;

			const compressionFormats = Engine.getEngineFileCompressionFormats();
			const availableModules = Engine.getJSModuleNames();
			if (!headResponse.headers.has('content-encoding') && compressionFormats.length > 0) {
				if (compressionFormats.includes('brotli') && availableModules.includes('brotli-dec-wasm')) {
					bandwidthSaver.enabled = true;
					bandwidthSaver.compressionFormat = 'brotli';
				} else if (compressionFormats.includes('gzip') && availableModules.includes('pako')) {
					bandwidthSaver.enabled = true;
					bandwidthSaver.compressionFormat = 'gzip';
				}
			}
		}

		if (bandwidthSaver.enabled) {
			switch (bandwidthSaver.compressionFormat) {
			case 'brotli': {
				const brotliInfo = await tryDownloadBrotliFile(headResponse);
				if (brotliInfo != null) {
					tracker[file].total = brotliInfo.fileSize;
					return handleResponse(brotliInfo.response);
				}
			} break;
			case 'gzip': {
				const gzipInfo = await tryDownloadGZipFile(headResponse);
				if (gzipInfo != null) {
					tracker[file].total = gzipInfo.fileSize;
					return handleResponse(gzipInfo.response);
				}
			} break;
			default:
				// Do nothing.
			}
		}

		const response = await fetch(file);
		return handleResponse(response);
	}

	function retry(func, attempts = 1) {
		function onerror(err) {
			if (attempts <= 1) {
				return Promise.reject(err);
			}
			return new Promise(function (resolve, reject) {
				setTimeout(function () {
					retry(func, attempts - 1).then(resolve).catch(reject);
				}, 1000);
			});
		}
		return func().catch(onerror);
	}

	const DOWNLOAD_ATTEMPTS_MAX = 4;
	const loadingFiles = {};
	const lastProgress = { loaded: 0, total: 0 };
	let progressFunc = null;

	const animateProgress = function () {
		let loaded = 0;
		let total = 0;
		let totalIsValid = true;
		let progressIsFinal = true;

		Object.keys(loadingFiles).forEach(function (file) {
			const stat = loadingFiles[file];
			if (!stat.done) {
				progressIsFinal = false;
			}
			if (!totalIsValid || stat.total === 0) {
				totalIsValid = false;
				total = 0;
			} else {
				total += stat.total;
			}
			loaded += stat.loaded;
		});
		if (loaded !== lastProgress.loaded || total !== lastProgress.total) {
			lastProgress.loaded = loaded;
			lastProgress.total = total;
			if (typeof progressFunc === 'function') {
				progressFunc(loaded, total);
			}
		}
		if (!progressIsFinal) {
			requestAnimationFrame(animateProgress);
		}
	};

	this.animateProgress = animateProgress;

	this.setProgressFunc = function (callback) {
		progressFunc = callback;
	};

	this.loadPromise = function (file, fileSize, raw = false) {
		return retry(loadFetch.bind(null, file, loadingFiles, fileSize, raw), DOWNLOAD_ATTEMPTS_MAX);
	};

	this.preloadedFiles = [];
	this.preload = function (pathOrBuffer, destPath, fileSize) {
		let buffer = null;
		if (typeof pathOrBuffer === 'string') {
			const me = this;
			return this.loadPromise(pathOrBuffer, fileSize).then(function (buf) {
				me.preloadedFiles.push({
					path: destPath || pathOrBuffer,
					buffer: buf,
				});
				return Promise.resolve();
			});
		} else if (pathOrBuffer instanceof ArrayBuffer) {
			buffer = new Uint8Array(pathOrBuffer);
		} else if (ArrayBuffer.isView(pathOrBuffer)) {
			buffer = new Uint8Array(pathOrBuffer.buffer);
		}
		if (buffer) {
			this.preloadedFiles.push({
				path: destPath,
				buffer: pathOrBuffer,
			});
			return Promise.resolve();
		}
		return Promise.reject(new Error('Invalid object for preloading'));
	};
};
