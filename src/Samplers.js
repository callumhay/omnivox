
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

  /**
	 * Creates a number for index with base in a Halton sequence between [0, 1].
	 * @param  {Number} index Index to return number for, > 0
	 * @param  {Number} base  The base to use
	 * @return {Number}       The halton number for the given index and base
	 */
	static halton(index, base) {
		let result = 0,	frac = 1 / base, i = index + 1;
		while (i > 0) {
			result += frac * (i % base);
			i = Math.floor(i / base);
			frac = frac / base;
		}
		return result;
	}

  /**
	 * Generate a sequence of Halton numbers
	 * @param  {Function} generatorFn The function to use for generating sequences
	 * @param  {Number}   length Length of sequence
	 * @return {Number[]}        Sequence of numbers
	 */
	static haltonSequence(base, length) {
    let index = 0;
    const result = [], haltonGenerator = idx => Sampler.halton(idx, base);
		const increment = () => haltonGenerator(index++);

		while(length--) {	result.push(increment());	}

		return result;
	};
}

const HALTON_SEQ_2_LEN5 = Sampler.haltonSequence(2,5);
const HALTON_SEQ_3_LEN5 = Sampler.haltonSequence(3,5);
const HALTON_SEQ_5_LEN5 = Sampler.haltonSequence(5,5);

export const HALTON_5PTS_SEQ_2_3_5 = [0,1,2,3,4].map(i => new THREE.Vector3(HALTON_SEQ_2_LEN5[i], HALTON_SEQ_3_LEN5[i], HALTON_SEQ_5_LEN5[i]));


export default Sampler;