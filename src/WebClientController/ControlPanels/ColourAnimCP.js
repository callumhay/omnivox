import {COLOUR_INTERPOLATION_TYPES} from '../../Spectrum';
import VoxelAnimator from '../../Animation/VoxelAnimator';
import {
  voxelColourAnimatorDefaultConfig, INTERPOLATION_TYPES, 
  VOXEL_COLOUR_SHAPE_TYPE_ALL, VOXEL_COLOUR_SHAPE_TYPE_SPHERE, VOXEL_COLOUR_SHAPE_TYPE_BOX
} from '../../Animation/VoxelColourAnimator';
import {CHANGE_EVENT} from '../controlpanelfuncs';
import AnimCP from './AnimCP';

const VOXEL_COLOUR_SHAPE_TYPES = [
  VOXEL_COLOUR_SHAPE_TYPE_ALL,
  VOXEL_COLOUR_SHAPE_TYPE_SPHERE,
  VOXEL_COLOUR_SHAPE_TYPE_BOX,
];

class ColourAnimCP extends AnimCP {
  constructor(masterCP) {
    super(masterCP, {...voxelColourAnimatorDefaultConfig});
  }

  animatorType() { return VoxelAnimator.VOXEL_ANIM_TYPE_COLOUR; }

  buildFolder() {
    const {pane} = this.masterCP;
    const folder = pane.addFolder({ title: "Colour Change Controls"});

    this.addList(folder, 'colourInterpolationType', COLOUR_INTERPOLATION_TYPES, "Colour Space");
    this.addList(folder, 'interpolationType', INTERPOLATION_TYPES, "Interpolation Type");
    this.addControl(folder, 'colourStart', {label: "Start Colour"});
    this.addControl(folder, 'colourEnd', {label: "End Colour"});
    this.addControl(folder, 'startTimeSecs', {label: "Start Time (s)", min:0.0, max:30, step:0.1});
    this.addControl(folder, 'endTimeSecs', {label: "End Time (s)", min:0.0, max:30, step:0.1});

    const self = this;

    // Build all the folders for different shape settings
    const sphereShapeFolder = folder.addFolder({title:"Sphere Properties"});
    const centerCompConstraints = { min: -self.masterCP.gridSize, max:2*self.masterCP.gridSize, step:0.5 };
    sphereShapeFolder.addInput(this.settings.sphereProperties, 'center', {
      label: "Center", x: {...centerCompConstraints}, y: {...centerCompConstraints}, z: {...centerCompConstraints}
    }).on(CHANGE_EVENT, ev => { 
      self.config.sphereProperties.center = ev.value;
      self.masterCP.controllerClient.sendAnimatorChangeCommand(self.animatorType(), self.config);
    });
    sphereShapeFolder.addInput(this.settings.sphereProperties, 'radius', {label:"Radius", min:0.5, max:self.masterCP.gridSize, step:0.5})
    .on(CHANGE_EVENT, ev => {
      self.config.sphereProperties.radius = ev.value;
      self.masterCP.controllerClient.sendAnimatorChangeCommand(self.animatorType(), self.config);
    });
    sphereShapeFolder.addInput(this.settings.sphereProperties, 'fill', {label:"Fill?"}).on(CHANGE_EVENT, ev => {
      self.config.sphereProperties.fill = ev.value;
      self.masterCP.controllerClient.sendAnimatorChangeCommand(self.animatorType(), self.config);
    });
    sphereShapeFolder.hidden = true;
    folder.remove(sphereShapeFolder);

    const boxShapeFolder = folder.addFolder({title: "Box Properties"});
    boxShapeFolder.addInput(this.settings.boxProperties, 'center', {
      label: "Center", x: {...centerCompConstraints}, y: {...centerCompConstraints}, z: {...centerCompConstraints}
    }).on(CHANGE_EVENT, ev => { 
      self.config.boxProperties.center = ev.value;
      self.masterCP.controllerClient.sendAnimatorChangeCommand(self.animatorType(), self.config);
    });
    const rotCompConstraints = {min:-180, max:180, step:10};
    boxShapeFolder.addInput(this.settings.boxProperties, 'rotation', {
      label: "Rotation (°)", x: {...rotCompConstraints}, y: {...rotCompConstraints}, z: {...rotCompConstraints}
    }).on(CHANGE_EVENT, ev => { 
      self.config.boxProperties.rotation = ev.value;
      self.masterCP.controllerClient.sendAnimatorChangeCommand(self.animatorType(), self.config);
    });
    const sizeCompConstraints = {min:0.5, max:2*self.masterCP.gridSize, step:0.5};
    boxShapeFolder.addInput(this.settings.boxProperties, 'size', {
      label: "Size", x: {...sizeCompConstraints}, y: {...sizeCompConstraints, inverted: true}, z: {...sizeCompConstraints}
    }).on(CHANGE_EVENT, ev => {
      self.config.boxProperties.size = ev.value;
      self.masterCP.controllerClient.sendAnimatorChangeCommand(self.animatorType(), self.config);
    });
    boxShapeFolder.addInput(this.settings.boxProperties, 'fill', {label: "Fill?"}).on(CHANGE_EVENT, ev => {
      self.config.boxProperties.fill = ev.value;
      self.masterCP.controllerClient.sendAnimatorChangeCommand(self.animatorType(), self.config);
    });
    boxShapeFolder.hidden = true;
    folder.remove(boxShapeFolder);
    
    const onShapeChange = ev => {
      sphereShapeFolder.hidden = true;
      boxShapeFolder.hidden = true;
      switch (ev.value) {
        case VOXEL_COLOUR_SHAPE_TYPE_SPHERE:
          sphereShapeFolder.hidden = false;
          break;
        case VOXEL_COLOUR_SHAPE_TYPE_BOX:
          boxShapeFolder.hidden = false;
          break;
        default:
          break;
      }
      self.config.shapeType = ev.value;
      self.masterCP.controllerClient.sendAnimatorChangeCommand(self.animatorType(), self.config);
    };
    this.addList(folder, 'shapeType', VOXEL_COLOUR_SHAPE_TYPES, "Shape Type", onShapeChange);
   
    // Re-add all the subfolders after the selection list widget
    folder.add(sphereShapeFolder);
    folder.add(boxShapeFolder);

    this.masterCP.buildResetButton(folder);
    return folder;
  }

}

export default ColourAnimCP;