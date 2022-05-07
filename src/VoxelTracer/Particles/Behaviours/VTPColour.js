import * as THREE from 'three';
import chroma from 'chroma-js';

import VTPBehaviour from "./VTPBehaviour";

import {Randomizer} from '../../../Randomizers';

export const RANDOM_COLOUR = "random";
export const MIX_COLOUR = "mix";

// NOTE: Possible optimization is to store all colours as a chroma-js objects
export class VTPColourArraySpan {
  constructor(colours=RANDOM_COLOUR, isMix=false) {
    this._colours = colours ? (Array.isArray(colours) ? colours : [colours]) : [RANDOM_COLOUR];
    this._isMix   = isMix;

    // Make sure the colours are all of type THREE.Color (if they aren't assigned as random)
    for (let i = 0; i < this._colours.length; i++) {
      const colour = this._colours[i];
      if (colour === RANDOM_COLOUR || colour instanceof THREE.Color) { continue; }
      if (colour.r !== undefined && colour.g !== undefined && colour.b !== undefined) {
        this._colours[i] = new THREE.Color(colour.r, colour.g, colour.b);
      }
      else {
        this._colours[i] = new THREE.Color(chroma(colour).hex());
      }
    }
  }

  getValue() {
    let colour = null;
    if (this._isMix) {
      const [firstColour, secondColour] = this._colours;
      const colourA = this._checkAndCreateRandom(firstColour);
      const colourB = this._checkAndCreateRandom(secondColour);
      colour = new THREE.Color(chroma.mix(colourA.getHex(), colourB.getHex(), Randomizer.getRandomFloat(0,1)).hex());
    }
    else {
      colour = this._colours[(this._colours.length * Math.random()) >> 0];
      colour = this._checkAndCreateRandom(colour);
    }
    return colour;
  }

  _checkAndCreateRandom(colour) {
    return (colour === RANDOM_COLOUR) ? new THREE.Color(chroma.random().hex()) : colour;
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
      // NOTE: energy goes from 1 to 0, so the mix is flipped
      particle.colour.set(chroma.mix(colourEnd.getHex(), colourStart.getHex(), this.energy).hex());
    }
  }
}

export default VTPColour;
