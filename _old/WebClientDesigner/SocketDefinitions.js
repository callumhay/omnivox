import * as Rete from 'rete';

export const numberSocket = new Rete.Socket('Number');
export const boolSocket = new Rete.Socket('Boolean');

export const vector3Socket = new Rete.Socket('Vector3');
export const eulerSocket   = new Rete.Socket('Euler');
export const colourSocket  = new Rete.Socket('Colour');

export const voxelsSocket  = new Rete.Socket('Voxels');

export const initSockets = () => {
  numberSocket.combineWith(vector3Socket);
  vector3Socket.combineWith(numberSocket);
};

