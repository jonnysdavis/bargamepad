# bargamepad
Use a gamepad to spectate Beyond All Reason

A typescript based application that converts gamepad input to mouse and keyboard input. this will be used to use the gamepad to spectate in the game beyond all reason. the shoulder buttons l1, l2, r1, r2, should be used for zooming in and out (mouse wheel or page up page down). dpad should be mapped to arrow keys. left analog stick controls the mouse, but if you press it in with l3 it toggles to arrow keys which you can toggle back to mouse control by pressing l3 again. right analog stick represents mouse movement while holding alt and middle click. x button should be left click. b button should be right click. make the application simple and cross platform. make it so the user can configure what each button does. have a visual of the controller with labels showing what each button is mapped too.

## Prerequisites
- Node.js installed.
- Linux: `xdotool` installed (`sudo apt install xdotool`).
- Windows: PowerShell (built-in).
- macOS: `osascript` (built-in). Note: macOS currently only supports keyboard mapping. Mouse control requires external tools.

## How to run
1. `npm install`
2. `npm start`
3. Open `http://localhost:3000` in your browser.
4. Connect a gamepad and press any button.
