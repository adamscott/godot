/**************************************************************************/
/*  global.d.ts                                                           */
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

import { _GodotRuntime } from "#/libraries/runtime.ts";
import { _GodotOS, _GodotEventListeners, _GodotConfig, _IDHandler, _GodotFS, _GodotPWA } from "#/libraries/os.ts";
import { _GodotAudio, _GodotAudioWorklet, _GodotAudioScript } from "#/libraries/audio.ts";
import { _GodotFetch } from "#/libraries/fetch.ts";
import { _GodotDisplayVK, _GodotDisplayCursor, _GodotDisplayScreen, _GodotDisplay } from "#/libraries/display.ts";
import { _GodotJSWrapper } from "#/libraries/eval.ts";
import { _GodotIME, _GodotInputGamepads, _GodotInputDragDrop, _GodotInput } from "#/libraries/input.ts";
import { _GodotWebGL2 } from "#/libraries/webgl2.ts";
import { _GodotWebMidi } from "#/libraries/webmidi.ts";

import "./emscripten.d.ts";

declare global {
	const GodotRuntime: typeof _GodotRuntime.$GodotRuntime;
	const GodotOS: typeof _GodotOS.$GodotOS;
	const GodotFS: typeof _GodotFS.$GodotFS;
	const GodotAudio: typeof _GodotAudio.$GodotAudio;
	const GodotAudioWorklet: typeof _GodotAudioWorklet.$GodotAudioWorklet;
	const GodotAudioScript: typeof _GodotAudioScript.$GodotAudioScript;
	const GodotDisplayVK: typeof _GodotDisplayVK.$GodotDisplayVK;
	const GodotDisplayCursor: typeof _GodotDisplayCursor.$GodotDisplayCursor;
	const GodotDisplayScreen: typeof _GodotDisplayScreen.$GodotDisplayScreen;
	const GodotDisplay: typeof _GodotDisplay.$GodotDisplay;
	const GodotFetch: typeof _GodotFetch.$GodotFetch;
	const GodotJSWrapper: typeof _GodotJSWrapper.$GodotJSWrapper;
	const GodotEventListeners: typeof _GodotEventListeners.$GodotEventListeners;
	const GodotConfig: typeof _GodotConfig.$GodotConfig;
	const GodotPWA: typeof _GodotPWA.$GodotPWA;
	const IDHandler: typeof _IDHandler.$IDHandler;
	const GodotIME: typeof _GodotIME.$GodotIME;
	const GodotInputGamepads: typeof _GodotInputGamepads.$GodotInputGamepads;
	const GodotInputDragDrop: typeof _GodotInputDragDrop.$GodotInputDragDrop;
	const GodotInput: typeof _GodotInput.$GodotInput;
	const GodotWebGL2: typeof _GodotWebGL2.$GodotWebGL2;
	const GodotWebMidi: typeof _GodotWebMidi.$GodotWebMidi;
}
