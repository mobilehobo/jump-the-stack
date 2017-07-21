/* global Bump */
/* eslint no-unused-vars: 0*/
const PIXI = require('pixi.js');
PIXI.default = PIXI; // because pixi-keyboard is bad
const keyboard = require('pixi-keyboard');
const audio = require('pixi-sound');
const pixiTiled = require('pixi-tiled');

import { app, smoothie } from './gameInit';
const loader = app.loader;
const resources = app.loader.resources;
const Sprite = PIXI.Sprite;
const keys = PIXI.keyboardManager;
const Key = PIXI.keyboard.Key;

const MOVE_SPEED = 3;
const GRAVITY = 0.39;
const FIRST_JUMP_SPEED = -8.5;
const DOUBLE_JUMP_SPEED = -7;

const bump = new Bump(PIXI);

// initialize globals
let cat, grass, map, collisionTiles;

// initialize hot keys
let jump = keys.getHotKey(Key.SHIFT);
let left = keys.getHotKey(Key.LEFT);
let right = keys.getHotKey(Key.RIGHT);

loader
	.add([
		'images/cat.png',
		'maps/stage1.json',
	])
	.on('progress', loadingBarHandler)
	.load(setup);

function loadingBarHandler(pixiLoader, resource) {
	if (resource.url === 'maps/stage1.json') {
		map = resource.tiledMap;
		collisionTiles = map.children[0].children;
	}
	document.getElementById('progressBar').style.width = `${pixiLoader.progress}%`;
}

function setup() {
	cat = new Sprite(resources['images/cat.png'].texture);
	cat.position.set(500, 400);
	cat.anchor.set(0.5, 0.5);
	cat.vx = 0;
	cat.vy = 0;
	cat.scale.set(0.4, 0.4);
	cat.inAir = true;
	cat.hasDoubleJump = true;
	cat.releasedJump = false;
	cat.releasedDoubleJump = false;
	app.stage.addChild(cat);

	app.stage.addChild(map);

	smoothie.start();
}

smoothie.update = function () {
	keys.update();
	cat.vx = 0;
	cat.vy += GRAVITY; // constantly fall to help out collision checks
	if (left.isDown) {
		cat.vx = -MOVE_SPEED;
	}

	if (right.isDown) {
		cat.vx = MOVE_SPEED;
	}

	if (jump.isPressed && !cat.inAir) {
		cat.inAir = true;
		cat.vy = FIRST_JUMP_SPEED;
	}
	else if (jump.isPressed && cat.inAir && cat.hasDoubleJump) {
		cat.vy = DOUBLE_JUMP_SPEED;
		cat.hasDoubleJump = false;
	}

	if (jump.isReleased && cat.vy < 0 && !cat.hasDoubleJump && !cat.releasedDoubleJump) {
		cat.vy *= 0.45;
		cat.releasedDoubleJump = true;
	}

	if (jump.isReleased && cat.vy < 0 && !cat.releasedJump) {
		cat.vy *= 0.45;
		cat.releasedJump = true;
	}

	cat.x += cat.vx;
	cat.y += cat.vy;

	// for (let i = 0; i < collisionTiles.length; i++) {
	// 	let coll = bump.hit(cat, collisionTiles[i], true);
	// 	console.log(coll);
	// 	if (coll === 'bottom') { // checks if overlapping and prevents it
	// 		cat.inAir = false;
	// 		cat.hasDoubleJump = true;
	// 		cat.releasedJump = false;
	// 		cat.releasedDoubleJump = false;
	// 		cat.vy = 0;
	// 	}
	// 	else if (coll === 'top') {
	// 		cat.vy *= 0.45;
	// 	}
	// 	else if (!coll) {
	// 		cat.inAir = true;
	// 	}
	// }
	let collide = bump.hit(cat, collisionTiles, true, false, true, (coll, tiles) => {
		console.log(coll);
		if (coll === 'bottom') { // checks if overlapping and prevents it
			cat.inAir = false;
			cat.hasDoubleJump = true;
			cat.releasedJump = false;
			cat.releasedDoubleJump = false;
			cat.vy = 0;
		}
		else if (coll === 'top' && cat.vy < 0) {
			cat.vy *= -0.2;
		}
	});
};
