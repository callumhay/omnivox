
import * as THREE from 'three';

class SoundController {
  constructor() {
    this.listener = new THREE.AudioListener();
    this.audio = new THREE.Audio(this.listener);

    this._mediaElement = new Audio('sounds/Yeasayer - I Remember.mp3');
    this._mediaElement.loop = true;
    this._mediaElement.pause();

    this.audio.setMediaElementSource(this._mediaElement);
  }

  play() {
    this._mediaElement.play();
  }
  pause() {
    this._mediaElement.pause();
  }


}

export default SoundController;