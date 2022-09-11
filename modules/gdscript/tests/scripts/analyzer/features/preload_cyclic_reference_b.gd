const A = preload("preload_cyclic_reference_a.gd")

func test():
	pass

static func test_cyclic_reference():
	print(A.VALUE_TO_TEST)

