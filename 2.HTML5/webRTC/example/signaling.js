let port = 8080;
let io = require('socket.io').listen(port);
io.sockets.on('connection', function(socket) {

    // 双人房间
    socket.on('message', function(message) {
        socket.broadcast.emit('message', message);
    });

    socket.on('disconnect', function() {
        socket.broadcast.emit('user disconnected');
    });

    // 多人房间
    socket.on('roomname', function(roomname) {
        socket.set('roomname', roomname);
        socket.join(roomname);
    });
    socket.on('message', function(message) {
        message.from = soket.id;
        let target = message.sendto;
        // 如果目标方指定
        if (target) {
            io.sockets.soket(target).emit('message', message);
            return;
        }
        // 为指定目标方的时候进行广播
        emitMessage('message', message);
    });
    function emitMessage(type, message) {
        let roomname;
        socket.get('roomname', function(err, _room) {
            roomname = _room;
            if (roomname) {
                soket.broadcast.to(roomname).emit(type, message);
            } else {
                soket.broadcast.emit(type, message);
            }
        })
    }
});
