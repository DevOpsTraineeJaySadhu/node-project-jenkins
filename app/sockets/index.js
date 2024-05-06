const socketIO = require('socket.io');
const root = require('./root/socket');
// const tournament = require('./tournament/socket');

function Socket() {
    this.options = {
        pingInterval: 30000,
        pingTimeout: 15000,
        cookie: false,
        maxHttpBufferSize: 2048,
        serveClient: true,
        transports: ['polling', 'websocket'],
        allowUpgrades: true,
        perMessageDeflate: false,
    };
}

Socket.prototype.initialize = function (httpServer) {
    global.io = socketIO(httpServer, this.options);
    root.init();
};

module.exports = new Socket();
// emitter.on('reqCreateTournamentChannel', tournament.init.bind(tournament));
