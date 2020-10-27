/*
 * speedy-vision.js
 * GPU-accelerated Computer Vision for JavaScript
 * Copyright 2020 Alexandre Martins <alemartf(at)gmail.com>
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * matrix-math.js
 * Linear algebra routines
 */

//! No imports here

/**
 * Matrix math routines
 * All routines are stateless
 */
class MatrixMath
{
    // ========================================================
    // Math routines
    // ========================================================

    /**
     * No-operation
     * @param {object} header
     * @param {TypedArray} output
     * @param {TypedArray[]} inputs
     */
    static nop(header, output, inputs)
    {
        ;
    }

    /**
     * Fill the matrix with a constant value
     * @param {object} header
     * @param {TypedArray} output
     * @param {TypedArray[]} inputs
     */
    static fill(header, output, inputs)
    {
        const { rows, columns, stride, length } = header;
        const { value } = header.custom;

        // use a memset-like operation if possible
        if(rows * columns == length) {
            output.fill(value, 0, length);
            return;
        }

        // fill the columns one by one
        for(let j = 0; j < columns; j++)
            output.fill(value, j * stride, j * stride + rows);
    }

    /**
     * Copy matrix
     * @param {object} header
     * @param {TypedArray} output
     * @param {TypedArray[]} inputs
     */
    static copy(header, output, inputs)
    {
        const { rows, columns, stride, length } = header;
        const [ strideI ] = header.strideOfInputs;
        const [ input ] = inputs;

        // use a memcpy-like operation if possible
        if(length == header.lengthOfInputs[0] && rows * columns == length) {
            output.set(input, 0, length);
            return;
        }

        // copy values one by one
        let i, j, oj, ij;
        for(oj = ij = j = 0; j < columns; j++, oj += stride, ij += strideI) {
            for(i = 0; i < rows; i++)
                output[oj + i] = input[ij + i];
        }
    }

    /**
     * Transpose matrix
     * @param {object} header
     * @param {TypedArray} output
     * @param {TypedArray[]} inputs
     */
    static transpose(header, output, inputs)
    {
        const { rows, columns, stride } = header;
        const [ strideT ] = header.strideOfInputs;
        const [ input ] = inputs;

        let i, j, ii, oj;
        for(ii = i = 0; i < rows; i++, ii += strideT) {
            for(oj = j = 0; j < columns; j++, oj += stride)
                output[oj + i] = input[ii + j];
        }
    }

    /**
     * Add two matrices
     * @param {object} header
     * @param {TypedArray} output
     * @param {TypedArray[]} inputs
     */
    static add(header, output, inputs)
    {
        const { rows, columns, stride } = header;
        const [ strideA, strideB ] = header.strideOfInputs;
        const [ a, b ] = inputs;

        let i, j, oj, aj, bj;
        for(j = 0; j < columns; j++) {
            oj = j * stride;
            aj = j * strideA;
            bj = j * strideB;
            for(i = 0; i < rows; i++)
                output[oj + i] = a[aj + i] + b[bj + i];
        }
    }

    /**
     * Subtract two matrices
     * @param {object} header
     * @param {TypedArray} output
     * @param {TypedArray[]} inputs
     */
    static subtract(header, output, inputs)
    {
        const { rows, columns, stride } = header;
        const [ strideA, strideB ] = header.strideOfInputs;
        const [ a, b ] = inputs;

        let i, j, oj, aj, bj;
        for(j = 0; j < columns; j++) {
            oj = j * stride;
            aj = j * strideA;
            bj = j * strideB;
            for(i = 0; i < rows; i++)
                output[oj + i] = a[aj + i] - b[bj + i];
        }
    }

    /**
     * Multiply two matrices (e.g., C = A B)
     * @param {object} header
     * @param {TypedArray} output
     * @param {TypedArray[]} inputs
     */
    static multiply(header, output, inputs)
    {
        const { rows, columns, stride, length } = header;
        const [ columnsA, columnsB ] = header.columnsOfInputs;
        const [ strideA, strideB ] = header.strideOfInputs;
        const [ a, b ] = inputs;

        // clear matrix
        if(rows * columns != length) {
            for(let c = 0; c < columns; c++)
                output.fill(0, c * stride, c * stride + rows);
        }
        else
            output.fill(0, 0, length);

        // multiply taking cache locality into account
        let i, j, k, ok, aj, bk, bjk;
        for(ok = bk = k = 0; k < columnsB; k++, ok += stride, bk += strideB) {
            for(aj = j = 0; j < columnsA; j++, aj += strideA) {
                bjk = b[bk + j];
                for(i = 0; i < rows; i++)
                    output[ok + i] += a[aj + i] * bjk;
            }
        }
    }

    /**
     * Multiply two matrices, transposing the left operand
     * (e.g., C = A^T B)
     * @param {object} header
     * @param {TypedArray} output
     * @param {TypedArray[]} inputs
     */
    static multiplylt(header, output, inputs)
    {
        const { rows, columns, stride, length } = header;
        const [ columnsA, columnsB ] = header.columnsOfInputs;
        const [ rowsA, rowsB ] = header.rowsOfInputs;
        const [ strideA, strideB ] = header.strideOfInputs;
        const [ a, b ] = inputs;

        // multiply taking cache locality into account
        let i, j, k, aj, bk, ok, ojk;
        for(ok = bk = k = 0; k < columnsB; k++, ok += stride, bk += strideB) {
            for(aj = j = 0; j < columnsA; j++, aj += strideA) {
                output[ojk = ok + j] = 0;
                for(i = 0; i < rowsB; i++)
                    output[ojk] += a[aj + i] * b[bk + i];
            }
        }
    }

    /**
     * Multiply two matrices, transposing the right operand
     * (e.g., C = A B^T)
     * @param {object} header
     * @param {TypedArray} output
     * @param {TypedArray[]} inputs
     */
    static multiplyrt(header, output, inputs)
    {
        const { rows, columns, stride, length } = header;
        const [ columnsA, columnsB ] = header.columnsOfInputs;
        const [ rowsA, rowsB ] = header.rowsOfInputs;
        const [ strideA, strideB ] = header.strideOfInputs;
        const [ a, b ] = inputs;

        // clear matrix
        if(rows * columns != length) {
            for(let c = 0; c < columns; c++)
                output.fill(0, c * stride, c * stride + rows);
        }
        else
            output.fill(0, 0, length);

        // multiply taking cache locality into account
        let i, j, k, ok, aj, bj, bkj;
        for(aj = bj = j = 0; j < columnsA; j++, aj += strideA, bj += strideB) {
            for(ok = k = 0; k < rowsB; k++, ok += stride) {
                bkj = b[bj + k];
                for(i = 0; i < rows; i++)
                    output[ok + i] += a[aj + i] * bkj;
            }
        }
    }

    /**
     * Multiply by a constant
     * @param {object} header
     * @param {TypedArray} output
     * @param {TypedArray[]} inputs
     */
    static scale(header, output, inputs)
    {
        const { rows, columns, stride } = header;
        const { scalar } = header.custom;
        const [ input ] = inputs;

        let i, j, oj;
        for(j = 0; j < columns; j++) {
            oj = j * stride;
            for(i = 0; i < rows; i++)
                output[oj + i] = input[oj + i] * scalar;
        }
    }

    /**
     * Component-wise multiplication
     * @param {object} header
     * @param {TypedArray} output
     * @param {TypedArray[]} inputs
     */
    static compmult(header, output, inputs)
    {
        const { rows, columns, stride } = header;
        const [ strideA, strideB ] = header.strideOfInputs;
        const [ a, b ] = inputs;

        let i, j, oj, aj, bj;
        for(j = 0; j < columns; j++) {
            oj = j * stride;
            aj = j * strideA;
            bj = j * strideB;
            for(i = 0; i < rows; i++)
                output[oj + i] = a[aj + i] * b[bj + i];
        }
    }




    // ========================================================
    // Enums & utilities
    // ========================================================

    /**
     * Types of matrices
     * @returns {object} enum
     */
    static get MatrixType()
    {
        return this._MatrixType || (this._MatrixType = Object.freeze({
            F32: 0x0,         // 32-bit float, 1 channel
            //F32C1: 0x0 | 0x0, // 32-bit float, 1 channel
            //F32C2: 0x0 | 0x1, // 32-bit float, 2 channels
            //F32C3: 0x0 | 0x2, // 32-bit float, 3 channels
            //F32C4: 0x0 | 0x3, // 32-bit float, 4 channels
            F64: 0x4,         // 64-bit float, 1 channel
            //F64C1: 0x4 | 0x0, // 64-bit float, 1 channel
            //F64C2: 0x4 | 0x1, // 64-bit float, 2 channels
            //F64C3: 0x4 | 0x2, // 64-bit float, 3 channels
            //F64C4: 0x4 | 0x3, // 64-bit float, 4 channels
            I32: 0x8,         // 32-bit signed integer, 1 channel
            //I32C1: 0x8 | 0x0, // 32-bit signed integer, 1 channel
            //I32C2: 0x8 | 0x1, // 32-bit signed integer, 2 channels
            //I32C3: 0x8 | 0x2, // 32-bit signed integer, 3 channels
            //I32C4: 0x8 | 0x3, // 32-bit signed integer, 4 channels
            U8: 0xC,          // 8-bit unsigned integer, 1 channel
            //U8C1: 0xC | 0x0,  // 8-bit unsigned integer, 1 channel
            //U8C2: 0xC | 0x1,  // 8-bit unsigned integer, 2 channels
            //U8C3: 0xC | 0x2,  // 8-bit unsigned integer, 3 channels
            //U8C4: 0xC | 0x3,  // 8-bit unsigned integer, 4 channels
        }));
    }

    /**
     * A mapping between MatrixTypes and TypedArrays
     * @returns {object}
     */
    static get DataType()
    {
        return this._DataType || (this._DataType = Object.freeze({
            [this.MatrixType.F32]: Float32Array,
            //[this.MatrixType.F32C1]: Float32Array,
            //[this.MatrixType.F32C2]: Float32Array,
            //[this.MatrixType.F32C3]: Float32Array,
            //[this.MatrixType.F32C4]: Float32Array,
            [this.MatrixType.F64]: Float64Array,
            [this.MatrixType.I32]: Int32Array,
            [this.MatrixType.U8]:  Uint8Array,
        }));
    }

    /**
     * A mapping between MatrixTypes and descriptive strings
     * @returns {object}
     */
    static get DataTypeName()
    {
        return this._DataTypeName || (this._DataTypeName = Object.freeze({
            [this.MatrixType.F32]: 'float32',
            [this.MatrixType.F64]: 'float64',
            [this.MatrixType.I32]: 'int32',
            [this.MatrixType.U8]:  'uint8',
        }));
    }

    /**
     * Each operation is mapped to a unique number, called an operation code
     * @returns {object}
     */
    static get Opcode()
    {
        return this._Opcode || (this._Opcode = Object.freeze({
            NOP: 0x0,        // no-operation
            //EYE: 0x1,      // identity matrix
            FILL: 0x2,       // fill the matrix with a constant
            COPY: 0x3,       // copy matrix
            TRANSPOSE: 0x4,  // transpose matrix
            ADD: 0x5,        // add two matrices
            SUBTRACT: 0x6,   // subtract two matrices
            MULTIPLY: 0x7,   // multiply two matrices
            SCALE: 0x8,      // multiply by scalar
            COMPMULT: 0x9,   // component-wise product
            MULTIPLYLT: 0xA, // multiply tranposing the left operand
            MULTIPLYRT: 0xB, // multiply tranposing the right operand
        }));
    }

    /**
     * A mapping between operation codes and functions
     * @returns {object}
     */
    static get Opcode2fun()
    {
        return this._Opcode2fun || (this._Opcode2fun = Object.freeze({
            [this.Opcode.NOP]: this.nop,
            [this.Opcode.FILL]: this.fill,
            [this.Opcode.COPY]: this.copy,
            [this.Opcode.TRANSPOSE]: this.transpose,
            [this.Opcode.ADD]: this.add,
            [this.Opcode.SUBTRACT]: this.subtract,
            [this.Opcode.MULTIPLY]: this.multiply,
            [this.Opcode.SCALE]: this.scale,
            [this.Opcode.COMPMULT]: this.compmult,
            [this.Opcode.MULTIPLYLT]: this.multiplylt,
            [this.Opcode.MULTIPLYRT]: this.multiplyrt,
        }));
    }
}

module.exports = { MatrixMath };