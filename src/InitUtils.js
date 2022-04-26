class InitUtils {

  static initValue(value, defaults) {
    return (value !== null && value !== undefined) ? value : defaults;
  }

  static classApply(constructor, args = null) {
    if (!args) { return new constructor(); } 
    else {
      const factoryFunc = constructor.bind.apply(constructor, [null, ...args]);
      return new factoryFunc();
    }
  }
}

export default InitUtils;
