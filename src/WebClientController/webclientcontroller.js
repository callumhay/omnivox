import ControllerClient from './ControllerClient';
import GamepadManager from './GamepadManager';

// Central communication class for the controller
const client = new ControllerClient();

// Setup gamepad controller capture
const gamepadManager = new GamepadManager(client);
gamepadManager.start();
client.start();
