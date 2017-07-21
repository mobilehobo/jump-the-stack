/* global Bump */
const PIXI = require('pixi.js');
PIXI.default = PIXI; // because pixi-keyboard is bad
const keyboard = require('pixi-keyboard'); // eslint-disable-line no-unused-vars
const audio = require('pixi-sound');
const pixiTiled = require('pixi-tiled');  // eslint-disable-line no-unused-vars
const _ = require('lodash');

import { app, smoothie } from './gameInit';
const loader = app.loader;
const resources = app.loader.resources;
const Sprite = PIXI.Sprite;
const keys = PIXI.keyboardManager;
const Key = PIXI.keyboard.Key;
const bump = new Bump(PIXI);

const MOVE_SPEED = 3;
const GRAVITY = 0.38;
const FIRST_JUMP_SPEED = -8;
const DOUBLE_JUMP_SPEED = -6.75;

let STAGE_START_X = 300;
let STAGE_START_Y = app.renderer.view.height - 64;

// initialize globals
let cat, map, map2, collisionTiles, killTiles, goalTiles;

// initialize hot keys
let jump = keys.getHotKey(Key.SHIFT);
let left = keys.getHotKey(Key.LEFT);
let right = keys.getHotKey(Key.RIGHT);

loader
	.add([
		'images/cat.png',
		'maps/stage1.json',
		'maps/stage2.json'
	])
	.on('progress', loadingBarHandler)
	.load(setup);

function loadingBarHandler(pixiLoader, resource) {
	if (resource.url === 'maps/stage1.json') {
		map = resource.tiledMap;
		console.log(resource);
		getTilesFromMap(map);
	}
	if (resource.url === 'maps/stage2.json') {
		map2 = resource.tiledMap;
	}
	document.getElementById('progressBar').style.width = `${pixiLoader.progress}%`;
}

function getTilesFromMap(tileMap) {
	collisionTiles = _.find(tileMap.children, tiles => tiles.name === 'Collide').children;
	killTiles = _.find(tileMap.children, tiles => tiles.name === 'Ouch').children;
	goalTiles = _.find(tileMap.children, tiles => tiles.name === 'Goal').children;
}

function setCatPosition() {
	cat.position.set(STAGE_START_X, STAGE_START_Y);
	cat.vx = 0;
	cat.vy = 0;
	cat.inAir = false;
	cat.hasDoubleJump = true;
	cat.releasedJump = false;
	cat.releasedDoubleJump = false;
}

function checkKeyboard() {
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
}

function setup() {
	app.stage.addChild(map);
	app.stage.addChild(map2);
	map2.visible = false;

	cat = new Sprite(resources['images/cat.png'].texture);
	cat.scale.set(0.3, 0.3);
	cat.anchor.set(0.5, 0.5);
	setCatPosition();
	app.stage.addChild(cat);

	smoothie.start();
}

smoothie.update = function () {
	keys.update();

	bump.hit(cat, killTiles, false, false, false, () => {
		cat.position.set(STAGE_START_X, STAGE_START_Y);
	});

	cat.vx = 0;
	cat.vy += GRAVITY; // constantly fall to help out collision checks

	checkKeyboard();

	cat.x += cat.vx;
	cat.y += cat.vy;

	if (bump.hit(cat, goalTiles)) {
		console.log('gooooooal!');
		smoothie.pause();
		setTimeout(() => {
			map.visible = false;
			getTilesFromMap(map2);
			STAGE_START_X = 64;
			STAGE_START_Y = app.renderer.view.height - 64;
			setCatPosition();
			map2.visible = true;
			smoothie.resume();
		}, 3000);
	}

	bump.hit(cat, collisionTiles, true, false, false, coll => { // checks if overlapping and prevents it
		console.log(coll);
		if (coll === 'left' || coll === 'right') {
			cat.vx = 0;
		}
		else if (coll === 'bottom') {
			cat.inAir = false;
			cat.hasDoubleJump = true;
			cat.releasedJump = false;
			cat.releasedDoubleJump = false;
			cat.vy = 0;
		}
		else if (coll === 'top' && cat.vy < 0) {
			cat.vy *= -0.15;
		}
	});
};
