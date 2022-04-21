import * as THREE from 'three';

import VTObject from "./VTObject";

const _v1 = /*@__PURE__*/ new THREE.Vector3();
const _q1 = /*@__PURE__*/ new THREE.Quaternion();
//const _m1 = /*@__PURE__*/ new THREE.Matrix4();
const _xAxis = /*@__PURE__*/ new THREE.Vector3(1, 0, 0);
const _yAxis = /*@__PURE__*/ new THREE.Vector3(0, 1, 0);
const _zAxis = /*@__PURE__*/ new THREE.Vector3(0, 0, 1);

const _position = /*@__PURE__*/ new THREE.Vector3();
const _scale = /*@__PURE__*/ new THREE.Vector3();
const _quaternion = /*@__PURE__*/ new THREE.Quaternion();

// NOTE: If you directly change any core transform properties (position, rotation, scale, quaternion),
// you must call makeDirty() directly to ensure the object is updated in the VoxelTracer scene/renderer!
class VTTransformable extends VTObject {
  constructor(type) {
    super(type);

    this.parent = null;
		this.children = [];

    this.matrix = new THREE.Matrix4();
		this.matrixWorld = new THREE.Matrix4();

		this.matrixAutoUpdate = true;
		this.matrixWorldNeedsUpdate = false;

    const position = new THREE.Vector3();
		const rotation = new THREE.Euler();
		const quaternion = new THREE.Quaternion();
		const scale = new THREE.Vector3(1, 1, 1);

		function onRotationChange() { quaternion.setFromEuler(rotation, false); }
		function onQuaternionChange() { rotation.setFromQuaternion(quaternion, undefined, false); }

    rotation._onChange(onRotationChange.bind(this));
		quaternion._onChange(onQuaternionChange.bind(this));

    Object.defineProperties(this, {
			position: {
				configurable: true,
				enumerable: true,
				value: position,
        //set: p => { position.copy(p); this.makeDirty(); }
			},
			rotation: {
				configurable: true,
				enumerable: true,
				value: rotation
			},
			quaternion: {
				configurable: true,
				enumerable: true,
				value: quaternion
			},
			scale: {
				configurable: true,
				enumerable: true,
				value: scale,
        //set: s => { scale.copy(s); this.makeDirty(); } 
			},
		});
  }

  unDirty() {
    if (super.unDirty()) {
      this.updateMatrixWorld(false);
      return true;
    }
    return false;
  }

  applyMatrix4(matrix) {
		if (this.matrixAutoUpdate) { this.updateMatrix(); }
		this.matrix.premultiply(matrix);
		this.matrix.decompose(this.position, this.quaternion, this.scale);
    this.makeDirty();
	}

	applyQuaternion(q) {
		this.quaternion.premultiply(q);
    this.makeDirty();
		return this;
	}

	setRotationFromEuler(euler) {
		this.quaternion.setFromEuler(euler, true);
    this.makeDirty();
	}

	setRotationFromMatrix(m) {
		// Assumes the upper 3x3 of m is a pure rotation matrix (i.e, unscaled)
		this.quaternion.setFromRotationMatrix(m);
    this.makeDirty();
	}

	setRotationFromQuaternion(q) {
		// Assumes q is normalized
		this.quaternion.copy(q);
    this.makeDirty();
	}

  rotateOnAxis(axis, angle) {
		// Rotate object on axis in object space, axis is assumed to be normalized
		_q1.setFromAxisAngle(axis, angle);
		this.quaternion.multiply(_q1);
    this.makeDirty();
		return this;
	}

	rotateX(angle) { return this.rotateOnAxis(_xAxis, angle); }
	rotateY(angle) { return this.rotateOnAxis(_yAxis, angle); }
	rotateZ(angle) { return this.rotateOnAxis(_zAxis, angle); }

	translateOnAxis(axis, distance) {
		// Translate object by distance along axis in object space
		// axis is assumed to be normalized
		_v1.copy(axis).applyQuaternion(this.quaternion);
		this.position.add(_v1.multiplyScalar(distance));
    this.makeDirty();
		return this;
	}

	translateX(distance) { return this.translateOnAxis(_xAxis, distance); }
	translateY(distance) { return this.translateOnAxis(_yAxis, distance); }
	translateZ(distance) { return this.translateOnAxis(_zAxis, distance);	}

  updateMatrix() {
		this.matrix.compose(this.position, this.quaternion, this.scale);
		this.matrixWorldNeedsUpdate = true;
    this.makeDirty();
	}

  updateMatrixWorld(force) {
		if (this.matrixAutoUpdate) { this.updateMatrix(); }

		if (this.matrixWorldNeedsUpdate || force) {
			if (this.parent === null) {
				this.matrixWorld.copy(this.matrix);
			}
      else {
				this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
			}

			this.matrixWorldNeedsUpdate = false;
			force = true;
		}

		// Update children
		const children = this.children;
		for (let i = 0, l = children.length; i < l; i++) {
			children[i].updateMatrixWorld(force);
		}
	}

	updateWorldMatrix(updateParents, updateChildren) {
		const parent = this.parent;

		if (updateParents === true && parent !== null) {
			parent.updateWorldMatrix(true, false);
		}

		if (this.matrixAutoUpdate) { this.updateMatrix(); }

		if (this.parent === null) {
			this.matrixWorld.copy(this.matrix);
		}
    else {
			this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix);
		}

		// Update children
		if (updateChildren === true) {
			const children = this.children;
			for (let i = 0, l = children.length; i < l; i++) {
				children[ i ].updateWorldMatrix(false, true);
			}
		}
	}

  getWorldPosition(target) {
		this.updateWorldMatrix(true, false);
		return target.setFromMatrixPosition(this.matrixWorld);
	}

	getWorldQuaternion(target) {
		this.updateWorldMatrix(true, false);
		this.matrixWorld.decompose(_position, target, _scale);
		return target;
	}

	getWorldScale(target) {
		this.updateWorldMatrix(true, false);
		this.matrixWorld.decompose(_position, _quaternion, target);
		return target;
	}

	getWorldDirection(target) {
		this.updateWorldMatrix(true, false);
		const e = this.matrixWorld.elements;
		return target.set(e[8], e[9], e[10]).normalize();
	}

}

export default VTTransformable;
