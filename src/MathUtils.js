export const VOXEL_EPSILON = 0.00001;

export const hslToHsvColor = (hsl) => {
  const v = hsl.l + hsl.s*Math.min(hsl.l,1-hsl.l);
  return {h:hsl.h, s: v == 0 ? 0 : 2-2*hsl.l/v, v:v};
}
export const hsvToHslColor = (hsv) => {
  const l = hsv.v - hsv.v*hsv.s/2.0;
  const hsl = new THREE.Color();
  hsl.setHSL(hsv.h, l === 0 || l === 1 ? 0 : ((hsv.v-l)/Math.min(l,1-l)), l);
}
