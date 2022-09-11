const B = preload("preload_cyclic_reference_b.gd")

const VALUE_TO_TEST = "godot"

func test():
	pass

static func test_cyclic_reference():
	B.test_cyclic_reference()
