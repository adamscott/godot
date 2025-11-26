const Preloader = /** @constructor */ function () { // eslint-disable-line no-unused-vars
	const CONCURRENCY_LIMIT = 5;
	const concurrency = {
		queue: [],
		active: [],
		eventTarget: new EventTarget(),
	};

	const fileSizes = {
		totalSet: false,
		total: 0,
	};

	const _waitForProcessQueue = (pPromiseFn) => {
		const symbol = Symbol('QueueItemId');
		let queueItem = {
			promiseFn: pPromiseFn,
			symbol,
		};

		if (concurrency.active.length < CONCURRENCY_LIMIT) {
			concurrency.active.push(queueItem);
			return queueItem;
		}

		concurrency.queue.push(queueItem);
		return new Promise((pResolve, pReject) => {
			const onQueueNext = (pEvent) => {
				if (pEvent?.detail?.symbol !== symbol) {
					return;
				}
				queueItem = pEvent.detail;
				concurrency.eventTarget.removeEventListener('queuenext', onQueueNext);
				if (concurrency.active.length >= CONCURRENCY_LIMIT) {
					pReject(new Error('Something went wrong, concurrency is too high.'));
					return;
				}
				concurrency.active.push(queueItem);
				pResolve(queueItem);
			};
			concurrency.eventTarget.addEventListener('queuenext', onQueueNext);
		});
	};

	const waitForConcurrency = async (pPromiseFn) => {
		const queueItem = await _waitForProcessQueue(pPromiseFn);
		let returnValue;
		try {
			returnValue = await queueItem.promiseFn();
		} catch (error) {
			const newError = new Error('An error occurred while waiting for concurrency.');
			newError.cause = error;
			throw error;
		}
		const queueIndex = concurrency.active.indexOf(queueItem);
		concurrency.active.splice(queueIndex, 1);
		while (concurrency.queue.length > 0 && concurrency.active.length < CONCURRENCY_LIMIT) {
			const concurrencyQueueItem = concurrency.queue[0];
			concurrency.queue.splice(0, 1);
			concurrency.eventTarget.dispatchEvent(new CustomEvent('queuenext', { detail: concurrencyQueueItem }));
		}
		return returnValue;
	};

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
		return new Response(new ReadableStream({
			start: function (controller) {
				onloadprogress(reader, controller).then(function () {
					controller.close();
				});
			},
		}), { headers: response.headers });
	}

	async function loadFetch(file, tracker, fileSize, raw) {
		tracker[file] = {
			total: fileSize || 0,
			loaded: 0,
			done: false,
		};
		try {
			const response = await fetch(file);

			if (!response.ok) {
				throw new Error(`Got response ${response.status}: ${response.statusText}`);
			}
			const tr = getTrackedResponse(response, tracker[file]);
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
			if (fileSizes.totalSet) {
				total = fileSizes.total;
			} else if (!totalIsValid || stat.total === 0) {
				totalIsValid = false;
				total = 0;
			} else {
				total += stat.total;
			}
			loaded += stat.loaded;
		});
		if (loaded !== lastProgress.loaded || (!fileSizes.totalSet && total !== lastProgress.total)) {
			lastProgress.loaded = loaded;
			if (fileSizes.totalSet) {
				lastProgress.total = fileSizes.total;
			} else {
				lastProgress.total = total;
			}
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

	this.loadPromise = async function (file, fileSize, raw = false) {
		try {
			return await waitForConcurrency(() => retry(loadFetch.bind(null, file, loadingFiles, fileSize, raw), DOWNLOAD_ATTEMPTS_MAX));
		} catch (error) {
			const newError = new Error(`An error occurred while running Preloader.loadPromise("${file}", ${fileSize}, raw = ${raw})`);
			newError.cause = error;
			throw error;
		}
	};

	this.preloadedFiles = [];
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

	this.setFileSizesTotal = (pFileSizesTotal) => {
		fileSizes.total = pFileSizesTotal;
		fileSizes.totalSet = true;
	};
};
