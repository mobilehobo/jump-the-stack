/* global Smoothie */

const PIXI = require('pixi.js');

export let app = new PIXI.Application({
	width: 800,
	height: 608,
	antialias: true
});

let type = 'WebGL';
if (!PIXI.utils.isWebGLSupported()) {
	type = 'canvas';
}
PIXI.utils.sayHello(type);

function update(){}

export let smoothie = new Smoothie({
	engine: PIXI,
	renderer: app.renderer,
	root: app.stage,
	fps: 60,
	update: update.bind(this)
});

// The application will create a canvas element for you that you
// can then insert into the DOM.
document.body.appendChild(app.view);

let progressBarWrapper = document.createElement('div');
progressBarWrapper.id = 'progressBarWrapper';
progressBarWrapper.className = 'progress';

let bar = document.createElement('div');
bar.id = 'progressBar';
bar.className = 'progress-bar';

progressBarWrapper.appendChild(bar);
document.body.appendChild(progressBarWrapper);
