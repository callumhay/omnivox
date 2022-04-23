import * as THREE from 'three';

class ColourRGBA extends THREE.Color {
  constructor(r, g, b) {
    super(r,g,b);
    this.a = 1;
  }

  setRGBA(r,g,b,a) {
    super.setRGB(r,g,b);
    this.a = a;
    return this;
  }

  equals(c) {
		return super.equals(c) && (c.a === this.a);
	}

  getTHREEColor(target) {
    target.setRGB(this.r, this.g, this.b);
  }

  copy(colour) {
    if (colour instanceof THREE.Color) {
      super.copy(threeColour);
    }
    else {
      this.setRGBA(colour.r, colour.g, colour.b, colour.a);
    }
    return this;
  }

  clone(colour) {
    return new ColourRGBA(colour.r, colour.g, colour.b, (colour.a !== undefined ? colour.a : 1));
  }
}

export default ColourRGBA;