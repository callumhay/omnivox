
import * as THREE from 'three';
import {SQRT5} from './MathUtils';

class Sampler {

  /**
   * Produces a fibonacci spiral sphere sample.
   * https://medium.com/@vagnerseibert/distributing-points-on-a-sphere-6b593cc05b42
   * 
   * @param {Number} sampleIdx The current sample index [0, numSamples-1]
   * @param {Number} numSamples The total number of samples over the entire sphere.
   * @param {Number} radius The radius of the sphere.
   * @param {Number} initPhi (Optional) Initial phi to start sampling at.
   * @param {Number} initTheta (Optional) Initial theta to start sampling at.
   * @returns The sample point on the surface of the sphere.
   */
  static fibSphere(sampleIdx, numSamples, radius, initPhi=0, initTheta=0) {
    const k = sampleIdx + 0.5;

    const phi   = initPhi + Math.acos(1 - 2 * k / numSamples);
    const theta = initTheta + Math.PI * (1 + SQRT5) * k;

    return (new THREE.Vector3(
      Math.cos(theta) * Math.sin(phi),
      Math.sin(theta) * Math.sin(phi),
      Math.cos(phi)
    )).multiplyScalar(radius);
  }
}

export default Sampler;