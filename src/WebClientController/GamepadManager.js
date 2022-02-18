
import { GamepadListener } from 'gamepad.js';

class GamepadManager {
  constructor(client) {
    this.listener = new GamepadListener({
      analog: true,
      stick: {
        precision: 3,
        deadZone: 0.33,
      },
      button: {
        precision: 3,
      }
    });
    
    this.listener.on('gamepad:connected',  function (event) {
      console.log(`Gamepad ${event.detail.index} connected.`);
      client.sendGamepadStatusEvent({status: 1});
    });
    this.listener.on('gamepad:disconnected',  function (event) {
      console.log(`Gamepad ${event.detail.index} disconnected.`);
      client.sendGamepadStatusEvent({status: 0});
    });
    
    this.listener.on('gamepad:0:axis', function (event) {
      // event.detail.stick Values: 0,1: Left,Right Analog Sticks
      // event.detail.axis Values: 0,1: X,Y Axis
      // event.detail.value Values: Negative is left or up, Positive is right or down
      client.sendGamepadAxisEvent(event.detail);
      //console.log(event.detail);
    });
    this.listener.on('gamepad:0:button',  function (event) {
      // event.detail.button Values:
      // 0,1,2,3 : A,B,X,Y Buttons
      // 4,5: Left, Right Bumper
      // 6,7: Left, Right Trigger
      // 8,9: Select, Start Buttons
      // 10,11: Left, Right Analog Buttons
      // 12,13,14,15: D-PAD Up,Down,Left,Right Buttons
      // 16: XBOX Button
      client.sendGamepadButtonEvent(event.detail);
      //console.log(event.detail);
    });
  }

  start() {
    this.listener.start();
  }

}

export default GamepadManager;