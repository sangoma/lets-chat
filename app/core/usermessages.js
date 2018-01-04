'use strict';

var _ = require('lodash'),
    mongoose = require('mongoose'),
    helpers = require('./helpers');

function UserMessageManager(options) {
    this.core = options.core;
}

// options.currentUser, options.user

UserMessageManager.prototype.onMessageCreated = function(message, user, options, cb) {
    var User = mongoose.model('User');

    User.findOne(message.owner, function(err, owner) {
        if (err) {
            console.error(err);
            return cb(err);
        }
        if (cb) {
            cb(null, message, user, owner);
        }

        this.core.emit('user-messages:new', message, user, owner, options.data);
    }.bind(this));
};

UserMessageManager.prototype.close = function(options, cb) {
    var User = mongoose.model('User');
    User.findById(options.owner, function(err, user) {
        var messageInArray = _.includes(user.openPrivateMessages, options.user.toString());

        if (messageInArray) {
          user.openPrivateMessages = _.without(user.openPrivateMessages, options.user.toString());
          user.save(function(err) {
              if (err) {
                  console.error(err);
                  return cb(err);
              }
          });
        }

    }.bind(this));
};

UserMessageManager.prototype.create = function(options, cb) {
    var UserMessage = mongoose.model('UserMessage'),
        User = mongoose.model('User');

    User.findById(options.owner, function(err, user) {
        var messageInArray = _.includes(user.openPrivateMessages, options.user.toString());
        var isFreepbxId = options.user.toString().length < 24;

        if (!messageInArray && !isFreepbxId) {
          user.openPrivateMessages.push(options.user.toString());
          user.save(function(err) {
              if (err) {
                console.error(err);
                return cb(err);
              }
          });
        }

    }.bind(this));


    User.findByIdentifier(options.user, function(err, user) {
        if (err) {
            console.error(err);
            return cb(err);
        }
        if (!user) {
            return cb('User does not exist.');
        }

        var data = {
            users: [options.owner, user._id],
            owner: options.owner,
            text: options.text
        };

        var message = new UserMessage(data);
        var messageInArray = _.includes(user.openPrivateMessages, options.owner.toString());

        if (!messageInArray) {
          user.openPrivateMessages.push(options.owner.toString());
          user.save(function(err) {
              if (err) {
                console.error(err);
                return cb(err);
              }
          });
        }

        // Test if this message is OTR
        if (data.text.match(/^\?OTR/)) {
            message._id = 'OTR';
            this.onMessageCreated(message, user, options, cb);
        } else {
            message.save(function(err) {
                if (err) {
                    console.error(err);
                    return cb(err);
                }
                this.onMessageCreated(message, user, options, cb);
            }.bind(this));
        }
    }.bind(this));
};

UserMessageManager.prototype.list = function(options, cb) {
    options = options || {};

    if (!options.user) {
        return cb(null, []);
    }

    options = helpers.sanitizeQuery(options, {
        defaults: {
            reverse: true,
            take: 500
        },
        maxTake: 5000
    });

    var UserMessage = mongoose.model('UserMessage');

    var find = UserMessage.find({
        users: { $all: [options.currentUser, options.user] }
    });

    if (options.since_id) {
        find.where('_id').gt(options.since_id);
    }

    if (options.from) {
        find.where('posted').gt(options.from);
    }

    if (options.to) {
        find.where('posted').lte(options.to);
    }

    if (options.expand) {
        var includes = options.expand.split(',');

        if (_.includes(includes, 'owner')) {
            find.populate('owner', 'id username displayName email avatar');
        }
    }

    if (options.skip) {
        find.skip(options.skip);
    }

    if (options.reverse) {
        find.sort({ 'posted': -1 });
    } else {
        find.sort({ 'posted': 1 });
    }

    find.limit(options.take)
        .exec(function(err, messages) {
            if (err) {
                console.error(err);
                return cb(err);
            }
            cb(null, messages);
        });
};

module.exports = UserMessageManager;
