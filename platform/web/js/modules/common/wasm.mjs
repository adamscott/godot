export const NULLPTR = 0;

/**
 * @typedef {Int8Array|Int16Array|Int32Array|BigInt64Array|Uint8Array|Uint16Array|Uint32Array|BigUint64Array|Float32Array|Float64Array} TypedArray
 * @typedef {"i8"|"i16"|"i32"|"i64"|"u8"|"u16"|"u32"|"u64"|"float"|"double"|"f32"|"f64"|"i8*"|"i16*"|"i32*"|"i64*"|"u8*"|"u16*"|"u32*"|"u64*"|"float*"|"double*"|"f32*"|"f64*"|"*"|"size_t"} Type
 * @typedef {(size: number) => number} Malloc
 * @typedef {(ptr: number) => void} Free
 * @typedef {(type: Type) => number} SizeOf
 */

class WasmValueBase {
	/**
	 * Returns the value in memory.
	 * @returns {Uint8Array}
	 */
	get value() {
		return this.HEAPU8.slice(this.ptr, this.ptr + this.size);
	}

	/**
	 * Sets the value in memory.
	 * @param {number | TypedArray | Array} val
	 */
	set value(val) {
		let valueToSet = val;
		if (typeof val === "number") {
			valueToSet = [val];
		}
		this.HEAPU8.set(valueToSet, this.ptr);
	}

	/**
	 * @constructor
	 * @param {number} size
	 * @param {Uint8Array} HEAPU8
	 * @param {Malloc} malloc
	 * @param {Free} free
	 */
	constructor(size, HEAPU8, malloc, free) {
		/** @type {typeof size} */
		this.size = size;
		/** @type {typeof HEAPU8} */
		this.HEAPU8 = HEAPU8;
		/** @type {typeof malloc} */
		this.malloc = malloc;
		/** @type {typeof free} */
		this.free = free;
		/** @type {number} */
		this.ptr = NULLPTR;

		this._init();
	}

	_init() {
		this.ptr = this.malloc(this.size);
	}

	destroy() {
		this.free(this.ptr);
	}
}

/**
 * @typedef {{ name: string, type: Type, size: number, offset: number }} WasmStructMemberDefinition
 */

class WasmStructMember {
	/**
	 * Returns a view to a buffer.
	 * @throws {Error} When `buffer` is null.
	 * @returns {DataView}
	 */
	get view() {
		if (this.buffer == null) {
			throw new Error("`buffer` is null");
		}
		return new DataView(this.buffer.slice(this.offset, this.offset + this.size));
	}

	/**
	 * @constructor
	 * @param {WasmStructMemberDefinition} signature
	 */
	constructor(signature) {
		/** @type {typeof signature.name} */
		this.name = signature.name;
		/** @type {typeof signature.type} */
		this.type = signature.type;
		/** @type {typeof signature.size} */
		this.size = signature.size;
		/** @type {typeof signature.offset} */
		this.offset = signature.offset;

		/** @type {ArrayBuffer | null} */
		this.buffer = null;
	}
}

class WasmStructBase {
	/**
	 * @constructor
	 * @param {WasmStructMemberDefinition[]} signatures
	 * @param {Uint8Array} HEAPU8
	 * @param {Malloc} malloc
	 * @param {Free} free
	 * @param {SizeOf} sizeOf
	 */
	constructor(signatures, HEAPU8, malloc, free, sizeOf) {
		/** @type {typeof signatures} */
		this.signatures = signatures;

		/** @type {typeof HEAPU8} */
		this.HEAPU8 = HEAPU8;
		/** @type {typeof malloc} */
		this.malloc = malloc;
		/** @type {typeof free} */
		this.free = free;
		/** @type {typeof sizeOf} */
		this.sizeOf = sizeOf;

		/** @type {Record<string, WasmStructMember>} */
		this.members = {};

		/** @type {number} */
		this.size = 0;
		/** @type {number} */
		this.ptr = NULLPTR;

		_init();
	}

	_init() {
		let structSize = 0;

		for (const signature of this.signatures) {
			if (this.hasMember(signature.name)) {
				throw new Error(`WasmStructMember defined twice: "${signature.name}"`);
			}
			this.members[signature.name] = new WasmStructMember(signature);

			structSize = Math.max(structSize, signature.offset + signature.size);
		}

		this.size = structSize;
		this.ptr = this.malloc(this.size);
		const buffer = this.HEAPU8.slice(this.ptr, this.ptr + this.size).buffer;
		for (const member of this.members) {
			member.buffer = buffer;
		}
	}

	hasMember(memberName) {
		return Object.keys(this.members).includes(signature.name);
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
		return this.members[memberName].view;
	}

	destroy() {
		this.free(this.ptr);
	}
}

/**
 * @typedef {{
 *    HEAPU8: Uint8Array
 *    malloc: Malloc
 *    free: Free
 * }} WasmImport
 */

/**
 * Returns utilities given a `malloc` and a `free`.
 * @param {WasmImport} wasmImport
 * @param {boolean} isMemory64
 */
export function initWasmUtils(wasmImport, isMemory64 = false) {
	const { HEAPU8, malloc, free } = wasmImport;
	if (HEAPU8 == null) {
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
		switch (type) {
			case "i8":
				return Int8Array.BYTES_PER_ELEMENT;
			case "i16":
				return Int16Array.BYTES_PER_ELEMENT;
			case "i32":
				return Int32Array.BYTES_PER_ELEMENT;
			case "i64":
				return BigInt64Array.BYTES_PER_ELEMENT;
			case "u8":
				return Uint8Array.BYTES_PER_ELEMENT;
			case "u16":
				return Uint16Array.BYTES_PER_ELEMENT;
			case "u32":
				return Uint32Array.BYTES_PER_ELEMENT;
			case "u64":
				return BigUint64Array.BYTES_PER_ELEMENT;
			case "float":
			case "f32":
				return Float32Array.BYTES_PER_ELEMENT;
			case "double":
			case "f64":
				return Float64Array.BYTES_PER_ELEMENT;
			case "i8*":
			case "i16*":
			case "i32*":
			case "i64*":
			case "u8*":
			case "u16*":
			case "u32*":
			case "u64*":
			case "float*":
			case "f32*":
			case "double*":
			case "f64":
			case "*":
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
		 * @param {number} size
		 */
		constructor(size) {
			super(size, HEAPU8, mallocOrDie, freeOrDie);
		}
	}

	/**
	 *
	 */
	class WasmStruct extends WasmStructBase {
		/**
		 * @constructor
		 * @param {WasmStructMemberDefinition[]} signatures
		 */
		constructor(signatures) {
			super(signatures, HEAPU8, malloc, free, sizeOf);
		}
	}

	return {
		mallocOrDie,
		freeOrDie,
		sizeOf,
		WasmValue,
		WasmStruct,
	};
}
