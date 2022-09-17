const A = preload("preload_cyclic_reference_a.notest.gd")

static func test_cyclic_reference():
	print(A.VALUE_TO_TEST)

