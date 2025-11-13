const Preloader = /** @constructor */ function () { // eslint-disable-line no-unused-vars
	const DOWNLOAD_ATTEMPTS_MAX = 4;
	const loadingFiles = {};
	const lastProgress = { loaded: 0, total: 0 };
	let progressFunc = null;
	let concurrencyQueueManager = null;
	let filesSizeTotal = 0;

	this.preloadedFiles = [];

	function getTrackedResponse(response, load_status) {
		async function onLoadProgress(reader, controller) {
			const { done, value } = await reader.read();
			if (load_status.done) {
				return Promise.resolve();
			}
			if (done) {
				load_status.done = true;
				return Promise.resolve();
			}
			controller.enqueue(value);
			load_status.loaded += value.byteLength;
			return onLoadProgress(reader, controller);
		}

		const reader = response.body.getReader();
		return new Response(new ReadableStream({
			start: async function (controller) {
				try {
					await onLoadProgress(reader, controller);
				} finally {
					controller.close();
				}
			},
		}), { headers: response.headers });
	}

	async function loadFetch(file, fileSize, raw) {
		if (!(file in loadingFiles)) {
			loadingFiles[file] = {
				file,
				total: fileSize || 0,
				loaded: 0,
				done: false,
			};
		}

		try {
			const response = await fetch(file);

			if (!response.ok) {
				throw new Error(`Got response ${response.status}: ${response.statusText}`);
			}
			const tr = getTrackedResponse(response, loadingFiles[file]);
			if (raw) {
				return Promise.resolve(tr);
			}

			return tr.arrayBuffer();
		} catch (error) {
			const newError = new Error(`loadFetch for "${file}" failed:`);
			newError.cause = error;
			throw newError;
		}
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

	const animateProgress = function () {
		let loaded = 0;
		let total = 0;
		let totalIsValid = true;
		let progressIsFinal = true;

		// eslint-disable-next-line no-unused-vars
		for (const [_file, status] of Object.entries(loadingFiles)) {
			if (!status.done) {
				progressIsFinal = false;
			}
			if (filesSizeTotal > 0) {
				total = filesSizeTotal;
			} else if (!totalIsValid || status.total === 0) {
				totalIsValid = false;
				total = 0;
			} else {
				total += status.total;
			}
			loaded += status.loaded;
		}
		if (loaded !== lastProgress.loaded || (!filesSizeTotal && total !== lastProgress.total)) {
			lastProgress.loaded = loaded;
			if (filesSizeTotal > 0) {
				lastProgress.total = filesSizeTotal;
			} else {
				lastProgress.total = total;
			}
			if (typeof progressFunc === 'function') {
				progressFunc(loaded, total);
			}
		}
		if (!progressIsFinal) {
			window.requestAnimationFrame(animateProgress);
		}
	};

	this.animateProgress = animateProgress;

	this.setProgressFunc = function (callback) {
		progressFunc = callback;
	};

	this.loadPromise = async function (file, fileSize, raw = false) {
		if (concurrencyQueueManager == null) {
			const { ConcurrencyQueueManager } = await import('@godotengine/utils/concurrencyQueueManager');
			// Another `loadPromise()` could have ended while awaiting.
			if (concurrencyQueueManager == null) {
				concurrencyQueueManager = new ConcurrencyQueueManager();
			}
		}

		try {
			return await concurrencyQueueManager.queue(() => retry(
				loadFetch.bind(null, file, fileSize, raw),
				DOWNLOAD_ATTEMPTS_MAX
			));
		} catch (error) {
			const newError = new Error(`An error occurred while running \`Preloader.loadPromise("${file}", ${fileSize}, raw = ${raw})\``);
			newError.cause = error;
			throw error;
		}
	};

	this.preload = async function (pathOrBuffer, destPath, fileSize) {
		let buffer = null;
		if (typeof pathOrBuffer === 'string') {
			const me = this;
			const buf = await this.loadPromise(pathOrBuffer, fileSize);
			me.preloadedFiles.push({
				path: destPath || pathOrBuffer,
				buffer: buf,
			});
			return;
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
			return;
		}
		throw new Error('Invalid object for preloading');
	};

	this.init = (pOptions = {}) => {
		const {
			fileSizes: loadingFileSizes = {},
		} = pOptions;

		for (const [file, fileSize] of Object.entries(loadingFileSizes)) {
			loadingFiles[file] = {
				file,
				total: fileSize || 0,
				loaded: 0,
				done: false,
			};
			filesSizeTotal += fileSize;
		}
		filesSizeTotal = Object.values(loadingFileSizes).reduce((pAccumulator, pFileSize) => pAccumulator + pFileSize, 0);
	};
};
