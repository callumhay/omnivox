import * as THREE from 'three';

import VoxelConstants from '../../VoxelConstants';

import VTConstants from '../VTConstants';
import {defaultIsofieldOptions} from '../VTIsofield';

import VTRPObject from './VTRPObject';
import VTRPObjectFactory from './VTRPObjectFactory';
import VTRPSample from './VTRPSample';

const _noUV     = new THREE.Vector2();
const _tempVec3_0  = new THREE.Vector3();
const _tempVec3_1 = new THREE.Vector3();
const _tempColour = new THREE.Color();

const _sample = new VTRPSample();

class VTRPIsofield extends VTRPObject {
  constructor() {
    super(VTConstants.ISOFIELD_TYPE);

    this.setSize(0);

    this._material = null;
    this._baseColour = null;
    this._options = {...defaultIsofieldOptions};
  }

  setSize(size) {
    this._size = size;
		this._size2 = size * size;
		this._size3 = this._size2 * size;
    this._yd = size;
    this._zd = this._size2;

    this._field   = new Float32Array(this._size3);     // Isofield (scalar field for the entire volume)
    this._palette = new Float32Array(this._size3 * 3); // Colour field for the entire volume

    this.clearFieldAndPalette();
  }

  clearFieldAndPalette() {
    for (let i = 0; i < this._size3; i++) {
      this._field[i] = 0.0;
      this._palette[i * 3 + 0] = this._palette[i * 3 + 1] = this._palette[i * 3 + 2] = 0.0;
    }
  }

  expire(pool) {
    if (this._material) {
      pool.expire(this._material);
      this._material = null;
    }
  }

  fromJSON(json, pool) {
    const {id, drawOrder, _size, _material, _metaballs, _walls, _options} = json;
    this.id = id;
    this.drawOrder = drawOrder;
    this._options = {...this._options, _options};
    this._material = VTRPObjectFactory.updateOrBuildFromPool(_material, pool, this._material);
    this._baseColour = this._material.colour;

    if (this._size !== _size) { this.setSize(_size); }
    else { this.clearFieldAndPalette(); }
    
    if ('x' in _walls) { this._addWallX(_walls['x']); }
    if ('y' in _walls) { this._addWallY(_walls['y']); }
    if ('z' in _walls) { this._addWallZ(_walls['z']); }

    for (const metaball of _metaballs) { this._addMetaball(metaball); }

    return this;
  }

  isShadowCaster() { return this._options.castsShadows || false; }
  isShadowReceiver() { return this._options.receivesShadows || false; }

  calculateShadow(raycaster) {
    const accumLightReduction = this._getAccumulatedVoxelRayIntersection(raycaster) * this._material.alpha;
    return {
      inShadow: this.isShadowCaster() && accumLightReduction > 0,
      lightReduction: accumLightReduction, // [0,1]: 1 => Completely black out the light if a voxel is in shadow from this object
    };
  }

  calculateVoxelColour(targetRGBA, voxelIdxPt, scene) {
    // Fast-out if we can't even see this object
    if (!this._material.isVisible()) { return targetRGBA; }

    const xIdx = Math.floor(voxelIdxPt.x);
    const yIdx = Math.floor(voxelIdxPt.y);
    const zIdx = Math.floor(voxelIdxPt.z);

    const idxXYZ = this._flatIdx(xIdx, yIdx, zIdx);
  
    // Build lighting sample for the voxel

    // Calculate the normal...
    const idxXp1YZ = xIdx >= this._size-1 ? idxXYZ : this._flatIdx(xIdx+1, yIdx, zIdx);
    const idxXm1YZ = xIdx <= 0 ? idxXYZ : this._flatIdx(xIdx-1, yIdx, zIdx);
    const idxXYp1Z = yIdx >= this._size-1 ? idxXYZ : this._flatIdx(xIdx, yIdx+1, zIdx);
    const idxXYm1Z = yIdx <= 0 ? idxXYZ : this._flatIdx(xIdx, yIdx-1, zIdx);
    const idxXYZp1 = zIdx >= this._size-1 ? idxXYZ : this._flatIdx(xIdx, yIdx, zIdx+1);
    const idxXYZm1 = zIdx <= 0 ? idxXYZ : this._flatIdx(xIdx, yIdx, zIdx-1);

    const fieldXYZ = this._field[idxXYZ];

    // Use central differences to find the normal via the gradient of the isofield
    // Nx = [Ixyz + (Ixyz + I(x+1)yz) / 2 ] - [Ixyz - (Ixyz + I(x-1)yz) / 2], ...
    const voxelNormal = new THREE.Vector3(
      (this._field[idxXm1YZ] - this._field[idxXp1YZ]) * 0.5,
      (this._field[idxXYm1Z] - this._field[idxXYp1Z]) * 0.5,
      (this._field[idxXYZm1] - this._field[idxXYZp1]) * 0.5,
    );

    // If a normal is non-zero then we're on the surface of something, render it
    if (fieldXYZ > 0 && Math.abs(voxelNormal.x) > 0.001 || Math.abs(voxelNormal.y) > 0.001 || Math.abs(voxelNormal.z) > 0.001) {
      const paletteColour = _tempColour.setRGB(this._palette[idxXYZ*3+0], this._palette[idxXYZ*3+1], this._palette[idxXYZ*3+2]);
      if (paletteColour.r > 0 || paletteColour.g > 0 || paletteColour.b > 0) {
        this._material.colour.copy(paletteColour);
      }
      else {
        this._material.colour.copy(this._baseColour);
      }

      _sample.set(voxelIdxPt, voxelNormal.normalize(), _noUV, Math.min(1, fieldXYZ));
      return scene.calculateLightingSamples(targetRGBA, voxelIdxPt, [_sample], this._material, this.isShadowReceiver());
    }

    // Otherwise there is nothing to render
    return targetRGBA;
  }

  _getAccumulatedVoxelRayIntersection(raycaster) {
    const {ray, far, near} = raycaster;

    // Store the equivalent to the CG function call "step(0,ray.direction)"
    _tempVec3_1.set(
      ray.direction.x >= 0.0 ? 1.0 : 0.0,
      ray.direction.y >= 0.0 ? 1.0 : 0.0,
      ray.direction.z >= 0.0 ? 1.0 : 0.0,
    );

    // Step the ray through the isofield, check for >0 intersections and accumulate them
    // until we have a value >= 1 or we exit the field
    let accumIsoVal = 0.0, t = near;
    const sizePlusEpsilon = this._size + VoxelConstants.VOXEL_EPSILON;

    _tempVec3_0.copy(ray.direction);
    _tempVec3_0.multiplyScalar(t);
    _tempVec3_0.add(ray.origin);

    while (t <= far) {
      // Determine the next step to take in the ray marching
      _tempVec3_0.set(
        -(_tempVec3_0.x - Math.floor(_tempVec3_0.x)),
        -(_tempVec3_0.y - Math.floor(_tempVec3_0.y)),
        -(_tempVec3_0.z - Math.floor(_tempVec3_0.z)),
      ); // -fract(_tempVec3_0)
      _tempVec3_0.add(_tempVec3_1); // + step(0,ray.direction)
      _tempVec3_0.divide(ray.direction);
      
      const minComp = Math.min(_tempVec3_0.x, Math.min(_tempVec3_0.y, _tempVec3_0.z));
      t += Math.max(minComp, 0.25);

      // Store the current marching position in a temporary 3d vector
      _tempVec3_0.copy(ray.direction);
      _tempVec3_0.multiplyScalar(t);
      _tempVec3_0.add(ray.origin);

      // Exit if we're outside the voxel volume
      if (_tempVec3_0.x < VoxelConstants.VOXEL_EPSILON || 
          _tempVec3_0.y < VoxelConstants.VOXEL_EPSILON || 
          _tempVec3_0.z < VoxelConstants.VOXEL_EPSILON ||
          _tempVec3_0.x > sizePlusEpsilon || 
          _tempVec3_0.y > sizePlusEpsilon || 
          _tempVec3_0.z > sizePlusEpsilon) {
        break;
      }
      
      _tempVec3_0.floor(); // TODO?: Interpolate the current isovalue instead of flooring it

      // Look up the value in the isofield at the current ray marched position
      accumIsoVal += this._field[this._flatIdx(_tempVec3_0.x, _tempVec3_0.y, _tempVec3_0.z)];
      if (accumIsoVal >= 1) { break; }
    }

    return Math.min(accumIsoVal, 1.0);
  }

  _flatIdx(x,y,z) {
    return this._size2*z + this._size*y + x;
  }

  // Much of this code comes from the three.js metaball/marching cube example:
  // https://github.com/mrdoob/three.js/blob/master/examples/jsm/objects/MarchingCubes.js
  _addMetaball(metaball) {
    if (!metaball) { return; }
    const {ballX, ballY, ballZ, strength:str, subtract, colour:cHex} = metaball;

    const colour = _tempColour.setHex(cHex);
    const sign = Math.sign(str);
		const strength = Math.abs(str);
		const userDefinedColor = !(colour === undefined || colour === null);
		const ballColor = userDefinedColor ? colour : _tempColour.setRGB(ballX, ballY, ballZ);

    // Let's solve the equation to find the radius:
    // 1.0 / (0.000001 + radius^2) * strength - subtract = 0
    // strength / (radius^2) = subtract
    // strength = subtract * radius^2
    // radius^2 = strength / subtract
    // radius = sqrt(strength / subtract)

    const radius = this._size * Math.sqrt(strength / subtract),
    zs = ballZ * this._size,
    ys = ballY * this._size,
    xs = ballX * this._size;

    let min_z = Math.floor(zs - radius);
    if (min_z < 0) { min_z = 0; }
    let max_z = Math.floor(zs + radius);
    if (max_z > this._size) { max_z = this._size; }

    let min_y = Math.floor(ys - radius);
    if (min_y < 0) { min_y = 0; }
    let max_y = Math.floor(ys + radius);
    if (max_y > this._size) { max_y = this._size; }

    let min_x = Math.floor(xs - radius);
    if (min_x < 0) { min_x = 0; }
    let max_x = Math.floor(xs + radius);
    if (max_x > this._size) { max_x = this._size; }

    let y_offset, z_offset, fx, fy, fz, fz2, fy2, val;
    for (let z = min_z; z < max_z; z++) {
      z_offset = this._size2 * z;
      fz = z / this._size - ballZ;
      fz2 = fz * fz;

      for (let y = min_y; y < max_y; y++) {
        y_offset = z_offset + this._size * y;
        fy = y / this._size - ballY;
        fy2 = fy * fy;

        for (let x = min_x; x < max_x; x++) {
          fx = x / this._size - ballX;
          val = strength / (0.000001 + fx * fx + fy2 + fz2) - subtract;
          if (val > 0.0) {
            const finalOffset = y_offset + x;
            this._field[finalOffset] = THREE.MathUtils.clamp(val * sign + this._field[finalOffset], -1, 1);

            //const ratio = Math.sqrt((x - xs) * (x - xs) + (y - ys) * (y - ys) + (z - zs) * (z - zs)) / radius;
            const contrib = 1;// 1.0 - ratio * ratio * ratio * (ratio * (ratio * 6 - 15) + 10);
            this._palette[finalOffset * 3 + 0] += ballColor.r * contrib;
            this._palette[finalOffset * 3 + 1] += ballColor.g * contrib;
            this._palette[finalOffset * 3 + 2] += ballColor.b * contrib;
          }
        }
      }
    }
  }

  _addWallX(wall) {
    if (!wall) { return; }
    const {strength, subtract} = wall;

    let xx, val, xdiv, cxy, dist = 2 * Math.sqrt(strength / subtract);
    if (dist > this._size) { dist = this._size };
    for (let x = 0; x < dist; x++) {
      xdiv = x / this._size;
      xx = xdiv * xdiv;
      val = strength / (0.0001 + xx) - subtract;
      if (val > 0.0) {
        for (let y = 0; y < this._size; y++) {
          cxy = x + y * this._yd;
          for (let z = 0; z < this._size; z++) {
            const offset = this._zd * z + cxy;
            this._field[offset] = THREE.MathUtils.clamp(val + this._field[offset], -1, 1);
          }
        }
      }
    }
  }

  _addWallY(wall) {
    if (!wall) { return; }
    const {strength, subtract} = wall;

    let yy, val, ydiv, cy, cxy, dist = 2 * Math.sqrt(strength / subtract);
    if (dist > this._size) { dist = this._size };
    for (let y = 0; y < dist; y++) {
      ydiv = y / this._size;
      yy = ydiv * ydiv;
      val = strength / (0.0001 + yy) - subtract;
      if (val > 0.0) {
        cy = y * this._yd;
        for (let x = 0; x < this._size; x++) {
          cxy = cy + x;
          for (let z = 0; z < this._size; z++) {
            const offset = this._zd * z + cxy;
            this._field[offset] = THREE.MathUtils.clamp(val + this._field[offset], -1, 1);
          }
        }
      }
    }
  }

  _addWallZ(wall) {
    if (!wall) { return; }
    const {strength, subtract} = wall;

    let zz, val, zdiv, cz, cyz,	dist = 2 * Math.sqrt(strength / subtract);
    if (dist > this._size) { dist = this._size };
    for (let z = 0; z < dist; z++) {
      zdiv = z / this._size;
      zz = zdiv * zdiv;
      val = strength / (0.0001 + zz) - subtract;
      if (val > 0.0) {
        cz = this._zd * z;
        for (let y = 0; y < this._size; y++) {
          cyz = cz + y * this._yd;
          for (let x = 0; x < this._size; x++) {
            const offset = cyz + x;
            this._field[offset] = THREE.MathUtils.clamp(val + this._field[offset], -1, 1);
          }
        }
      }
    }
  }

};

export default VTRPIsofield;
