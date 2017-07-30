/* global Bump */
/* eslint id-length: 0 */

const PIXI = require('pixi.js');
PIXI.default = PIXI; // because pixi-keyboard is bad
const keyboard = require('pixi-keyboard'); // eslint-disable-line no-unused-vars, this is middleware
const audio = require('pixi-sound');
const pixiTiled = require('pixi-tiled');  // eslint-disable-line no-unused-vars, this is middleware
const _ = require('lodash');
import io from 'socket.io-client';

import { app, smoothie } from './gameInit';

// set convenience variables
const loader = app.loader;
const resources = app.loader.resources;
const Sprite = PIXI.Sprite;
const keys = PIXI.keyboardManager;
const Key = PIXI.keyboard.Key;

// load in bump collisions
const bump = new Bump(PIXI); // bump is loaded through a script in index.html

// initiailize constants
const MOVE_SPEED = 3;
const GRAVITY = 0.38;
const FIRST_JUMP_SPEED = -8;
const DOUBLE_JUMP_SPEED = -6.75;
const UPDATE_INTERVAL = 2; // (60 / this number) times per second
const connectedPlayers = {};
const socket = io(window.location.origin);

// initialize globals
let levelStarted = false,
	sendDataToSocket = UPDATE_INTERVAL,
	playerWon = false,
	playerLost = false,
	setupFinished = false,
	startX,
	startY,
	cat,
	map,
	map2,
	collisionTiles,
	killTiles,
	goalTiles,
	markerTiles,
	gateTiles;

// initialize hot keys
let jump = keys.getHotKey(Key.SHIFT);
let left = keys.getHotKey(Key.LEFT);
let right = keys.getHotKey(Key.RIGHT);

// load in assets
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
	markerTiles = _.find(tileMap.children, tiles => tiles.name === 'Markers').children;
	startX = markerTiles[0].x;
	startY = markerTiles[0].y;
	gateTiles = _.find(tileMap.children, tiles => tiles.name === 'Gate').children;
}

function createPlayerSprite(data) {
	connectedPlayers[data.id] = new Sprite(resources['images/cat.png'].texture);
	let newPlayer = connectedPlayers[data.id];
	newPlayer.scale.set(0.3, 0.3);
	newPlayer.anchor.set(0.5, 0.5);
	newPlayer.alpha = 0.3;
	newPlayer.tint = data.color;
	resetPlayerPosition(newPlayer);
	app.stage.addChild(newPlayer);
}

function resetPlayerPosition(player) {
	player.position.set(startX, startY);
	player.vx = 0;
	player.vy = 0;
	player.inAir = false;
	player.hasDoubleJump = true;
	player.releasedJump = false;
	player.releasedDoubleJump = false;
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

function changeStages(mapFrom, mapTo) {
	smoothie.pause();
	setTimeout(() => {
		mapFrom.visible = false;
		getTilesFromMap(mapTo);
		levelStarted = false;
		playerWon = false;
		resetPlayerPosition(cat);
		mapTo.visible = true;
		smoothie.resume();
		startCountdown();
	}, 3000);
}

function getPlayerData() {
	return {
		id: socket.id,
		color: 0xFF00FF,
		playerX: cat.x,
		playerY: cat.y,
		wonGame: playerWon
	};
}

function sendPlayerData() {
	socket.emit('gameUpdate', getPlayerData());
}

function startCountdown() {
	setTimeout(() => {
		levelStarted = true;
	}, 4000);
}

function setup() {
	app.stage.addChild(map);
	app.stage.addChild(map2);
	map2.visible = false;

	cat = new Sprite(resources['images/cat.png'].texture);
	cat.scale.set(0.3, 0.3);
	cat.anchor.set(0.5, 0.5);
	resetPlayerPosition(cat);
	app.stage.addChild(cat);

	// send out that someone connected
	socket.emit('playerConnect', getPlayerData());

	setupFinished = true;

	smoothie.start();
	startCountdown();
}

smoothie.update = function () {
	sendDataToSocket++;
	keys.update();

	// check spike collisions
	bump.hit(cat, killTiles, false, false, false, () => {
		cat.position.set(startX, startY);
	});

	cat.vx = 0;
	cat.vy += GRAVITY; // constantly fall to help out collision checks

	checkKeyboard();

	cat.x += cat.vx;
	cat.y += cat.vy;

	// only check for collisions on gate tiles if the level hasn't started yet
	if (!levelStarted) {
		bump.hit(cat, gateTiles, true);
	}

	if (playerLost) {
		changeStages(map, map2);
	}

	// goal collisions
	if (bump.hit(cat, goalTiles)) {
		console.log('gooooooal!');
		playerWon = true;
		sendPlayerData();
		changeStages(map, map2);
	}

	// ground collisions
	bump.hit(cat, collisionTiles, true, false, false, coll => { // checks if overlapping and prevents it
		// console.log(coll);
		if (coll === 'left' || coll === 'right') {
			cat.x += 1;
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

	// prevents sending every frame
	if (sendDataToSocket >= UPDATE_INTERVAL) {
		sendPlayerData();
		sendDataToSocket = 0;
	}
};

// sockets!
socket.on('connect', () => {
	console.log('socket connected!');

	// get rid of disconencted players
	socket.on('playerDisconnect', id => {
		app.stage.removeChild(connectedPlayers[id]);
		delete connectedPlayers[id];
	});

	// receive data about other players, only if setup is done
	socket.on('gameUpdate', data => {
		if (setupFinished) {
			// if local sprite does not exist, make it
			for (let player in data) {
				if (!connectedPlayers[player] && player !== socket.id) {
					createPlayerSprite(data[player]);
				}
			}

			// iterate over every player connected and update the local sprites
			for (let player in data) {
				if (data.hasOwnProperty(player) && player !== socket.id) {
					console.log('play', data[player]);
					console.log('conn x', connectedPlayers[player].x);
					connectedPlayers[player].x = data[player].playerX;
					connectedPlayers[player].y = data[player].playerY;
					playerLost = data[player].playerWon;
				}
			}
			console.log('players', connectedPlayers);
		}
	});
});
