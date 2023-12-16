/**
xxHash64 implementation in pure Javascript

Copyright (C) 2016, Pierre Curto
MIT license
*/
// var UINT64 = require('cuint').UINT64


// Local cache for typical radices
var radixPowerCache = {
    16: UINT64( Math.pow(16, 5) )
,	10: UINT64( Math.pow(10, 5) )
,	2:  UINT64( Math.pow(2, 5) )
}
var radixCache = {
    16: UINT64(16)
,	10: UINT64(10)
,	2:  UINT64(2)
}

/**
 *	Represents an unsigned 64 bits integer
 * @constructor
 * @param {Number} first low bits (8)
 * @param {Number} second low bits (8)
 * @param {Number} first high bits (8)
 * @param {Number} second high bits (8)
 * or
 * @param {Number} low bits (32)
 * @param {Number} high bits (32)
 * or
 * @param {String|Number} integer as a string 		 | integer as a number
 * @param {Number|Undefined} radix (optional, default=10)
 * @return
 */
function UINT64 (a00, a16, a32, a48) {
    if ( !(this instanceof UINT64) )
        return new UINT64(a00, a16, a32, a48)

    this.remainder = null
    if (typeof a00 == 'string')
        return fromString.call(this, a00, a16)

    if (typeof a16 == 'undefined')
        return fromNumber.call(this, a00)

    fromBits.apply(this, arguments)
}

/**
 * Set the current _UINT64_ object with its low and high bits
 * @method fromBits
 * @param {Number} first low bits (8)
 * @param {Number} second low bits (8)
 * @param {Number} first high bits (8)
 * @param {Number} second high bits (8)
 * or
 * @param {Number} low bits (32)
 * @param {Number} high bits (32)
 * @return ThisExpression
 */
function fromBits (a00, a16, a32, a48) {
    if (typeof a32 == 'undefined') {
        this._a00 = a00 & 0xFFFF
        this._a16 = a00 >>> 16
        this._a32 = a16 & 0xFFFF
        this._a48 = a16 >>> 16
        return this
    }

    this._a00 = a00 | 0
    this._a16 = a16 | 0
    this._a32 = a32 | 0
    this._a48 = a48 | 0

    return this
}
UINT64.prototype.fromBits = fromBits

/**
 * Set the current _UINT64_ object from a number
 * @method fromNumber
 * @param {Number} number
 * @return ThisExpression
 */
function fromNumber (value) {
    this._a00 = value & 0xFFFF
    this._a16 = value >>> 16
    this._a32 = 0
    this._a48 = 0

    return this
}
UINT64.prototype.fromNumber = fromNumber

/**
 * Set the current _UINT64_ object from a string
 * @method fromString
 * @param {String} integer as a string
 * @param {Number} radix (optional, default=10)
 * @return ThisExpression
 */
function fromString (s, radix) {
    radix = radix || 10

    this._a00 = 0
    this._a16 = 0
    this._a32 = 0
    this._a48 = 0

    /*
        In Javascript, bitwise operators only operate on the first 32 bits
        of a number, even though parseInt() encodes numbers with a 53 bits
        mantissa.
        Therefore UINT64(<Number>) can only work on 32 bits.
        The radix maximum value is 36 (as per ECMA specs) (26 letters + 10 digits)
        maximum input value is m = 32bits as 1 = 2^32 - 1
        So the maximum substring length n is:
        36^(n+1) - 1 = 2^32 - 1
        36^(n+1) = 2^32
        (n+1)ln(36) = 32ln(2)
        n = 32ln(2)/ln(36) - 1
        n = 5.189644915687692
        n = 5
     */
    var radixUint = radixPowerCache[radix] || new UINT64( Math.pow(radix, 5) )

    for (var i = 0, len = s.length; i < len; i += 5) {
        var size = Math.min(5, len - i)
        var value = parseInt( s.slice(i, i + size), radix )
        this.multiply(
                size < 5
                    ? new UINT64( Math.pow(radix, size) )
                    : radixUint
            )
            .add( new UINT64(value) )
    }

    return this
}
UINT64.prototype.fromString = fromString

/**
 * Convert this _UINT64_ to a number (last 32 bits are dropped)
 * @method toNumber
 * @return {Number} the converted UINT64
 */
UINT64.prototype.toNumber = function () {
    return (this._a16 * 65536) + this._a00
}

/**
 * Convert this _UINT64_ to a string
 * @method toString
 * @param {Number} radix (optional, default=10)
 * @return {String} the converted UINT64
 */
UINT64.prototype.toString = function (radix) {
    radix = radix || 10
    var radixUint = radixCache[radix] || new UINT64(radix)

    if ( !this.gt(radixUint) ) return this.toNumber().toString(radix)

    var self = this.clone()
    var res = new Array(64)
    for (var i = 63; i >= 0; i--) {
        self.div(radixUint)
        res[i] = self.remainder.toNumber().toString(radix)
        if ( !self.gt(radixUint) ) break
    }
    res[i-1] = self.toNumber().toString(radix)

    return res.join('')
}

/**
 * Add two _UINT64_. The current _UINT64_ stores the result
 * @method add
 * @param {Object} other UINT64
 * @return ThisExpression
 */
UINT64.prototype.add = function (other) {
    var a00 = this._a00 + other._a00

    var a16 = a00 >>> 16
    a16 += this._a16 + other._a16

    var a32 = a16 >>> 16
    a32 += this._a32 + other._a32

    var a48 = a32 >>> 16
    a48 += this._a48 + other._a48

    this._a00 = a00 & 0xFFFF
    this._a16 = a16 & 0xFFFF
    this._a32 = a32 & 0xFFFF
    this._a48 = a48 & 0xFFFF

    return this
}

/**
 * Subtract two _UINT64_. The current _UINT64_ stores the result
 * @method subtract
 * @param {Object} other UINT64
 * @return ThisExpression
 */
UINT64.prototype.subtract = function (other) {
    return this.add( other.clone().negate() )
}

/**
 * Multiply two _UINT64_. The current _UINT64_ stores the result
 * @method multiply
 * @param {Object} other UINT64
 * @return ThisExpression
 */
UINT64.prototype.multiply = function (other) {
    /*
        a = a00 + a16 + a32 + a48
        b = b00 + b16 + b32 + b48
        a*b = (a00 + a16 + a32 + a48)(b00 + b16 + b32 + b48)
            = a00b00 + a00b16 + a00b32 + a00b48
            + a16b00 + a16b16 + a16b32 + a16b48
            + a32b00 + a32b16 + a32b32 + a32b48
            + a48b00 + a48b16 + a48b32 + a48b48

        a16b48, a32b32, a48b16, a48b32 and a48b48 overflow the 64 bits
        so it comes down to:
        a*b	= a00b00 + a00b16 + a00b32 + a00b48
            + a16b00 + a16b16 + a16b32
            + a32b00 + a32b16
            + a48b00
            = a00b00
            + a00b16 + a16b00
            + a00b32 + a16b16 + a32b00
            + a00b48 + a16b32 + a32b16 + a48b00
     */
    var a00 = this._a00
    var a16 = this._a16
    var a32 = this._a32
    var a48 = this._a48
    var b00 = other._a00
    var b16 = other._a16
    var b32 = other._a32
    var b48 = other._a48

    var c00 = a00 * b00

    var c16 = c00 >>> 16
    c16 += a00 * b16
    var c32 = c16 >>> 16
    c16 &= 0xFFFF
    c16 += a16 * b00

    c32 += c16 >>> 16
    c32 += a00 * b32
    var c48 = c32 >>> 16
    c32 &= 0xFFFF
    c32 += a16 * b16
    c48 += c32 >>> 16
    c32 &= 0xFFFF
    c32 += a32 * b00

    c48 += c32 >>> 16
    c48 += a00 * b48
    c48 &= 0xFFFF
    c48 += a16 * b32
    c48 &= 0xFFFF
    c48 += a32 * b16
    c48 &= 0xFFFF
    c48 += a48 * b00

    this._a00 = c00 & 0xFFFF
    this._a16 = c16 & 0xFFFF
    this._a32 = c32 & 0xFFFF
    this._a48 = c48 & 0xFFFF

    return this
}

/**
 * Divide two _UINT64_. The current _UINT64_ stores the result.
 * The remainder is made available as the _remainder_ property on
 * the _UINT64_ object. It can be null, meaning there are no remainder.
 * @method div
 * @param {Object} other UINT64
 * @return ThisExpression
 */
UINT64.prototype.div = function (other) {
    if ( (other._a16 == 0) && (other._a32 == 0) && (other._a48 == 0) ) {
        if (other._a00 == 0) throw Error('division by zero')

        // other == 1: this
        if (other._a00 == 1) {
            this.remainder = new UINT64(0)
            return this
        }
    }

    // other > this: 0
    if ( other.gt(this) ) {
        this.remainder = this.clone()
        this._a00 = 0
        this._a16 = 0
        this._a32 = 0
        this._a48 = 0
        return this
    }
    // other == this: 1
    if ( this.eq(other) ) {
        this.remainder = new UINT64(0)
        this._a00 = 1
        this._a16 = 0
        this._a32 = 0
        this._a48 = 0
        return this
    }

    // Shift the divisor left until it is higher than the dividend
    var _other = other.clone()
    var i = -1
    while ( !this.lt(_other) ) {
        // High bit can overflow the default 16bits
        // Its ok since we right shift after this loop
        // The overflown bit must be kept though
        _other.shiftLeft(1, true)
        i++
    }

    // Set the remainder
    this.remainder = this.clone()
    // Initialize the current result to 0
    this._a00 = 0
    this._a16 = 0
    this._a32 = 0
    this._a48 = 0
    for (; i >= 0; i--) {
        _other.shiftRight(1)
        // If shifted divisor is smaller than the dividend
        // then subtract it from the dividend
        if ( !this.remainder.lt(_other) ) {
            this.remainder.subtract(_other)
            // Update the current result
            if (i >= 48) {
                this._a48 |= 1 << (i - 48)
            } else if (i >= 32) {
                this._a32 |= 1 << (i - 32)
            } else if (i >= 16) {
                this._a16 |= 1 << (i - 16)
            } else {
                this._a00 |= 1 << i
            }
        }
    }

    return this
}

/**
 * Negate the current _UINT64_
 * @method negate
 * @return ThisExpression
 */
UINT64.prototype.negate = function () {
    var v = ( ~this._a00 & 0xFFFF ) + 1
    this._a00 = v & 0xFFFF
    v = (~this._a16 & 0xFFFF) + (v >>> 16)
    this._a16 = v & 0xFFFF
    v = (~this._a32 & 0xFFFF) + (v >>> 16)
    this._a32 = v & 0xFFFF
    this._a48 = (~this._a48 + (v >>> 16)) & 0xFFFF

    return this
}

/**

 * @method eq
 * @param {Object} other UINT64
 * @return {Boolean}
 */
UINT64.prototype.equals = UINT64.prototype.eq = function (other) {
    return (this._a48 == other._a48) && (this._a00 == other._a00)
         && (this._a32 == other._a32) && (this._a16 == other._a16)
}

/**
 * Greater than (strict)
 * @method gt
 * @param {Object} other UINT64
 * @return {Boolean}
 */
UINT64.prototype.greaterThan = UINT64.prototype.gt = function (other) {
    if (this._a48 > other._a48) return true
    if (this._a48 < other._a48) return false
    if (this._a32 > other._a32) return true
    if (this._a32 < other._a32) return false
    if (this._a16 > other._a16) return true
    if (this._a16 < other._a16) return false
    return this._a00 > other._a00
}

/**
 * Less than (strict)
 * @method lt
 * @param {Object} other UINT64
 * @return {Boolean}
 */
UINT64.prototype.lessThan = UINT64.prototype.lt = function (other) {
    if (this._a48 < other._a48) return true
    if (this._a48 > other._a48) return false
    if (this._a32 < other._a32) return true
    if (this._a32 > other._a32) return false
    if (this._a16 < other._a16) return true
    if (this._a16 > other._a16) return false
    return this._a00 < other._a00
}

/**
 * Bitwise OR
 * @method or
 * @param {Object} other UINT64
 * @return ThisExpression
 */
UINT64.prototype.or = function (other) {
    this._a00 |= other._a00
    this._a16 |= other._a16
    this._a32 |= other._a32
    this._a48 |= other._a48

    return this
}

/**
 * Bitwise AND
 * @method and
 * @param {Object} other UINT64
 * @return ThisExpression
 */
UINT64.prototype.and = function (other) {
    this._a00 &= other._a00
    this._a16 &= other._a16
    this._a32 &= other._a32
    this._a48 &= other._a48

    return this
}

/**
 * Bitwise XOR
 * @method xor
 * @param {Object} other UINT64
 * @return ThisExpression
 */
UINT64.prototype.xor = function (other) {
    this._a00 ^= other._a00
    this._a16 ^= other._a16
    this._a32 ^= other._a32
    this._a48 ^= other._a48

    return this
}

/**
 * Bitwise NOT
 * @method not
 * @return ThisExpression
 */
UINT64.prototype.not = function() {
    this._a00 = ~this._a00 & 0xFFFF
    this._a16 = ~this._a16 & 0xFFFF
    this._a32 = ~this._a32 & 0xFFFF
    this._a48 = ~this._a48 & 0xFFFF

    return this
}

/**
 * Bitwise shift right
 * @method shiftRight
 * @param {Number} number of bits to shift
 * @return ThisExpression
 */
UINT64.prototype.shiftRight = UINT64.prototype.shiftr = function (n) {
    n %= 64
    if (n >= 48) {
        this._a00 = this._a48 >> (n - 48)
        this._a16 = 0
        this._a32 = 0
        this._a48 = 0
    } else if (n >= 32) {
        n -= 32
        this._a00 = ( (this._a32 >> n) | (this._a48 << (16-n)) ) & 0xFFFF
        this._a16 = (this._a48 >> n) & 0xFFFF
        this._a32 = 0
        this._a48 = 0
    } else if (n >= 16) {
        n -= 16
        this._a00 = ( (this._a16 >> n) | (this._a32 << (16-n)) ) & 0xFFFF
        this._a16 = ( (this._a32 >> n) | (this._a48 << (16-n)) ) & 0xFFFF
        this._a32 = (this._a48 >> n) & 0xFFFF
        this._a48 = 0
    } else {
        this._a00 = ( (this._a00 >> n) | (this._a16 << (16-n)) ) & 0xFFFF
        this._a16 = ( (this._a16 >> n) | (this._a32 << (16-n)) ) & 0xFFFF
        this._a32 = ( (this._a32 >> n) | (this._a48 << (16-n)) ) & 0xFFFF
        this._a48 = (this._a48 >> n) & 0xFFFF
    }

    return this
}

/**
 * Bitwise shift left
 * @method shiftLeft
 * @param {Number} number of bits to shift
 * @param {Boolean} allow overflow
 * @return ThisExpression
 */
UINT64.prototype.shiftLeft = UINT64.prototype.shiftl = function (n, allowOverflow) {
    n %= 64
    if (n >= 48) {
        this._a48 = this._a00 << (n - 48)
        this._a32 = 0
        this._a16 = 0
        this._a00 = 0
    } else if (n >= 32) {
        n -= 32
        this._a48 = (this._a16 << n) | (this._a00 >> (16-n))
        this._a32 = (this._a00 << n) & 0xFFFF
        this._a16 = 0
        this._a00 = 0
    } else if (n >= 16) {
        n -= 16
        this._a48 = (this._a32 << n) | (this._a16 >> (16-n))
        this._a32 = ( (this._a16 << n) | (this._a00 >> (16-n)) ) & 0xFFFF
        this._a16 = (this._a00 << n) & 0xFFFF
        this._a00 = 0
    } else {
        this._a48 = (this._a48 << n) | (this._a32 >> (16-n))
        this._a32 = ( (this._a32 << n) | (this._a16 >> (16-n)) ) & 0xFFFF
        this._a16 = ( (this._a16 << n) | (this._a00 >> (16-n)) ) & 0xFFFF
        this._a00 = (this._a00 << n) & 0xFFFF
    }
    if (!allowOverflow) {
        this._a48 &= 0xFFFF
    }

    return this
}

/**
 * Bitwise rotate left
 * @method rotl
 * @param {Number} number of bits to rotate
 * @return ThisExpression
 */
UINT64.prototype.rotateLeft = UINT64.prototype.rotl = function (n) {
    n %= 64
    if (n == 0) return this
    if (n >= 32) {
        // A.B.C.D
        // B.C.D.A rotl(16)
        // C.D.A.B rotl(32)
        var v = this._a00
        this._a00 = this._a32
        this._a32 = v
        v = this._a48
        this._a48 = this._a16
        this._a16 = v
        if (n == 32) return this
        n -= 32
    }

    var high = (this._a48 << 16) | this._a32
    var low = (this._a16 << 16) | this._a00

    var _high = (high << n) | (low >>> (32 - n))
    var _low = (low << n) | (high >>> (32 - n))

    this._a00 = _low & 0xFFFF
    this._a16 = _low >>> 16
    this._a32 = _high & 0xFFFF
    this._a48 = _high >>> 16

    return this
}

/**
 * Bitwise rotate right
 * @method rotr
 * @param {Number} number of bits to rotate
 * @return ThisExpression
 */
UINT64.prototype.rotateRight = UINT64.prototype.rotr = function (n) {
    n %= 64
    if (n == 0) return this
    if (n >= 32) {
        // A.B.C.D
        // D.A.B.C rotr(16)
        // C.D.A.B rotr(32)
        var v = this._a00
        this._a00 = this._a32
        this._a32 = v
        v = this._a48
        this._a48 = this._a16
        this._a16 = v
        if (n == 32) return this
        n -= 32
    }

    var high = (this._a48 << 16) | this._a32
    var low = (this._a16 << 16) | this._a00

    var _high = (high >>> n) | (low << (32 - n))
    var _low = (low >>> n) | (high << (32 - n))

    this._a00 = _low & 0xFFFF
    this._a16 = _low >>> 16
    this._a32 = _high & 0xFFFF
    this._a48 = _high >>> 16

    return this
}

/**
 * Clone the current _UINT64_
 * @method clone
 * @return {Object} cloned UINT64
 */
UINT64.prototype.clone = function () {
    return new UINT64(this._a00, this._a16, this._a32, this._a48)
}

if (typeof define != 'undefined' && define.amd) {
    // AMD / RequireJS
    define([], function () {
        return UINT64
    })
} else if (typeof module != 'undefined' && module.exports) {
    // Node.js
    module.exports = UINT64
} else {
    // Browser
    // root['UINT64'] = UINT64
}

/*
 * Constants
 */
var PRIME64_1 = UINT64( '11400714785074694791' )
var PRIME64_2 = UINT64( '14029467366897019727' )
var PRIME64_3 = UINT64(  '1609587929392839161' )
var PRIME64_4 = UINT64(  '9650029242287828579' )
var PRIME64_5 = UINT64(  '2870177450012600261' )

/**
* Convert string to proper UTF-8 array
* @param str Input string
* @returns {Uint8Array} UTF8 array is returned as uint8 array
*/
function toUTF8Array (str) {
	var utf8 = []
	for (var i=0, n=str.length; i < n; i++) {
		var charcode = str.charCodeAt(i)
		if (charcode < 0x80) utf8.push(charcode)
		else if (charcode < 0x800) {
			utf8.push(0xc0 | (charcode >> 6),
			0x80 | (charcode & 0x3f))
		}
		else if (charcode < 0xd800 || charcode >= 0xe000) {
			utf8.push(0xe0 | (charcode >> 12),
			0x80 | ((charcode>>6) & 0x3f),
			0x80 | (charcode & 0x3f))
		}
		// surrogate pair
		else {
			i++;
			// UTF-16 encodes 0x10000-0x10FFFF by
			// subtracting 0x10000 and splitting the
			// 20 bits of 0x0-0xFFFFF into two halves
			charcode = 0x10000 + (((charcode & 0x3ff)<<10)
			| (str.charCodeAt(i) & 0x3ff))
			utf8.push(0xf0 | (charcode >>18),
			0x80 | ((charcode>>12) & 0x3f),
			0x80 | ((charcode>>6) & 0x3f),
			0x80 | (charcode & 0x3f))
		}
	}

	return new Uint8Array(utf8)
}

/**
 * XXH64 object used as a constructor or a function
 * @constructor
 * or
 * @param {Object|String} input data
 * @param {Number|UINT64} seed
 * @return ThisExpression
 * or
 * @return {UINT64} xxHash
 */
function XXH64 () {
	if (arguments.length == 2)
		return new XXH64( arguments[1] ).update( arguments[0] ).digest()

	if (!(this instanceof XXH64))
		return new XXH64( arguments[0] )

	init.call(this, arguments[0])
}

/**
 * Initialize the XXH64 instance with the given seed
 * @method init
 * @param {Number|Object} seed as a number or an unsigned 32 bits integer
 * @return ThisExpression
 */
 function init (seed) {
	this.seed = seed instanceof UINT64 ? seed.clone() : UINT64(seed)
	this.v1 = this.seed.clone().add(PRIME64_1).add(PRIME64_2)
	this.v2 = this.seed.clone().add(PRIME64_2)
	this.v3 = this.seed.clone()
	this.v4 = this.seed.clone().subtract(PRIME64_1)
	this.total_len = 0
	this.memsize = 0
	this.memory = null

	return this
}
XXH64.prototype.init = init

/**
 * Add data to be computed for the XXH64 hash
 * @method update
 * @param {String|Buffer|ArrayBuffer} input as a string or nodejs Buffer or ArrayBuffer
 * @return ThisExpression
 */
XXH64.prototype.update = function (input) {
	var isArrayBuffer

	// Convert all strings to utf-8 first (issue #5)
	if (typeof input == 'string') {
		input = toUTF8Array(input)
		isArrayBuffer = true
	}

	if (typeof ArrayBuffer !== "undefined" && input instanceof ArrayBuffer)
	{
		isArrayBuffer = true
		input = new Uint8Array(input);
	}

	var p = 0
	var len = input.length
	var bEnd = p + len

	if (len == 0) return this

	this.total_len += len

	if (this.memsize == 0)
	{
		if (isArrayBuffer) {
			this.memory = new Uint8Array(32)
		} else {
			this.memory = new Buffer(32)
		}
	}

	if (this.memsize + len < 32)   // fill in tmp buffer
	{
		// XXH64_memcpy(this.memory + this.memsize, input, len)
		if (isArrayBuffer) {
			this.memory.set( input.subarray(0, len), this.memsize )
		} else {
			input.copy( this.memory, this.memsize, 0, len )
		}

		this.memsize += len
		return this
	}

	if (this.memsize > 0)   // some data left from previous update
	{
		// XXH64_memcpy(this.memory + this.memsize, input, 16-this.memsize);
		if (isArrayBuffer) {
			this.memory.set( input.subarray(0, 32 - this.memsize), this.memsize )
		} else {
			input.copy( this.memory, this.memsize, 0, 32 - this.memsize )
		}

		var p64 = 0
		var other
		other = UINT64(
				(this.memory[p64+1] << 8) | this.memory[p64]
			,	(this.memory[p64+3] << 8) | this.memory[p64+2]
			,	(this.memory[p64+5] << 8) | this.memory[p64+4]
			,	(this.memory[p64+7] << 8) | this.memory[p64+6]
			)
		this.v1.add( other.multiply(PRIME64_2) ).rotl(31).multiply(PRIME64_1);
		p64 += 8
		other = UINT64(
				(this.memory[p64+1] << 8) | this.memory[p64]
			,	(this.memory[p64+3] << 8) | this.memory[p64+2]
			,	(this.memory[p64+5] << 8) | this.memory[p64+4]
			,	(this.memory[p64+7] << 8) | this.memory[p64+6]
			)
		this.v2.add( other.multiply(PRIME64_2) ).rotl(31).multiply(PRIME64_1);
		p64 += 8
		other = UINT64(
				(this.memory[p64+1] << 8) | this.memory[p64]
			,	(this.memory[p64+3] << 8) | this.memory[p64+2]
			,	(this.memory[p64+5] << 8) | this.memory[p64+4]
			,	(this.memory[p64+7] << 8) | this.memory[p64+6]
			)
		this.v3.add( other.multiply(PRIME64_2) ).rotl(31).multiply(PRIME64_1);
		p64 += 8
		other = UINT64(
				(this.memory[p64+1] << 8) | this.memory[p64]
			,	(this.memory[p64+3] << 8) | this.memory[p64+2]
			,	(this.memory[p64+5] << 8) | this.memory[p64+4]
			,	(this.memory[p64+7] << 8) | this.memory[p64+6]
			)
		this.v4.add( other.multiply(PRIME64_2) ).rotl(31).multiply(PRIME64_1);

		p += 32 - this.memsize
		this.memsize = 0
	}

	if (p <= bEnd - 32)
	{
		var limit = bEnd - 32

		do
		{
			var other
			other = UINT64(
					(input[p+1] << 8) | input[p]
				,	(input[p+3] << 8) | input[p+2]
				,	(input[p+5] << 8) | input[p+4]
				,	(input[p+7] << 8) | input[p+6]
				)
			this.v1.add( other.multiply(PRIME64_2) ).rotl(31).multiply(PRIME64_1);
			p += 8
			other = UINT64(
					(input[p+1] << 8) | input[p]
				,	(input[p+3] << 8) | input[p+2]
				,	(input[p+5] << 8) | input[p+4]
				,	(input[p+7] << 8) | input[p+6]
				)
			this.v2.add( other.multiply(PRIME64_2) ).rotl(31).multiply(PRIME64_1);
			p += 8
			other = UINT64(
					(input[p+1] << 8) | input[p]
				,	(input[p+3] << 8) | input[p+2]
				,	(input[p+5] << 8) | input[p+4]
				,	(input[p+7] << 8) | input[p+6]
				)
			this.v3.add( other.multiply(PRIME64_2) ).rotl(31).multiply(PRIME64_1);
			p += 8
			other = UINT64(
					(input[p+1] << 8) | input[p]
				,	(input[p+3] << 8) | input[p+2]
				,	(input[p+5] << 8) | input[p+4]
				,	(input[p+7] << 8) | input[p+6]
				)
			this.v4.add( other.multiply(PRIME64_2) ).rotl(31).multiply(PRIME64_1);
			p += 8
		} while (p <= limit)
	}

	if (p < bEnd)
	{
		// XXH64_memcpy(this.memory, p, bEnd-p);
		if (isArrayBuffer) {
			this.memory.set( input.subarray(p, bEnd), this.memsize )
		} else {
			input.copy( this.memory, this.memsize, p, bEnd )
		}

		this.memsize = bEnd - p
	}

	return this
}

/**
 * Finalize the XXH64 computation. The XXH64 instance is ready for reuse for the given seed
 * @method digest
 * @return {UINT64} xxHash
 */
XXH64.prototype.digest = function () {
	var input = this.memory
	var p = 0
	var bEnd = this.memsize
	var h64, h
	var u = new UINT64

	if (this.total_len >= 32)
	{
		h64 = this.v1.clone().rotl(1)
		h64.add( this.v2.clone().rotl(7) )
		h64.add( this.v3.clone().rotl(12) )
		h64.add( this.v4.clone().rotl(18) )

		h64.xor( this.v1.multiply(PRIME64_2).rotl(31).multiply(PRIME64_1) )
		h64.multiply(PRIME64_1).add(PRIME64_4)

		h64.xor( this.v2.multiply(PRIME64_2).rotl(31).multiply(PRIME64_1) )
		h64.multiply(PRIME64_1).add(PRIME64_4)

		h64.xor( this.v3.multiply(PRIME64_2).rotl(31).multiply(PRIME64_1) )
		h64.multiply(PRIME64_1).add(PRIME64_4)

		h64.xor( this.v4.multiply(PRIME64_2).rotl(31).multiply(PRIME64_1) )
		h64.multiply(PRIME64_1).add(PRIME64_4)
	}
	else
	{
		h64  = this.seed.clone().add( PRIME64_5 )
	}

	h64.add( u.fromNumber(this.total_len) )

	while (p <= bEnd - 8)
	{
		u.fromBits(
			(input[p+1] << 8) | input[p]
		,	(input[p+3] << 8) | input[p+2]
		,	(input[p+5] << 8) | input[p+4]
		,	(input[p+7] << 8) | input[p+6]
			)
		u.multiply(PRIME64_2).rotl(31).multiply(PRIME64_1)
		h64
			.xor(u)
			.rotl(27)
			.multiply( PRIME64_1 )
			.add( PRIME64_4 )
		p += 8
	}

	if (p + 4 <= bEnd) {
		u.fromBits(
			(input[p+1] << 8) | input[p]
		,	(input[p+3] << 8) | input[p+2]
		,	0
		,	0
		)
		h64
			.xor( u.multiply(PRIME64_1) )
			.rotl(23)
			.multiply( PRIME64_2 )
			.add( PRIME64_3 )
		p += 4
	}

	while (p < bEnd)
	{
		u.fromBits( input[p++], 0, 0, 0 )
		h64
			.xor( u.multiply(PRIME64_5) )
			.rotl(11)
			.multiply(PRIME64_1)
	}

	h = h64.clone().shiftRight(33)
	h64.xor(h).multiply(PRIME64_2)

	h = h64.clone().shiftRight(29)
	h64.xor(h).multiply(PRIME64_3)

	h = h64.clone().shiftRight(32)
	h64.xor(h)

	// Reset the state
	this.init( this.seed )

	return h64
}

export { XXH64 }
