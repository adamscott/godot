export const NULLPTR = 0;

/**
 * @typedef {Int8Array|Int16Array|Int32Array|BigInt64Array|Uint8Array|Uint16Array|Uint32Array|BigUint64Array|Float32Array|Float64Array} TypedArray
 * @typedef {("i8"|"int8_t")|("i16"|"int16_t")|("i32"|"int32_t")|("i64"|"int64_t")|("u8"|"uint8_t")|("u16"|"uint16_t")|("u32"|"uint32_t")|("u64"|"uint64_t")|("f32"|"float32_t"|"float")|("f64"|"float64_t"|"double")|("size_t")} BaseType
 * @typedef {"*"|"**"|"***"|"****"|"*****"} PtrIndicator
 * @typedef {`${BaseType}${PtrIndicator}`} PtrType
 * @typedef {BaseType|PtrType} Type
 * @typedef {Uint8Array} HEAPU8
 * @typedef {() => HEAPU8} GetHEAPU8
 * @typedef {(size: number) => number} Malloc
 * @typedef {(ptr: number) => void} Free
 * @typedef {(type: Type) => number} SizeOf
 * @typedef {ReturnType<initWasmUtils>} WasmUtils
 */

class WasmValueBase {
	/**
	 * Returns the pointer of the value.
	 * @type {typeof this._ptr}
	 */
	get ptr() {
		return this._ptr;
	}

	/**
	 * Returns the value in memory.
	 * @returns {typeof this._type extends Type ? number : DataView}
	 */
	get value() {
		if (this._type != null) {
			if (this._type.endsWith("*")) {
				if (this._wasmUtils.sizeOf("*") === this._wasmUtils.sizeOf("u32")) {
					return this.view.getUint32(0, true);
				}
				return this.view.getBigUint64(0, true);
			}

			switch (this._type) {
				case "i8":
				case "int8_t":
					return this.view.getInt8(0);
				case "i16":
				case "int16_t":
					return this.view.getInt16(0, true);
				case "i32":
				case "int32_t":
					return this.view.getInt32(0, true);
				case "i64":
				case "int64_t":
					return this.view.getBigInt64(0, true);
				case "u8":
				case "uint8_t":
					return this.view.getUint8(0);
				case "u16":
				case "uint16_t":
					return this.view.getUint16(0, true);
				case "uint32_t":
					return this.view.getUint32(0, true);
				case "uint64_t":
					return this.view.getBigUint64(0, true);
				case "float":
				case "f32":
				case "float32_t":
					return this.view.getFloat32(0, true);
				case "double":
				case "f64":
				case "float64_t":
					return this.view.getFloat64(0, true);
				case "size_t":
					if (this._wasmUtils.sizeOf("*") === this._wasmUtils.sizeOf("u32")) {
						return this.view.getUint32(0, true);
					}
					return this.view.getBigUint64(0, true);
				default:
					throw new TypeError(`Unknown type: "${this._type}"`);
			}
		}
		return new Uint8Array(this.view.buffer).slice(
			this.view.byteOffset,
			this.view.byteOffset + this.view.byteLength,
		);
	}

	/**
	 * Sets the value in memory.
	 * @param {typeof this._type extends Type ? number : TypedArray}
	 */
	set value(value) {
		if (this._type != null) {
			if (this._type.endsWith("*")) {
				if (this._wasmUtils.sizeOf("*") === this._wasmUtils.sizeOf("u32")) {
					return this.view.setUint32(0, value, true);
				}
				return this.view.setBigUint64(0, value, true);
			}

			switch (this._type) {
				case "i8":
				case "int8_t":
					return this.view.setInt8(0, value);
				case "i16":
				case "int16_t":
					return this.view.setInt16(0, value, true);
				case "i32":
				case "int32_t":
					return this.view.setInt32(0, value, true);
				case "i64":
				case "int64_t":
					return this.view.setBigInt64(0, value, true);
				case "u8":
				case "uint8_t":
					return this.view.setUint8(0, value, true);
				case "u16":
				case "uint16_t":
					return this.view.setUint16(0, value, true);
				case "u32":
				case "uint32_t":
					return this.view.setUint32(0, value, true);
				case "u64":
				case "uint64_t":
					return this.view.setBigUint64(0, value, true);
				case "float":
				case "f32":
				case "float32_t":
					return this.view.setFloat32(0, value, true);
				case "double":
				case "f64":
				case "float64_t":
					return this.view.setFloat64(0, value, true);
				case "size_t":
					if (this._wasmUtils.sizeOf("size_t") === this._wasmUtils.sizeOf("uint32_t")) {
						return this.view.setUint32(0, value, true);
					}
					return this.view.setBigUint64(0, value, true);
				default:
					throw new TypeError(`Unknown type: "${this._type}"`);
			}
		}
		new Uint8Array(this.view.buffer).set(value, this.view.byteOffset);
	}

	/**
	 * Returns the DataView of the value.
	 * @returns {DataView}
	 */
	get view() {
		try {
			return new DataView(this._wasmUtils.HEAPU8.buffer, this._ptr, this._size);
		} catch (err) {
			const newErr = new Error("???");
			newErr.cause = err;
			throw newErr;
		}
	}

	/**
	 * @constructor
	 * @param {{ type?: Type, size?: number }} params
	 * @param {WasmUtils} wasmUtils
	 */
	constructor(params, wasmUtils) {
		/** @type {typeof wasm} */
		this._wasmUtils = wasmUtils;

		const { type, size } = params;
		if (type != null && size != null) {
			throw new Error("Cannot define both type and size.");
		}

		/** @type {Type|null} */
		this._type;
		if (type != null) {
			this._type = type;
			this._size = this._wasmUtils.sizeOf(this._type);
		} else {
			this._type = null;
			this._size = size;
		}

		/** @type {number} */
		this._ptr = NULLPTR;

		this._init();
	}

	_init() {
		this._ptr = this._wasmUtils.malloc(this._size);
	}

	destroy() {
		this._wasmUtils.free(this._ptr);
	}
}

/**
 * @typedef {{ name: string, type: Type, size: number, offset: number }} WasmStructMemberDefinition
 */

class WasmStructMember {
	get ptr() {
		return this._struct._ptr + this._offset;
	}

	/**
	 * Returns a view to a buffer.
	 * @throws {Error} When `buffer` is null.
	 * @returns {DataView}
	 */
	get view() {
		return new DataView(this._struct.wasm.HEAPU8.buffer, this.ptr, this._size);
	}

	get value() {
		if (this._type.endsWith("*")) {
			if (this._wasmUtils.sizeOf("size_t") === this._wasmUtils.sizeOf("uint32_t")) {
				return this.view.getUint32(0, true);
			}
			return this.view.getBigUint64(0, true);
		}

		switch (this._type) {
			case "i8":
			case "int8_t":
				return this.view.getInt8(0);
			case "i16":
			case "int16_t":
				return this.view.getInt16(0, true);
			case "i32":
			case "int32_t":
				return this.view.getInt32(0, true);
			case "i64":
			case "int64_t":
				return this.view.getBigInt64(0, true);
			case "u8":
			case "uint8_t":
				return this.view.getUint8(0);
			case "u16":
			case "uint16_t":
				return this.view.getUint16(0, true);
			case "uint32_t":
				return this.view.getUint32(0, true);
			case "uint64_t":
				return this.view.getBigUint64(0, true);
			case "float":
			case "f32":
			case "float32_t":
				return this.view.getFloat32(0, true);
			case "double":
			case "f64":
			case "float64_t":
				return this.view.getFloat64(0, true);
			case "size_t":
				if (this._wasmUtils.sizeOf("size_t") === this._wasmUtils.sizeOf("uint32_t")) {
					return this.view.getUint32(0, true);
				}
				return this.view.getBigUint64(0, true);
			default:
				throw new TypeError(`Unknown type: "${this._type}"`);
		}
	}

	set value(value) {
		if (typeof value === "number") {
			if (this._type.endsWith("*")) {
				if (this._wasmUtils.sizeOf("size_t") === this._wasmUtils.sizeOf("uint32_t")) {
					return this.view.setUint32(0, value, true);
				}
				return this.view.setBigUint64(0, value, true);
			}

			switch (this._type) {
				case "i8":
				case "int8_t":
					return this.view.setInt8(0, value);
				case "i16":
				case "int16_t":
					return this.view.setInt16(0, value, true);
				case "i32":
				case "int32_t":
					return this.view.setInt32(0, value, true);
				case "i64":
				case "int64_t":
					return this.view.setBigInt64(0, value, true);
				case "u8":
				case "uint8_t":
					return this.view.setUint8(0, value, true);
				case "u16":
				case "uint16_t":
					return this.view.setUint16(0, value, true);
				case "u32":
				case "uint32_t":
					return this.view.setUint32(0, value, true);
				case "u64":
				case "uint64_t":
					return this.view.setBigUint64(0, value, true);
				case "float":
				case "f32":
				case "float32_t":
					return this.view.setFloat32(0, value, true);
				case "double":
				case "f64":
				case "float64_t":
					return this.view.setFloat64(0, value, true);
				case "size_t":
					if (this._wasmUtils.sizeOf("size_t") === this._wasmUtils.sizeOf("uint32_t")) {
						return this.view.setUint32(0, value, true);
					}
					return this.view.setBigUint64(0, value, true);
				default:
					throw new TypeError(`Unknown type: "${this._type}"`);
			}
		}
		throw new Error("Value type not supported");
	}

	/**
	 * @constructor
	 * @param {WasmStructMemberDefinition} signature
	 * @param {WasmStructBase} struct
	 * @param {WasmUtils} wasmUtils
	 */
	constructor(signature, struct, wasmUtils) {
		/** @type {typeof wasmUtils} */
		this._wasmUtils = wasmUtils;

		/** @type {typeof signature.name} */
		this._name = signature.name;
		/** @type {typeof signature.type} */
		this._type = signature.type;
		/** @type {typeof signature.size} */
		this._size = signature.size;
		/** @type {typeof signature.offset} */
		this._offset = signature.offset;

		/** @type {typeof struct} */
		this._struct = struct;
	}
}

class WasmStructBase {
	get buffer() {
		return this._wasmUtils.HEAPU8.slice(this._ptr, this.ptr + this._size);
	}

	/**
	 * @constructor
	 * @param {WasmStructMemberDefinition[]} signatures
	 * @param {WasmUtils} wasmUtils
	 */
	constructor(signatures, wasmUtils) {
		/** @type {typeof wasm} */
		this._wasmUtils = wasmUtils;

		/** @type {typeof signatures} */
		this._signatures = signatures;

		/** @type {Record<string, WasmStructMember>} */
		this._members = {};

		/** @type {number} */
		this._size = 0;
		/** @type {number} */
		this._ptr = NULLPTR;

		this._init();
	}

	_init() {
		let structSize = 0;

		for (const signature of this._signatures) {
			if (this.hasMember(signature.name)) {
				throw new Error(`WasmStructMember defined twice: "${signature.name}"`);
			}
			this._members[signature.name] = new WasmStructMember(signature, this, this._wasmUtils);
			Object.defineProperty(this, signature.name, {
				get: function (member) {
					return this;
				}.bind(this._members[signature.name]),
			});

			structSize = Math.max(structSize, signature.offset + signature.size);
		}

		this._size = structSize;
		this._ptr = this._wasmUtils.malloc(this._size);
	}

	/**
	 * Returns if submitted member name is part of this struct.
	 * @param {string} memberName
	 * @returns {boolean}
	 */
	hasMember(memberName) {
		return Object.keys(this._members).includes(memberName);
	}

	/**
	 * Returns the memory view of a member.
	 * @param {string} memberName
	 * @returns {DataView}
	 */
	getView(memberName) {
		if (!this.hasMember(memberName)) {
			throw new Error(`This struct don't have a member named "${memberName}"`);
		}
		return this._members[memberName].view;
	}

	/**
	 * Use to destroy instance.
	 */
	destroy() {
		this._wasmUtils.free(this._ptr);
	}
}

/**
 * @typedef {{
 *    HEAPU8: HEAPU8
 *    _malloc: Malloc
 *    _free: Free
 * }} WasmImport
 */

/**
 * Returns utilities given a `malloc` and a `free`.
 * @param {WasmImport} wasmImport
 * @param {boolean} isMemory64
 */
export function initWasmUtils(wasmImport, isMemory64 = false) {
	const { _malloc: malloc, _free: free } = wasmImport;
	if (wasmImport.HEAPU8 == null) {
		throw new Error("HEAPU8 is null.");
	}
	if (malloc == null) {
		throw new Error("malloc is null.");
	}
	if (free == null) {
		throw new Error("free is null.");
	}

	/**
	 * `malloc`, but with sanity checks.
	 * @param {number} size Desired size of the buffer.
	 * @throws {Error} When the size is not a number.
	 * @throws {Error} When it cannot malloc successfully.
	 * @returns {number} Heap pointer.
	 */
	const mallocOrDie = (size) => {
		if (typeof size !== "number") {
			throw new Error(`size is not a number (${typeof size})`);
		}
		const heapPtr = malloc(size);
		if (heapPtr === NULLPTR) {
			throw new Error("Could not malloc successfully.");
		}
		return heapPtr;
	};

	/**
	 * `free`, but with sanity checks.
	 * @param {number} ptr
	 * @throws {Error} When the ptr isn't a number.
	 */
	const freeOrDie = (ptr) => {
		if (typeof ptr !== "number") {
			throw new Error(`ptr is not a number (${typeof size})`);
		}
		free(ptr);
	};

	/**
	 * Returns the byte length of supplied type.
	 * @param {Type} type
	 * @throws {TypeError} When the type is unknown.
	 * @returns {number} Byte length
	 */
	const sizeOf = (type) => {
		if (type.endsWith("*")) {
			if (isMemory64) {
				return BigUint64Array.BYTES_PER_ELEMENT;
			}
			return Uint32Array.BYTES_PER_ELEMENT;
		}

		switch (type) {
			case "i8":
			case "int8_t":
				return Int8Array.BYTES_PER_ELEMENT;
			case "i16":
			case "int16_t":
				return Int16Array.BYTES_PER_ELEMENT;
			case "i32":
			case "int32_t":
				return Int32Array.BYTES_PER_ELEMENT;
			case "i64":
			case "int64_t":
				return BigInt64Array.BYTES_PER_ELEMENT;
			case "u8":
			case "uint8_t":
				return Uint8Array.BYTES_PER_ELEMENT;
			case "u16":
			case "uint16_t":
				return Uint16Array.BYTES_PER_ELEMENT;
			case "u32":
			case "uint32_t":
				return Uint32Array.BYTES_PER_ELEMENT;
			case "u64":
			case "uint64_t":
				return BigUint64Array.BYTES_PER_ELEMENT;
			case "float":
			case "f32":
			case "float32_t":
				return Float32Array.BYTES_PER_ELEMENT;
			case "double":
			case "f64":
			case "float64_t":
				return Float64Array.BYTES_PER_ELEMENT;
			case "size_t":
				if (isMemory64) {
					return BigUint64Array.BYTES_PER_ELEMENT;
				}
				return Uint32Array.BYTES_PER_ELEMENT;
			default:
				throw new TypeError(`Unknown type: "${type}"`);
		}
	};

	/**
	 * An interface between a WASM instance and JavaScript native values.
	 */
	class WasmValue extends WasmValueBase {
		/**
		 * @constructor
		 * @param {{ type?: Type, size?: number }} params
		 */
		constructor(params) {
			super(params, wasmUtils);
		}
	}

	/**
	 * Framework to manage memory of a defined struct.
	 */
	class WasmStruct extends WasmStructBase {
		/**
		 * @constructor
		 * @param {WasmStructMemberDefinition[]} signatures
		 */
		constructor(signatures) {
			super(signatures, wasmUtils);
		}
	}

	const wasmUtils = {
		malloc: mallocOrDie,
		free: freeOrDie,
		sizeOf,
		WasmValue,
		WasmStruct,
	};
	Object.defineProperty(wasmUtils, "HEAPU8", {
		get() {
			// Needed as we need the direct reference,
			// as if we pass it, we actually copy the Uint8Array.
			return wasmImport.HEAPU8;
		},
	});
	return Object.freeze(wasmUtils);
}
