const PER_FRAME_LOOPS = 20; 

class FluidGPU {

  constructor(gridSize, gpu) {
    this.N = gridSize;
    const NPLUS2 = this.N+2;
    this.SIZE = Math.pow(NPLUS2,3);

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
        SIZE: this.SIZE,
        NPLUSONEHALF: this.N + 0.5,
        ONEDIVN: 1.0/this.N,
      },
      returnType: 'Float',
      immutable: true,
    };
    this.gpu.addFunction(function ijkLookup() {
      return [this.thread.z, this.thread.y, this.thread.x];
      //return [this.thread.x, this.thread.y, this.thread.z];
    });

    const ARRAY3D_TYPE = 'Array';

    this.initBufferFunc = this.gpu.createKernel(function(value) {
      return value;
    }, {...pipelineFuncSettings, argumentTypes: {value: 'Float'}});

    this.addSourceFunc = this.gpu.createKernel(function(srcBuffer, dstBuffer, dt) {
      const i = this.thread.z;
      const j = this.thread.y;
      const k = this.thread.x;
      return dstBuffer[i][j][k] + srcBuffer[i][j][k] * dt;
    }, {...pipelineFuncSettings, argumentTypes: {srcBuffer: ARRAY3D_TYPE, dstBuffer: ARRAY3D_TYPE, dt: 'Float'}});

    this.addBuoyancyFunc = this.gpu.createKernel(function(TBuffer, vBuffer, dtBuoy) {
      const i = this.thread.z;
      const j = this.thread.y;
      const k = this.thread.x;
      return vBuffer[i][j][k]  + TBuffer[i][j][k] * dtBuoy;
    }, {...pipelineFuncSettings, argumentTypes: {TBuffer: ARRAY3D_TYPE, vBuffer: ARRAY3D_TYPE, dtBuoy: 'Float'}});

    
    this.diffuseStepFunc = this.gpu.createKernel(function(x0, x, a) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 || i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return x[i][j][k];
      }
      return (x0[i][j][k] + a*(x[i-1][j][k] + x[i+1][j][k] + x[i][j-1][k] + x[i][j+1][k] + x[i][j][k-1] + x[i][j][k+1])) / (1+6*a);
    }, {...pipelineFuncSettings, argumentTypes: {x0: ARRAY3D_TYPE, x: ARRAY3D_TYPE, a: 'Float'}});
    
    this.advectCoolFunc = this.gpu.createKernel(function(x0, x, uu, vv, ww, dt0, c0) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return x[i][j][k];
      }
      let xx = clampValue(i-dt0*uu[i][j][k], 0.5, this.constants.NPLUSONEHALF);
      let yy = clampValue(j-dt0*vv[i][j][k], 0.5, this.constants.NPLUSONEHALF);
      let zz = clampValue(k-dt0*ww[i][j][k], 0.5, this.constants.NPLUSONEHALF);
      let i0 = Math.floor(xx); let i1 = i0 + 1;
      let j0 = Math.floor(yy); let j1 = j0 + 1;
      let k0 = Math.floor(zz); let k1 = k0 + 1;
      let sx1 = xx-i0; let sx0 = 1-sx1;
      let sy1 = yy-j0; let sy0 = 1-sy1;
      let sz1 = zz-k0; let sz0 = 1-sz1;
      let v0 = sx0*(sy0*x0[i0][j0][k0] + sy1*x0[i0][j1][k0]) + sx1*(sy0*x0[i1][j0][k0] + sy1*x0[i1][j1][k0]);
      let v1 = sx0*(sy0*x0[i0][j0][k1] + sy1*x0[i0][j1][k1]) + sx1*(sy0*x0[i1][j0][k1] + sy1*x0[i1][j1][k1]);
      return (sz0*v0 + sz1*v1)*c0;
    }, {...pipelineFuncSettings, argumentTypes: {x0: ARRAY3D_TYPE, x: ARRAY3D_TYPE, uu: ARRAY3D_TYPE, vv: ARRAY3D_TYPE, ww: ARRAY3D_TYPE, dt0: 'Float', c0: 'Float'}});

    this.projectStep1Func = this.gpu.createKernel(function(div, u, v, w) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return div[i][j][k];
      }
      return -this.constants.ONEDIVN * (u[i+1][j][k] - u[i-1][j][k] + v[i][j+1][k] - v[i][j-1][k] + w[i][j][k+1] - w[i][j][k-1]) / 3.0;
    }, {...pipelineFuncSettings, argumentTypes: {div: ARRAY3D_TYPE, u: ARRAY3D_TYPE, v: ARRAY3D_TYPE, w: ARRAY3D_TYPE}});

    this.projectStep2Func = this.gpu.createKernel(function(p, div) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return p[i][j][k];
      }
      return (div[i][j][k] + p[i-1][j][k] + p[i+1][j][k] + p[i][j-1][k] + p[i][j+1][k] + p[i][j][k-1] + p[i][j][k+1]) / 6.0;
    }, {...pipelineFuncSettings, argumentTypes: {p: ARRAY3D_TYPE, div: ARRAY3D_TYPE}});

    this.projectStep3UFunc = this.gpu.createKernel(function(u, p) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return u[i][j][k];
      }
      return u[i][j][k] - (p[i+1][j][k] - p[i-1][j][k]) / 3.0 / this.constants.ONEDIVN;
    }, {...pipelineFuncSettings, argumentTypes: {u: ARRAY3D_TYPE, p: ARRAY3D_TYPE}});
    this.projectStep3VFunc = this.gpu.createKernel(function(v, p) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return v[i][j][k];
      }
      return v[i][j][k] - (p[i][j+1][k] - p[i][j-1][k]) / 3.0 / this.constants.ONEDIVN;
    }, {...pipelineFuncSettings, argumentTypes: {v: ARRAY3D_TYPE, p: ARRAY3D_TYPE}});
    this.projectStep3WFunc = this.gpu.createKernel(function(w, p) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return w[i][j][k];
      }
      return w[i][j][k] - (p[i][j][k+1] - p[i][j][k-1]) / 3.0 / this.constants.ONEDIVN;
    }, {...pipelineFuncSettings, argumentTypes: {w: ARRAY3D_TYPE, p: ARRAY3D_TYPE}});


    this.curlXFunc = this.gpu.createKernel(function(curlx, w, v) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return curlx[i][j][k];
      }
      return (w[i][j+1][k] - w[i][j-1][k]) * 0.5 - (v[i][j][k+1] - v[i][j][k-1]) * 0.5;
    },  {...pipelineFuncSettings, argumentTypes: {curlx: ARRAY3D_TYPE, w: ARRAY3D_TYPE, v: ARRAY3D_TYPE}});
    this.curlYFunc = this.gpu.createKernel(function(curly, u, w) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return curly[i][j][k];
      }
      return (u[i][j][k+1] - u[i][j][k-1]) * 0.5 - (w[i+1][j][k] - w[i-1][j][k]) * 0.5;
    },  {...pipelineFuncSettings, argumentTypes: {curly: ARRAY3D_TYPE, u: ARRAY3D_TYPE, w: ARRAY3D_TYPE}});
    this.curlZFunc = this.gpu.createKernel(function(curlz, v, u) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return curlz[i][j][k];
      }
      return (v[i+1][j][k] - v[i-1][j][k]) * 0.5 - (u[i][j+1][k] - u[i][j-1][k]) * 0.5;
    },  {...pipelineFuncSettings, argumentTypes: {curlz: ARRAY3D_TYPE, v: ARRAY3D_TYPE, u: ARRAY3D_TYPE}});

    this.vorticityConfinementStep1Func = this.gpu.createKernel(function(curl, curlx, curly, curlz) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return curl[i][j][k];
      }
      const x = curlx[i][j][k];
      const y = curly[i][j][k];
      const z = curlz[i][j][k];
      return Math.sqrt(x*x + y*y + z*z);
    }, {...pipelineFuncSettings, argumentTypes: {curl: ARRAY3D_TYPE, curlx: ARRAY3D_TYPE, curly: ARRAY3D_TYPE, curlz: ARRAY3D_TYPE}});
  
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
    },  {...pipelineFuncSettings, arguementTypes: {curl: ARRAY3D_TYPE}, returnType: 'Array(3)'});

    this.vorticityConfinementStep3UFunc = this.gpu.createKernel(function(u, Nxyz, curly, curlz, dt0) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return u[i][j][k];
      }
      const NxyzVal = Nxyz[i][j][k];
      return u[i][j][k] + (NxyzVal[1]*curlz[i][j][k] - NxyzVal[2]*curly[i][j][k]) * dt0;
    }, {...pipelineFuncSettings, argumentTypes: {u: ARRAY3D_TYPE, Nxyz: 'Array3D(3)', curly: ARRAY3D_TYPE, curlz: ARRAY3D_TYPE, dt0: 'Float'}});

    this.vorticityConfinementStep3VFunc = this.gpu.createKernel(function(v, Nxyz, curlx, curlz, dt0) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return v[i][j][k];
      }
      const NxyzVal = Nxyz[i][j][k];
      return v[i][j][k] + (NxyzVal[2]*curlx[i][j][k] - NxyzVal[0]*curlz[i][j][k]) * dt0;
    }, {...pipelineFuncSettings, argumentTypes: {v: ARRAY3D_TYPE, Nxyz: 'Array3D(3)', curlx: ARRAY3D_TYPE, curlz: ARRAY3D_TYPE, dt0: 'Float'}});

    this.vorticityConfinementStep3WFunc = this.gpu.createKernel(function(w, Nxyz, curlx, curly, dt0) {
      const [i,j,k] = ijkLookup();
      if (i < 1 || j < 1 || k < 1 ||  i > this.constants.N || j > this.constants.N || k > this.constants.N) {
        return w[i][j][k];
      }
      const NxyzVal = Nxyz[i][j][k];
      return w[i][j][k] + (NxyzVal[0]*curly[i][j][k]- NxyzVal[1]*curlx[i][j][k]) * dt0;
    }, {...pipelineFuncSettings, argumentTypes: {w: ARRAY3D_TYPE, Nxyz: 'Array3D(3)', curlx: ARRAY3D_TYPE, curly: ARRAY3D_TYPE, dt0: 'Float'}});


    // Source buffers for density, velocity and temp
    const build3dBuffer = () => {
      const result = new Array(NPLUS2);
      for (let x = 0; x < NPLUS2; x++) {
        const xArr = new Array(NPLUS2);
        result[x] = xArr;
        for (let y = 0; y < NPLUS2; y++) {
          const yArr = new Array(NPLUS2).fill(0);
          xArr[y] = yArr;
        }
      }
      return result
    } 
    this.sd = build3dBuffer();
    this.su = build3dBuffer();
    this.sv = build3dBuffer();
    this.sw = build3dBuffer();
    this.sT = build3dBuffer();

    this.d = this.initBufferFunc(0);   this.d0 = this.initBufferFunc(0); // density
    this.T = this.initBufferFunc(0);   this.T0 = this.initBufferFunc(0); // temperature
    this.u = this.initBufferFunc(0);   this.u0 = this.initBufferFunc(0); // velocity in the x direction
    this.v = this.initBufferFunc(0.5); this.v0 = this.initBufferFunc(0); // velocity in the y direction
    this.w = this.initBufferFunc(0);   this.w0 = this.initBufferFunc(0); // velocity in the z direction
  }

  addSource(srcBuffer, dstBuffer, dt) {
    const temp = dstBuffer;
    dstBuffer = this.addSourceFunc(srcBuffer, dstBuffer, dt);
    temp.delete();
    return dstBuffer;
  }

  addBuoyancy(dt) {
    const temp = this.v;
    this.v = this.addBuoyancyFunc(this.T, this.v, this.buoyancy*dt);
    temp.delete();
  }

  diffuse(x0, x, diff, dt) {
    let temp = x;
    let result = x;
    const a = dt * diff * this.N * this.N * this.N;
    for (let l = 1; l < PER_FRAME_LOOPS; l++) {
      temp = result;
      result = this.diffuseStepFunc(x0, result, a);
      temp.delete();
    }
    return result;
  }

  advect(x0, x, uu, vv, ww, dt) {
    const dt0 = dt*this.N;
    const result = this.advectCoolFunc(x0, x, uu, vv, ww, dt0, 1);
    x.delete();
    return result;
  }
  _advectCoolX(x0, x, uu, vv, ww, dt) {
    return this.advect(x0, x, uu, vv, ww, dt);
  }
  _advectCoolY(y0, y, uu, vv, ww, dt) {
    const dt0 = dt*this.N;
    const c0  = 1.0 - this.cooling*dt;
    const result = this.advectCoolFunc(y0, y, uu, vv, ww, dt0, c0);
    y.delete();
    return result;
  }

  project() {
    let temp = this.v0;
    this.v0 = this.projectStep1Func(this.v0, this.u, this.v, this.w);
    temp.delete();

    for (let l = 0; l < PER_FRAME_LOOPS; l++) {
      temp = this.u0;
      this.u0 = this.projectStep2Func(this.u0, this.v0);
      temp.delete();
    }

    temp = this.u;
    this.u = this.projectStep3UFunc(this.u, this.u0);
    temp.delete();
    temp = this.v;
    this.v = this.projectStep3VFunc(this.v, this.u0);
    temp.delete();
    temp = this.w;
    this.w = this.projectStep3WFunc(this.w, this.u0);
    temp.delete();
  }

  vorticityConfinement(dt) {
    let temp = this.u0;
    this.u0 = this.curlXFunc(this.u0, this.w, this.v);
    temp.delete();
    temp = this.v0;
    this.v0 = this.curlYFunc(this.v0, this.u, this.w);
    temp.delete();
    temp = this.w0;
    this.w0 = this.curlZFunc(this.w0, this.v, this.u);
    temp.delete();
    
    temp = this.T0;
    this.T0 = this.vorticityConfinementStep1Func(this.T0, this.u0, this.v0, this.w0);
    temp.delete();
    
    const Nxyz = this.vorticityConfinementStep2Func(this.T0);
    const dt0 = dt * this.vc_eps;

    temp = this.u;
    this.u = this.vorticityConfinementStep3UFunc(this.u, Nxyz, this.v0, this.w0, dt0);
    temp.delete();
    temp = this.v;
    this.v = this.vorticityConfinementStep3VFunc(this.v, Nxyz, this.u0, this.w0, dt0);
    temp.delete();
    temp = this.w;
    this.w = this.vorticityConfinementStep3WFunc(this.w, Nxyz, this.u0, this.v0, dt0);
    temp.delete();

    Nxyz.delete();
  }

  velStep(dt, diffuse = true, advect = true) {
    this.u = this.addSource(this.su, this.u, dt);
    this.v = this.addSource(this.sv, this.v, dt);
    this.w = this.addSource(this.sw, this.w, dt);
    this.addBuoyancy(dt);
    this.vorticityConfinement(dt);

    let temp = null;

    if (diffuse) {
      temp = this.u; this.u = this.u0; this.u0 = temp;
      temp = this.v; this.v = this.v0; this.v0 = temp;
      temp = this.w; this.w = this.w0; this.w0 = temp;
      this.u = this.diffuse(this.u0, this.u, this.viscosity, dt);
      this.v = this.diffuse(this.v0, this.v, this.viscosity, dt);
      this.w = this.diffuse(this.w0, this.w, this.viscosity, dt);
      this.project();
    }
    if (advect) {
      temp = this.u; this.u = this.u0; this.u0 = temp;
      temp = this.v; this.v = this.v0; this.v0 = temp;
      temp = this.w; this.w = this.w0; this.w0 = temp;
      this.u = this.advect(this.u0, this.u, this.u0, this.v0, this.w0, dt);
      this.v = this.advect(this.v0, this.v, this.u0, this.v0, this.w0, dt);
      this.w = this.advect(this.w0, this.w, this.u0, this.v0, this.w0, dt);
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
    this.d = this._advectCoolX(this.d0, this.d, this.u, this.v, this.w, dt);
    this.T = this._advectCoolY(this.T0, this.T, this.u, this.v, this.w, dt);
  }

  step(dt) {
    this.velStep(dt);
    this.densTempStep(dt);
  }

}

export default FluidGPU;