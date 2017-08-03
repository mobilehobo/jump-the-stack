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
const Text = PIXI.Text;
const Graphics = PIXI.Graphics;
const keys = PIXI.keyboardManager;
const Key = PIXI.keyboard.Key;
const viewBox = app.renderer.view;

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
	playerReady = true,
	lastColl,
	startX,
	startY,
	cat,
	collisionTiles,
	killTiles,
	goalTiles,
	markerTiles,
	gateTiles,
	message,
	startText,
	startGameBox,
	readyText,
	maps = [],
	currMap;

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
		maps.push(resource.tiledMap);
		getTilesFromMap(maps[0]);
	}
	if (resource.url === 'maps/stage2.json') {
		maps.push(resource.tiledMap);
	}
	document.getElementById('progressBar').style.width = `${pixiLoader.progress}%`;
}

function getTilesFromMap() {
	const tileMap = maps[0];
	collisionTiles = _.find(tileMap.children, tiles => tiles.name === 'Collide').children;
	killTiles = _.find(tileMap.children, tiles => tiles.name === 'Ouch').children;
	goalTiles = _.find(tileMap.children, tiles => tiles.name === 'Goal').children;
	markerTiles = _.find(tileMap.children, tiles => tiles.name === 'Markers').children;
	startX = markerTiles[0].x;
	startY = markerTiles[0].y;
	gateTiles = _.find(tileMap.children, tiles => tiles.name === 'Gate').children;
	currMap = tileMap;
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

function makeStartBox() {
	startText = new Text('Start Race', {
		fontFamily: 'Arial',
		fontSize: 32,
		fill: 'black',
		align: 'center'
	});
	startText.visible = true;

	startGameBox = new Graphics();
	startGameBox.beginFill(0xFF4500);
	startGameBox.lineStyle(3, 0x000000);
	startGameBox.drawRect(0, 0, startText.width, startText.height);
	startGameBox.endFill();
	startGameBox.position.set(viewBox.width - startGameBox.width, viewBox.height - startGameBox.height);

	startGameBox.interactiveChildren = false;
	startGameBox.visible = true;

	startText.position.set(0, 0);
	startGameBox.addChild(startText);

	startGameBox.interactive = true;
	startGameBox.buttonMode = true;
	startGameBox.on('pointerdown', () => {
		startGameBox.visible = false;
		socket.emit('gameStart');
	});

	app.stage.addChild(startGameBox);
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

function changeStages() {
	smoothie.pause();
	setTimeout(() => {
		currMap.visible = false;
		app.stage.removeChild(message);
		maps.shift();
		getTilesFromMap();
		levelStarted = false;
		playerWon = false;
		resetPlayerPosition(cat);
		currMap.visible = true; // currMap changes in getTilesFromMap
		smoothie.resume();
		startCountdown();
	}, 3000);
}

function makeTextBox(text) {
	const textBox = new PIXI.Text(text, {
		fontFamily: 'Arial',
		fontSize: 32,
		fill: 'orange',
		align: 'center'
	});
	textBox.anchor.set(0.5, 0.5);
	textBox.position.set(viewBox.width / 2, viewBox.height / 2);
	return textBox;
}

function getPlayerData() {
	return {
		id: socket.id,
		color: 0xFF00FF,
		playerX: cat.x,
		playerY: cat.y,
		wonGame: playerWon,
		ready: playerReady,
		room: window.location.pathname
	};
}

function sendPlayerData() {
	socket.emit('gameUpdate', getPlayerData());
}

function startCountdown() {
	setTimeout(() => {
		levelStarted = true;
		readyText.visible = false;
	}, 3000);
}

function setup() {
	for (let i = 0; i < maps.length; i++) {
		maps[i].visible = false;
		app.stage.addChild(maps[i]);
	}
	currMap.visible = true;

	cat = new Sprite(resources['images/cat.png'].texture);
	cat.scale.set(0.3, 0.3);
	cat.anchor.set(0.5, 0.5);
	resetPlayerPosition(cat);
	app.stage.addChild(cat);

	// send out that someone connected
	socket.emit('playerConnect', getPlayerData());

	setupFinished = true;

	smoothie.start();
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
		message = makeTextBox('Better luck next time :(');
		app.stage.addChild(message);
		changeStages();
	}

	// goal collisions
	if (bump.hit(cat, goalTiles)) {
		playerWon = true;
		sendPlayerData();
		message = makeTextBox('You win! :D');
		app.stage.addChild(message);
		changeStages();
	}

	// ground collisions
	bump.hit(cat, collisionTiles, true, false, false, coll => { // checks if overlapping and prevents it
		if (coll === 'left' || coll === 'right') {
			cat.x += 1;
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
		lastColl = coll;
	});

	// prevents sending every frame
	if (sendDataToSocket >= UPDATE_INTERVAL) {
		sendPlayerData();
		sendDataToSocket = 0;
	}
};

// sockets!
socket.on('connect', () => {
	// tell our client if it's the host
	socket.emit('joinRoom', window.location.pathname);

	socket.on('isHost', () => {
		makeStartBox();
	});

	socket.on('gameStart', () => {
		startCountdown();
		readyText = makeTextBox('Ready...');
		app.stage.addChild(readyText);
	});

	// receive data about other players, only if setup is done
	socket.on('gameUpdate', data => {
		if (setupFinished) {

			// if local sprite does not exist, make it
			data.forEach(player => {
				if (!connectedPlayers[player.id] && player.id !== socket.id) {
					createPlayerSprite(player);
				}
			});

			// iterate over every player connected and update the player data on server
			data.forEach(player => {
				if (player.id !== socket.id) {
					connectedPlayers[player.id].x = player.playerX;
					connectedPlayers[player.id].y = player.playerY;
					playerLost = player.wonGame;
				}
			});
		}
	});

	// get rid of disconencted players
	socket.on('playerDisconnect', id => {
		app.stage.removeChild(connectedPlayers[id]);
		delete connectedPlayers[id];
	});
});
