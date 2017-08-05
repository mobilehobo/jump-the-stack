/* global Bump */
/* eslint id-length: 0 complexity: 0*/

const PIXI = require('pixi.js');
PIXI.default = PIXI; // because pixi-keyboard is outdated probably

// this is all middleware for PIXI
/* eslint-disable no-unused-vars */
const keyboard = require('pixi-keyboard');
const audio = require('pixi-sound');
const pixiTiled = require('pixi-tiled');
const particles = require('pixi-particles');
/* eslint-enable no-unused-vars */

const _ = require('lodash');
const io = require('socket.io-client');

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
const sound = PIXI.sound;

// load in bump collisions
const bump = new Bump(PIXI); // bump is loaded through a script in index.html

// initiailize constants
const MOVE_SPEED = 3;
const GRAVITY = 0.36;
const FIRST_JUMP_SPEED = -8;
const DOUBLE_JUMP_SPEED = -6.75;
const connectedPlayers = {};
const socket = io(window.location.origin);

// initialize globals
let levelStarted = false,
	sendDataToSocket = true,
	playerWon = false,
	playerLost = false,
	setupFinished = false,
	playerReady = true,
	lastColl,
	color,
	startX,
	startY,
	player,
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
	currMap,
	emitterContainer,
	emitter,
	elapsed;

// initialize hot keys
let jump = keys.getHotKey(Key.SHIFT);
let jump2 = keys.getHotKey(Key.SPACE);
let left = keys.getHotKey(Key.LEFT);
let right = keys.getHotKey(Key.RIGHT);

// load in assets
loader
	.add([
		'images/player.png',
		'images/particle.png',
		'maps/stage1.json',
		'maps/stage2.json',
		'maps/stage3.json',
		'maps/end.json',
		'sounds/cheer.mp3',
		'sounds/jump.mp3',
		'sounds/race.mp3',
		'sounds/death.mp3'
	])
	.on('progress', loadingBarHandler)
	.load(setup);

function loadingBarHandler(pixiLoader, resource) {
	if (resource.url === 'maps/stage1.json') {
		maps.push(resource.tiledMap);
		getTilesFromMap(maps[0]);
	}
	else if (resource.url === 'maps/stage2.json') {
		maps.push(resource.tiledMap);
	}
	else if (resource.url === 'maps/stage3.json') {
		maps.push(resource.tiledMap);
	}
	else if (resource.url === 'maps/end.json') {
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
	connectedPlayers[data.id] = new Sprite(resources['images/player.png'].texture);
	let newPlayer = connectedPlayers[data.id];
	newPlayer.anchor.set(0.5, 0.5);
	newPlayer.alpha = 0.3;
	newPlayer.tint = data.color;
	resetPlayerPosition(newPlayer);
	app.stage.addChild(newPlayer);
}

function resetPlayerPosition(playerObj) {
	playerObj.position.set(startX, startY);
	playerObj.vx = 0;
	playerObj.vy = 0;
	playerObj.inAir = true;
	playerObj.hasDoubleJump = true;
	playerObj.releasedJump = false;
	playerObj.releasedDoubleJump = false;
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
		player.vx = -MOVE_SPEED;
	}

	if (right.isDown) {
		player.vx = MOVE_SPEED;
	}

	if ((jump.isPressed || jump2.isPressed) && !player.inAir) {
		player.inAir = true;
		player.vy = FIRST_JUMP_SPEED;
		sound.play('sounds/jump.mp3');
	}
	else if ((jump.isPressed || jump2.isPressed) && player.inAir && player.hasDoubleJump) {
		player.vy = DOUBLE_JUMP_SPEED;
		player.hasDoubleJump = false;
		sound.play('sounds/jump.mp3');
	}

	if ((jump.isReleased || jump2.isReleased) && player.vy < 0 && !player.hasDoubleJump && !player.releasedDoubleJump) {
		player.vy *= 0.45;
		player.releasedDoubleJump = true;
	}

	if ((jump.isReleased || jump2.isReleased) && player.vy < 0 && !player.releasedJump) {
		player.vy *= 0.45;
		player.releasedJump = true;
	}
}

function makeEndText() {
	var style = new PIXI.TextStyle({
		fontFamily: 'Arial',
		fontSize: 36,
		fontStyle: 'italic',
		fontWeight: 'bold',
		fill: ['#ff00ff', '#00ff00'], // gradient
		stroke: '#4a1850',
		strokeThickness: 5,
		dropShadow: true,
		dropShadowColor: '#000000',
		dropShadowBlur: 4,
		dropShadowAngle: Math.PI / 4,
		dropShadowDistance: 6,
	});

	var richText = new Text('Thanks for Playing!!! :D', style);
	richText.anchor.set(0.5, 0.5);
	richText.x = viewBox.width / 2;
	richText.y = 180;

	app.stage.addChild(richText);
}

function checkPlayerCollisionsWithGound() {
	bump.hit(player, collisionTiles, true, false, false, coll => { // checks if overlapping and prevents it
		if (coll === 'left' || coll === 'right') {
			if (coll === 'left') {
				player.x += 1;
			} else {
				player.x -= 1;
			}
			if (lastColl === 'bottom') {
				if (player.vy > 0) {
					player.vy *= 0.45;
				}
				else if (player.vy === 0) {
					player.vy += GRAVITY;
				}
			}
		}
		else if (coll === 'bottom' && !(lastColl === 'left' || lastColl === 'right')) {
			player.inAir = false;
			player.hasDoubleJump = true;
			player.releasedJump = false;
			player.releasedDoubleJump = false;
			player.vy = 0;
		}
		else if (coll === 'bottom' && (lastColl === 'left' || lastColl === 'right')) {
			player.y += 2;
		}
		else if (coll === 'top' && player.vy < 0) {
			player.vy *= -0.15;
		}
		lastColl = coll;
	});
}

function changeStages() {
	smoothie.pause();
	setTimeout(() => {
		currMap.visible = false;
		app.stage.removeChild(message);
		maps.shift();
		getTilesFromMap(); // currMap gets re-assigned
		levelStarted = false;
		playerWon = false;
		resetPlayerPosition(player);
		currMap.visible = true; // currMap changes in getTilesFromMap
		smoothie.resume();
		if (maps.length > 1) {
			startCountdown();
		}
		else {
			makeEndText();
		}
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
		color: color,
		playerX: player.x,
		playerY: player.y,
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
		let goText = makeTextBox('Go!!!');
		app.stage.addChild(goText);
		setTimeout(() => {
			goText.visible = false;
		}, 1000);
		sound.play('sounds/race.mp3', { loop: true });
	}, 3000);
	readyText = makeTextBox('Ready...');
	app.stage.addChild(readyText);
}

function particleEmit() {
	emitter.emit = true;
}

function setup() {
	for (let i = 0; i < maps.length; i++) {
		maps[i].visible = false;
		app.stage.addChild(maps[i]);
	}
	currMap.visible = true;

	player = new Sprite(resources['images/player.png'].texture);
	player.anchor.set(0.5, 0.5);
	color = parseInt(document.getElementById('colorPick').value, 16);
	player.tint = color;
	resetPlayerPosition(player);
	app.stage.addChild(player);

	emitterContainer = new PIXI.ParticleContainer();
	emitterContainer.setProperties({
		scale: true,
		position: true,
		uvs: true,
		alpha: true
	});
	app.stage.addChild(emitterContainer);
	// make particle emitter
	emitter = new PIXI.particles.Emitter(
		emitterContainer,
		resources['images/particle.png'].texture,
		{
			alpha: {
				start: 0.9,
				end: 0
			},
			scale: {
				start: 0.8,
				end: 0.2
			},
			speed: {
				start: 250,
				end: 40
			},
			startRotation: {
				min: 0,
				max: 360
			},
			lifetime: {
				min: 0.4,
				max: 0.6
			},
			blendMode: 'normal',
			frequency: 0.002,
			emitterLifetime: 0.12,
			maxParticles: 150,
			pos: {
				x: 0,
				y: 0
			},
			addAtBack: false,
			spawnType: 'point'
		});
		emitter.particleConstructor = PIXI.particles.PathParticle;
	elapsed = Date.now();

	// send out that someone connected
	socket.emit('playerConnect', getPlayerData());

	setupFinished = true;

	smoothie.start();
}

smoothie.update = () => {
	color = parseInt(document.getElementById('colorPick').value, 16);
	player.tint = color;
	sendDataToSocket = !sendDataToSocket;
	emitter.updateOwnerPos(player.x, player.y);
	keys.update();

	// check spike collisions
	bump.hit(player, killTiles, false, false, false, () => {
		particleEmit();
		sound.play('sounds/death.mp3');
		resetPlayerPosition(player);
	});

	player.vx = 0;

	checkKeyboard();
	player.x += player.vx;
	player.vy += GRAVITY;
	player.y += player.vy;

	// only check for collisions on gate tiles if the level hasn't started yet
	if (!levelStarted) {
		bump.hit(player, gateTiles, true);
	}

	// If player loases the round
	if (playerLost) {
		message = makeTextBox('Better luck next time :(');
		app.stage.addChild(message);
		changeStages();
		sound.stop('sounds/race.mp3');
		playerLost = false;
	}

	// goal collisions
	if (bump.hit(player, goalTiles)) {
		playerWon = true;
		sendPlayerData();
		message = makeTextBox('You win! :D');
		sound.stop('sounds/race.mp3');
		sound.play('sounds/cheer.mp3');
		app.stage.addChild(message);
		playerWon = true;
		changeStages();
	}

	// ground collisions
	checkPlayerCollisionsWithGound();

	const containColl = bump.contain(player, {
		x: 0,
		y: 0,
		width: viewBox.width,
		height: viewBox.height
	});
	if (containColl && containColl.has('top') && player.vy < 0) {
		player.vy *= -0.15;
	}

	// prevents sending every frame
	if (sendDataToSocket) {
		sendPlayerData();
		sendDataToSocket = 0;
	}

	let now = Date.now();
	emitter.update((now - elapsed) * 0.001);
	elapsed = now;
};

// sockets!
socket.on('connect', () => {
	// tell our client if it's the host
	socket.emit('joinRoom', window.location.pathname);
});
socket.on('isHost', () => {
	makeStartBox();
});

socket.on('gameStart', () => {
	startCountdown();
});

// receive data about other players, only if setup is done
socket.on('gameUpdate', data => {
	if (setupFinished) {

		// if local sprite does not exist, make it
		data.forEach(otherPlayer => {
			if (!connectedPlayers[otherPlayer.id] && otherPlayer.id !== socket.id) {
				createPlayerSprite(otherPlayer);
			}
		});

		// iterate over every player connected and update the player data on server
		data.forEach(otherPlayer => {
			if (otherPlayer.id !== socket.id) {
				connectedPlayers[otherPlayer.id].x = otherPlayer.playerX;
				connectedPlayers[otherPlayer.id].y = otherPlayer.playerY;
				connectedPlayers[otherPlayer.id].tint = otherPlayer.color;
				playerLost = otherPlayer.wonGame;
			}
		});
	}
});

// get rid of disconencted players
socket.on('playerDisconnect', id => {
	app.stage.removeChild(connectedPlayers[id]);
	delete connectedPlayers[id];
});
