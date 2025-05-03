/**************************************************************************/
/*  library_godot_async.js                                                */
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

const GodotAsync = {
    $GodotAsync__postset: [
        "GodotAsync.suspending = Promise.resolve();"
    ].join("\n"),
	$GodotAsync: {
		suspending: null,
        init: () => {

        },
		handleAsync: (startAsync) => {
// eslint-disable
#if ASYNCIFY == 1
			const returnValue = Asyncify.handleAsync(startAsync);
			GodotAsync.suspending = Asyncify.whenDone();
			return returnValue;
#elif ASYNCIFY == 2
			const sleepPromise = Asyncify.handleAsync(startAsync);
			GodotAsync.suspending = GodotAsync.suspending.then(() => sleepPromise);
			return sleepPromise;
#else
			// TODO: Error out.
#endif
// eslint-enable
		},
		handleSleep: (startAsync) => {
// eslint-disable
#if ASYNCIFY == 1
			const returnValue = Asyncify.handleSleep(startAsync);
			GodotAsync.suspending = GodotAsync.suspending.then(() => Asyncify.whenDone());
			return returnValue;
#elif ASYNCIFY == 2
			const sleepPromise = Asyncify.handleSleep(startAsync);
			GodotAsync.suspending = GodotAsync.suspending.then(() => sleepPromise);
			return sleepPromise;
#else
			// TODO: Error out.
#endif
// eslint-enable
		}
	},

	godot_js_async_test__async: true,
	godot_js_async_test__deps: ['$GodotAsync'],
	godot_js_async_test__proxy: 'sync',
	godot_js_async_test__sig: 'v',
	godot_js_async_test: () => {
		GodotAsync.handleAsync(async () => {
			const wait = (ms) => new Promise((resolve, _reject) => {
				setTimeout(() => resolve(), ms);
			});
			console.group('Waiting'); // eslint-disable-line no-console
			console.log('Begin'); // eslint-disable-line no-consol
			await wait(5000);
			console.log('End'); // eslint-disable-line no-consol
			console.groupEnd(); // eslint-disable-line no-consol
		});
	},
};
autoAddDeps(GodotAsync, "$GodotAsync");
addToLibrary(GodotAsync);
