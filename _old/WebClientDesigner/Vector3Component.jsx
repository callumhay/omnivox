
import React from 'react';
import * as Rete from 'rete';
import * as THREE from 'three';

import {vector3Socket} from './SocketDefinitions';
import {TYPES_SUBMENU} from './ContextMenuDefinitions';


class Vector3ControlComponent extends React.Component {
  constructor(props) {
    super(props);
    this.state = { value: [0,0,0] };
    this.onValueChanged = this.onValueChanged.bind(this);
  }

  componentDidMount() {
    const {control, keyName} = this.props;
    const initialValue = control.getData(keyName)?.toArray() || [0,0,0];
    this.setState({ value: initialValue});
  }

  onValueChanged(idx) {
    return (event) => {
      const newIdxVal = event.target.value ? parseInt(event.target.value) : 0;
      const newVal = [...this.state.value];
      newVal[idx] = newIdxVal;
      
      this.setState({value: newVal});
      
      const {control, editor, keyName} = this.props;
      control.putData(keyName, new THREE.Vector3(newVal[0], newVal[1], newVal[2]));
      editor.trigger('process');
    };
  }

  render() {
    const {value} = this.state;
    return (
      <div>
        x: <input type="number" value={value[0].toString()} onChange={this.onValueChanged(0)}/><br />
        y: <input type="number" value={value[1].toString()} onChange={this.onValueChanged(1)}/><br />
        z: <input type="number" value={value[2].toString()} onChange={this.onValueChanged(2)}/>
      </div>
    );
  }
}

class Vector3Control extends Rete.Control {
  constructor(editor, key) {
    super(key);
    this.render = 'react';
    this.component = Vector3ControlComponent;
    this.props = { control: this, editor, keyName: key };
  }
}

const VEC3_KEY = "vec3";
const VECTOR3_COMPONENT_NAME = "Vector3";

class Vector3Component extends Rete.Component {
  constructor(){
    super(VECTOR3_COMPONENT_NAME);
    this.contextMenuName = TYPES_SUBMENU + VECTOR3_COMPONENT_NAME;
  }

  builder(node) {
    const out = new Rete.Output(VEC3_KEY, 'Vector3', vector3Socket);
    return node.addControl(new Vector3Control(this.editor, VEC3_KEY)).addOutput(out);
  }

  worker(node, inputs, outputs){
    outputs[VEC3_KEY] = node.data[VEC3_KEY] || new THREE.Vector3(0,0,0);
  }
};

export default Vector3Component;