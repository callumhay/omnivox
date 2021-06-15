import * as Rete from 'rete';
import {numberSocket} from './SocketDefinitions';

export class AddNumberComponent extends Rete.Component {
  constructor() {
    super("Add Number");
    //this.previewControl = new NumControl(this.editor, 'preview', true);
  }

  builder(node) {
      var inp1 = new Rete.Input('num0', "Number 1", numberSocket);
      var inp2 = new Rete.Input('num1', "Number 2", numberSocket);
      var out  = new Rete.Output('num',  "Result",  numberSocket);
      return node
        .addInput(inp1)
        .addInput(inp2)
        .addControl(this.previewControl)
        .addOutput(out);
  }

  worker(node, inputs, outputs) {
      var n1 = inputs['num'].length?inputs['num'][0]:node.data.num1;
      var n2 = inputs['num2'].length?inputs['num2'][0]:node.data.num2;
      var sum = n1 + n2;
      //this.previewControl.setValue(sum);
      //this.editor.nodes.find(n => n.id == node.id).controls.get('preview').setValue(sum);
      outputs['num'] = sum;
  }
}

