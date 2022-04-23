import {Howl} from 'howler';

class SoundPlayer {
  constructor() {
    this.sounds = {};
  }

  preloadSound(soundEvent) {
    const {soundSrc, soundName} = soundEvent;
    const src = Array.isArray(soundSrc) ? soundSrc : [soundSrc];
    const sound = new Howl({src});

    if (!sound) {
      console.error(`Failed to load sound ${soundName} from file ${soundSrc}.`);
      return null;
    }

    this.sounds[soundName] = sound;
    return sound;
  }
  unloadSound(soundEvent) {
    delete this.sounds[soundEvent.soundSrc];
  }

  playSound(soundEvent) {
    const {soundName} = soundEvent;
    let sound = this.sounds[soundName];
    if (sound) { sound.play(); }
    else {
      console.log(`Attempting to play sound ${soundName}, but sound has not been loaded, attempting to load now.`);
      sound = this.preloadSound(soundEvent);
      if (sound) { sound.play(); }
    }
  }
  stopSound(soundEvent) {
    const {soundName} = soundEvent;
    const sound = this.sounds[soundName];
    if (sound) { sound.stop(); }
  }

}

export default SoundPlayer;
