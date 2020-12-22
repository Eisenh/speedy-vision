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
 * encode-keypoints.glsl
 * Encode keypoints in a texture
 */

/*
 * Keypoint images are encoded as follows:
 *
 * R - "cornerness" score of the pixel (0 means it's not a corner)
 * G - pixel intensity
 * B - skip offset
 * A - keypoint scale
 *
 * skip offset := min(c, -1 + offset to the next feature) / 255,
 * for a constant c in [1,255]
 */

@include "keypoints.glsl"

uniform sampler2D image;
uniform sampler2D encodedKeypoints;
uniform ivec2 imageSize;
uniform int tileSize; // preferably a power of 2
uniform int tileIndex; // 0, 1, 2...
uniform int descriptorSize;
uniform int extraSize;
uniform int encoderLength;

// q = 0, 1, 2... keypoint index
bool findQthKeypoint(int q, out ivec2 position, out vec4 pixel)
{
    int i = 0, p = -1;

    position = ivec2(0, 0);
    while(position.y < imageSize.y && p != q) {
        pixel = texelFetch(image, position, 0);
        p += int(pixel.r > 0.0f);
        i += 1 + int(pixel.b * 255.0f);
        position = ivec2(i % imageSize.x, i / imageSize.x);
    }

    return (p == q);
}

void main()
{
    ivec2 thread = threadLocation();
    KeypointAddress address = findKeypointAddress(thread, encoderLength, descriptorSize, extraSize);
    int q = findKeypointIndex(address, descriptorSize, extraSize);
    ivec2 position;
    vec4 pixel;

    // we divide the processing in a few tiles...
    color = threadPixel(encodedKeypoints);
    ivec2 tilePos = thread / tileSize;
    int tileStride = encoderLength / tileSize;
    int tile = tilePos.y * tileStride + tilePos.x;
    if(tile != tileIndex) // not this tile?
        return;

    // is it a descriptor/extra cell?
    color = vec4(0.0f); // fill it with zeroes
    if(address.offset > 1)
        return;

    // find the q-th keypoint, if it exists
    color = encodeNullKeypoint(); // end of list
    if(!findQthKeypoint(q, position, pixel))
        return;

    // write keypoint data
    color = (address.offset == 1) ? vec4(
        pixel.a, // scale
        0.0f, // rotation
        pixel.r, // score
        encodeKeypointFlags(KPF_NONE) // flags
    ) : encodeKeypointPosition(
        vec2(position) // position
    );
}