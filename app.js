const express = require('express');
const volleyball = require('volleyball');
const path = require('path');

const app = express();

app.use(volleyball);
app.use(express.static('public'));
app.use(express.static(path.join(__dirname, 'node_modules/bootstrap/dist')));

const server = app.listen(process.env.PORT || 3000, () => {
	console.log('here on port ' + server.address().port);
});
const io = require('socket.io')(server);

app.use('*', (req, res) => {
	res.sendFile(path.join(__dirname, 'index.html'));
});

let connectedPlayers = [];

io.on('connection', socket => {
	let room;

	socket.on('joinRoom', roomName => {
		room = roomName;
		socket.join(roomName);
	});

	socket.on('gameUpdate', data => {
		if (data.id) {
			connectedPlayers = connectedPlayers.map(player => {
				return (player.id === data.id) ? data : player;
			});

			const filteredPlayers = connectedPlayers.filter(player => player.room === room);
			socket.broadcast.to(room).emit('gameUpdate', filteredPlayers);
		}
	});

	socket.on('playerConnect', data => {
		if (data.id) {
			connectedPlayers.push(data);
			const filteredPlayers = connectedPlayers.filter(player => player.room === room);

			socket.emit('gameUpdate', filteredPlayers);
			if (filteredPlayers.length === 1) {
				socket.emit('isHost');
			}

			socket.broadcast.to(room).emit('gameUpdate', filteredPlayers);
			console.log('players connected', connectedPlayers);
		}
	});

	socket.on('gameStart', () => {
		io.to(room).emit('gameStart');
	});

	socket.on('disconnect', () => {
		connectedPlayers = connectedPlayers.filter(player => player.id !== socket.id);
		socket.broadcast.to(room).emit('playerDisconnect', socket.id);
		socket.leave(room);
		console.log('players connected', connectedPlayers);
	});
});
