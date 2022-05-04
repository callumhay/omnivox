
import * as THREE from 'three';

import {TINYFONT_3x4_DEF} from '../tinyfonts';
import VoxelProtocol from '../VoxelProtocol';

import VoxelAnimator from './VoxelAnimator';

export const textAnimatorDefaultConfig = {
  colour: {r:1, g:1, b:1},
  text: "test",
  letterSpacing: 1,
};

class TextAnimator extends VoxelAnimator {
  constructor(voxelModel, config = textAnimatorDefaultConfig) {
    super(voxelModel, config);
    this.reset();
  }

  getType() { return VoxelAnimator.VOXEL_ANIM_TEXT; }

  setConfig(c) {
    super.setConfig(c);
    const {colour, text, letterSpacing} = c;
    //const {voxelServer} = this.voxelModel;

    if (!this.font) { this.font = new TinyFont(); }
    
    this.font.colour = new THREE.Color(colour.r, colour.g, colour.b);
    this.font.letterSpacing = letterSpacing;
    if (text !== this.text) {
      /*
      if (voxelServer) {
        voxelServer.sendViewerPacketStr(VoxelProtocol.buildSoundEventPacketStr(
          VoxelProtocol.SOUND_EVENT_PLAY_TYPE, "shot"
        ));
      }
      */
    }
    this.text = text;

    /*
    if (voxelServer) {
      voxelServer.sendViewerPacketStr(VoxelProtocol.buildSoundEventPacketStr(
        VoxelProtocol.SOUND_EVENT_LOAD_TYPE, "shot", "sounds/mmx_charged_shot.wav"
      ));
    }
    */

  }

  rendersToCPUOnly() { return true; }

  render(dt) {
    const {gridSize} = this.voxelModel;
    super.render(dt);

    if (!this.font) { return; }

    // Split the text up into the number of characters that will fit per line
    const maxCharsPerLine = gridSize / (this.font.fontDef.width+this.font.letterSpacing);
    const textLines = [];
    for (let i = 0; i < this.text.length; i+=maxCharsPerLine) {
      let currTextLine = "";
      for (let j = i; j < i+maxCharsPerLine && j < this.text.length; j++) {
        currTextLine += this.text[j];
      }
      textLines.push(currTextLine);
    }
    //console.log(textLines);

    let currY = gridSize-1-this.font.fontDef.height;
    for (let i = 0; i < textLines.length; i++) {
      this.font.setCursor(0,currY);
      this.font.print(textLines[i], this.voxelModel);
      currY -= (this.font.fontDef.height+1);
    }
  }

  reset() {}
}

export default TextAnimator;

class TinyFont {
  constructor(fontDef=TINYFONT_3x4_DEF) {
    this._cursorX = this._cursorY = this._baseX = 0;
    this.letterSpacing = 1;
    this.fontDef = fontDef;
    this.lineHeight = fontDef.height + 1;
    this.colour = new THREE.Color(1,1,1);
  }

  setCursor(x, y) {
    this._cursorX = this._baseX = x;
    this._cursorY = y;
  }

  print(str, voxelModel) {
    for (let i = 0; i < str.length; i++) {
      this._printChar(str[i], voxelModel);
    }
  }

  _printChar(c, voxelModel) {
    switch (c) {
      case '\n':
        this._cursorX = this._baseX;
        this._cursorY -= this.lineHeight;
        break;

      case '\t':
        this._cursorX += this.fontDef.width + 5;
        break;

      default:
        this._printCharAtPos(c, this._cursorX, this._cursorY, voxelModel);
        this._cursorX += this.fontDef.width + this.letterSpacing;
        break;
    }
  }

  _printCharAtPos(c, x, y, voxelModel) {
    const {gridSize} = voxelModel;

    // Don't draw if we're offscreen
    if (x + this.fontDef.width <= 0 || x > gridSize - 1 || y + this.fontDef.height <= 0 || y > gridSize - 1) { return; }

    const charCode = (""+c).charCodeAt(0);
    // Make sure the character is available in the font
    if (charCode < 32 || charCode > 127) { return; }

    const charFontIdx = charCode - 32;
    let finalY = y;

    // Lowercase letters have a different layout
    if (charFontIdx >= 65 && charFontIdx <= 90) { finalY--; }
    // Comma characters have a different layout
    if (charFontIdx === 12 || charFontIdx === 27) { finalY--; }

    const startIdx = Math.floor(charFontIdx/2)*this.fontDef.width;
    for (let i = 0; i < this.fontDef.width; i++) {
      let letterSprite = this.fontDef.sprites[startIdx + i];
      if (charCode % 2 === 0) {
        // Mask the upper sprite
        letterSprite &= 0x0F;
      }
      else {
        // Each odd character in the sprite array is shifted to get the correct character
        letterSprite >>= 4;
      }
      this._drawByteAtPos(x+i, finalY, letterSprite, voxelModel);
    }
  }

  _drawByteAtPos(x, y, pixels, voxelModel) {
    const {gridSize} = voxelModel;
    if (x < 0 || x > gridSize-1) { return; }

    // String of 4 bits representing the current column of on/off pixels
    const binPixels = ("0".repeat(this.fontDef.height) + pixels.toString(2)).slice(-this.fontDef.height);
    //console.log("Pixels: " + binPixels);
    const currPt = new THREE.Vector3(0,0,0);
    const black = new THREE.Color(0,0,0);
    for (let i = 0; i < binPixels.length; i++) {
      const currY = y+i;
      if (currY < 0 || currY > gridSize-1) { continue; }
      currPt.set(x, currY, 0);
      //console.log("Draw point at: " + currPt.x + "," + currPt.y + "," + currPt.z);
      voxelModel.setVoxel(currPt, binPixels[i] === "1" ? this.colour : black);
    }
  }
}