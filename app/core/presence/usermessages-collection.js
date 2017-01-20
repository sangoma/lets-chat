'use strict';

var EventEmitter = require('events').EventEmitter,
    util = require('util'),
    _ = require('lodash'),
    User = require('./user-collection');

function UserMessageCollection() {
    EventEmitter.call(this);
    this.privChats = {};

    this.get = this.get.bind(this);
    this.getOrAdd = this.getOrAdd.bind(this);

    this.onMessage = this.onMessage.bind(this);
    this.onClose = this.onClose.bind(this);
}

util.inherits(UserMessageCollection, EventEmitter);

UserMessageCollection.prototype.get = function(userId) {
    userId = userId.toString();
    return this.privChats[userId];
};

UserMessageCollection.prototype.getOrAdd = function(user) {
    var userId = user._id.toString();
    var pUser = this.privChats[userId];
    if (!pUser) {
        pUser = this.privChats[userId] = new User({
            user: user
        });
        pUser.on('usermessages_join', this.onMessage);
        pUser.on('usermessages_leave', this.onClose);
    }
    return pUser;
};

UserMessageCollection.prototype.onMessage = function(data) {
    this.emit('usermessages_join', data);
};

UserMessageCollection.prototype.onClose = function(data) {
    this.emit('usermessages_leave', data);
};

module.exports = UserMessageCollection;
