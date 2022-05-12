const STUPID_EASING_CONSTANT = 1.70158;

const EASE_FUNC_NAMES = [
  "easeLinear",
  "easeInQuad", "easeOutQuad", "easeInOutQuad",
  "easeInCubic", "easeOutCubic", "easeInOutCubic",
  "easeInQuart", "easeOutQuart", "easeInOutQuart",
  "easeInSine", "easeOutSine", "easeInOutSine",
  "easeInExpo", "easeOutExpo", "easeInOutExpo",
  "easeInCirc", "easeOutCirc", "easeInOutCirc",
  "easeInBack", "easeOutBack", "easeInOutBack"
];

class VTPEase {

  static get EASE_FUNC_NAMES() { return EASE_FUNC_NAMES; }

  static easeLinear(value) { return value; }

  static easeInQuad(value) { return Math.pow(value, 2); }
  static easeOutQuad(value) { return -(Math.pow((value - 1), 2) - 1); }
  static easeInOutQuad(value) {
    if ((value /= 0.5) < 1) { return 0.5 * Math.pow(value, 2); }
    return -0.5 * ((value -= 2) * value - 2);
  }

  static easeInCubic(value) { return Math.pow(value, 3); }
  static easeOutCubic(value) { return (Math.pow((value - 1), 3) + 1); }
  static easeInOutCubic(value) {
    if ((value /= 0.5) < 1) { return 0.5 * Math.pow(value, 3); }
    return 0.5 * (Math.pow((value - 2), 3) + 2);
  }

  static easeInQuart(value) { return Math.pow(value, 4); }
  static easeOutQuart(value) { return -(Math.pow((value - 1), 4) - 1); }
  static easeInOutQuart(value) {
      if ((value /= 0.5) < 1) { return 0.5 * Math.pow(value, 4); }
      return -0.5 * ((value -= 2) * Math.pow(value, 3) - 2);
  }

  static easeInSine(value) { return -Math.cos(value * (Math.PI / 2)) + 1; }
  static easeOutSine(value) { return Math.sin(value * (Math.PI / 2)); }
  static easeInOutSine(value) { return (-0.5 * (Math.cos(Math.PI * value) - 1)); }

  static easeInExpo(value) { return (value === 0) ? 0 : Math.pow(2, 10 * (value - 1)); }
  static easeOutExpo(value) { return (value === 1) ? 1 : -Math.pow(2, -10 * value) + 1; }
  static easeInOutExpo(value) {
    if (value === 0) { return 0; }
    if (value === 1) { return 1; }
    if ((value /= 0.5) < 1) { return 0.5 * Math.pow(2, 10 * (value - 1)); }
    return 0.5 * (-Math.pow(2, -10 * --value) + 2);
  }

  static easeInCirc(value) { return -(Math.sqrt(1 - (value * value)) - 1); }
  static easeOutCirc(value) { return Math.sqrt(1 - Math.pow((value - 1), 2)); }
  static easeInOutCirc(value) {
    if ((value /= 0.5) < 1) { return -0.5 * (Math.sqrt(1 - value * value) - 1); }
    return 0.5 * (Math.sqrt(1 - (value -= 2) * value) + 1);
  }

  static easeInBack(value) { return (value) * value * ((STUPID_EASING_CONSTANT + 1) * value - STUPID_EASING_CONSTANT); }
  static easeOutBack(value) { return (value = value - 1) * value * ((STUPID_EASING_CONSTANT + 1) * value + STUPID_EASING_CONSTANT) + 1; }
  static easeInOutBack(value) {
    let s = STUPID_EASING_CONSTANT;
    if ((value /= 0.5) < 1) { return 0.5 * (value * value * (((s *= (1.525)) + 1) * value - s)); }
    return 0.5 * ((value -= 2) * value * (((s *= (1.525)) + 1) * value + s) + 2);
  }
}

export default VTPEase;