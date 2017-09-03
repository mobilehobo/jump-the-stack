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
let sendDataToSocket = true,
	playerWon = false,
	setupFinished = false,
	playerReady = true,
	currLevel = 0,
	textSprite,
	lastColl,
	color,
	startX,
	startY,
	player,
	collisionTiles,
	killTiles,
	goalTiles,
	markerTiles,
	message,
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
		'images/stage0text.png',
		'images/stage1text.png',
		'images/stage2text.png',
		'images/stage3text.png',
		'maps/stage1.json',
		'maps/stage2.json',
		'maps/stage3.json',
		'maps/end.json',
		'sounds/cheer.mp3',
		'sounds/jump.mp3',
		'sounds/death.mp3'
	])
	.on('progress', loadingBarHandler)
	.load(setup);

function loadingBarHandler(pixiLoader, resource) {
	if (resource.url === 'maps/stage1.json') {
		resource.tiledMap.levelName = 0;
		maps.push(resource.tiledMap);
		console.log(resource);
		getTilesFromMap();
	}
	else if (resource.url === 'maps/stage2.json') {
		resource.tiledMap.levelName = 1;
		maps.push(resource.tiledMap);
	}
	else if (resource.url === 'maps/stage3.json') {
		resource.tiledMap.levelName = 2;
		maps.push(resource.tiledMap);
	}
	else if (resource.url === 'maps/end.json') {
		resource.tiledMap.levelName = 3;
		maps.push(resource.tiledMap);
	}
	document.getElementById('progressBar').style.width = `${pixiLoader.progress}%`;
}

function getTilesFromMap() {
	if (textSprite) {
		app.stage.removeChild(textSprite);
		textSprite.destroy();
	}
	const tileMap = _.find(maps, map => map.levelName === currLevel);
	collisionTiles = _.find(tileMap.children, tiles => tiles.name === 'Collide').children;
	killTiles = _.find(tileMap.children, tiles => tiles.name === 'Ouch').children;
	goalTiles = _.find(tileMap.children, tiles => tiles.name === 'Goal').children;
	markerTiles = _.find(tileMap.children, tiles => tiles.name === 'Markers').children;
	startX = markerTiles[0].x;
	startY = markerTiles[0].y;
	currMap = tileMap;
	if (currLevel < maps.length) {
		textSprite = new Sprite(resources[`images/stage${currLevel}text.png`].texture);
		app.stage.addChildAt(textSprite, 0);
	}
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
		fill: '#ff00ff',
		stroke: '#4a1850',
		strokeThickness: 5,
		dropShadow: true,
		dropShadowColor: '#000000',
		dropShadowBlur: 4,
		dropShadowAngle: Math.PI / 4,
		dropShadowDistance: 6,
		wordWrap: true,
		wordWrapWidth: 400
	});

	var richText = new Text('Thanks again for Playing! I hope you consider me for the Software Engineer role! :D', style);
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
		currLevel++;
		app.stage.removeChild(message);
		getTilesFromMap(); // currMap gets re-assigned
		resetPlayerPosition(player);
		currMap.visible = true; // currMap changes in getTilesFromMap
		smoothie.resume();
		if (currLevel === 3) {
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

	emitterContainer = new PIXI.particles.ParticleContainer();
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

	// goal collisions
	if (bump.hit(player, goalTiles)) {
		playerWon = true;
		sendPlayerData();
		message = makeTextBox('You win! :D');
		app.stage.addChild(message);
		sound.play('sounds/cheer.mp3');
		playerWon = false;
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
			}
		});
	}
});

// get rid of disconencted players
socket.on('playerDisconnect', id => {
	app.stage.removeChild(connectedPlayers[id]);
	delete connectedPlayers[id];
});
