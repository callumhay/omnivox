import meyda from 'meyda';
import * as THREE from 'three';

export const DEFAULT_NUM_FFT_SAMPLES = 16;
export const DEFAULT_FFT_BUFFER_SIZE = 2048;

class SoundController {
  constructor() {

    if (window.hasOwnProperty('webkitAudioContext') && !window.hasOwnProperty('AudioContext')) {
      window.AudioContext = webkitAudioContext;
    }

    if (navigator.hasOwnProperty('webkitGetUserMedia') && !navigator.hasOwnProperty('getUserMedia')) {
      navigator.getUserMedia = webkitGetUserMedia;
      if (!AudioContext.prototype.hasOwnProperty('createScriptProcessor')) {
        AudioContext.prototype.createScriptProcessor = AudioContext.prototype.createJavaScriptNode;
      }
    }

    this.enabled = false;
    this.numFFTSamples = DEFAULT_NUM_FFT_SAMPLES;
    this.fftBufferSize = DEFAULT_FFT_BUFFER_SIZE;

    // Debug renderer variables
    this.showDebug = false;

    const width = window.innerWidth;
    const height = window.innerHeight;

    this._soundDebugScene  = new THREE.Scene();
    this._soundDebugCamera = new THREE.PerspectiveCamera(75, width/height, 0.1, 1000);
    this._soundDebugSceneOrtho  = new THREE.Scene();
    this._soundDebugCameraOrtho = new THREE.OrthographicCamera(-width/2, width/2, height/2, -height/2, 1, 10);
    this._soundDebugScene.position.set(0,0,0);
    this._soundDebugCamera.position.set(0,0,10);

    this._renderTarget = new THREE.WebGLRenderTarget(width, height, {minFilter: THREE.LinearMipMapLinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat});
    let spriteMaterial = new THREE.SpriteMaterial({map:this._renderTarget.texture, blending:THREE.AdditiveBlending});
    this._renderTargetSprite = new THREE.Sprite(spriteMaterial)
    this._soundDebugSceneOrtho.add(this._renderTargetSprite);
    this._updateSprite();

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
  _initRenderFFTs() {
    if (this._lines) {
      this._soundDebugScene.remove(this._lines);
    }

    this._lines = new THREE.Group();
    let material = new THREE.LineBasicMaterial({color:0x00ff00});
    for (let i = 0; i < this.ffts.length; i++) {
      let geometry = new THREE.BufferGeometry();
      let positions = new Float32Array(this.ffts[i].length * 3);

      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setDrawRange(0, this.ffts[i].length);

      let line = new THREE.Line(geometry, material);
      this._lines.add(line);

      positions = line.geometry.attributes.position.array;
    }

    this._soundDebugScene.add(this._lines);

    /*
    let bufferLineGeometry = new THREE.BufferGeometry();
    this._bufferLine = new THREE.Line(bufferLineGeometry, material);
    {
      let positions = new Float32Array(this.fftBufferSize * 3);
      bufferLineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      bufferLineGeometry.setDrawRange(0, this.fftBufferSize);
      positions = this._bufferLine.geometry.attributes.position.array;
    }
    */
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

  sample(voxelClient) {
    if (!this.enabled) {
      return;
    }

    this.features = this._getAudioFeatures([
      'amplitudeSpectrum',
      'spectralCentroid',
      'spectralRolloff',
      //'loudness',
      'rms',
      //'mfcc'
    ]);

    if (!this.features) {
      return;
    }

    this.ffts.pop();
    this.ffts.unshift(this.features.amplitudeSpectrum);

    // Send the most recent FFT and feature info to the server
    voxelClient.sendAudioInfo({
      fft: this.ffts[0],
      rms: this.features.rms,
      spectralRolloff: this.features.spectralRolloff,
      spectralCentroid: this.features.spectralCentroid,
    });
  }

  _updateFFTDebugGeometry() {
    for (let i = 0; i < this.ffts.length; i++) {
      const positions = this._lines.children[i].geometry.attributes.position.array;
      let index = 0;

      for (var j = 0; j < this.ffts[i].length+1; j++) {
        positions[index++] = 11.7 + (8 * Math.log10(j/this.ffts[i].length));
        positions[index++] = -6.5 + 0.1 * this.ffts[i][j];
        positions[index++] = -1 - i;
      }

      this._lines.children[i].geometry.attributes.position.needsUpdate = true;
    }
  }

  _updateSprite() {
    const width  = window.innerWidth;
    const height = window.innerHeight;
    const halfWidth = width/2;
    const halfHeight = height/2;
    const spriteWidth  = width/2;
    const spriteHeight = height/2;

    this._renderTargetSprite.scale.set(spriteWidth, spriteHeight, 1);
    this._renderTargetSprite.position.set(-halfWidth+spriteWidth/2, -halfHeight+spriteHeight/2, -1);
  }
  
  render(renderer) {
    if (!this.showDebug || !this.enabled) {
      return;
    }
    this._updateFFTDebugGeometry();

    // Render the Sound data to a render target (texture)
    renderer.setRenderTarget(this._renderTarget);
    renderer.clear();
    renderer.render(this._soundDebugScene, this._soundDebugCamera);
    renderer.setRenderTarget(null);

    // Render the texture onto the screen
    renderer.render(this._soundDebugSceneOrtho, this._soundDebugCameraOrtho);
  }

  windowResize(originalTanFOV, originalWindowHeight) {
    const width  = window.innerWidth;
    const height = window.innerHeight;

    this._soundDebugCamera.aspect = width / height;
    this._soundDebugCamera.fov = (360 / Math.PI) * Math.atan(originalTanFOV * (height / originalWindowHeight));
    this._soundDebugCamera.updateProjectionMatrix();
    this._soundDebugCamera.lookAt(this._soundDebugScene.position);

    this._soundDebugCameraOrtho.left = -width/2;
    this._soundDebugCameraOrtho.right = width/2;
    this._soundDebugCameraOrtho.top = height/2;
    this._soundDebugCameraOrtho.bottom = -height/2;
    this._soundDebugCameraOrtho.updateProjectionMatrix();

    this._updateSprite();
  }
}

export default SoundController;