import meyda from 'meyda';
import * as THREE from 'three';

export const DEFAULT_NUM_FFT_SAMPLES = 1;
export const DEFAULT_FFT_BUFFER_SIZE = 2048;

class SoundManager {
  constructor(renderer) {
    if (window.hasOwnProperty('webkitAudioContext') && !window.hasOwnProperty('AudioContext')) {
      window.AudioContext = webkitAudioContext;
    }

    if (navigator.hasOwnProperty('webkitGetUserMedia') && !navigator.hasOwnProperty('getUserMedia')) {
      navigator.getUserMedia = webkitGetUserMedia;
      if (!AudioContext.prototype.hasOwnProperty('createScriptProcessor')) {
        AudioContext.prototype.createScriptProcessor = AudioContext.prototype.createJavaScriptNode;
      }
    }

    // Setup audio visualization variables
    this.renderer = renderer;

    const renderSize = new THREE.Vector2();
    renderer.getSize(renderSize);
    const width = renderSize.x; 
    const height = renderSize.y;

    this._soundDebugScene  = new THREE.Scene();
    this._soundDebugCamera = new THREE.PerspectiveCamera(75, width/height, 0.1, 1000);
    this._soundDebugScene.position.set(0,0,0);
    this._soundDebugCamera.position.set(0,-1,8);

    // Build the sampler
    this.numFFTSamples = DEFAULT_NUM_FFT_SAMPLES;
    this.fftBufferSize = DEFAULT_FFT_BUFFER_SIZE;
    this.context = new AudioContext();
    this._initializeMicrophoneSampling();
    this._initializeFFTs(); // NOTE: The number of FFTs must be a multiple of 8 for the visualizer to work properly!!!
  }

  _initializeFFTs() {
    this.ffts = [];
    for (let i = 0; i < this.numFFTSamples; i++) {
      this.ffts.push(new Array(this.fftBufferSize));
    }
    this._initRenderFFTs();
  }

  _initializeMicrophoneSampling() {
    const errorCallback = function (err) {
      console.error("Failed to initialize microphone: " + err);
    };

    const self = this;

    try {
      navigator.getUserMedia = navigator.webkitGetUserMedia || navigator.getUserMedia || navigator.mediaDevices.getUserMedia;
      const constraints = { video: false, audio: true };

      const successCallback = function (mediaStream) {
        console.log('User allowed microphone access.');
        console.log('Initializing AudioNode from MediaStream');

        const source = self.context.createMediaStreamSource(mediaStream);

        console.log('Setting Meyda Source to Microphone');
        self.meyda = meyda.createMeydaAnalyzer({
          audioContext: self.context,
          source: source,
          bufferSize: self.fftBufferSize,
          windowingFunction: 'hanning',
        });
        console.groupEnd();
      };

      console.log('Asking for permission...');
      const getUserMediaPromise = navigator.getUserMedia(
        constraints,
        successCallback,
        errorCallback
      );
      if (getUserMediaPromise) {
        p.then(successCallback);
        p.catch(errorCallback);
      }
    }
    catch (e) {
      errorCallback();
    }
  }

  _getAudioFeatures(features) {
    this.context.resume();
    return this.meyda ? this.meyda.get(features) : null;
  }

  setFFTNumSamples(num) {
    this.numFFTSamples = num;
    this._initializeFFTs();
  }

  sample(client) {
    this.features = this._getAudioFeatures([
      'amplitudeSpectrum',
      'spectralCentroid',
      'spectralRolloff',
      //'loudness',
      'rms',
      'zcr',
      //'mfcc',
      'chroma',
    ]);

    if (!this.features) {
      return;
    }

    this.ffts.pop();
    this.ffts.unshift(this.features.amplitudeSpectrum);

    // Send the most recent FFT and feature info to the server
    client.sendAudioInfo({
      fft: this.ffts[0],
      rms: this.features.rms,
      zcr: this.features.zcr,
      spectralRolloff: this.features.spectralRolloff,
      spectralCentroid: this.features.spectralCentroid,
      //mfcc: this.features.mfcc,
    });
  }

  _initializeFFTs() {
    this.ffts = [];
    for (let i = 0; i < this.numFFTSamples; i++) {
      this.ffts.push(new Array(this.fftBufferSize));
    }
    this._initRenderFFTs();
  }
  
  _initRenderFFTs() {
    if (this._lines) {
      this._soundDebugScene.remove(this._lines);
    }

    this._lines = new THREE.Group();
    const material = new THREE.LineBasicMaterial({color:0x00ff00});

    for (let i = 0; i < this.ffts.length; i++) {
      if (this.ffts[i]) {
        let geometry = new THREE.BufferGeometry();
        let positions = new Float32Array(this.ffts[i].length * 3);

        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setDrawRange(0, this.ffts[i].length);
        geometry.computeBoundingSphere();

        const line = new THREE.Line(geometry, material);
        this._lines.add(line);

        positions = line.geometry.attributes.position.array;
      }
    }

    this._soundDebugScene.add(this._lines);
  }
  _updateFFTDebugGeometry() {
    for (let i = 0; i < this.ffts.length; i++) {
      const positions = this._lines.children[i].geometry.attributes.position.array;
      let index = 0;

      for (var j = 0; j < this.ffts[i].length+1; j++) {
        positions[index++] = 12 + (8 * Math.log10(j/this.ffts[i].length));
        positions[index++] = -6.5 + 0.1 * this.ffts[i][j];
        positions[index++] = -1 - i;
      }

      this._lines.children[i].geometry.attributes.position.needsUpdate = true;
    }
  }

  render() {
    this._updateFFTDebugGeometry();
    this.renderer.clear();
    this.renderer.render(this._soundDebugScene, this._soundDebugCamera);
  }

}

export default SoundManager;