import 'regenerator-runtime/runtime';
import * as Rete from 'rete';
import ConnectionPlugin from 'rete-connection-plugin';
import ContextMenuPlugin from 'rete-context-menu-plugin';
import ReactRenderPlugin from 'rete-react-render-plugin';

import {initSockets} from './SocketDefinitions';

import NumberComponent from './NumberComponent.jsx';
import Vector3Component from './Vector3Component.jsx';
import DrawBoxComponent from './DrawBoxComponent.jsx';


const APP_STR = "omnivox_designer";
const VERSION_STR = "0.0.1";
const APP_VERSION_STR = APP_STR + "@" + VERSION_STR;

initSockets();

const container = document.querySelector('#designerId');
const editor = new Rete.NodeEditor(APP_VERSION_STR, container);

editor.use(ConnectionPlugin);
editor.use(ReactRenderPlugin);
editor.use(ContextMenuPlugin, {
  rename(component) {
    return component.contextMenuName || component.name;
  }
});

const numberComponent = new NumberComponent();
const vector3Component = new Vector3Component();
const drawBoxComponent = new DrawBoxComponent();

editor.register(numberComponent);
editor.register(vector3Component);
editor.register(drawBoxComponent);

const engine = new Rete.Engine(APP_VERSION_STR);
engine.register(numberComponent);
engine.register(vector3Component);
engine.register(drawBoxComponent);

editor.on('process nodecreated noderemoved connectioncreated connectionremoved', async () => {
  await engine.abort();
  await engine.process(editor.toJSON());
});
