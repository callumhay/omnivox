import * as CANNON from 'cannon-es';
import VoxelConstants from './VoxelConstants';

class PhysicsUtils {

  static stepWorld(world, lastCallTime, dt) {
    const safeDt = Math.min(dt, 1/15);
    const now = Date.now() / 1000;
    if (!lastCallTime) {
      world.step(safeDt); // Last call time not saved, can't guess elapsed time. Take a simple step.
    }
    else {
      world.step(safeDt);
      world.step(safeDt, now - lastCallTime, 20);
    }
    return now;
  }

  static buildSideWalls(cubeSize, wallMaterial) {
    // Create walls (collision planes) along the edges of the voxel box
    const wallYNegShape = new CANNON.Plane();
    const wallYPosShape = new CANNON.Plane();
    const wallXNegShape = new CANNON.Plane();
    const wallXPosShape = new CANNON.Plane();
    const wallZNegShape = new CANNON.Plane();
    const wallZPosShape = new CANNON.Plane();

    const wallYNegBody = new CANNON.Body({mass: 0, material: wallMaterial});
    const wallYPosBody = new CANNON.Body({mass: 0, material: wallMaterial});
    const wallXNegBody = new CANNON.Body({mass: 0, material: wallMaterial});
    const wallXPosBody = new CANNON.Body({mass: 0, material: wallMaterial});
    const wallZNegBody = new CANNON.Body({mass: 0, material: wallMaterial});
    const wallZPosBody = new CANNON.Body({mass: 0, material: wallMaterial});

    const adjustedZero = VoxelConstants.VOXEL_HALF_UNIT_SIZE;
    const adjustedCubeSize = cubeSize-VoxelConstants.VOXEL_HALF_UNIT_SIZE;

    wallYNegBody.addShape(wallYNegShape);
    wallYNegBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    wallYNegBody.position.set(adjustedZero,adjustedZero,adjustedZero);

    wallYPosBody.addShape(wallYPosShape);
    wallYPosBody.quaternion.setFromEuler(Math.PI / 2, 0, 0);
    wallYPosBody.position.set(adjustedZero,adjustedCubeSize,adjustedZero);

    wallXNegBody.addShape(wallXNegShape);
    wallXNegBody.quaternion.setFromEuler(0, Math.PI / 2, 0);
    wallXNegBody.position.set(adjustedZero,adjustedZero,adjustedZero);

    wallXPosBody.addShape(wallXPosShape);
    wallXPosBody.quaternion.setFromEuler(0, -Math.PI / 2, 0);
    wallXPosBody.position.set(adjustedCubeSize,adjustedZero,adjustedZero);

    wallZNegBody.addShape(wallZNegShape);
    wallZNegBody.quaternion.setFromEuler(0,0,0);
    wallZNegBody.position.set(adjustedZero,adjustedZero,adjustedZero);

    wallZPosBody.addShape(wallZPosShape);
    wallZPosBody.quaternion.setFromEuler(0, Math.PI, 0);
    wallZPosBody.position.set(adjustedZero,adjustedZero,adjustedCubeSize);

    return [
      wallXNegBody, wallXPosBody,
      wallYNegBody, wallYPosBody,
      wallZNegBody, wallZPosBody,
    ];
  }

}

export default PhysicsUtils;