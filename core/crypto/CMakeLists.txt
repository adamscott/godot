target_sources(godot_core
	PRIVATE
		aes_context.cpp
		crypto_core.cpp
		crypto.cpp
		hashing_context.cpp
)

target_link_libraries(godot_core
	PRIVATE
		godot_thirdparty_mbedtls
)
