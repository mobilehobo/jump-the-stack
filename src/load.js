const PIXI = require('pixi.js');
PIXI.default = PIXI; // because pixi-keyboard is bad
const keyboard = require('pixi-keyboard');
const audio = require('pixi-sound');

import { app, smoothie } from './gameInit';
const loader = app.loader;
const resources = app.loader.resources;
const Sprite = PIXI.Sprite;
const keys = PIXI.keyboardManager;
const Key = PIXI.keyboard.Key;

// initialize globals
let cat;

// initialize hot keys
let jump = keys.getHotKey(Key.SHIFT);
let left = keys.getHotKey(Key.LEFT);
let right = keys.getHotKey(Key.RIGHT);

loader
	.add([
		'images/cat.png'
	])
	.on('progress', loadingBarHandler)
	.load(setup);

function loadingBarHandler(pixiLoader) {
	document.getElementById('progressBar').style.width = `${pixiLoader.progress}%`;
}

function setup() {
	cat = new Sprite(resources['images/cat.png'].texture);
	cat.position.set(500, 400);
	cat.anchor.set(0.5, 0.5);
	cat.vx = 0;
	cat.vy = 0;
	cat.scale.set(0.5, 0.5);
	cat.inAir = false;
	cat.hasDoubleJump = true;
	app.stage.addChild(cat);

	smoothie.start();
}

smoothie.update = function () {
	keys.update();
	cat.vx = 0;
	if (left.isDown) {
		cat.vx = -3;
	}
	if (right.isDown) {
		cat.vx = 3;
	}
	if (jump.isPressed && !cat.inAir) {
		cat.inAir = true;
		cat.vy = -5;
	}
	else if(jump.isPressed && cat.inAir && cat.hasDoubleJump){
		cat.vy = -3;
		cat.hasDoubleJump = false;
	}
	else if (cat.inAir) {
		cat.vy += 0.16;
	}

	cat.x += cat.vx;
	cat.y += cat.vy;
	cat.rotation += 0.01;
};
