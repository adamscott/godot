const B = preload("preload_cyclic_reference_b.notest.gd")

const VALUE_TO_TEST = "godot"

static func test_cyclic_reference():
	B.test_cyclic_reference()
