const NUM_BUFFERS = 10;

class Fluid {
  constructor(gridSize) {
    this.N = gridSize;
    this.SIZE = Math.pow(this.N+2,3);

    // Initialize the array of buffers
    this.buffers = [];
    for (let i = 0; i < NUM_BUFFERS; i++) {
      this.buffers.push(new Array(this.SIZE).fill(0));
    }

    // Source buffers for density and velocities
    this.sd = new Array(this.SIZE).fill(0);
    this.su = new Array(this.SIZE).fill(0);
    this.sv = new Array(this.SIZE).fill(0);
    this.sw = new Array(this.SIZE).fill(0);
    this.sT = new Array(this.SIZE).fill(0);

    this.diffusion = 0;
    this.viscosity = 0;
    this.cooling   = 0;
    this.buoyancy  = 0;
    this.vc_eps    = 0;

    this.d = this.buffers[0]; this.d0 = this.buffers[1]; // density
    this.T = this.buffers[2]; this.T0 = this.buffers[3]; // temperature
    this.u = this.buffers[4]; this.u0 = this.buffers[5]; // velocity in the x direction
    this.v = this.buffers[6]; this.v0 = this.buffers[7]; // velocity in the y direction
    this.w = this.buffers[8]; this.w0 = this.buffers[9]; // velocity in the z direction

    for (let i = 0; i < this.SIZE; i++) {
      this.v[i] = 0.5; // fire goes up!
    }
  }

  _I(x,y,z) {
    return z*Math.pow(this.N+2,2) + y*(this.N+2) + x;
  }

  //set_bnd(b, x) {}

  addSource(srcBuffer, dstBuffer, dt) {
    for (let i = 0; i < this.SIZE; i++) {
      dstBuffer[i] += srcBuffer[i] * dt;
    }
  }

  addBuoyancy(dt) {
    for (let i = 0; i < this.SIZE; i++) {
      this.v[i] += this.T[i] * this.buoyancy * dt;
    }
  }

  diffuse(x0, x, diff, dt) {
    let a = dt * diff * this.N * this.N * this.N;
    for (let l = 0; l < 20; l++) {
      for (let k = 1; k <= this.N; k++) {
        for (let j = 1; j <= this.N; j++) {
          for (let i = 1; i <= this.N; i++) {
            x[this._I(i,j,k)] = (x0[this._I(i,j,k)] + a*(
              x[this._I(i-1,j,k)] + x[this._I(i+1,j,k)] +
              x[this._I(i,j-1,k)] + x[this._I(i,j+1,k)] +
              x[this._I(i,j,k-1)] + x[this._I(i,j,k+1)]
            )) / (1+6*a);
          }
        }
      }
    }
  }

  advect(b, x0, x, uu, vv, ww, dt) {
    const dt0 = dt*this.N;
    for (let k = 1; k <= this.N; k++) {
      for (let j = 1; j <= this.N; j++) {
        for (let i = 1; i <= this.N; i++) {
          let xx = i-dt0*uu[this._I(i,j,k)];
          let yy = j-dt0*vv[this._I(i,j,k)];
          let zz = k-dt0*ww[this._I(i,j,k)];

          if (xx < 0.5) { xx = 0.5; } if (xx > this.N+0.5) { xx = this.N + 0.5; } let i0 = parseInt(xx); let i1 = i0 + 1;
          if (yy < 0.5) { yy = 0.5; } if (yy > this.N+0.5) { yy = this.N + 0.5; } let j0 = parseInt(yy); let j1 = j0 + 1;
          if (zz < 0.5) { zz = 0.5; } if (zz > this.N+0.5) { zz = this.N + 0.5; } let k0 = parseInt(zz); let k1 = k0 + 1;

          let sx1 = xx-i0; let sx0 = 1-sx1;
          let sy1 = yy-j0; let sy0 = 1-sy1;
          let sz1 = zz-k0; let sz0 = 1-sz1;

          let v0 = sx0*(sy0*x0[this._I(i0,j0,k0)] + sy1*x0[this._I(i0,j1,k0)]) + sx1*(sy0*x0[this._I(i1,j0,k0)]+sy1*x0[this._I(i1,j1,k0)]);
          let v1 = sx0*(sy0*x0[this._I(i0,j0,k1)] + sy1*x0[this._I(i0,j1,k1)]) + sx1*(sy0*x0[this._I(i1,j0,k1)]+sy1*x0[this._I(i1,j1,k1)]);
          x[this._I(i,j,k)] = sz0*v0 + sz1*v1;
        }
      }
    }
    //this.set_bnd(b, this.d);
  }

  advectCool(b, x0, x, y0, y, uu, vv, ww, dt) {
    const dt0 = dt*this.N;
    const c0 = 1.0 - this.cooling*dt;

    for (let k = 1; k <= this.N; k++) {
      for (let j = 1; j <= this.N; j++) {
        for (let i = 1; i <= this.N; i++) {
          let xx = i-dt0*uu[this._I(i,j,k)];
          let yy = j-dt0*vv[this._I(i,j,k)];
          let zz = k-dt0*ww[this._I(i,j,k)];

          if (xx < 0.5) { xx = 0.5; } if (xx > this.N+0.5) { xx = this.N + 0.5; } let i0 = parseInt(xx); let i1 = i0 + 1;
          if (yy < 0.5) { yy = 0.5; } if (yy > this.N+0.5) { yy = this.N + 0.5; } let j0 = parseInt(yy); let j1 = j0 + 1;
          if (zz < 0.5) { zz = 0.5; } if (zz > this.N+0.5) { zz = this.N + 0.5; } let k0 = parseInt(zz); let k1 = k0 + 1;

          let sx1 = xx-i0; let sx0 = 1-sx1;
          let sy1 = yy-j0; let sy0 = 1-sy1;
          let sz1 = zz-k0; let sz0 = 1-sz1;

          let v0 = sx0*(sy0*x0[this._I(i0,j0,k0)] + sy1*x0[this._I(i0,j1,k0)]) + sx1*(sy0*x0[this._I(i1,j0,k0)]+sy1*x0[this._I(i1,j1,k0)]);
          let v1 = sx0*(sy0*x0[this._I(i0,j0,k1)] + sy1*x0[this._I(i0,j1,k1)]) + sx1*(sy0*x0[this._I(i1,j0,k1)]+sy1*x0[this._I(i1,j1,k1)]);
          x[this._I(i,j,k)] = sz0*v0 + sz1*v1;

          v0 = sx0*(sy0*y0[this._I(i0,j0,k0)] + sy1*y0[this._I(i0,j1,k0)]) + sx1*(sy0*y0[this._I(i1,j0,k0)]+sy1*y0[this._I(i1,j1,k0)]);
          v1 = sx0*(sy0*y0[this._I(i0,j0,k1)] + sy1*y0[this._I(i0,j1,k1)]) + sx1*(sy0*y0[this._I(i1,j0,k1)]+sy1*y0[this._I(i1,j1,k1)]);
          y[this._I(i,j,k)] = (sz0*v0 + sz1*v1)*c0;
        }
      }
    }
  }

  project() {
    const p = this.u0;
    const div = this.v0;
    const h = 1.0/this.N;
    for (let k = 1; k <= this.N; k++) {
      for (let j = 1; j <= this.N; j++) {
        for (let i = 1; i <= this.N; i++) {
          div[this._I(i,j,k)] = -h*(
            this.u[this._I(i+1,j,k)] - this.u[this._I(i-1,j,k)] +
            this.v[this._I(i,j+1,k)] - this.v[this._I(i,j-1,k)] +
            this.w[this._I(i,j,k+1)] - this.w[this._I(i,j,k-1)])/3;
          
          p[this._I(i,j,k)] = 0;
        }
      }
    }

    for (let l = 0; l < 20; l++) {
      for (let k = 1; k <= this.N; k++) {
        for (let j = 1; j <= this.N; j++) {
          for (let i = 1; i <= this.N; i++) {
            p[this._I(i,j,k)] = (div[this._I(i,j,k)] +
              p[this._I(i-1,j,k)] + p[this._I(i+1,j,k)] +
              p[this._I(i,j-1,k)] + p[this._I(i,j+1,k)] +
              p[this._I(i,j,k-1)] + p[this._I(i,j,k+1)])/6;
          }
        }
      }
    }

    for (let k = 1; k <= this.N; k++) {
      for (let j = 1; j <= this.N; j++) {
        for (let i = 1; i <= this.N; i++) {
          this.u[this._I(i,j,k)] -= (p[this._I(i+1,j,k)] - p[this._I(i-1,j,k)])/3/h;
          this.v[this._I(i,j,k)] -= (p[this._I(i,j+1,k)] - p[this._I(i,j-1,k)])/3/h;
          this.w[this._I(i,j,k)] -= (p[this._I(i,j,k+1)] - p[this._I(i,j,k-1)])/3/h;
        }
      }
    }
  }

  vorticityConfinement(dt) {
    const curlx = this.u0;
    const curly = this.v0; 
    const curlz = this.w0;
    const curl = this.T0;
    const dt0 = dt * this.vc_eps;

    for (let k = 1; k < this.N; k++) {
      for (let j = 1; j < this.N; j++) {
        for (let i = 1; i < this.N; i++) {
          let ijk = this._I(i,j,k);

          let x = curlx[ijk] = (this.w[this._I(i,j+1,k)] - this.w[this._I(i,j-1,k)]) * 0.5 -
            (this.v[this._I(i,j,k+1)] - this.v[this._I(i,j,k-1)]) * 0.5;
          let y = curly[ijk] = (this.u[this._I(i,j,k+1)] - this.u[this._I(i,j,k-1)]) * 0.5 -
            (this.w[this._I(i+1,j,k)] - this.w[this._I(i-1,j,k)]) * 0.5;
          let z = curlz[ijk] = (this.v[this._I(i+1,j,k)] - this.v[this._I(i-1,j,k)]) * 0.5 -
            (this.u[this._I(i,j+1,k)] - this.u[this._I(i,j-1,k)]) * 0.5;

          curl[ijk] = Math.sqrt(x*x + y*y + z*z);
        }
      }
    }

    for (let k = 1; k < this.N; k++) {
      for (let j = 1; j < this.N; j++) {
        for (let i = 1; i < this.N; i++) {
          let ijk = this._I(i,j,k);

          let Nx = (curl[this._I(i+1,j,k)] - curl[this._I(i-1,j,k)]) * 0.5;
          let Ny = (curl[this._I(i,j+1,k)] - curl[this._I(i,j-1,k)]) * 0.5;
          let Nz = (curl[this._I(i,j,k+1)] - curl[this._I(i,j,k-1)]) * 0.5;
          let len1 = 1.0 / (Math.sqrt(Nx*Nx + Ny*Ny + Nz*Nz) + 0.0000001);
          Nx *= len1;
          Ny *= len1;
          Nz *= len1;

          this.u[ijk] += (Ny*curlz[ijk] - Nz*curly[ijk]) * dt0;
          this.v[ijk] += (Nz*curlx[ijk] - Nx*curlz[ijk]) * dt0;
          this.w[ijk] += (Nx*curly[ijk] - Ny*curlx[ijk]) * dt0;
        }
      }
    }
  }

  velStep(dt, diffuse = true, advect = true) {

    this.addSource(this.su, this.u, dt);
    this.addSource(this.sv, this.v, dt);
    this.addSource(this.sw, this.w, dt);
    this.addBuoyancy(dt);
    this.vorticityConfinement(dt);

    let temp = null;

    if (diffuse) {
      temp = this.u; this.u = this.u0; this.u0 = temp;
      temp = this.v; this.v = this.v0; this.v0 = temp;
      temp = this.w; this.w = this.w0; this.w0 = temp;
      this.diffuse(this.u0, this.u, this.viscosity, dt);
      this.diffuse(this.v0, this.v, this.viscosity, dt);
      this.diffuse(this.w0, this.w, this.viscosity, dt);
      this.project();
    }

    if (advect) {
      temp = this.u; this.u = this.u0; this.u0 = temp;
      temp = this.v; this.v = this.v0; this.v0 = temp;
      temp = this.w; this.w = this.w0; this.w0 = temp;
      this.advect(1, this.u0, this.u, this.u0, this.v0, this.w0, dt);
      this.advect(2, this.v0, this.v, this.u0, this.v0, this.w0, dt);
      this.advect(3, this.w0, this.w, this.u0, this.v0, this.w0, dt);
      this.project();
    }
  }

  densTempStep(dt) {
    this.addSource(this.sd, this.d, dt);
    this.addSource(this.sT, this.T, dt);
    
    let temp = null;
    temp = this.d; this.d = this.d0; this.d0 = temp;
    this.diffuse(this.d0, this.d, this.diffusion, dt);
    temp = this.d; this.d = this.d0; this.d0 = temp;
    temp = this.T; this.T = this.T0; this.T0 = temp;
    this.advectCool(0, this.d0, this.d, this.T0, this.T, this.u, this.v, this.w, dt);
  }

  step(dt) {
    this.velStep(dt);
    this.densTempStep(dt);
  }
}

export default Fluid;