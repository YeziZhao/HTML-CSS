const express = require('express');
const path = require('path');
const httpProxy = require('http-proxy');

const app = express();

// 双人通信
// app.use('/index.js', function(req, res) {
//     res.sendFile(path.join(__dirname, './twoPeople/index.js'));
// });
// app.use('/soket.js', function(req, res) {
//     res.sendFile(path.join(__dirname, './node_modules/socket.io/node_modules/socket.io-client/dist/socket.io.js'));
// });
// app.use('/', function(req, res) {
//     res.sendFile(path.join(__dirname, './twoPeople/index.html'));
// });


app.use('/index.js', function(req, res) {
    res.sendFile(path.join(__dirname, './mutiPeople/index.js'));
});
app.use('/soket.js', function(req, res) {
    res.sendFile(path.join(__dirname, './node_modules/socket.io/node_modules/socket.io-client/dist/socket.io.js'));
});
app.use('/', function(req, res) {
    res.sendFile(path.join(__dirname, './mutiPeople/index.html'));
});
app.listen(3000, function(err) {
    if (err) {
        console.log(err);
    }
    console.log('starting...');
})