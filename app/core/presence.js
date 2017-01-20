'use strict';

var Connection = require('./presence/connection'),
    Room = require('./presence/room'),
    ConnectionCollection = require('./presence/connection-collection'),
    RoomCollection = require('./presence/room-collection'),
    UserMessageCollection = require('./presence/usermessages-collection'),
    UserCollection = require('./presence/user-collection');

function PresenceManager(options) {
    this.core = options.core;
    this.system = new Room({ system: true });
    this.connections = new ConnectionCollection();
    this.rooms = new RoomCollection();
    this.users = new UserCollection({ core: this.core });
    this.usermessages = new UserMessageCollection();

    this.rooms.on('user_join', this.onJoin.bind(this));
    this.rooms.on('user_leave', this.onLeave.bind(this));

    this.usermessages.on('usermessages_join', this.onMessage.bind(this));
    this.usermessages.on('usermessages_leave', this.onClose.bind(this));

    this.connect = this.connect.bind(this);
    this.getUserCountForRoom = this.getUserCountForRoom.bind(this);
    this.getUsersForRoom = this.getUsersForRoom.bind(this);
}

PresenceManager.prototype.getUserCountForRoom = function(roomId) {
    var room = this.rooms.get(roomId);
    return room ? room.userCount : 0;
};

PresenceManager.prototype.getUsersForRoom = function(roomId) {
    var room = this.rooms.get(roomId);
    return room ? room.getUsers() : [];
};

PresenceManager.prototype.connect = function(connection) {
    this.system.addConnection(connection);
    this.core.emit('connect', connection);

    connection.user = this.users.getOrAdd(connection.user);

    connection.on('disconnect', function() {
        this.disconnect(connection);
    }.bind(this));
};

PresenceManager.prototype.disconnect = function(connection) {
    this.system.removeConnection(connection);
    this.core.emit('disconnect', connection);
    this.rooms.removeConnection(connection);
};

PresenceManager.prototype.join = function(connection, room) {
    var pRoom = this.rooms.getOrAdd(room);
    pRoom.addConnection(connection);
};

PresenceManager.prototype.leave = function(connection, roomId) {
    var room = this.rooms.get(roomId);
    if (room) {
        room.removeConnection(connection);
    }
};

PresenceManager.prototype.onJoin = function(data) {
    this.core.emit('presence:user_join', data);
};

PresenceManager.prototype.onLeave = function(data) {
    this.core.emit('presence:user_leave', data);
};

PresenceManager.prototype.onMessage = function(data) {
    this.core.emit('user-messages:new', data);
}

PresenceManager.prototype.onClose = function(data) {
    this.core.emit('user-messages:close', data);
};

PresenceManager.Connection = Connection;
module.exports = PresenceManager;
