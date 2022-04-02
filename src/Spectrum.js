import * as THREE from 'three';
import chroma from 'chroma-js';

import {Randomizer} from './Randomizers';

// Default note-to-colour palette:
// [C, C♯, D, D♯, E, F, F♯, G, G♯, A, A♯, B]
// Based on Alexander Scriabin's synethesthetic scheme, see: https://en.wikipedia.org/wiki/Chromesthesia
export const SCRIABIN_NOTE_COLOURS = [
  {r: 1.000, g: 0.008, b: 0.000}, // C: Intense Red (#ff0200)
  {r: 0.569, g: 0.008, b: 0.996}, // C♯: Violet (#9102fe)
  {r: 0.992, g: 1.000, b: 0.000}, // D: Yellow (#fdff00)
  {r: 0.725, g: 0.267, b: 0.545}, // D♯: Mulberry (#b9448b)
  {r: 0.776, g: 0.949, b: 0.996}, // E: Pale Blue/Cobalt (#c6f2fe)
  {r: 0.678, g: 0.000, b: 0.188}, // F: Rose (#ad0030)
  {r: 0.502, g: 0.549, b: 0.992}, // F♯ Cornflower Blue (#808cfd)
  {r: 1.000, g: 0.502, b: 0.004}, // G: Orange (#ff8001)
  {r: 0.737, g: 0.463, b: 0.988}, // G♯: Mauve (#bc76fc)
  {r: 0.196, g: 0.804, b: 0.180}, // A: Green (#32cd2e)
  {r: 0.671, g: 0.400, b: 0.486}, // A♯: Puce (#ab667c)
  {r: 0.565, g: 0.796, b: 0.996}, // B: Sky Blue (#90cbfe)
];

export const COLOUR_INTERPOLATION_RGB  = 'rgb';
export const COLOUR_INTERPOLATION_HSL  = 'hsl';
export const COLOUR_INTERPOLATION_LAB  = 'lab';
export const COLOUR_INTERPOLATION_LCH  = 'lch';
export const COLOUR_INTERPOLATION_LRGB = 'lrgb';
export const COLOUR_INTERPOLATION_TYPES = [
  COLOUR_INTERPOLATION_RGB,
  COLOUR_INTERPOLATION_HSL,
  COLOUR_INTERPOLATION_LAB,
  COLOUR_INTERPOLATION_LCH,
  COLOUR_INTERPOLATION_LRGB,
];

export const FIRE_SPECTRUM_WIDTH = 256;

const cie_colour_match = [
  [0.0014,0.0000,0.0065], [0.0022,0.0001,0.0105], [0.0042,0.0001,0.0201],
  [0.0076,0.0002,0.0362], [0.0143,0.0004,0.0679], [0.0232,0.0006,0.1102],
  [0.0435,0.0012,0.2074], [0.0776,0.0022,0.3713], [0.1344,0.0040,0.6456],
  [0.2148,0.0073,1.0391], [0.2839,0.0116,1.3856], [0.3285,0.0168,1.6230],
  [0.3483,0.0230,1.7471], [0.3481,0.0298,1.7826], [0.3362,0.0380,1.7721],
  [0.3187,0.0480,1.7441], [0.2908,0.0600,1.6692], [0.2511,0.0739,1.5281],
  [0.1954,0.0910,1.2876], [0.1421,0.1126,1.0419], [0.0956,0.1390,0.8130],
  [0.0580,0.1693,0.6162], [0.0320,0.2080,0.4652], [0.0147,0.2586,0.3533],
  [0.0049,0.3230,0.2720], [0.0024,0.4073,0.2123], [0.0093,0.5030,0.1582],
  [0.0291,0.6082,0.1117], [0.0633,0.7100,0.0782], [0.1096,0.7932,0.0573],
  [0.1655,0.8620,0.0422], [0.2257,0.9149,0.0298], [0.2904,0.9540,0.0203],
  [0.3597,0.9803,0.0134], [0.4334,0.9950,0.0087], [0.5121,1.0000,0.0057],
  [0.5945,0.9950,0.0039], [0.6784,0.9786,0.0027], [0.7621,0.9520,0.0021],
  [0.8425,0.9154,0.0018], [0.9163,0.8700,0.0017], [0.9786,0.8163,0.0014],
  [1.0263,0.7570,0.0011], [1.0567,0.6949,0.0010], [1.0622,0.6310,0.0008],
  [1.0456,0.5668,0.0006], [1.0026,0.5030,0.0003], [0.9384,0.4412,0.0002],
  [0.8544,0.3810,0.0002], [0.7514,0.3210,0.0001], [0.6424,0.2650,0.0000],
  [0.5419,0.2170,0.0000], [0.4479,0.1750,0.0000], [0.3608,0.1382,0.0000],
  [0.2835,0.1070,0.0000], [0.2187,0.0816,0.0000], [0.1649,0.0610,0.0000],
  [0.1212,0.0446,0.0000], [0.0874,0.0320,0.0000], [0.0636,0.0232,0.0000],
  [0.0468,0.0170,0.0000], [0.0329,0.0119,0.0000], [0.0227,0.0082,0.0000],
  [0.0158,0.0057,0.0000], [0.0114,0.0041,0.0000], [0.0081,0.0029,0.0000],
  [0.0058,0.0021,0.0000], [0.0041,0.0015,0.0000], [0.0029,0.0010,0.0000],
  [0.0020,0.0007,0.0000], [0.0014,0.0005,0.0000], [0.0010,0.0004,0.0000],
  [0.0007,0.0002,0.0000], [0.0005,0.0002,0.0000], [0.0003,0.0001,0.0000],
  [0.0002,0.0001,0.0000], [0.0002,0.0001,0.0000], [0.0001,0.0000,0.0000],
  [0.0001,0.0000,0.0000], [0.0001,0.0000,0.0000], [0.0000,0.0000,0.0000]
];

const IlluminantC   = [0.3101, 0.3162]; /* For NTSC television */   	    	
const IlluminantD65 = [0.3127, 0.3291];	/* For EBU and SMPTE */
const IlluminantE 	= [0.33333333, 0.33333333];  /* CIE equal-energy illuminant */
const GAMMA_REC709 = 0;

export const NTSCsystem   = { name: "NTSC",            xRed: 0.67,   yRed: 0.33,   xGreen: 0.21,   yGreen: 0.71,   xBlue: 0.14,   yBlue: 0.08,   xWhite: IlluminantC[0],   yWhite: IlluminantC[1],   gamma: GAMMA_REC709 };
export const EBUsystem    = { name: "EBU (PAL/SECAM)", xRed: 0.64,   yRed: 0.33,   xGreen: 0.29,   yGreen: 0.60,   xBlue: 0.15,   yBlue: 0.06,   xWhite: IlluminantD65[0], yWhite: IlluminantD65[1], gamma: GAMMA_REC709 };
export const SMPTEsystem  = { name: "SMPTE",           xRed: 0.630,  yRed: 0.340,  xGreen: 0.310,  yGreen: 0.595,  xBlue: 0.155,  yBlue: 0.070,  xWhite: IlluminantD65[0], yWhite: IlluminantD65[1], gamma: GAMMA_REC709 };
export const HDTVsystem   = { name: "HDTV",            xRed: 0.670,  yRed: 0.330,  xGreen: 0.210,  yGreen: 0.710,  xBlue: 0.150,  yBlue: 0.060,  xWhite: IlluminantD65[0], yWhite: IlluminantD65[1], gamma: GAMMA_REC709 };
export const CIEsystem    = { name: "CIE",             xRed: 0.7355, yRed: 0.2645, xGreen: 0.2658, yGreen: 0.7243, xBlue: 0.1669, yBlue: 0.0085, xWhite: IlluminantE[0],   yWhite: IlluminantE[1],   gamma: GAMMA_REC709 };
export const Rec709system = { name: "CIE REC 709",     xRed: 0.64,   yRed: 0.33,   xGreen: 0.30,   yGreen: 0.60,   xBlue: 0.15,   yBlue: 0.06,   xWhite: IlluminantD65[0], yWhite: IlluminantD65[1], gamma: GAMMA_REC709 };
export const ColourSystems = {
  'NTSCsystem'  : NTSCsystem,
  'EBUsystem'   : EBUsystem,
  'SMPTEsystem' : SMPTEsystem,
  'HDTVsystem'  : HDTVsystem,
  'CIEsystem'   : CIEsystem,
  'Rec709system': Rec709system
};

class Spectrum {
  static genLowToHighColourSpectrum(lowColour, highColour, colourInterpolationType, size=FIRE_SPECTRUM_WIDTH) {
    const lowColourGL  = chroma.gl(lowColour.r, lowColour.g, lowColour.b, 1);
    const highColourGL = chroma.gl(highColour.r, highColour.g, highColour.b, 1);
    const spectrum = new Array(size);
    for (let i = 0; i < size; i++) {
      spectrum[i] = chroma.mix(lowColourGL, highColourGL, i / (size - 1.0), colourInterpolationType).gl();
    }
    return spectrum;
  }

  static genRandomHighLowColours(currRandomColours=null) {

    const HUE_MIN_DIST = 60.0;
    const HUE_LOW_TO_HIGH_TEMP_DIST = 90;
    const LOW_TEMP_SATURATION = [0.75, 1.0];
    const LOW_TEMP_INTENSITY  = [0.33, 0.66];

    let nextHighTempColour = null;
    let nextLowTempColour  = null;

    if (currRandomColours) {
      // Use the existing random colours as a jump-off point to make sure we don't repeat them consecutively
      const {lowTempColour} = currRandomColours;
      const lowTempChromaHsl = chroma(chroma.gl(lowTempColour.r, lowTempColour.g, lowTempColour.b, 1)).hsl();

      lowTempChromaHsl[0] = (lowTempChromaHsl[0] + Randomizer.getRandomFloat(HUE_MIN_DIST, 360-HUE_MIN_DIST)) % 360;
      lowTempChromaHsl[1] = Randomizer.getRandomFloat(LOW_TEMP_SATURATION[0], LOW_TEMP_SATURATION[1]);
      lowTempChromaHsl[2] = Randomizer.getRandomFloat(LOW_TEMP_INTENSITY[0], LOW_TEMP_INTENSITY[1]);

      const highTempHue = (lowTempChromaHsl[0] + Randomizer.getRandomFloat(HUE_LOW_TO_HIGH_TEMP_DIST, 360-HUE_LOW_TO_HIGH_TEMP_DIST)) % 360;
      const highTempChromaHsl = [highTempHue, 1, lowTempChromaHsl[2]];
      nextLowTempColour = chroma(lowTempChromaHsl, 'hsl').gl();
      nextLowTempColour = new THREE.Color(nextLowTempColour[0], nextLowTempColour[1], nextLowTempColour[2]);
      nextHighTempColour = chroma(highTempChromaHsl, 'hsl').gl();
      nextHighTempColour = new THREE.Color(nextHighTempColour[0], nextHighTempColour[1], nextHighTempColour[2]);
    }
    else {
      // First time generation, pick some good random colours
      const lowTempChroma = chroma(
        Randomizer.getRandomFloat(0,360),
        Randomizer.getRandomFloat(LOW_TEMP_SATURATION[0], LOW_TEMP_SATURATION[1]),
        Randomizer.getRandomFloat(LOW_TEMP_INTENSITY[0], LOW_TEMP_INTENSITY[1]), 'hsl');
      const lowTempChromaGl = lowTempChroma.gl();
      nextLowTempColour = new THREE.Color(lowTempChromaGl[0], lowTempChromaGl[1], lowTempChromaGl[2]);

      const lowTempHsl = lowTempChroma.hsl();
      const highTempChromaGl = chroma((lowTempHsl[0] + 180) % 360, 1, lowTempHsl[2], 'hsl').gl();
      nextHighTempColour = new THREE.Color(highTempChromaGl[0], highTempChromaGl[1], highTempChromaGl[2]);
    }

    return {
      highTempColour: nextHighTempColour,
      lowTempColour: nextLowTempColour
    };
  }


  static bb_spectrum(wavelength, blackbodyTemp) {
    let wlm = wavelength * 1e-9;
    return (3.74183e-16 * Math.pow(wlm, -5)) / (Math.exp(1.4388e-2 / (wlm * blackbodyTemp)) - 1.0);
  }
  
  static spectrumToXyz(specFunc, blackbodyTemp) {
    let X = 0; let Y = 0; let Z = 0;
    for (let i = 0, lambda = 380; lambda < 780.1; i++, lambda += 5) {
      let Me = specFunc(lambda, blackbodyTemp);
      X += Me * cie_colour_match[i][0];
      Y += Me * cie_colour_match[i][1];
      Z += Me * cie_colour_match[i][2];
    }
  
    const XYZ = X+Y+Z;
    return {
      x: X / XYZ,
      y: Y / XYZ,
      z: Z / XYZ
    };
  }
  
  static xyzToLms(x, y, z) {
    return {
      l: 0.3897*x + 0.6890*y - 0.0787*z,
      m: -0.2298*x + 1.1834*y + 0.0464*z,
      s: z
    };
  }
  static lmsToXyz(l, m, s) {
    return {
      x: 1.9102*l - 1.1121*m + 0.2019*s,
      y: 0.3709*l + 0.6290*m + 0.0000*s,
      z: s
    };
  }
  static xyzToRgb(cs, xc, yc, zc) {
    let xr, yr, zr, xg, yg, zg, xb, yb, zb;
    let xw, yw, zw;
    let rx, ry, rz, gx, gy, gz, bx, by, bz;
    let rw, gw, bw;
  
    xr = cs.xRed;    yr = cs.yRed;    zr = 1 - (xr + yr);
    xg = cs.xGreen;  yg = cs.yGreen;  zg = 1 - (xg + yg);
    xb = cs.xBlue;   yb = cs.yBlue;   zb = 1 - (xb + yb);
  
    xw = cs.xWhite;  yw = cs.yWhite;  zw = 1 - (xw + yw);
  
    /* xyz . rgb matrix, before scaling to white. */
    
    rx = (yg * zb) - (yb * zg);  ry = (xb * zg) - (xg * zb);  rz = (xg * yb) - (xb * yg);
    gx = (yb * zr) - (yr * zb);  gy = (xr * zb) - (xb * zr);  gz = (xb * yr) - (xr * yb);
    bx = (yr * zg) - (yg * zr);  by = (xg * zr) - (xr * zg);  bz = (xr * yg) - (xg * yr);
  
    /* White scaling factors.
       Dividing by yw scales the white luminance to unity, as conventional. */
       
    rw = ((rx * xw) + (ry * yw) + (rz * zw)) / yw;
    gw = ((gx * xw) + (gy * yw) + (gz * zw)) / yw;
    bw = ((bx * xw) + (by * yw) + (bz * zw)) / yw;
  
    /* xyz => rgb matrix, correctly scaled to white. */
    
    rx = rx / rw;  ry = ry / rw;  rz = rz / rw;
    gx = gx / gw;  gy = gy / gw;  gz = gz / gw;
    bx = bx / bw;  by = by / bw;  bz = bz / bw;
  
    /* rgb of the desired point */
    return {
      r: (rx * xc) + (ry * yc) + (rz * zc),
      g: (gx * xc) + (gy * yc) + (gz * zc),
      b: (bx * xc) + (by * yc) + (bz * zc)
    };
  }
  
  static constrainRgb(r, g, b) {
    /* Amount of white needed is w = - min(0, *r, *g, *b) */
    let w = (0 < r) ? 0 : r;
    w = (w < g) ? w : g;
    w = (w < b) ? w : b;
    w = -w;
  
    /* Add just enough white to make r, g, b all positive. */
    if (w > 0) {
      return { r: r+w, g: g+w, b: b+w }; /* Colour modified to fit RGB gamut */
    }
    return { r: r, g: g, b: b };
  }
  static normalizeRgb(r, g, b) {
    let greatest = Math.max(r, Math.max(g, b));
    let rgb = {r: r, g: g, b: b};
  
    if (greatest > 0) {
      rgb.r /= greatest;
      rgb.g /= greatest;
      rgb.b /= greatest;
    }
  
    return rgb;
  }

  static generateSpectrum(t1, t2, N, colourSystem=CIEsystem) {
    let j = 0; let dj = 1;
  
    if (t1 < t2) {
      let t = t1;
      t1 = t2;
      t2 = t;
      j = N-1; dj = -1;
    }
  
    let Lw = 0, Mw = 0, Sw = 0;
    let result = new Array(N);
    for (let i = 0; i < N; i++) {
      let blackbodyTemp = t1 + (t2-t1)/N*i;
      let xyz = Spectrum.spectrumToXyz(Spectrum.bb_spectrum, blackbodyTemp);
      let lms = Spectrum.xyzToLms(xyz.x, xyz.y, xyz.z);
      if (i === 0) {
        Lw = 1/lms.l; Mw = 1/lms.m; Sw = 1/lms.s;
      }
      lms.l *= Lw; lms.m *= Mw; lms.s *= Sw;
      xyz = Spectrum.lmsToXyz(lms.l, lms.m, lms.s);
  
      // Convert to RGB
      let rgb = Spectrum.xyzToRgb(colourSystem, xyz.x, xyz.y, xyz.z);
      rgb = Spectrum.constrainRgb(rgb.r, rgb.g, rgb.b);
      rgb = Spectrum.normalizeRgb(rgb.r, rgb.g, rgb.b);
      
      result[j] = [rgb.r, rgb.g, rgb.b, (rgb.b>0.1)? rgb.b : 0];
      
      j += dj;
    }
    return result;
  } 



};
export default Spectrum;







