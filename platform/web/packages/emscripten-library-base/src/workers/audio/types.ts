/**************************************************************************/
/*  types.ts                                                              */
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

import type { FixedLengthArray } from "@godotengine/utils/types";

// https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/parameterDescriptors_static#value
export interface AudioParamDescriptor {
	name: string;
	automationRate?: "a-rate" | "k-rate";
	minValue?: number;
	maxValue?: number;
	defaultValue?: number;
}

// https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/AudioWorkletProcessor#options
export interface AudioWorkletProcessorConstructorOptions<NO extends number = number> {
	numberOfInputs?: number;
	numberOfOutputs?: NO;
	outputChannelCount?: FixedLengthArray<number, NO>;
	parameterData?: Record<AudioParamDescriptor["name"], Omit<AudioParamDescriptor, "name">>;
	processorOptions?: unknown;
}

export type Channel = Float32Array<ArrayBuffer>;
export type Input = Channel[];
export type Output = Channel[];
