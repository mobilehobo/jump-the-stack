const express = require('express');
const volleyball = require('volleyball');
const path = require('path');

const app = express();

app.use(volleyball);
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'node_modules/bootstrap/dist')));
app.use(express.static(path.join(__dirname, 'node_modules/pixi.js/dist')));

const server = app.listen(3000, () => {
	console.log('here on port ' + server.address().port);
});

app.use('/', (req, res) => {
	res.sendFile(path.join(__dirname, 'index.html'));
});
