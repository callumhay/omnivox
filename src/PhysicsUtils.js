import * as CANNON from 'cannon-es';

class PhysicsUtils {

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

    wallYNegBody.addShape(wallYNegShape);
    wallYNegBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    wallYNegBody.position.set(0,0,0);

    wallYPosBody.addShape(wallYPosShape);
    wallYPosBody.quaternion.setFromEuler(Math.PI / 2, 0, 0);
    wallYPosBody.position.set(0,cubeSize,0);

    wallXNegBody.addShape(wallXNegShape);
    wallXNegBody.quaternion.setFromEuler(0, Math.PI / 2, 0);
    wallXNegBody.position.set(0,0,0);

    wallXPosBody.addShape(wallXPosShape);
    wallXPosBody.quaternion.setFromEuler(0, -Math.PI / 2, 0);
    wallXPosBody.position.set(cubeSize,0,0);

    wallZNegBody.addShape(wallZNegShape);
    wallZNegBody.quaternion.setFromEuler(0,0,0);
    wallZNegBody.position.set(0,0,0);

    wallZPosBody.addShape(wallZPosShape);
    wallZPosBody.quaternion.setFromEuler(0, Math.PI, 0);
    wallZPosBody.position.set(0,0,cubeSize);

    return [
      wallXNegBody, wallXPosBody,
      wallYNegBody, wallYPosBody,
      wallZNegBody, wallZPosBody,
    ];
  }

}

export default PhysicsUtils;