const Preloader = /** @constructor */ function () { // eslint-disable-line no-unused-vars
	/**
	 * @param {Response} response
	 * @param {Object} load_status
	 * @param {number} load_status.total
	 * @param {number} load_status.loaded
	 * @param {boolean} load_status.done
	 * @returns {Promise<Response>}
	 */
	function getTrackedResponse(response, load_status) {
		/**
		 * @param {ReadableStream} reader
		 * @returns {Promise<typeof consume>|Promise<void>}
		 */
		async function consume(reader) {
			const { done, value } = await reader.read();
			if (load_status.done) {
				return Promise.resolve();
			}
			if (load_status.total === -1) {
				load_status.total = Number(response.headers.get('content-length') ?? 0);
			}
			if (value) {
				load_status.loaded += value.length;
			}
			if (!done) {
				return consume(reader);
			}
			load_status.done = true;
			return Promise.resolve();
		}

		const responseClone = response.clone();
		consume(responseClone.body.getReader()).catch((err) => {
			// Do nothing.
		});

		// Return the response right away to continue the process,
		// without binding it to the tracking of the response.
		return response;
	}

	async function loadFetch(file, tracker, fileSize) {
		tracker[file] = {
			total: fileSize || -1,
			loaded: 0,
			done: false,
		};
		const response = await fetch(file);
		if (!response.ok) {
			throw new Error(`Failed loading file '${file}'`);
		}
		return getTrackedResponse(response, tracker[file]);
	}

	async function retry(func, attempts = 1) {
		function onRetryError(err) {
			if (attempts <= 1) {
				const newErr = new Error('Max retry attempts reached.');
				newErr.cause = err;
				throw newErr;
			}
			return new Promise(function (resolve, reject) {
				setTimeout(function () {
					retry(func, attempts - 1).then(resolve).catch(reject);
				}, 1000);
			});
		}

		try {
			return await func();
		} catch (err) {
			return onRetryError(err);
		}
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

		for (const file of Object.keys(loadingFiles)) {
			const stat = loadingFiles[file];
			if (!stat.done) {
				progressIsFinal = false;
			}
			if (!totalIsValid || stat.total <= 0) {
				totalIsValid = false;
				total = 0;
			} else {
				total += stat.total;
			}
			loaded += stat.loaded;
		}
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

	this.loadPromise = function (file, fileSize) {
		return retry(loadFetch.bind(null, file, loadingFiles, fileSize), DOWNLOAD_ATTEMPTS_MAX);
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
