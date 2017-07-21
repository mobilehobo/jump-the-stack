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

app.use('/', (req, res) => {
	res.sendFile('/home/david/stackathon/index.html');
});
