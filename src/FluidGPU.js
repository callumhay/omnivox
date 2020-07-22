const DIFFUSE_PER_FRAME_LOOPS = 20; 
const PROJECT_PER_FRAME_LOOPS = 20;

class FluidGPU {

  constructor(gridSize, gpu) {
    this.N = gridSize;
    const NPLUS2 = this.N+2;

    this.diffusion = 0;
    this.viscosity = 0;
    this.cooling   = 0;
    this.buoyancy  = 0;
    this.vc_eps    = 0;

    this.gpu = gpu;

    const pipelineFuncSettings = {
      output: [NPLUS2, NPLUS2, NPLUS2],
      pipeline: true,
      constants: {
        N: this.N,
        NPLUSONEHALF: this.N + 0.5,
        ONEDIVN: 1.0/this.N,
      },
      immutable: true,
      //tactic: 'balanced',
    };
    this.gpu.addFunction(function ijkLookup() {
      return [this.thread.z, this.thread.y, this.thread.x];
    });

    const ARRAY3D_TYPE = 'Array';
    const ARRAY3D_3_TYPE = 'Array3D(3)';
    this.initBufferFunc = this.gpu.createKernel(function(value) {
      return value;
    }, {...pipelineFuncSettings, argumentTypes: {value: 'Float'}});
    this.initBuffer3Func = this.gpu.createKernel(function(x,y,z) {
      return [x, y, z];
    }, {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes: {x: 'Float', y: 'Float', z: 'Float'}});

    this.addSourceFunc = this.gpu.createKernel(function(srcBuffer, dstBuffer, dt) {
      const [i,j,k] = ijkLookup();
      return dstBuffer[i][j][k] + srcBuffer[i][j][k] * dt;
    }, {...pipelineFuncSettings, returnType: 'Float', argumentTypes: {srcBuffer: ARRAY3D_TYPE, dstBuffer: ARRAY3D_TYPE, dt: 'Float'}});

    this.addBuoyancyFunc = this.gpu.createKernel(function(T, uvw, dtBuoy) {
      const [i,j,k] = ijkLookup();
      const uvwVec = uvw[i][j][k];
      return [uvwVec[0], uvwVec[1]  + T[i][j][k] * dtBuoy, uvwVec[2]];
    }, {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes: {T: ARRAY3D_TYPE, uvw: ARRAY3D_3_TYPE, dtBuoy: 'Float'}});

    this.diffuseStepFunc = this.gpu.createKernel(function(x0, x, a) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 || i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return x[i][j][k];
      }
      return (x0[i][j][k] + a*(x[i-1][j][k] + x[i+1][j][k] + x[i][j-1][k] + x[i][j+1][k] + x[i][j][k-1] + x[i][j][k+1])) / (1+6*a);
    }, {...pipelineFuncSettings, returnType: 'Float', argumentTypes: {x0: ARRAY3D_TYPE, x: ARRAY3D_TYPE, a: 'Float'}});

    this.diffuseStep3Func = this.gpu.createKernel(function(uvw0, uvw, a) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 || i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return uvw[i][j][k];
      }
      const divisor = 1.0 + 6.0*a;
      const uvw0ijk = uvw0[i][j][k];
      const uvwiNeg = uvw[i-1][j][k];
      const uvwiPos = uvw[i+1][j][k];
      const uvwjNeg = uvw[i][j-1][k];
      const uvwjPos = uvw[i][j+1][k];
      const uvwkNeg = uvw[i][j][k-1];
      const uvwkPos = uvw[i][j][k+1];

      return [
        (uvw0ijk[0] + a*(uvwiNeg[0] + uvwiPos[0] + uvwjNeg[0] + uvwjPos[0] + uvwkNeg[0] + uvwkPos[0])) / divisor,
        (uvw0ijk[1] + a*(uvwiNeg[1] + uvwiPos[1] + uvwjNeg[1] + uvwjPos[1] + uvwkNeg[1] + uvwkPos[1])) / divisor,
        (uvw0ijk[2] + a*(uvwiNeg[2] + uvwiPos[2] + uvwjNeg[2] + uvwjPos[2] + uvwkNeg[2] + uvwkPos[2])) / divisor
      ];
    }, {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes: {uvw0: ARRAY3D_3_TYPE, uvw: ARRAY3D_3_TYPE, a: 'Float'}});
    
    this.advectCoolFunc = this.gpu.createKernel(function(x0, x, uuvvww, dt0, c0) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return x[i][j][k];
      }
      const uvwijk = uuvvww[i][j][k];
      let xx = clampValue(i-dt0*uvwijk[0], 0.5, this.constants.NPLUSONEHALF);
      let yy = clampValue(j-dt0*uvwijk[1], 0.5, this.constants.NPLUSONEHALF);
      let zz = clampValue(k-dt0*uvwijk[2], 0.5, this.constants.NPLUSONEHALF);
      let i0 = Math.floor(xx); let i1 = i0 + 1;
      let j0 = Math.floor(yy); let j1 = j0 + 1;
      let k0 = Math.floor(zz); let k1 = k0 + 1;
      let sx1 = xx-i0; let sx0 = 1-sx1;
      let sy1 = yy-j0; let sy0 = 1-sy1;
      let sz1 = zz-k0; let sz0 = 1-sz1;
      let v0 = sx0*(sy0*x0[i0][j0][k0] + sy1*x0[i0][j1][k0]) + sx1*(sy0*x0[i1][j0][k0] + sy1*x0[i1][j1][k0]);
      let v1 = sx0*(sy0*x0[i0][j0][k1] + sy1*x0[i0][j1][k1]) + sx1*(sy0*x0[i1][j0][k1] + sy1*x0[i1][j1][k1]);
      return (sz0*v0 + sz1*v1)*c0;
    }, {...pipelineFuncSettings, returnType: 'Float', argumentTypes: {x0: ARRAY3D_TYPE, x: ARRAY3D_TYPE, uuvvww: ARRAY3D_3_TYPE, dt0: 'Float', c0: 'Float'}});

    this.advectCool3Func = this.gpu.createKernel(function(uvw0, uvw, dt0) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return uvw[i][j][k];
      }
      const uvw0ijk = uvw0[i][j][k];
      const xx = clampValue(i-dt0*uvw0ijk[0], 0.5, this.constants.NPLUSONEHALF);
      const yy = clampValue(j-dt0*uvw0ijk[1], 0.5, this.constants.NPLUSONEHALF);
      const zz = clampValue(k-dt0*uvw0ijk[2], 0.5, this.constants.NPLUSONEHALF);
      const i0 = Math.floor(xx); const i1 = i0 + 1;
      const j0 = Math.floor(yy); let j1 = j0 + 1;
      const k0 = Math.floor(zz); let k1 = k0 + 1;
      const sx1 = xx-i0; const sx0 = 1-sx1;
      const sy1 = yy-j0; const sy0 = 1-sy1;
      const sz1 = zz-k0; const sz0 = 1-sz1;

      const uvw0i0j0k0 = uvw0[i0][j0][k0];
      const uvw0i0j1k0 = uvw0[i0][j1][k0];
      const uvw0i1j0k0 = uvw0[i1][j0][k0];
      const uvw0i1j1k0 = uvw0[i1][j1][k0];
      const uvw0i0j0k1 = uvw0[i0][j0][k1];
      const uvw0i0j1k1 = uvw0[i0][j1][k1];
      const uvw0i1j0k1 = uvw0[i1][j0][k1];
      const uvw0i1j1k1 = uvw0[i1][j1][k1];

      const result = [0,0,0];
      for (let i = 0; i < 3; i++) {
        let v0 = sx0*(sy0*uvw0i0j0k0[i] + sy1*uvw0i0j1k0[i]) + sx1*(sy0*uvw0i1j0k0[i] + sy1*uvw0i1j1k0[i]);
        let v1 = sx0*(sy0*uvw0i0j0k1[i] + sy1*uvw0i0j1k1[i]) + sx1*(sy0*uvw0i1j0k1[i] + sy1*uvw0i1j1k1[i]);
        result[i] = sz0*v0 + sz1*v1;
      }
      return result;
    }, {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes: {uvw0: ARRAY3D_3_TYPE, uvw: ARRAY3D_3_TYPE, dt0: 'Float'}});

    this.projectStep1Func = this.gpu.createKernel(function(uvw0, uvw) {
      const [i,j,k] = ijkLookup();
      const uvw0ijk = uvw0[i][j][k];
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return uvw0ijk;
      }
      const uvwiPos = uvw[i+1][j][k];
      const uvwiNeg = uvw[i-1][j][k];
      const uvwjPos = uvw[i][j+1][k];
      const uvwjNeg = uvw[i][j-1][k];
      const uvwkPos = uvw[i][j][k+1];
      const uvwkNeg = uvw[i][j][k-1];
      return [
        0,
        -this.constants.ONEDIVN * (uvwiPos[0] - uvwiNeg[0] + uvwjPos[1] - uvwjNeg[1] + uvwkPos[2] - uvwkNeg[2]) / 3.0,
        uvw0ijk[2]
      ];
    }, {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes: {uvw0: ARRAY3D_3_TYPE, uvw: ARRAY3D_3_TYPE}});

    this.projectStep2Func = this.gpu.createKernel(function(uvw0) {
      const [i,j,k] = ijkLookup();
      const uvw0ijk = uvw0[i][j][k];
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return uvw0ijk;
      }

      const uvw0iNeg = uvw0[i-1][j][k];
      const uvw0iPos = uvw0[i+1][j][k];
      const uvw0jNeg = uvw0[i][j-1][k];
      const uvw0jPos = uvw0[i][j+1][k];
      const uvw0kNeg = uvw0[i][j][k-1];
      const uvw0kPos = uvw0[i][j][k+1];

      return [
        (uvw0ijk[1] + uvw0iNeg[0] + uvw0iPos[0] + uvw0jNeg[0] + uvw0jPos[0] + uvw0kNeg[0] + uvw0kPos[0]) / 6.0,
        uvw0ijk[1],
        uvw0ijk[2]
      ];
    }, {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes: {uvw0: ARRAY3D_3_TYPE}});

    this.projectStep3Func = this.gpu.createKernel(function(uvw, uvw0) {
      const [i,j,k] = ijkLookup();
      const uvwijk = uvw[i][j][k];
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return uvwijk;
      }

      const uvw0iNeg = uvw0[i-1][j][k];
      const uvw0iPos = uvw0[i+1][j][k];
      const uvw0jNeg = uvw0[i][j-1][k];
      const uvw0jPos = uvw0[i][j+1][k];
      const uvw0kNeg = uvw0[i][j][k-1];
      const uvw0kPos = uvw0[i][j][k+1];

      return [
        uvwijk[0] - (uvw0iPos[0] - uvw0iNeg[0]) / 3.0 / this.constants.ONEDIVN,
        uvwijk[1] - (uvw0jPos[0] - uvw0jNeg[0]) / 3.0 / this.constants.ONEDIVN,
        uvwijk[2] - (uvw0kPos[0] - uvw0kNeg[0]) / 3.0 / this.constants.ONEDIVN
      ];
    }, {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes: {uvw: ARRAY3D_3_TYPE, uvw0: ARRAY3D_3_TYPE}});

    this.curlFunc = this.gpu.createKernel(function(curlxyz, uvw) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return curlxyz[i][j][k];
      }

      const uvwiPos = uvw[i+1][j][k];
      const uvwiNeg = uvw[i-1][j][k];
      const uvwjPos = uvw[i][j+1][k];
      const uvwjNeg = uvw[i][j-1][k];
      const uvwkPos = uvw[i][j][k+1];
      const uvwkNeg = uvw[i][j][k-1];
      
      return [
        (uvwjPos[2] - uvwjNeg[2]) * 0.5 - (uvwkPos[1] - uvwkNeg[1]) * 0.5,
        (uvwkPos[0] - uvwkNeg[0]) * 0.5 - (uvwiPos[2] - uvwiNeg[2]) * 0.5,
        (uvwiPos[1] - uvwiNeg[1]) * 0.5 - (uvwjPos[0] - uvwjNeg[0]) * 0.5
      ];
    },  {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes: {curlxyz: ARRAY3D_3_TYPE, uvw: ARRAY3D_3_TYPE}});

    this.vorticityConfinementStep1Func = this.gpu.createKernel(function(curl, curlxyz) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return curl[i][j][k];
      }
      const curlxyzijk = curlxyz[i][j][k];
      const x = curlxyzijk[0];
      const y = curlxyzijk[1];
      const z = curlxyzijk[2];
      return Math.sqrt(x*x + y*y + z*z);
    }, {...pipelineFuncSettings, returnType: 'Float', argumentTypes: {curl: ARRAY3D_TYPE, curlxyz: ARRAY3D_3_TYPE}});
  
    this.vorticityConfinementStep2Func = this.gpu.createKernel(function(curl) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return [0,0,0];
      }
      const Nx = (curl[i+1][j][k] - curl[i-1][j][k]) * 0.5;
      const Ny = (curl[i][j+1][k] - curl[i][j-1][k]) * 0.5;
      const Nz = (curl[i][j][k+1] - curl[i][j][k-1]) * 0.5;
      const len1 = 1.0 / (Math.sqrt(Nx*Nx + Ny*Ny + Nz*Nz) + 0.0000001);
      return [Nx*len1, Ny*len1, Nz*len1];
    },  {...pipelineFuncSettings, returnType: 'Array(3)', arguementTypes: {curl: ARRAY3D_TYPE}});

    this.vorticityConfinementStep3Func = this.gpu.createKernel(function(uvw, Nxyz, curlxyz, dt0) {
      const [i,j,k] = ijkLookup();
      const uvwVal  = uvw[i][j][k];
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return uvwVal;
      }
      const NxyzVal = Nxyz[i][j][k];
      const curlVal = curlxyz[i][j][k];
      return [
        uvwVal[0] + (NxyzVal[1]*curlVal[2] - NxyzVal[2]*curlVal[1]) * dt0,
        uvwVal[1] + (NxyzVal[2]*curlVal[0] - NxyzVal[0]*curlVal[2]) * dt0,
        uvwVal[2] + (NxyzVal[0]*curlVal[1] - NxyzVal[1]*curlVal[0]) * dt0
      ];
    }, {...pipelineFuncSettings, returnType: 'Array(3)', argumentTypes: {uvw: ARRAY3D_3_TYPE, Nxyz: ARRAY3D_3_TYPE, curlxyz: ARRAY3D_3_TYPE, dt0: 'Float'}});

    const build3dBuffer = (size) => {
      const result = new Array(size);
      for (let x = 0; x < size; x++) {
        const xArr = new Array(size);
        result[x] = xArr;
        for (let y = 0; y < size; y++) {
          const yArr = new Array(size).fill(0);
          xArr[y] = yArr;
        }
      }
      return result
    }

    // Density and temperature source buffers
    this.sd = build3dBuffer(NPLUS2);
    this.sT = build3dBuffer(NPLUS2);
    // Density and temperature result buffers
    this.d = this.initBufferFunc(0); this.d0 = this.initBufferFunc(0);
    this.T = this.initBufferFunc(0); this.T0 = this.initBufferFunc(0);
    // xyz velocity buffers
    this.uvw  = this.initBuffer3Func(0, 0.5, 0);
    this.uvw0 = this.initBuffer3Func(0, 0, 0);
  }

  addSource(srcBuffer, dstBuffer, dt) {
    const temp = dstBuffer;
    dstBuffer = this.addSourceFunc(srcBuffer, dstBuffer, dt);
    temp.delete();
    return dstBuffer;
  }

  addBuoyancy(dt) {
    const temp = this.uvw;
    this.uvw = this.addBuoyancyFunc(this.T, this.uvw, this.buoyancy*dt);
    temp.delete();
  }

  diffuse3(dt) {
    let temp = null;
    let result = this.uvw;
    const a = dt * this.viscosity * this.N * this.N * this.N;
    for (let l = 0; l < DIFFUSE_PER_FRAME_LOOPS; l++) {
      temp = result;
      result = this.diffuseStep3Func(this.uvw0, result, a);
      temp.delete();
    }
    this.uvw = result;
  }
  diffuse(x0, x, diff, dt) {
    let temp = null;
    let result = x;
    const a = dt * diff * this.N * this.N * this.N;
    for (let l = 0; l < DIFFUSE_PER_FRAME_LOOPS; l++) {
      temp = result;
      result = this.diffuseStepFunc(x0, result, a);
      temp.delete();
    }
    return result;
  }

  advect3(dt) {
    const dt0 = dt*this.N;
    let temp = this.uvw;
    this.uvw = this.advectCool3Func(this.uvw0, this.uvw, dt0);
    temp.delete();
  }

  advect(x0, x, uuvvww, dt) {
    const dt0 = dt*this.N;
    const result = this.advectCoolFunc(x0, x, uuvvww, dt0, 1);
    x.delete();
    return result;
  }
  _advectCoolX(x0, x, uuvvww, dt) {
    return this.advect(x0, x, uuvvww, dt);
  }
  _advectCoolY(y0, y, uuvvww, dt) {
    const dt0 = dt*this.N;
    const c0  = 1.0 - this.cooling*dt;
    const result = this.advectCoolFunc(y0, y, uuvvww, dt0, c0);
    y.delete();
    return result;
  }

  project() {
    let temp = this.uvw0;
    this.uvw0 = this.projectStep1Func(this.uvw0, this.uvw);
    temp.delete();

    for (let l = 0; l < PROJECT_PER_FRAME_LOOPS; l++) {
      temp = this.uvw0;
      this.uvw0 = this.projectStep2Func(this.uvw0);
      temp.delete();
    }

    temp = this.uvw;
    this.uvw = this.projectStep3Func(this.uvw, this.uvw0);
    temp.delete();
  }

  vorticityConfinement(dt) {
    let temp = this.uvw0;
    this.uvw0 = this.curlFunc(this.uvw0, this.uvw);
    temp.delete();
    
    temp = this.T0;
    this.T0 = this.vorticityConfinementStep1Func(this.T0, this.uvw0);
    temp.delete();
    
    const Nxyz = this.vorticityConfinementStep2Func(this.T0);
    const dt0 = dt * this.vc_eps;
    temp = this.uvw;
    this.uvw = this.vorticityConfinementStep3Func(this.uvw, Nxyz, this.uvw0, dt0);
    temp.delete();
    Nxyz.delete();
  }

  velStep(dt, diffuse = true, advect = true) {
    this.addBuoyancy(dt);
    this.vorticityConfinement(dt);

    let temp = null;
    if (diffuse) {
      temp = this.uvw; this.uvw = this.uvw0; this.uvw0 = temp;
      this.diffuse3(dt);
      this.project();
    }
    if (advect) {
      temp = this.uvw; this.uvw = this.uvw0; this.uvw0 = temp;
      this.advect3(dt);
      this.project();
    }
  }

  densTempStep(dt) {
    this.d = this.addSource(this.sd, this.d, dt);
    this.T = this.addSource(this.sT, this.T, dt);

    let temp = null;
    temp = this.d; this.d = this.d0; this.d0 = temp;
    this.d = this.diffuse(this.d0, this.d, this.diffusion, dt);

    temp = this.d; this.d = this.d0; this.d0 = temp;
    temp = this.T; this.T = this.T0; this.T0 = temp;
    this.d = this._advectCoolX(this.d0, this.d, this.uvw, dt);
    this.T = this._advectCoolY(this.T0, this.T, this.uvw, dt);
  }

  step(dt) {
    this.velStep(dt);
    this.densTempStep(dt);
  }

}

export default FluidGPU;