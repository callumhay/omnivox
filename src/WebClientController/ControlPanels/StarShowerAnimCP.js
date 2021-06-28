import VoxelAnimator from '../../Animation/VoxelAnimator';
import {starShowerDefaultConfig} from '../../Animation/StarShowerAnimator';
import {CHANGE_EVENT} from '../controlpanelfuncs';
import AnimCP from './AnimCP';
import VoxelConstants from '../../VoxelConstants';

class StarShowerAnimCP extends AnimCP {
  constructor(masterCP) {
    super(masterCP, {...starShowerDefaultConfig});
  }

  animatorType() { return VoxelAnimator.VOXEL_ANIM_TYPE_STAR_SHOWER; }

  buildFolder() {
    const folder = this.masterCP.pane.addFolder({title: "Star Shower Controls"});

    this.addControl(folder, 'colourMin', {label: "Min Colour"});
    this.addControl(folder, 'colourMax', {label: "Max Colour"});
    this.addControl(folder, 'spawnRate', {label: "Spawn Rate", min: 1, max:100, step: 1});
    this.addControl(folder, 'speedMin', {label: "Min Speed", min:1, max:25, step:0.5});
    this.addControl(folder, 'speedMax', {label: "Max Speed", min:1, max:25, step:0.5});
    
    const self = this;
    // Setup the direction control
    {
      const directionStrs = VoxelConstants.ORTHO_DIR_STRS;
      const directionVecs = VoxelConstants.ORTHO_DIR_VEC3S;
      const dirOptions = directionStrs.map(str => {
        return {text: str, value: str};
      });
      
      const onChangeDir = ev => {
        const idx = directionStrs.indexOf(ev.value);
        self.config.direction = {x: directionVecs[idx].x, y: directionVecs[idx].y, z:directionVecs[idx].z};
        self.masterCP.controllerClient.sendAnimatorChangeCommand(self.animatorType(), self.config);
      };

      // Find the index of the initial value for the direction...
      const {direction} = this.settings;
      const isDir = (el) => (el.x === direction.x && el.y === direction.y && el.z === direction.z);
      const initialDirIdx = directionVecs.findIndex(isDir);
      const initialDirStr = directionStrs[initialDirIdx];

      const blade = folder.addBlade({view: 'list', label: "Direction", options: dirOptions, value: ''}).on(CHANGE_EVENT, onChangeDir);
      blade.value = initialDirStr;
    }

    this.addControl(folder, 'directionVariance', {label: "Direction Variance (Radians)", min:0, max:Math.PI, step:Math.PI/16});

    const positionCompMax = 2*this.masterCP.gridSize;
    const posCompConstraints = { min:-positionCompMax, max:positionCompMax, step:1 };
    this.addControl(folder, 'minSpawnPos', {
      label: "Min Spawn Posiition", x: {...posCompConstraints}, y: {...posCompConstraints}, z: {...posCompConstraints}
    });
    this.addControl(folder, 'maxSpawnPos', {
      label: "Max Spawn Position", x: {...posCompConstraints}, y: {...posCompConstraints}, z: {...posCompConstraints}
    });

    this.masterCP.buildResetButton(folder);
    return folder;
  }
}

export default StarShowerAnimCP;