const express = require('express');
const volleyball = require('volleyball');
const path = require('path');

const app = express();

app.use(volleyball);
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'node_modules/bootstrap/dist')));

const server = app.listen(3000, () => {
	console.log('here on port ' + server.address().port);
});
const io = require('socket.io')(server);

app.use('*', (req, res) => {
	res.sendFile('/home/david/stackathon/index.html');
});

const connectedPlayers = {};

io.on('connection', socket => {
	socket.on('gameUpdate', data => {
		if (data.id) {
			connectedPlayers[data.id] = data;
			socket.broadcast.emit('gameUpdate', connectedPlayers);
		}
	});

	socket.on('playerConnect', data => {
		if (data.id) {
			connectedPlayers[data.id] = {
				id: data.id,
				color: data.color,
				playerX: data.playerX,
				playerY: data.playerY,
				wonGame: data.wonGame
			};
			socket.emit('gameUpdate', connectedPlayers);
			socket.broadcast.emit('gameUpdate', connectedPlayers);
			console.log('players connected', connectedPlayers);
		}
	});

	socket.on('disconnect', () => {
		delete connectedPlayers[socket.id];
		socket.broadcast.emit('playerDisconnect', socket.id);
	});
});
