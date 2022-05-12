export const SQRT3   = 1.73205080757;
export const SQRT5   = 2.23606797749;
export const SQRT2PI = 4.44288293816;
export const PI2 = Math.PI*2;

export const hslToHsvColor = (hsl) => {
  const v = hsl.l + hsl.s*Math.min(hsl.l,1-hsl.l);
  return {h:hsl.h, s: v == 0 ? 0 : 2-2*hsl.l/v, v:v};
};
export const hsvToHslColor = (hsv) => {
  const l = hsv.v - hsv.v*hsv.s/2.0;
  const hsl = new THREE.Color();
  hsl.setHSL(hsv.h, l === 0 || l === 1 ? 0 : ((hsv.v-l)/Math.min(l,1-l)), l);
};

export const clamp = (value, min, max) => {
  return Math.max(min, Math.min(max, value));
};

/**
 * Fast hash code function for uint8 arrays.
 * @param {Uint8Array} arr - Array to get the hash code for.
 */
export const hashCode = (arr) => {
  let hash = 0;
  for (let i = 0; i < arr.length; i++) {
    hash = ((hash << 5) - hash) + arr[i];
    hash = hash & hash;
  }
  return hash;
};

/**
 * Get the theta and phi angles for a given position on the surface of a sphere.
 * https://en.wikipedia.org/wiki/Spherical_coordinate_system
 * @param {Number} r The radius of the sphere.
 * @param {THREE.Vector3} pt The coordinate on the surface of the sphere in the local space of the sphere.
 * @returns An array of the radian angles [theta, phi] corresponding to the given pt.
 */
export const spherePtToThetaPhi = (r, pt)  => {
  const theta = Math.acos(pt.z / r);
  const phi = Math.atan2(pt.y, pt.z);
  return [theta, phi];
};

/**
 * To create an 'imperfect' perpendicular unit vector to the one given we
 * find the smallest index coordinate component and set it to zero,
 * then we flip the other two coordinates and negate the first.
 **/
export const perpendicularUnitVector = (target, vec) => {
  let smallestIdx = 0;
  if (vec.x < vec.y) {
    if (vec.x < vec.z) {
      smallestIdx = 0;
      target.y = -vec.z; target.z = vec.y;
    }
    else {
      smallestIdx = 2;
      target.x = -vec.y; target.y = vec.x;
    }
  }
  else {
    if (vec.y < vec.z) {
      smallestIdx = 1;
      target.x = -vec.z; target.z = vec.x;
    }
    else {
      smallestIdx = 2;
      target.x = -vec.y; target.y = vec.x;
    }
  }
  return target.setComponent(smallestIdx, 0).normalize();
};