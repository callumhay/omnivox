import * as THREE from 'three';

class ColourRGBA extends THREE.Color {
  constructor(r=0, g=0, b=0, a=0) {
    super(r,g,b);
    this.a = a;
  }

  setRGBA(r,g,b,a) {
    super.setRGB(r,g,b);
    this.a = a;
    return this;
  }

  add(c) {
    super.add(c);
    this.a += (c.a !== undefined ? c.a : 0);
    return this;
  }

  clampRGBA(min=0, max=1) {
    this.r = THREE.MathUtils.clamp(this.r, min, max);
    this.g = THREE.MathUtils.clamp(this.g, min, max);
    this.b = THREE.MathUtils.clamp(this.b, min, max);
    this.a = THREE.MathUtils.clamp(this.a, min, max);
    return this;
  }

  equals(c) {
		return super.equals(c) && (c.a === this.a);
	}

  getTHREEColor(target) {
    target.setRGB(this.r, this.g, this.b);
  }

  copy(colour) {
    this.setRGBA(colour.r, colour.g, colour.b, colour.a !== undefined ? colour.a : this.a);
    return this;
  }

  clone() {
    return new ColourRGBA(this.r, this.g, this.b, (this.a !== undefined ? this.a : 1));
  }
  cloneTHREEColor() {
    return new THREE.Color(this.r, this.g, this.b)
  }
}

export default ColourRGBA;