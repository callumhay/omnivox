import * as THREE from 'three';
import chroma from 'chroma-js';

import VTPBehaviour from "./VTPBehaviour";

import {Randomizer} from '../../../Randomizers';

export const RANDOM_COLOUR = "random";
export const MIX_COLOUR = "mix";

// NOTE: Possible optimization is to store all colours as a chroma.gl() colour array
export class VTPColourArraySpan {
  constructor(colours, isMix=false) {
    this._colours = Array.isArray(colours) ? colours : [colours];
    this._isMix = isMix;

    // Make sure the colours are all of type THREE.Color (if they aren't assigned as random)
    for (let i = 0; i < this._colours.length; i++) {
      const colour = this._colours[i];
      if (colour === RANDOM_COLOUR || colour instanceof THREE.Color) { continue; }
      if (colour.r !== undefined && colour.g !== undefined && colour.b !== undefined) {
        this._colours[i] = new THREE.Color(colour.r, colour.g, colour.b);
      }
      else {
        const glColour = chroma(colour).gl();
        this._colours[i] = new THREE.Color(glColour[0], glColour[1], glColour[2]);
      }
    }
  }

  getValue() {
    let colour = null;
    if (this._isMix) {
      const [firstColour, secondColour] = this._colours;
      const colourA = this._checkAndCreateRandom(firstColour);
      const colourB = this._checkAndCreateRandom(secondColour);
      const chromaA = chroma.gl(colourA.r, colourA.g, colourA.b, 1);
      const chromaB = chroma.gl(colourB.r, colourB.g, colourB.b, 1);
      const chromaMix = chroma.mix(chromaA, chromaB, Randomizer.getRandomFloat(0,1), 'lrgb').gl();
      colour = new THREE.Color(chromaMix[0], chromaMix[1], chromaMix[2]);
    }
    else {
      colour = this._colours[(this._colours.length * Math.random()) >> 0];
      colour = this._checkAndCreateRandom(colour);
    }

    return colour;
  }

  _checkAndCreateRandom(colour) {
    if (colour === RANDOM_COLOUR) {
      const randomColour = chroma(chroma.random()).gl();
      return new THREE.Color(randomColour[0], randomColour[1], randomColour[2]);
    }
    return colour;
  }

  static createColourArraySpan(colours) {
    if (!colours) { return null; }
    if (colours instanceof VTPColourArraySpan) { return colours; }
    if (Array.isArray(colours) && colours.length === 3 && colours[0] === MIX_COLOUR) {
      return new VTPColourArraySpan([colours[1], colours[2]], true);
    }
    return new VTPColourArraySpan(colours);
  }
}


// Methods of use
//
// 1. Colour list (colours will be choosen from the list for each particle):
// new VTPColour([colourStart0, colourStart1, ...], [colourEnd0, colourEnd1, ...])
//
// 2. Mixed colours (colours will be a random mix between the two given start and/or end colours):
// new VTPColour(['mix', colourStart0, colourStart1], ['mix', colourEnd0, colourEnd1])
//
// Note: any colour can be assigned "random" and it will be randomized
class VTPColour extends VTPBehaviour {
  constructor(startColours, endColours, life, easing) {
    super(life, easing);
    this.reset(startColours, endColours);
  }

  reset(startColours, endColours, life, easing) {
    life && super.reset(life, easing);

    this._same = (endColours === null || endColours === undefined);
    this.startColourSpan = VTPColourArraySpan.createColourArraySpan(startColours);
    this.endColourSpan = VTPColourArraySpan.createColourArraySpan(endColours);
  }

  initialize(particle) {
    particle.useColour = true;
    particle.transform.colourStart = this.startColourSpan.getValue();
    particle.transform.colourEnd   = this._same ? particle.transform.colourStart : this.endColourSpan.getValue();
  }

  applyBehaviour(particle, dt, index) {
    super.applyBehaviour(particle, dt, index);

    // Interpolate from the start to the end colour based on the energy and assign it to the particle's colour
    if (this._same) {
      particle.colour.copy(particle.transform.colourStart);
    }
    else {
      const {colourStart, colourEnd} = particle.transform;
      const glStartColour = chroma.gl(colourStart.r, colourStart.g, colourStart.b, 1);
      const glEndColour   = chroma.gl(colourEnd.r, colourEnd.g, colourEnd.b, 1);
      const glColourMix   = chroma.mix(glEndColour, glStartColour, this.energy, 'lrgb').gl(); // NOTE: energy goes from 1 to 0, so the mix is flipped
      particle.colour.setRGB(glColourMix[0], glColourMix[1], glColourMix[2]);
    }
  }
}

export default VTPColour;
