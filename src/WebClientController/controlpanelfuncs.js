
export const CHANGE_EVENT = "change";
export const CLICK_EVENT  = "click";

export const colourToGui = (c) => {
  return {
    r: parseInt(c.r*255),
    g: parseInt(c.g*255),
    b: parseInt(c.b*255)
  };
};
export const guiColorToRGBObj = (c) => {
  return {
    r: parseFloat(c.r)/255.0, 
    g: parseFloat(c.g)/255.0, 
    b: parseFloat(c.b)/255.0
  };
};