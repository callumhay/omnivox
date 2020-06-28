import {shadowSceneDefaultOptions} from '../VoxelTracer/Scenes/SceneDefaultConfigs';

export const SCENE_TYPE_SIMPLE  = "Simple";
export const SCENE_TYPE_SHADOW  = "Shadow (Basic)";
export const SCENE_TYPE_FOG     = "Fog";

export const SCENE_TYPES = [
  SCENE_TYPE_SIMPLE,
  SCENE_TYPE_SHADOW,
  SCENE_TYPE_FOG,
];

export const sceneAnimatorDefaultConfig = {
  sceneType: SCENE_TYPE_SHADOW,
  sceneOptions: {...shadowSceneDefaultOptions},
};