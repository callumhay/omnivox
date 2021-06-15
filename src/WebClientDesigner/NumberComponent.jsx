import React from 'react';
import * as Rete from 'rete';

import {numberSocket} from './SocketDefinitions';
import {TYPES_SUBMENU} from './ContextMenuDefinitions';

class NumberControlComponent extends React.Component {
  constructor(props) {
    super(props);

    this.state = { value: 0.0 };
    this.onValueChanged = this.onValueChanged.bind(this);
  }

  componentDidMount() {
    const {control, keyName} = this.props;
    const initialValue = control.getData(keyName) || 0;
    this.setState({ value: initialValue});
  }

  onValueChanged(event) {
    let currVal = event.target.value ? parseInt(event.target.value) : 0;
    this.setState({value: currVal});
    
    const {control, editor, keyName} = this.props;
    control.putData(keyName, currVal);
    editor.trigger('process');
  }

  render() {
    const {value} = this.state;
    return (
        <input type="number" value={value.toString()} onChange={this.onValueChanged}/>
    );
  }
}

class NumberControl extends Rete.Control {
  constructor(editor, key) {
    super(key);
    this.render = 'react';
    this.component = NumberControlComponent;
    this.props = { control: this, editor, keyName: key };
  }
}

const NUMBER_COMPONENT_NAME = "Number";

class NumberComponent extends Rete.Component {
  constructor(){
    super(NUMBER_COMPONENT_NAME);
    this.contextMenuName = TYPES_SUBMENU + NUMBER_COMPONENT_NAME;
  }

  builder(node) {
    const out = new Rete.Output('num', 'Number', numberSocket);
    node.addControl(new NumberControl(this.editor, 'num')).addOutput(out);
    node.data.num = 0;
  }

  worker(node, inputs, outputs){
    outputs['num'] = node.data.num || 0;
  }
};

export default NumberComponent;
 