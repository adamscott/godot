# Options.
option(GODOT_LINUXBSD_USE_SOWRAP "Dynamically load system libraries." ON)

option(GODOT_LINUXBSD_USE_ALSA "Use ALSA." ON)
option(GODOT_LINUXBSD_USE_PULSEAUDIO "Use PulseAudio." ON)
option(GODOT_LINUXBSD_USE_DBUS "Use D-Bus to handle screensaver and portal desktop settings." ON)
option(GODOT_LINUXBSD_USE_SPEECHD "Use Speech Dispatcher for Text-to-Speech support." ON)
option(GODOT_LINUXBSD_USE_FONTCONFIG "Use fontconfig for system fonts support." ON)
option(GODOT_LINUXBSD_USE_UDEV "Use udev for gamepad connection callbacks." ON)
option(GODOT_LINUXBSD_USE_EXECINFO "Use libexecinfo on systems where glibc is not available." OFF)
option(GODOT_LINUXBSD_ENABLE_X11 "Enable X11 display." ON)
option(GODOT_LINUXBSD_ENABLE_WAYLAND "Enable Wayland display." ON)
option(GODOT_LINUXBSD_ENABLE_LIBDECOR "Enable libdecor support." ON)
option(GODOT_LINUXBSD_ENABLE_TOUCH "Enable touch events." ON)

# Library.
include(FindPkgConfig)
include(Platform)

add_library(godot_linuxbsd)

list(APPEND
	GODOT_COMPILE_DEFINITIONS
		"LINUXBSD_ENABLED"
		"UNIX_ENABLED"
)

target_sources(godot_linuxbsd
	PUBLIC
		crash_handler_linuxbsd.cpp
		freedesktop_portal_desktop.cpp
		freedesktop_screensaver.cpp
		godot_linuxbsd.cpp
		joypad_linux.cpp
		os_linuxbsd.cpp
		tts_linux.cpp
)

target_link_libraries(godot_linuxbsd
	PRIVATE
		godot_drivers_unix
)

target_include_directories(godot_linuxbsd
	PUBLIC
		${Godot_SOURCE_DIR}
)

macro_target_include_platform_config(godot_linuxbsd)

if(GODOT_LINUXBSD_USE_ALSA)
	list(APPEND
		GODOT_COMPILE_DEFINITIONS
			"ALSA_ENABLED" 
			"ALSAMIDI_ENABLED"
	)

	if(NOT GODOT_LINUXBSD_USE_SOWRAP)
		pkg_check_modules(GODOT_LINUXBSD_ALSA REQUIRED alsa)

		target_include_directories(godot_linuxbsd
			PRIVATE
				${GODOT_LINUXBSD_ALSA_LIBRARY_DIRS}
		)

		target_compile_definitions(godot_linuxbsd
			PRIVATE
				${GODOT_LINUXBSD_ALSA_CFLAGS}
		)
	endif()
endif()

target_compile_definitions(godot_linuxbsd
	PUBLIC
		$<BUILD_INTERFACE:${GODOT_COMPILE_DEFINITIONS}>
)

target_link_libraries(godot
	PRIVATE
		godot_linuxbsd
)
