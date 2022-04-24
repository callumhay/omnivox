import * as THREE from 'three';

import VTObject from '../VTObject';
import VTMaterialFactory from '../VTMaterialFactory';
import VoxelConstants from '../../VoxelConstants';
import VTConstants from '../VTConstants';

const NO_UV = new THREE.Vector2();
const tempVec3  = new THREE.Vector3();
const tempVec3a = new THREE.Vector3();

class VTRPIsofield extends VTObject {
  constructor(size, balls, walls, material, options) {
    super(VTConstants.ISOFIELD_TYPE);

    this._size = size;
		this._size2 = size * size;
		this._size3 = this._size2 * size;
    this._yd = size;
    this._zd = this._size2;

    this._field   = new Float32Array(this._size3);     // Isofield (scalar field for the entire volume)
    this._palette = new Float32Array(this._size3 * 3); // Colour field for the entire volume

    this._material = VTMaterialFactory.build(material);
    this._baseColour = this._material.colour;
    this._options = options;

    this.reinit();

    if ('x' in walls) { this._addWallX(walls['x']); }
    if ('y' in walls) { this._addWallY(walls['y']); }
    if ('z' in walls) { this._addWallZ(walls['z']); }

    for (let i = 0; i < balls.length; i++) {
      const metaball = balls[i];
      this._addMetaball(metaball);
    }
  }

  reinit() {
    for (let i = 0; i < this._size3; i++) {
      this._field[i] = 0.0;
      this._palette[i * 3] = this._palette[i * 3 + 1] = this._palette[i * 3 + 2] = 0.0;
    }
  }

  static build(jsonVTIsofield) {
    const {id, drawOrder, _size, _material, _metaballs, _walls, _options} = jsonVTIsofield;
    const result = new VTRPIsofield(_size, _metaballs, _walls, _material, _options);
    result.id = id;
    result.drawOrder = drawOrder;
    return result;
  }

  dispose() {}

  isShadowCaster() { return this._options.castsShadows || false; }
  isShadowReceiver() { return this._options.receivesShadows || false; }

  calculateShadow(raycaster) {
    const accumLightReduction = this._getAccumulatedVoxelRayIntersection(raycaster);
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
    if (Math.abs(voxelNormal.x) > 0.001 || Math.abs(voxelNormal.y) > 0.001 || Math.abs(voxelNormal.z) > 0.001) {
      voxelNormal.normalize();

      const paletteColour = new THREE.Color(this._palette[idxXYZ*3+0], this._palette[idxXYZ*3+1], this._palette[idxXYZ*3+2]);
      if (paletteColour.r > 0 || paletteColour.g > 0 || paletteColour.b > 0) {
        this._material.colour = paletteColour;
      }
      else {
        this._material.colour = this._baseColour;
      }
      const voxelSample = {
        point: voxelIdxPt,
        normal: voxelNormal,
        uv: NO_UV,
        falloff: fieldXYZ //THREE.MathUtils.smoothstep(fieldXYZ,0,1), // fieldXYZ > 0.5 ? 1 : 0,
      };

      return scene.calculateLightingSamples(targetRGBA, voxelIdxPt, [voxelSample], this._material, this._receivesShadow);
    }

    // Otherwise there is nothing to render
    return targetRGBA;
  }

  _getAccumulatedVoxelRayIntersection(raycaster) {
    const {ray, far, near} = raycaster;

    // Store the equivalent to the CG function call "step(0,ray.direction)"
    tempVec3a.set(
      ray.direction.x >= 0.0 ? 1.0 : 0.0,
      ray.direction.y >= 0.0 ? 1.0 : 0.0,
      ray.direction.z >= 0.0 ? 1.0 : 0.0,
    );

    // Step the ray through the isofield, check for >0 intersections and accumulate them
    // until we have a value >= 1 or we exit the field
    let accumIsoVal = 0.0, t = near;
    const sizePlusEpsilon = this._size + VoxelConstants.VOXEL_EPSILON;

    tempVec3.copy(ray.direction);
    tempVec3.multiplyScalar(t);
    tempVec3.add(ray.origin);

    while (t <= far) {
      // Determine the next step to take in the ray marching
      tempVec3.set(
        -(tempVec3.x - Math.floor(tempVec3.x)),
        -(tempVec3.y - Math.floor(tempVec3.y)),
        -(tempVec3.z - Math.floor(tempVec3.z)),
      ); // -fract(tempVec3)
      tempVec3.add(tempVec3a); // + step(0,ray.direction)
      tempVec3.divide(ray.direction);
      
      const minComp = Math.min(tempVec3.x, Math.min(tempVec3.y, tempVec3.z));
      t += Math.max(minComp, 0.25);

      // Store the current marching position in a temporary 3d vector
      tempVec3.copy(ray.direction);
      tempVec3.multiplyScalar(t);
      tempVec3.add(ray.origin);

      // Exit if we're outside the voxel volume
      if (tempVec3.x < VoxelConstants.VOXEL_EPSILON || 
          tempVec3.y < VoxelConstants.VOXEL_EPSILON || 
          tempVec3.z < VoxelConstants.VOXEL_EPSILON ||
          tempVec3.x > sizePlusEpsilon || 
          tempVec3.y > sizePlusEpsilon || 
          tempVec3.z > sizePlusEpsilon) {
        break;
      }
      
      tempVec3.floor(); // TODO?: Interpolate the current isovalue instead of flooring it

      // Look up the value in the isofield at the current ray marched position
      accumIsoVal += this._field[this._flatIdx(tempVec3.x, tempVec3.y, tempVec3.z)];
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

    const colour = (new THREE.Color()).setHex(cHex);
    const sign = Math.sign(str);
		const strength = Math.abs(str);
		const userDefinedColor = !(colour === undefined || colour === null);
		const ballColor = userDefinedColor ? colour : new THREE.Color(ballX, ballY, ballZ);
    //if (userDefinedColor) { console.log("Colour!"); }
    
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
            this._palette[(finalOffset) * 3 + 0] += ballColor.r * contrib;
            this._palette[(finalOffset) * 3 + 1] += ballColor.g * contrib;
            this._palette[(finalOffset) * 3 + 2] += ballColor.b * contrib;
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
            this._field[this._zd * z + cxy] += val;
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
            this._field[this._zd * z + cxy] += val;
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
            this._field[cyz + x] += val;
          }
        }
      }
    }
  }

};

export default VTRPIsofield;
