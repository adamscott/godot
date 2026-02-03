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

import type { _GodotAudio, _GodotAudioScript, _GodotAudioWorklet } from "#/libraries/audio/index.js";
import type {
	_GodotConfig,
	_GodotEventListeners,
	_GodotFS,
	_GodotOS,
	_GodotPWA,
	_IDHandler,
} from "#/libraries/os/index.js";
import type {
	_GodotDisplay,
	_GodotDisplayCursor,
	_GodotDisplayScreen,
	_GodotDisplayVK,
} from "#/libraries/display/index.js";
import type { _GodotEval, _GodotJSWrapper } from "#/libraries/jswrapper/index.js";
import type { _GodotIME, _GodotInput, _GodotInputDragDrop, _GodotInputGamepads } from "#/libraries/input/index.js";
import type { _GodotFetch } from "#/libraries/fetch/index.js";
import type { _GodotRuntime } from "#/libraries/runtime/index.js";
import type { _GodotWebGL2 } from "#/libraries/webgl2/index.js";
import type { _GodotWebMidi } from "#/libraries/webmidi/index.js";

export * from "@godotengine/emscripten-utils/external";

export declare const GodotRuntime: typeof _GodotRuntime.$GodotRuntime;
export declare const GodotOS: typeof _GodotOS.$GodotOS;
export declare const GodotFS: typeof _GodotFS.$GodotFS;
export declare const GodotAudio: typeof _GodotAudio.$GodotAudio;
export declare const GodotAudioWorklet: typeof _GodotAudioWorklet.$GodotAudioWorklet;
export declare const GodotAudioScript: typeof _GodotAudioScript.$GodotAudioScript;
export declare const GodotDisplayVK: typeof _GodotDisplayVK.$GodotDisplayVK;
export declare const GodotDisplayCursor: typeof _GodotDisplayCursor.$GodotDisplayCursor;
export declare const GodotDisplayScreen: typeof _GodotDisplayScreen.$GodotDisplayScreen;
export declare const GodotDisplay: typeof _GodotDisplay.$GodotDisplay;
export declare const GodotEval: typeof _GodotEval.$GodotEval;
export declare const GodotFetch: typeof _GodotFetch.$GodotFetch;
export declare const GodotJSWrapper: typeof _GodotJSWrapper.$GodotJSWrapper;
export declare const GodotEventListeners: typeof _GodotEventListeners.$GodotEventListeners;
export declare const GodotConfig: typeof _GodotConfig.$GodotConfig;
export declare const GodotPWA: typeof _GodotPWA.$GodotPWA;
export declare const IDHandler: typeof _IDHandler.$IDHandler;
export declare const GodotIME: typeof _GodotIME.$GodotIME;
export declare const GodotInputGamepads: typeof _GodotInputGamepads.$GodotInputGamepads;
export declare const GodotInputDragDrop: typeof _GodotInputDragDrop.$GodotInputDragDrop;
export declare const GodotInput: typeof _GodotInput.$GodotInput;
export declare const GodotWebGL2: typeof _GodotWebGL2.$GodotWebGL2;
export declare const GodotWebMidi: typeof _GodotWebMidi.$GodotWebMidi;
