
import * as THREE from 'three';

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
    if (!this.font) { this.font = new TinyFont(); }
    
    this.font.colour = new THREE.Color(colour.r, colour.g, colour.b);
    this.font.letterSpacing = letterSpacing;
    this.text = text;
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

  reset() {
    super.reset();
  }

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


const TINYFONT_SPRITES_4x4 = [
  // #32 & #33 - Symbol ' ' (space) & Symbol '!'.
  0x00,  //  B00000000 → ! ░░░░   ░░░░
  0xB0,  //  B10110000 →   ▓░▓▓   ░░░░   
  0x00,  //  B00000000 →   ░░░░   ░░░░
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #34 & #35 - Symbol '"' & Symbol '#'.
  0xA1,  //  B10100001 → # ▓░▓░ " ░░░▓
  0x70,  //  B01110000 →   ░▓▓▓   ░░░░
  0xE1,  //  B11100001 →   ▓▓▓░   ░░░▓
  0x50,  //  B01010000 →   ░▓░▓   ░░░░

  // #36 & #37 - Symbol '$' & Symbol '%'.
  0x96,  //  B10010110 → % ▓░░▓ $ ░▓▓░
  0x4F,  //  B01001111 →   ░▓░░   ▓▓▓▓
  0x26,  //  B00100110 →   ░░▓░   ░▓▓░
  0x90,  //  B10010000 →   ▓░░▓   ░░░░

  // #38 & #39 - Symbol '&' & Symbol '''.
  0x0F,  //  B00001111 → ' ░░░░ & ▓▓▓▓
  0x1D,  //  B00011101 →   ░░░▓   ▓▓░▓
  0x07,  //  B00000111 →   ░░░░   ░▓▓▓
  0x0C,  //  B00001100 →   ░░░░   ▓▓░░

  // #40 & #41 - Symbol '(' & Symbol ')'.
  0x00,  //  B00000000 → ) ░░░░ ( ░░░░
  0x96,  //  B10010110 →   ▓░░▓   ░▓▓░
  0x69,  //  B01101001 →   ░▓▓░   ▓░░▓
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #42 & #43 - Symbol '*' & Symbol '+'.
  0x4A,  //  B01001010 → + ░▓░░ * ▓░▓░
  0xE4,  //  B11100100 →   ▓▓▓░   ░▓░░
  0x4A,  //  B01001010 →   ░▓░░   ▓░▓░
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #44 & #45 - Symbol ',' & Symbol '-'.
  0x48,  //  B01001000 → - ░▓░░ , ▓░░░
  0x44,  //  B01000100 →   ░▓░░   ░▓░░
  0x40,  //  B01000000 →   ░▓░░   ░░░░
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #46 & #47 - Symbol '.' & Symbol '/'.
  0x80,  //  B10000000 → / ▓░░░   ░░░░
  0x68,  //  B01101000 →   ░▓▓░   ▓░░░
  0x10,  //  B00010000 →   ░░░▓   ░░░░
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #48 & #49 - Number '0' & Number '1'.
  0x0F,  //  B00001111 → 1 ░░░░ 0 ▓▓▓▓
  0x99,  //  B10011001 →   ▓░░▓   ▓░░▓
  0xFB,  //  B11111011 →   ▓▓▓▓   ▓░▓▓
  0x8F,  //  B10001111 →   ▓░░░   ▓▓▓▓

  // #50 & #51 - Number '2' & Number '3'.
  0x9D,  //  B10011101 → 3 ▓░░▓ 2 ▓▓░▓
  0xBD,  //  B10111101 →   ▓░▓▓   ▓▓░▓
  0xBB,  //  B10111011 →   ▓░▓▓   ▓░▓▓
  0xFB,  //  B11111011 →   ▓▓▓▓   ▓░▓▓

  // #52 & #53 - Number '4' & Number '5'.
  0x77,  //  B01110111 → 5 ░▓▓▓ 4 ░▓▓▓
  0xD4,  //  B11010100 →   ▓▓░▓   ░▓░░
  0xD4,  //  B11010100 →   ▓▓░▓   ░▓░░
  0xDF,  //  B11011111 →   ▓▓░▓   ▓▓▓▓

  // #54 & #55 - Number '6' & Number '7'.
  0x1F,  //  B00011111 → 7 ░░░▓ 6 ▓▓▓▓
  0x1A,  //  B00011010 →   ░░░▓   ▓░▓░
  0x1A,  //  B00011010 →   ░░░▓   ▓░▓░
  0xFE,  //  B11111110 →   ▓▓▓▓   ▓▓▓░

  // #56 & #57 - Number '8' & Number '9'.
  0x7F,  //  B01111111 → 9 ░▓▓▓ 8 ▓▓▓▓
  0x5D,  //  B01011101 →   ░▓░▓   ▓▓░▓
  0x5D,  //  B01011101 →   ░▓░▓   ▓▓░▓
  0xFF,  //  B11111111 →   ▓▓▓▓   ▓▓▓▓

  // #58 & #59 - Symbol ':' & Symbol ';'.
  0x80,  //  B10000000 → ; ▓░░░ : ░░░░
  0x5A,  //  B01011010 →   ░▓░▓   ▓░▓░
  0x00,  //  B00000000 →   ░░░░   ░░░░
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #60 & #61 - Symbol '<' & Symbol '='.
  0xA0,  //  B10100000 → = ▓░▓░ < ░░░░
  0xA4,  //  B10100100 →   ▓░▓░   ░▓░░
  0xAA,  //  B10101010 →   ▓░▓░   ▓░▓░
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #62 & #63 - Symbol '>' & Symbol '?'.
  0x10,  //  B00010000 → ? ░░░▓ > ░░░░
  0xBA,  //  B10111010 →   ▓░▓▓   ▓░▓░
  0x34,  //  B00110100 →   ░░▓▓   ░▓░░
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #64 & #65 - Symbol '@' & Letter 'A'.
  0xFF,  //  B11111111 → A ▓▓▓▓ @ ▓▓▓▓
  0x59,  //  B01011001 →   ░▓░▓   ▓░░▓
  0x53,  //  B01010011 →   ░▓░▓   ░░▓▓
  0xF3,  //  B11110011 →   ▓▓▓▓   ░░▓▓

  // #66 & #67 - Letter 'B' & Letter 'C'.
  0xFF,  //  B11111111 → C ▓▓▓▓ B ▓▓▓▓
  0x9B,  //  B10011011 →   ▓░░▓   ▓░▓▓
  0x9B,  //  B10011011 →   ▓░░▓   ▓░▓▓
  0x9E,  //  B10011110 →   ▓░░▓   ▓▓▓░

  // #68 & #69 - Letter 'D' & Letter 'E'.
  0xFF,  //  B11111111 → E ▓▓▓▓ D ▓▓▓▓
  0xB9,  //  B10111001 →   ▓░▓▓   ▓░░▓
  0xB9,  //  B10111001 →   ▓░▓▓   ▓░░▓
  0x96,  //  B10010110 →   ▓░░▓   ░▓▓░

  // #70 & #71 - Letter 'F' & Letter 'G'.
  0xFF,  //  B11111111 → G ▓▓▓▓ F ▓▓▓▓
  0x95,  //  B10010101 →   ▓░░▓   ░▓░▓
  0x95,  //  B10010101 →   ▓░░▓   ░▓░▓
  0xD1,  //  B11010001 →   ▓▓░▓   ░░░▓

  // #72 & #73 - Letter 'H' & Letter 'I'.
  0x9F,  //  B10011111 → I ▓░░▓ H ▓▓▓▓
  0xF4,  //  B11110100 →   ▓▓▓▓   ░▓░░
  0x94,  //  B10010100 →   ▓░░▓   ░▓░░
  0x0F,  //  B00001111 →   ░░░░   ▓▓▓▓

  // #74 & #75 - Letter 'J' & Letter 'K'.
  0xFC,  //  B11111100 → K ▓▓▓▓ J ▓▓░░
  0x29,  //  B00101001 →   ░░▓░   ▓░░▓
  0x5F,  //  B01011111 →   ░▓░▓   ▓▓▓▓
  0x91,  //  B10010001 →   ▓░░▓   ░░░▓

  // #76 & #77 - Letter 'L' & Letter 'M'.
  0xFF,  //  B11111111 → M ▓▓▓▓ L ▓▓▓▓
  0x18,  //  B00011000 →   ░░░▓   ▓░░░
  0x38,  //  B00111000 →   ░░▓▓   ▓░░░
  0xF8,  //  B11111000 →   ▓▓▓▓   ▓░░░

  // #78 & #79 - Letter 'N' & Letter 'O'.
  0xFF,  //  B11111111 → O ▓▓▓▓ N ▓▓▓▓
  0x92,  //  B10010010 →   ▓░░▓   ░░▓░
  0x94,  //  B10010100 →   ▓░░▓   ░▓░░
  0xFF,  //  B11111111 →   ▓▓▓▓   ▓▓▓▓

  // #80 & #81 - Letter 'P' & Letter 'Q'.
  0xFF,  //  B11111111 → Q ▓▓▓▓ P ▓▓▓▓
  0x95,  //  B10010101 →   ▓░░▓   ░▓░▓
  0xD5,  //  B11010101 →   ▓▓░▓   ░▓░▓
  0xF7,  //  B11110111 →   ▓▓▓▓   ░▓▓▓

  // #82 & #83 - Letter 'R' & Letter 'S'.
  0xBF,  //  B10111111 → S ▓░▓▓ R ▓▓▓▓
  0xB5,  //  B10110101 →   ▓░▓▓   ░▓░▓
  0xDD,  //  B11011101 →   ▓▓░▓   ▓▓░▓
  0xD7,  //  B11010111 →   ▓▓░▓   ░▓▓▓

  // #84 & #85 - Letter 'T' & Letter 'U'.
  0xF1,  //  B11110001 → U ▓▓▓▓ T ░░░▓
  0x8F,  //  B10001111 →   ▓░░░   ▓▓▓▓
  0x81,  //  B10000001 →   ▓░░░   ░░░▓
  0xF1,  //  B11110001 →   ▓▓▓▓   ░░░▓

  // #86 & #87 - Letter 'V' & Letter 'W'.
  0xF7,  //  B11110111 → W ▓▓▓▓ V ░▓▓▓
  0x88,  //  B10001000 →   ▓░░░   ▓░░░
  0xC8,  //  B11001000 →   ▓▓░░   ▓░░░
  0xF7,  //  B11110111 →   ▓▓▓▓   ░▓▓▓

  // #88 & #89 - Letter 'X' & Letter 'Y'.
  0x79,  //  B01111001 → Y ░▓▓▓ X ▓░░▓
  0xC6,  //  B11000110 →   ▓▓░░   ░▓▓░
  0x46,  //  B01000110 →   ░▓░░   ░▓▓░
  0x79,  //  B01111001 →   ░▓▓▓   ▓░░▓

  // #90 & #91 - Letter 'Z' & Symbol '['.
  0x09,  //  B00001001 → [ ░░░░ Z ▓░░▓
  0xFD,  //  B11111101 →   ▓▓▓▓   ▓▓░▓
  0x9B,  //  B10011011 →   ▓░░▓   ▓░▓▓
  0x09,  //  B00001001 →   ░░░░   ▓░░▓

  // #92 & #93 - Symbol '\' & Symbol ']'.
  0x01,  //  B00000001 → ] ░░░░ \ ░░░▓
  0x96,  //  B10010110 →   ▓░░▓   ░▓▓░
  0xF8,  //  B11111000 →   ▓▓▓▓   ▓░░░
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #94 & #95 - Symbol '^' & Symbol '_'.
  0x82,  //  B10000010 → _ ▓░░░ ^ ░░▓░
  0x81,  //  B10000001 →   ▓░░░   ░░░▓
  0x82,  //  B10000010 →   ▓░░░   ░░▓░
  0x80,  //  B10000000 →   ▓░░░   ░░░░

  // #96 & #97 - Symbol '`' & Letter 'a'.
  0x50,  //  B01010000 → a ░▓░▓ ` ░░░░
  0x71,  //  B01110001 →   ░▓▓▓   ░░░▓
  0x62,  //  B01100010 →   ░▓▓░   ░░▓░
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #98 & #99 - Letter 'b' & Letter 'c'.
  0x77,  //  B01110111 → c ░▓▓▓ b ░▓▓▓
  0x56,  //  B01010110 →   ░▓░▓   ░▓▓░
  0x56,  //  B01010110 →   ░▓░▓   ░▓▓░
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #100 & #101 - Letter 'd' & Letter 'e'.
  0x76,  //  B01110110 → e ░▓▓▓ d ░▓▓░
  0x76,  //  B01110110 →   ░▓▓▓   ░▓▓░
  0x37,  //  B00110111 →   ░░▓▓   ░▓▓▓
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #102 & #103 - Letter 'f' & Letter 'g'.
  0xA2,  //  B10100010 → g ▓░▓░ f ░░▓░
  0xB7,  //  B10110111 →   ▓░▓▓   ░▓▓▓
  0x73,  //  B01110011 →   ░▓▓▓   ░░▓▓
  0x01,  //  B00000001 →   ░░░░   ░░░▓

  // #104 & #105 - Letter 'h' & Letter 'i'.
  0x07,  //  B00000111 → i ░░░░ h ░▓▓▓
  0x72,  //  B01110010 →   ░▓▓▓   ░░▓░
  0x06,  //  B00000110 →   ░░░░   ░▓▓░
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #106 & #107 - Letter 'j' & Letter 'k'.
  0x78,  //  B01111000 → k ░▓▓▓ j ▓░░░
  0x27,  //  B00100111 →   ░░▓░   ░▓▓▓
  0x50,  //  B01010000 →   ░▓░▓   ░░░░
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #108 & #109 - Letter 'l' & Letter 'm'.
  0x73,  //  B01110011 → m ░▓▓▓ l ░░▓▓
  0x34,  //  B00110100 →   ░░▓▓   ░▓░░
  0x74,  //  B01110100 →   ░▓▓▓   ░▓░░
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #110 & #111 - Letter 'n' & Letter 'o'.
  0x77,  //  B01110111 → o ░▓▓▓ n ░▓▓▓
  0x51,  //  B01010001 →   ░▓░▓   ░░░▓
  0x76,  //  B01110110 →   ░▓▓▓   ░▓▓░
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #112 & #113 - Letter 'p' & Letter 'q'.
  0x7F,  //  B01111111 → q ░▓▓▓ p ▓▓▓▓
  0x55,  //  B01010101 →   ░▓░▓   ░▓░▓
  0xF7,  //  B11110111 →   ▓▓▓▓   ░▓▓▓
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #114 & #115 - Letter 'r' & Letter 's'.
  0x47,  //  B01000111 → s ░▓░░ r ░▓▓▓
  0x71,  //  B01110001 →   ░▓▓▓   ░░░▓
  0x10,  //  B00010000 →   ░░░▓   ░░░░
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #116 & #117 - Letter 't' & Letter 'u'.
  0x32,  //  B00110010 → u ░░▓▓ t ░░▓░
  0x47,  //  B01000111 →   ░▓░░   ░▓▓▓
  0x72,  //  B01110010 →   ░▓▓▓   ░░▓░
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #118 & #119 - Letter 'v' & Letter 'w'.
  0x73,  //  B01110011 → w ░▓▓▓ v ░░▓▓
  0x64,  //  B01100100 →   ░▓▓░   ░▓░░
  0x73,  //  B01110011 →   ░▓▓▓   ░░▓▓
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #120 & #121 - Letter 'x' & Letter 'y'.
  0x15,  //  B00010101 → y ░░░▓ x ░▓░▓
  0xA2,  //  B10100010 →   ▓░▓░   ░░▓░
  0x75,  //  B01110101 →   ░▓▓▓   ░▓░▓
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #122 & #123 - Letter 'z' & Symbol '{'.
  0x61,  //  B01100001 → { ░▓▓░ z ░░░▓
  0x67,  //  B01100111 →   ░▓▓░   ░▓▓▓
  0x94,  //  B10010100 →   ▓░░▓   ░▓░░
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #124 & #125 - Symbol '|' & Symbol '}'.
  0x00,  //  B00000000 → } ░░░░ | ░░░░
  0x9F,  //  B10011111 →   ▓░░▓   ▓▓▓▓
  0x60,  //  B01100000 →   ░▓▓░   ░░░░
  0x60,  //  B01100000 →   ░▓▓░   ░░░░

  // #126 & #127 - Symbol '~' & Symbol '■'.
  0xF4,  //  B11110100 → ■ ▓▓▓▓ ~ ░▓░░
  0xF2,  //  B11110010 →   ▓▓▓▓   ░░▓░
  0xF6,  //  B11110110 →   ▓▓▓▓   ░▓▓░
  0xF2   //  B11110010 →   ▓▓▓▓   ░░▓░
];

const TINYFONT_SPRITES_3x4 = [
  // #32 & #33 - Symbol ' ' (space) & Symbol '!'.
  0x00,  //  B00000000 → ! ░░░░   ░░░░
  0xB0,  //  B10110000 →   ▓░▓▓   ░░░░   
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #34 & #35 - Symbol '"' & Symbol '#'.
  0xA1,  //  B10100001 → # ▓░▓░ " ░░░▓
  0x70,  //  B01110000 →   ░▓▓▓   ░░░░
  0x51,  //  B01010001 →   ░▓░▓   ░░░▓

  // #36 & #37 - Symbol '$' & Symbol '%'.
  0x96,  //  B10010110 → % ▓░░▓ $ ░▓▓░
  0x4F,  //  B01001111 →   ░▓░░   ▓▓▓▓
  0x96,  //  B10010110 →   ▓░░▓   ░▓▓░

  // #38 & #39 - Symbol '&' & Symbol '''.
  0x0F,  //  B00001111 → ' ░░░░ & ▓▓▓▓
  0x15,  //  B00010101 →   ░░░▓   ░▓░▓
  0x0E,  //  B00001110 →   ░░░░   ▓▓▓░

  // #40 & #41 - Symbol '(' & Symbol ')'.
  0x00,  //  B00000000 → ) ░░░░ ( ░░░░
  0x96,  //  B10010110 →   ▓░░▓   ░▓▓░
  0x69,  //  B01101001 →   ░▓▓░   ▓░░▓

  // #42 & #43 - Symbol '*' & Symbol '+'.
  0x4A,  //  B01001010 → + ░▓░░ * ▓░▓░
  0xE4,  //  B11100100 →   ▓▓▓░   ░▓░░
  0x4A,  //  B01001010 →   ░▓░░   ▓░▓░

  // #44 & #45 - Symbol ',' & Symbol '-'.
  0x48,  //  B01001000 → - ░▓░░ , ▓░░░
  0x44,  //  B01000100 →   ░▓░░   ░▓░░
  0x40,  //  B01000000 →   ░▓░░   ░░░░

  // #46 & #47 - Symbol '.' & Symbol '/'.
  0x80,  //  B10000000 → / ▓░░░ . ░░░░
  0x68,  //  B01101000 →   ░▓▓░   ▓░░░
  0x10,  //  B00010000 →   ░░░▓   ░░░░

  // #48 & #49 - Number '0' & Number '1'.
  0x9F,  //  B10011111 → 1 ▓░░▓ 0 ▓▓▓▓
  0xF9,  //  B11111001 →   ▓▓▓▓   ▓░░▓
  0x8F,  //  B10001111 →   ▓░░░   ▓▓▓▓

  // #50 & #51 - Number '2' & Number '3'.
  0x99,  //  B10011001 → 3 ▓░░▓ 2 ▓░░▓
  0xBD,  //  B10111101 →   ▓░▓▓   ▓▓░▓
  0xFB,  //  B11111011 →   ▓▓▓▓   ▓░▓▓

  // #52 & #53 - Number '4' & Number '5'.
  0xB7,  //  B10110111 → 5 ▓░▓▓ 4 ░▓▓▓
  0xB4,  //  B10110100 →   ▓░▓▓   ░▓░░
  0xDF,  //  B11011111 →   ▓▓░▓   ▓▓▓▓

  // #54 & #55 - Number '6' & Number '7'.
  0x1F,  //  B00011111 → 7 ░░░▓ 6 ▓▓▓▓
  0x1A,  //  B00011010 →   ░░░▓   ▓░▓░
  0xFE,  //  B11111110 →   ▓▓▓▓   ▓▓▓░

  // #56 & #57 - Number '8' & Number '9'.
  0x7F,  //  B01111111 → 9 ░▓▓▓ 8 ▓▓▓▓
  0x5D,  //  B01011101 →   ░▓░▓   ▓▓░▓
  0xFF,  //  B11111111 →   ▓▓▓▓   ▓▓▓▓

  // #58 & #59 - Symbol ':' & Symbol ';'.
  0x80,  //  B10000000 → ; ▓░░░ : ░░░░
  0x5A,  //  B01011010 →   ░▓░▓   ▓░▓░
  0x00,  //  B00000000 →   ░░░░   ░░░░

  // #60 & #61 - Symbol '<' & Symbol '='.
  0xA0,  //  B10100000 → = ▓░▓░ < ░░░░
  0xA4,  //  B10100100 →   ▓░▓░   ░▓░░
  0xAA,  //  B10101010 →   ▓░▓░   ▓░▓░

  // #62 & #63 - Symbol '>' & Symbol '?'.
  0x10,  //  B00010000 → ? ░░░▓ > ░░░░
  0xBA,  //  B10111010 →   ▓░▓▓   ▓░▓░
  0x34,  //  B00110100 →   ░░▓▓   ░▓░░

  // #64 & #65 - Symbol '@' & Letter 'A'.
  0xFF,  //  B11111111 → A ▓▓▓▓ @ ▓▓▓▓
  0x59,  //  B01011001 →   ░▓░▓   ▓░░▓
  0xF3,  //  B11110011 →   ▓▓▓▓   ░░▓▓

  // #66 & #67 - Letter 'B' & Letter 'C'.
  0xFF,  //  B11111111 → C ▓▓▓▓ B ▓▓▓▓
  0x9B,  //  B10011011 →   ▓░░▓   ▓░▓▓
  0x9E,  //  B10011110 →   ▓░░▓   ▓▓▓░

  // #68 & #69 - Letter 'D' & Letter 'E'.
  0xFF,  //  B11111111 → E ▓▓▓▓ D ▓▓▓▓
  0xB9,  //  B10111001 →   ▓░▓▓   ▓░░▓
  0x96,  //  B10010110 →   ▓░░▓   ░▓▓░

  // #70 & #71 - Letter 'F' & Letter 'G'.
  0xFF,  //  B11111111 → G ▓▓▓▓ F ▓▓▓▓
  0x95,  //  B10010101 →   ▓░░▓   ░▓░▓
  0xD1,  //  B11010001 →   ▓▓░▓   ░░░▓

  // #72 & #73 - Letter 'H' & Letter 'I'.
  0x9F,  //  B10011111 → I ▓░░▓ H ▓▓▓▓
  0xF4,  //  B11110100 →   ▓▓▓▓   ░▓░░
  0x9F,  //  B10011111 →   ▓░░▓   ▓▓▓▓

  // #74 & #75 - Letter 'J' & Letter 'K'.
  0xF9,  //  B11111001 → K ▓▓▓▓ J ▓░░▓
  0x6F,  //  B01101111 →   ░▓▓░   ▓▓▓▓
  0x91,  //  B10010001 →   ▓░░▓   ░░░▓

  // #76 & #77 - Letter 'L' & Letter 'M'.
  0xFF,  //  B11111111 → M ▓▓▓▓ L ▓▓▓▓
  0x38,  //  B00111000 →   ░░▓▓   ▓░░░
  0xF8,  //  B11111000 →   ▓▓▓▓   ▓░░░

  // #78 & #79 - Letter 'N' & Letter 'O'.
  0xFF,  //  B11111111 → O ▓▓▓▓ N ▓▓▓▓
  0x96,  //  B10010110 →   ▓░░▓   ░▓▓░
  0xFF,  //  B11111111 →   ▓▓▓▓   ▓▓▓▓

  // #80 & #81 - Letter 'P' & Letter 'Q'.
  0x7F,  //  B01111111 → Q ░▓▓▓ P ▓▓▓▓
  0x55,  //  B01010101 →   ░▓░▓   ░▓░▓
  0xF7,  //  B11110111 →   ▓▓▓▓   ░▓▓▓

  // #82 & #83 - Letter 'R' & Letter 'S'.
  0xBF,  //  B10111111 → S ▓░▓▓ R ▓▓▓▓
  0xF5,  //  B11110101 →   ▓▓▓▓   ░▓░▓
  0xDB,  //  B11011011 →   ▓▓░▓   ▓░▓▓

  // #84 & #85 - Letter 'T' & Letter 'U'.
  0xF1,  //  B11110001 → U ▓▓▓▓ T ░░░▓
  0x8F,  //  B10001111 →   ▓░░░   ▓▓▓▓
  0xF1,  //  B11110001 →   ▓▓▓▓   ░░░▓

  // #86 & #87 - Letter 'V' & Letter 'W'.
  0xF7,  //  B11110111 → W ▓▓▓▓ V ░▓▓▓
  0xC8,  //  B11001000 →   ▓▓░░   ▓░░░
  0xF7,  //  B11110111 →   ▓▓▓▓   ░▓▓▓

  // #88 & #89 - Letter 'X' & Letter 'Y'.
  0x39,  //  B00111001 → Y ░░▓▓ X ▓░░▓
  0xE6,  //  B11100110 →   ▓▓▓░   ░▓▓░
  0x39,  //  B01111001 →   ░░▓▓   ▓░░▓

  // #90 & #91 - Letter 'Z' & Symbol '['.
  0x0D,  //  B00001101 → [ ░░░░ Z ▓▓░▓
  0xFB,  //  B11111011 →   ▓▓▓▓   ▓░▓▓
  0x99,  //  B10011001 →   ▓░░▓   ▓░░▓

  // #92 & #93 - Symbol '\' & Symbol ']'.
  0x01,  //  B00000001 → ] ░░░░ \ ░░░▓
  0x96,  //  B10010110 →   ▓░░▓   ░▓▓░
  0xF8,  //  B11111000 →   ▓▓▓▓   ▓░░░

  // #94 & #95 - Symbol '^' & Symbol '_'.
  0x82,  //  B10000010 → _ ▓░░░ ^ ░░▓░
  0x81,  //  B10000001 →   ▓░░░   ░░░▓
  0x82,  //  B10000010 →   ▓░░░   ░░▓░

  // #96 & #97 - Symbol '`' & Letter 'a'.
  0x50,  //  B01010000 → a ░▓░▓ ` ░░░░
  0x71,  //  B01110001 →   ░▓▓▓   ░░░▓
  0x62,  //  B01100010 →   ░▓▓░   ░░▓░

  // #98 & #99 - Letter 'b' & Letter 'c'.
  0x77,  //  B01110111 → c ░▓▓▓ b ░▓▓▓
  0x56,  //  B01010110 →   ░▓░▓   ░▓▓░
  0x56,  //  B01010110 →   ░▓░▓   ░▓▓░

  // #100 & #101 - Letter 'd' & Letter 'e'.
  0x76,  //  B01110110 → e ░▓▓▓ d ░▓▓░
  0x76,  //  B01110110 →   ░▓▓▓   ░▓▓░
  0x37,  //  B00110111 →   ░░▓▓   ░▓▓▓

  // #102 & #103 - Letter 'f' & Letter 'g'.
  0xA2,  //  B10100010 → g ▓░▓░ f ░░▓░
  0xB7,  //  B10110111 →   ▓░▓▓   ░▓▓▓
  0x73,  //  B01110011 →   ░▓▓▓   ░░▓▓

  // #104 & #105 - Letter 'h' & Letter 'i'.
  0x07,  //  B00000111 → i ░░░░ h ░▓▓▓
  0x72,  //  B01110010 →   ░▓▓▓   ░░▓░
  0x06,  //  B00000110 →   ░░░░   ░▓▓░

  // #106 & #107 - Letter 'j' & Letter 'k'.
  0x78,  //  B01111000 → k ░▓▓▓ j ▓░░░
  0x27,  //  B00100111 →   ░░▓░   ░▓▓▓
  0x50,  //  B01010000 →   ░▓░▓   ░░░░

  // #108 & #109 - Letter 'l' & Letter 'm'.
  0x73,  //  B01110011 → m ░▓▓▓ l ░░▓▓
  0x34,  //  B00110100 →   ░░▓▓   ░▓░░
  0x74,  //  B01110100 →   ░▓▓▓   ░▓░░

  // #110 & #111 - Letter 'n' & Letter 'o'.
  0x77,  //  B01110111 → o ░▓▓▓ n ░▓▓▓
  0x51,  //  B01010001 →   ░▓░▓   ░░░▓
  0x76,  //  B01110110 →   ░▓▓▓   ░▓▓░

  // #112 & #113 - Letter 'p' & Letter 'q'.
  0x7F,  //  B01111111 → q ░▓▓▓ p ▓▓▓▓
  0x55,  //  B01010101 →   ░▓░▓   ░▓░▓
  0xF7,  //  B11110111 →   ▓▓▓▓   ░▓▓▓

  // #114 & #115 - Letter 'r' & Letter 's'.
  0x47,  //  B01000111 → s ░▓░░ r ░▓▓▓
  0x71,  //  B01110001 →   ░▓▓▓   ░░░▓
  0x10,  //  B00010000 →   ░░░▓   ░░░░

  // #116 & #117 - Letter 't' & Letter 'u'.
  0x32,  //  B00110010 → u ░░▓▓ t ░░▓░
  0x47,  //  B01000111 →   ░▓░░   ░▓▓▓
  0x72,  //  B01110010 →   ░▓▓▓   ░░▓░

  // #118 & #119 - Letter 'v' & Letter 'w'.
  0x73,  //  B01110011 → w ░▓▓▓ v ░░▓▓
  0x64,  //  B01100100 →   ░▓▓░   ░▓░░
  0x73,  //  B01110011 →   ░▓▓▓   ░░▓▓

  // #120 & #121 - Letter 'x' & Letter 'y'.
  0x15,  //  B00010101 → y ░░░▓ x ░▓░▓
  0xA2,  //  B10100010 →   ▓░▓░   ░░▓░
  0x75,  //  B01110101 →   ░▓▓▓   ░▓░▓

  // #122 & #123 - Letter 'z' & Symbol '{'.
  0x61,  //  B01100001 → { ░▓▓░ z ░░░▓
  0x67,  //  B01100111 →   ░▓▓░   ░▓▓▓
  0x94,  //  B10010100 →   ▓░░▓   ░▓░░

  // #124 & #125 - Symbol '|' & Symbol '}'.
  0x00,  //  B00000000 → } ░░░░ | ░░░░
  0x9F,  //  B10011111 →   ▓░░▓   ▓▓▓▓
  0x60,  //  B01100000 →   ░▓▓░   ░░░░

  // #126 & #127 - Symbol '~' & Symbol '■'.
  0xF4,  //  B11110100 → ■ ▓▓▓▓ ~ ░▓░░
  0xF2,  //  B11110010 →   ▓▓▓▓   ░░▓░
  0xF6,  //  B11110110 →   ▓▓▓▓   ░▓▓░
];

// Font definitions
const TINYFONT_4x4_DEF = {
  sprites: TINYFONT_SPRITES_4x4,
  width: 4,
  height: 4,
};
const TINYFONT_3x4_DEF = {
  sprites: TINYFONT_SPRITES_3x4,
  width: 3,
  height: 4,
};