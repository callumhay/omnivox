import * as THREE from 'three';

export const convertInputToBoolean = (inputs, key, defaultValue = false) => {
  const result = defaultValue;

  const inputValues = inputs[key];
  if (inputValues && inputValues.length == 1) {
    const inputValue = inputValues[0];
    result = !!inputValue;
  }

  return result;
};

export const convertInputToVector3 = (inputs, key, defaultValue = new THREE.Vector3(0,0,0)) => {
  const result = defaultValue;
  
  const inputValues = inputs[key]; 
  if (inputValues && inputValues.length === 1) {
    const inputValue = inputValues[0];
    
    if (Array.isArray(inputValue)) {
      result.set(inputValue[0] || 0, inputValue[1] || 0, inputValue[2] || 0);
    }
    else if (typeof inputValue === 'number' || typeof inputValue === 'string') {
      const numVal = parseFloat(inputValue);
      result.set(numVal, numVal, numVal);
    }
    else {
      result.copy(inputValue);
    }
  }

  return result;
};

//export const convertInputToEulerXYZ

export const convertInputToColour = (inputs, key, defaultValue = new THREE.Color(1,1,1)) => {
  const result = defaultValue;

  const inputValues = inputs[key];
  if (inputValues && inputValues.length === 1) {
    const inputValue = inputValues[0];
    if (Array.isArray(inputValue)) {
      result.setRGB(
        THREE.MathUtils.clamp(inputValue[0] || 0, 0, 1), 
        THREE.MathUtils.clamp(inputValue[1] || 0, 0, 1),
        THREE.MathUtils.clamp(inputValue[2] || 0, 0, 1)
      );
    }
    else if (typeof inputValue === 'number' || typeof inputValue === 'string') {
      const numVal = THREE.MathUtils.clamp(parseFloat(inputValue), 0, 1);
      result.setRGB(numVal, numVal, numVal);
    }
    else {
      result.copy(inputValue);
    }
  }

  return result;
};

