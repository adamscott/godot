const B = preload("preload_cyclic_reference_b.notest.gd")

const WAITING_FOR = "godot"

static func test_cyclic_reference():
	B.test_cyclic_reference()
