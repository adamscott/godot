/**************************************************************************/
/*  godot_js.h                                                            */
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

#pragma once

#define WASM_EXPORT __attribute__((visibility("default")))

#include <cstdint>

#ifdef __cplusplus
extern "C" {
#endif

// Config
extern void godot_js_config_locale_get(char *p_ptr, int p_max_size);
extern void godot_js_config_canvas_id_get(char *p_ptr, int p_max_size);

// OS
typedef void (*OSFinishAsyncCallback)();
typedef void (*OSRequestQuitCbCallback)();
typedef void (*OSFSSyncCallback)();
typedef void (*PWACbCallback)();

extern void godot_js_os_finish_async(OSFinishAsyncCallback p_callback);
extern void godot_js_os_request_quit_cb(OSRequestQuitCbCallback p_callback);
extern int godot_js_os_fs_is_persistent();
extern void godot_js_os_fs_sync(OSFSSyncCallback p_callback);
extern int godot_js_os_execute(const char *p_json);
extern void godot_js_os_shell_open(const char *p_uri);
extern int godot_js_os_hw_concurrency_get();
extern int godot_js_os_has_feature(const char *p_ftr);
extern int godot_js_pwa_cb(PWACbCallback p_callback);
extern int godot_js_pwa_update();

// Input
typedef int (*InputMouseButtonCbCallback)(int p_pressed, int p_button, double p_x, double p_y, int p_modifiers);
typedef void (*InputMouseMoveCbCallback)(double p_x, double p_y, double p_rel_x, double p_rel_y, int p_modifiers);
typedef int (*InputMouseWheelCbCallback)(double p_delta_x, double p_delta_y);
typedef void (*InputTouchCbCallback)(int p_type, int p_count);
typedef void (*InputKeyCbCallback)(int p_type, int p_repeat, int p_modifiers);

typedef void (*SetIMECbIMECallback)(int p_type, const char *p_text);
typedef void (*SetIMECbKeyCallback)(int p_type, int p_repeat, int p_modifiers);

extern void godot_js_input_mouse_button_cb(InputMouseButtonCbCallback p_callback);
extern void godot_js_input_mouse_move_cb(InputMouseMoveCbCallback p_callback);
extern void godot_js_input_mouse_wheel_cb(InputMouseWheelCbCallback p_callback);
extern void godot_js_input_touch_cb(InputTouchCbCallback p_callback, uint32_t *r_identifiers, double *r_coords);
extern void godot_js_input_key_cb(InputKeyCbCallback p_callback, char r_code[32], char r_key[32]);
extern void godot_js_input_vibrate_handheld(int p_duration_ms);

extern void godot_js_set_ime_active(int p_active);
extern void godot_js_set_ime_position(int p_x, int p_y);
extern void godot_js_set_ime_cb(SetIMECbIMECallback p_ime_callback, SetIMECbKeyCallback p_key_callback, char r_code[32], char r_key[32]);
extern int godot_js_is_ime_focused();

// Input gamepad
typedef void (*InputGamepadCbCallback)(int p_index, int p_connected, const char *p_id, const char *p_guid);

extern void godot_js_input_gamepad_cb(InputGamepadCbCallback p_callback);
extern int godot_js_input_gamepad_sample();
extern int godot_js_input_gamepad_sample_count();
extern int godot_js_input_gamepad_sample_get(int p_idx, float r_btns[16], int32_t *r_btns_num, float r_axes[10], int32_t *r_axes_num, int32_t *r_standard);

// Paste / Drop
typedef void (*InputPasteCbCallback)(const char *p_text);
typedef void (*InputDropFilesCbCallback)(const char **p_filev, int p_filec);

extern void godot_js_input_paste_cb(InputPasteCbCallback p_callback);
extern void godot_js_input_drop_files_cb(InputDropFilesCbCallback p_callback);

// TTS
typedef void (*TTSGetVoicesCallback)(int p_size, const char **p_voices);
typedef void (*TTSSpeakCallback)(int p_event, int p_id, int p_pos);

extern int godot_js_tts_is_speaking();
extern int godot_js_tts_is_paused();
extern int godot_js_tts_get_voices(TTSGetVoicesCallback p_callback);
extern void godot_js_tts_speak(const char *p_text, const char *p_voice, int p_volume, float p_pitch, float p_rate, int p_utterance_id, TTSSpeakCallback p_callback);
extern void godot_js_tts_pause();
extern void godot_js_tts_resume();
extern void godot_js_tts_stop();

// Display
extern int godot_js_display_screen_dpi_get();
extern double godot_js_display_pixel_ratio_get();
extern void godot_js_display_alert(const char *p_text);
extern int godot_js_display_touchscreen_is_available();
extern int godot_js_display_is_swap_ok_cancel();
extern void godot_js_display_setup_canvas(int p_width, int p_height, int p_fullscreen, int p_hidpi);

// Display canvas
extern void godot_js_display_canvas_focus();
extern int godot_js_display_canvas_is_focused();

// Display window
extern void godot_js_display_desired_size_set(int p_width, int p_height);
extern int godot_js_display_size_update();
extern void godot_js_display_window_size_get(int32_t *p_x, int32_t *p_y);
extern void godot_js_display_screen_size_get(int32_t *p_x, int32_t *p_y);
extern int godot_js_display_fullscreen_request();
extern int godot_js_display_fullscreen_exit();
extern void godot_js_display_window_title_set(const char *p_text);
extern void godot_js_display_window_icon_set(const uint8_t *p_ptr, int p_len);
extern int godot_js_display_has_webgl(int p_version);

// Display clipboard
typedef void (*DisplayClipboardGetCallback)(const char *p_text);

extern int godot_js_display_clipboard_set(const char *p_text);
extern int godot_js_display_clipboard_get(DisplayClipboardGetCallback p_callback);

// Display cursor
extern void godot_js_display_cursor_set_shape(const char *p_cursor);
extern int godot_js_display_cursor_is_hidden();
extern void godot_js_display_cursor_set_custom_shape(const char *p_shape, const uint8_t *p_ptr, int p_len, int p_hotspot_x, int p_hotspot_y);
extern void godot_js_display_cursor_set_visible(int p_visible);
extern void godot_js_display_cursor_lock_set(int p_lock);
extern int godot_js_display_cursor_is_locked();

// Display listeners
typedef void (*DisplayFullscreenCbCallback)(int p_fullscreen);
typedef void (*DisplayWindowBlurCbCallback)();
typedef void (*DisplayNotificationCbCallback)(int p_notification);

extern void godot_js_display_fullscreen_cb(DisplayFullscreenCbCallback p_callback);
extern void godot_js_display_window_blur_cb(DisplayWindowBlurCbCallback p_callback);
extern void godot_js_display_notification_cb(DisplayNotificationCbCallback p_callback, int p_enter, int p_exit, int p_in, int p_out);

// Display Virtual Keyboard
typedef void (*DisplayVkCbCallback)(const char *p_text, int p_cursor);

extern int godot_js_display_vk_available();
extern int godot_js_display_tts_available();
extern void godot_js_display_vk_cb(DisplayVkCbCallback p_callback);
extern void godot_js_display_vk_show(const char *p_text, int p_type, int p_start, int p_end);
extern void godot_js_display_vk_hide();

#ifdef __cplusplus
}
#endif
